// Knowledge Folder RAG Plugin for TopEng Agent Harness & DeepSeek
import { scanAndIndexFolder, getIndexedFolderData, getAllIndexedFolders } from '../utils/folderIndexer.js';
import { retrieveRelevantChunks } from '../utils/ragRetriever.js';

export const KNOWLEDGE_FOLDER_SCHEMA = [
  {
    type: "function",
    function: {
      name: "scan_and_index_folder",
      description: "Quét và lập chỉ mục toàn bộ tài liệu trong thư mục cục bộ (hỗ trợ PDF, Word DOCX, Excel XLSX, Markdown, Text, Code, JSON) để AI tra cứu.",
      parameters: {
        type: "object",
        properties: {
          folderPath: {
            type: "string",
            description: "Đường dẫn tuyệt đối hoặc tương đối tới thư mục trên máy tính cần quét (Ví dụ: 'D:/TaiLieuKyThuat', 'C:/Projects/Docs')."
          },
          forceReindex: {
            type: "boolean",
            description: "Bắt buộc quét lại toàn bộ nếu thư mục đã có chỉ mục trước đó."
          }
        },
        required: ["folderPath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_folder_knowledge",
      description: "Tra cứu và trích xuất nội dung từ các tài liệu trong thư mục đã lập chỉ mục để trả lời câu hỏi.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Câu hỏi hoặc từ khóa cần tìm kiếm trong tài liệu."
          },
          folderPath: {
            type: "string",
            description: "Đường dẫn thư mục đã nạp (để trống nếu muốn tìm trong thư mục vừa được quét gần nhất)."
          },
          topK: {
            type: "number",
            description: "Số lượng đoạn văn bản trích xuất tối đa (mặc định: 5)."
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_indexed_folder_status",
      description: "Kiểm tra danh sách các thư mục và tập tin tài liệu đã được nạp vào bộ nhớ chỉ mục AI.",
      parameters: {
        type: "object",
        properties: {
          folderPath: {
            type: "string",
            description: "Đường dẫn thư mục cụ thể cần xem chi tiết (hoặc để trống để xem tất cả)."
          }
        }
      }
    }
  }
];

export async function handleKnowledgeFolderTool(toolName, args, context) {
  try {
    const isEn = context?.language === 'en';

    // 1. Tool: scan_and_index_folder
    if (toolName === 'scan_and_index_folder') {
      const folderPath = args.folderPath;
      if (!folderPath) {
        return {
          success: false,
          reply: isEn ? '⚠️ Folder path is required.' : '⚠️ Vui lòng cung cấp đường dẫn thư mục cần quét.'
        };
      }

      const scanResult = await scanAndIndexFolder(folderPath, !!args.forceReindex);

      if (!scanResult.success) {
        return {
          success: false,
          reply: `❌ Không thể lập chỉ mục thư mục: ${scanResult.error}`
        };
      }

      const fileListStr = (scanResult.fileSummaries || [])
        .filter(f => f.status === 'success')
        .slice(0, 15)
        .map(f => `  • \`${f.fileName}\` (${f.chunksCount} đoạn ngữ cảnh)`)
        .join('\n');

      return {
        success: true,
        data: {
          folderPath: scanResult.folderPath,
          totalFiles: scanResult.totalFilesFound,
          parsedFiles: scanResult.parsedFiles,
          totalChunks: scanResult.totalChunks
        },
        reply: `📂 **Đã quét & lập chỉ mục thành công thư mục:**\n📁 \`${scanResult.folderPath}\`\n\n📊 **Tổng quan:**\n- Tổng số tập tin: **${scanResult.totalFilesFound}** (Đọc thành công: **${scanResult.parsedFiles}** file)\n- Tổng số đoạn ngữ cảnh (Chunks): **${scanResult.totalChunks}**\n\n📄 **Các tài liệu tiêu biểu đã nạp:**\n${fileListStr || '  (Không có file văn bản)'}\n\n*Bây giờ bạn có thể đặt câu hỏi, DeepSeek sẽ trả lời trực tiếp từ các tài liệu trên!*`
      };
    }

    // 2. Tool: search_folder_knowledge
    if (toolName === 'search_folder_knowledge') {
      const query = args.query;
      let folderPath = args.folderPath;

      if (!folderPath) {
        const all = getAllIndexedFolders();
        if (all.length > 0) {
          folderPath = all[0].folderPath;
        }
      }

      if (!folderPath) {
        return {
          success: false,
          reply: '⚠️ Chưa có thư mục nào được nạp dữ liệu. Vui lòng sử dụng tính năng nạp thư mục trước.'
        };
      }

      const indexData = getIndexedFolderData(folderPath);
      if (!indexData || !indexData.chunks || indexData.chunks.length === 0) {
        return {
          success: false,
          reply: `⚠️ Không tìm thấy dữ liệu chỉ mục cho thư mục: \`${folderPath}\`. Vui lòng quét thư mục trước.`
        };
      }

      const relevantChunks = retrieveRelevantChunks(query, indexData.chunks, args.topK || 5);

      if (relevantChunks.length === 0) {
        return {
          success: true,
          found: false,
          chunks: [],
          reply: 'Không tìm thấy thông tin này trong tài liệu của thư mục đã cung cấp.'
        };
      }

      return {
        success: true,
        found: true,
        count: relevantChunks.length,
        chunks: relevantChunks.map(r => ({
          fileName: r.fileName,
          filePath: r.filePath,
          chunkIndex: r.chunkIndex,
          score: r.score,
          content: r.chunk.content
        })),
        reply: `🔍 Đã tìm thấy ${relevantChunks.length} đoạn trích xuất liên quan trong thư mục tài liệu.`
      };
    }

    // 3. Tool: get_indexed_folder_status
    if (toolName === 'get_indexed_folder_status') {
      if (args.folderPath) {
        const indexData = getIndexedFolderData(args.folderPath);
        if (!indexData) {
          return {
            success: false,
            reply: `⚠️ Thư mục \`${args.folderPath}\` chưa được nạp chỉ mục.`
          };
        }
        return {
          success: true,
          data: {
            folderPath: indexData.folderPath,
            totalFiles: indexData.totalFilesFound,
            parsedFiles: indexData.parsedFiles,
            totalChunks: indexData.totalChunks,
            fileSummaries: indexData.fileSummaries
          },
          reply: `📊 Thư mục \`${indexData.folderPath}\` hiện có ${indexData.parsedFiles} file và ${indexData.totalChunks} đoạn ngữ cảnh.`
        };
      }

      const all = getAllIndexedFolders();
      if (all.length === 0) {
        return {
          success: true,
          reply: 'ℹ️ Hiện chưa có thư mục nào được nạp vào bộ nhớ tri thức.'
        };
      }

      const listStr = all.map(f => `• \`${f.folderPath}\`: ${f.parsedFiles} file, ${f.totalChunks} chunks`).join('\n');
      return {
        success: true,
        data: all,
        reply: `📂 **Danh sách các thư mục tri thức đã nạp:**\n${listStr}`
      };
    }

    return {
      success: false,
      reply: `⚠️ Không tìm thấy handler cho công cụ \`${toolName}\`.`
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      reply: `❌ Lỗi khi thực thi Knowledge Folder Plugin: ${err.message}`
    };
  }
}
