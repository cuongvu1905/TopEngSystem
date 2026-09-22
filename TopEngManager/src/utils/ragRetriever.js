const STOP_WORDS = new Set([
  'là', 'và', 'các', 'những', 'của', 'được', 'có', 'cho', 'trong', 'với',
  'khi', 'thì', 'ở', 'để', 'tại', 'về', 'này', 'đó', 'gì', 'nào', 'ai',
  'sao', 'bao', 'nhiêu', 'ra', 'vào', 'lên', 'xuống', 'lại', 'qua', 'như',
  'nhưng', 'bởi', 'vì', 'do', 'nên', 'thế', 'rồi', 'đã', 'đang', 'sẽ',
  'năm', 'tháng', 'ngày', 'giờ', 'phút', 'giây', 'đồng',
  'the', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'of', 'and', 'a', 'an', 'to', 'for', 'with', 'what', 'where', 'when', 'how'
]);

/**
 * Normalizes text and tokenizes into words/terms
 */
export function tokenize(text, filterStopWords = true) {
  if (!text || typeof text !== 'string') return [];
  const rawTokens = text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'<>\[\]\\|]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1);

  if (!filterStopWords) return rawTokens;
  const filtered = rawTokens.filter(t => !STOP_WORDS.has(t));
  return filtered.length > 0 ? filtered : rawTokens;
}

/**
 * Computes BM25 & Keyword relevance scores between query and document chunks
 */
export function retrieveRelevantChunks(query, chunks = [], topK = 5, minScore = 0.5) {
  if (!query || !chunks || chunks.length === 0) return [];

  const queryLower = query.toLowerCase().trim();
  const queryTokens = tokenize(queryLower, true);
  if (queryTokens.length === 0) return [];

  const N = chunks.length;
  // Calculate term document frequency (DF)
  const docFrequency = {};
  let totalWords = 0;

  const chunkProfiles = chunks.map(chunk => {
    const content = (chunk.content || '').toLowerCase();
    const fileName = (chunk.fileName || '').toLowerCase();
    const tokens = tokenize(content, false);
    const uniqueTokens = new Set(tokens);
    totalWords += tokens.length;

    uniqueTokens.forEach(token => {
      docFrequency[token] = (docFrequency[token] || 0) + 1;
    });

    return {
      chunk,
      content,
      fileName,
      tokens,
      docLength: tokens.length
    };
  });

  const avgDocLength = totalWords / Math.max(1, N);
  const k1 = 1.5;
  const b = 0.75;

  const scoredResults = chunkProfiles.map(profile => {
    let score = 0;
    let matchedTerms = 0;
    const termCounts = {};
    profile.tokens.forEach(t => {
      termCounts[t] = (termCounts[t] || 0) + 1;
    });

    // 1. BM25 scoring
    for (const qToken of queryTokens) {
      const tf = termCounts[qToken] || 0;
      if (tf > 0) {
        matchedTerms++;
        const df = docFrequency[qToken] || 1;
        // IDF formula
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (profile.docLength / avgDocLength));
        score += idf * (numerator / denominator);
      }
    }

    // 2. Exact phrase bonus
    const hasExactPhrase = queryLower.length > 4 && profile.content.includes(queryLower);
    if (hasExactPhrase) {
      score += 4.0;
    }

    // 3. File name matching bonus (if user asks about a specific file or topic in file name)
    for (const qToken of queryTokens) {
      if (profile.fileName.includes(qToken)) {
        score += 2.0;
        matchedTerms++;
      }
    }

    // Keyword coverage check: prevent single accidental match in multi-word query
    const matchCoverage = queryTokens.length > 0 ? (matchedTerms / queryTokens.length) : 0;
    const isRelevant = hasExactPhrase || (queryTokens.length <= 2 ? matchedTerms >= 1 : (matchedTerms >= 2 || matchCoverage >= 0.4));

    if (!isRelevant) {
      score = 0;
    }

    return {
      chunk: profile.chunk,
      score,
      fileName: profile.chunk.fileName,
      filePath: profile.chunk.filePath,
      chunkIndex: profile.chunk.chunkIndex
    };
  });

  // Filter and sort by descending score
  return scoredResults
    .filter(res => res.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Builds the Strict Zero-Hallucination System Prompt and Context for DeepSeek
 */
export function buildStrictRAGPrompt({
  query,
  retrievedChunks = [],
  folderPath = '',
  language = 'vi'
}) {
  const isEn = language === 'en';

  if (retrievedChunks.length === 0) {
    const noContextPrompt = isEn
      ? `You are an AI assistant performing Strict Local Folder Q&A.
[STRICT DIRECTIVE]
The user asked: "${query}".
No relevant documents were found in the provided folder "${folderPath}".
You MUST respond strictly: "I could not find any information regarding this in the provided folder documents."`
      : `Bạn là Trợ lý AI thực hiện Hỏi-Đáp Dữ Liệu từ Thư Mục Cục Bộ.
[CHỈ THỊ NGHIÊM NGẶT - CHỐNG BỊA ĐẶT TUYỆT ĐỐI]
Người dùng đã hỏi: "${query}".
Không tìm thấy bất kỳ tài liệu hoặc đoạn văn bản liên quan nào trong thư mục "${folderPath}".
Bạn BẮT BUỘC PHẢI trả lời chính xác: "Không tìm thấy thông tin này trong tài liệu của thư mục đã cung cấp."`;

    return {
      systemPrompt: noContextPrompt,
      contextText: '',
      hasContext: false
    };
  }

  // Format context chunks
  const contextSections = retrievedChunks.map((res, idx) => {
    const c = res.chunk;
    return `=== [TÀI LIỆU ${idx + 1}] ===\n- Tên File: ${c.fileName}\n- Đường dẫn tương đối: ${c.filePath || c.fileName}\n- Vị trí đoạn: Đoạn ${c.chunkIndex || (idx + 1)}\n- Nội dung trích xuất:\n"""\n${c.content}\n"""`;
  }).join('\n\n');

  const systemPrompt = isEn
    ? `[STRICT DIRECTIVE - ZERO HALLUCINATION LOCAL FOLDER RAG]
You are TopEng DeepSeek Local Document Analyst.
Your SOLE PURPOSE is to answer the user's questions based EXCLUSIVELY on the provided document excerpts below.

CRITICAL RULES:
1. ONLY use factual information explicitly stated in the provided DOCUMENT EXCERPTS.
2. DO NOT assume, extrapolate, or use outside training knowledge.
3. If the answer cannot be directly determined from the provided context, you MUST clearly state: "I could not find this information in the provided folder documents."
4. ALWAYS cite the source files at the end of your response, formatted as:
   **Source Reference**:
   - [File Name] (Excerpt / Section)
5. Reply in ${isEn ? 'English' : 'Vietnamese'}.`
    : `[CHỈ THỊ NGHIÊM NGẶT - ZERO HALLUCINATION LOCAL FOLDER RAG]
Bạn là Trợ lý Phân tích Tài liệu Thư mục Cục bộ của TopEng chạy trên nền tảng DeepSeek Harness.
NHIỆM VỤ DUY NHẤT của bạn là trả lời câu hỏi của người dùng dựa HOÀN TOÀN và DUY NHẤT vào các đoạn trích xuất tài liệu (Context) bên dưới.

QUY TẮC BẮT BUỘC TUÂN THỦ:
1. CHỈ sử dụng thông tin được viết rõ ràng trong các [TÀI LIỆU] được cung cấp.
2. TUYỆT ĐỐI KHÔNG tự suy diễn, phỏng đoán, hoặc dùng kiến thức bên ngoài tài liệu.
3. Nếu tài liệu được cung cấp không chứa câu trả lời hoặc không đủ thông tin, bạn BẮT BUỘC PHẢI thông báo rõ: "Không tìm thấy thông tin này trong tài liệu của thư mục đã cung cấp."
4. LUÔN LUÔN đính kèm phần Trích dẫn nguồn tài liệu ở cuối câu trả lời theo mẫu:
   📌 **Tài liệu trích dẫn**:
   - \`[Tên File]\` (Đoạn trích dẫn liên quan)
5. Luôn trả lời bằng Tiếng Việt rõ ràng, mạch lạc.`;

  return {
    systemPrompt: `${systemPrompt}\n\n=== DANH SÁCH TÀI LIỆU TRÍCH XUẤT TỪ THƯ MỤC (${folderPath}) ===\n${contextSections}\n=== HẾT DANH SÁCH TÀI LIỆU ===`,
    contextText: contextSections,
    hasContext: true,
    retrievedCount: retrievedChunks.length
  };
}
