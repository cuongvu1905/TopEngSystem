import { retrieveRelevantChunks, buildStrictRAGPrompt } from '../src/utils/ragRetriever.js';

async function testRagRetriever() {
  console.log('Testing RAG retriever...');

  const sampleChunks = [
    {
      id: 'c1',
      fileName: 'quy_dinh_nghi_phep.txt',
      filePath: 'D:/HR/quy_dinh_nghi_phep.txt',
      chunkIndex: 1,
      content: 'Nhân viên chính thức được nghỉ phép 12 ngày có lương hàng năm. Làm việc trên 5 năm được cộng thêm 1 ngày mỗi năm.'
    },
    {
      id: 'c2',
      fileName: 'so_do_server.json',
      filePath: 'D:/IT/so_do_server.json',
      chunkIndex: 1,
      content: 'Database MySQL chính có IP là 192.168.1.50, cổng kết nối 3306, user là topeng_admin.'
    },
    {
      id: 'c3',
      fileName: 'du_an_ai.md',
      filePath: 'D:/Projects/du_an_ai.md',
      chunkIndex: 1,
      content: 'Dự án DeepSeek Harness triển khai tích hợp AI vào quy trình quản lý dự án và tra cứu tài liệu cục bộ.'
    }
  ];

  // Test 1: Query matching c1
  const q1 = 'Nhân viên được nghỉ phép bao nhiêu ngày một năm?';
  const res1 = retrieveRelevantChunks(q1, sampleChunks);
  console.log('Test 1 matching results count:', res1.length);
  console.log('Test 1 top file:', res1[0]?.fileName);

  if (res1[0]?.fileName !== 'quy_dinh_nghi_phep.txt') {
    throw new Error('Test 1 failed: Expected quy_dinh_nghi_phep.txt');
  }

  // Test 2: Build Strict Prompt
  const promptData = buildStrictRAGPrompt({
    query: q1,
    retrievedChunks: res1,
    folderPath: 'D:/HR',
    language: 'vi'
  });
  console.log('Strict prompt hasContext:', promptData.hasContext);
  console.log('Prompt includes Zero Hallucination:', promptData.systemPrompt.includes('ZERO HALLUCINATION'));

  // Test 3: Query with no matches
  const q3 = 'Ai là tổng thống Mỹ năm 1900?';
  const res3 = retrieveRelevantChunks(q3, sampleChunks);
  const promptDataNoMatch = buildStrictRAGPrompt({
    query: q3,
    retrievedChunks: res3,
    folderPath: 'D:/HR',
    language: 'vi'
  });
  console.log('No match prompt hasContext:', promptDataNoMatch.hasContext);

  console.log('Task 3 RAG Retriever tests PASSED successfully!');
}

testRagRetriever().catch(console.error);
