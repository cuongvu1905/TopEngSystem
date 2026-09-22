import path from 'path';
import fs from 'fs';
import { scanAndIndexFolder, getIndexedFolderData } from '../src/utils/folderIndexer.js';
import { retrieveRelevantChunks, buildStrictRAGPrompt } from '../src/utils/ragRetriever.js';
import { handleKnowledgeFolderTool } from '../src/plugins/knowledgeFolderPlugin.js';

async function runE2ETest() {
  console.log('--- STARTING E2E LOCAL FOLDER RAG TEST ---');

  // 1. Setup sample knowledge directory
  const testFolder = path.resolve('scratch', 'e2e_knowledge_folder');
  if (!fs.existsSync(testFolder)) fs.mkdirSync(testFolder, { recursive: true });

  fs.writeFileSync(
    path.join(testFolder, 'chinh_sach_thuong_tet.txt'),
    'Chính sách thưởng Tết năm 2026: Nhân viên làm việc đủ 12 tháng được thưởng 2 tháng lương cơ bản và một chuyến du lịch Phú Quốc.'
  );

  fs.writeFileSync(
    path.join(testFolder, 'he_thong_server.json'),
    JSON.stringify({
      mainDatabase: 'MySQL Cluster Master-Slave',
      port: 3306,
      ip: '10.0.0.88',
      backupSchedule: 'Hàng ngày lúc 02:00 AM'
    }, null, 2)
  );

  fs.writeFileSync(
    path.join(testFolder, 'kien_truc_du_an.md'),
    `# Kiến trúc Dự án TopEng DeepSeek Harness
Hệ thống sử dụng Next.js 16, Node.js Express backend, Prisma ORM và Plugin Agent Harness.
Plugin Folder RAG cho phép tra cứu tài liệu từ thư mục cục bộ với cơ chế chống bịa đặt nghiêm ngặt.`
  );

  console.log('✅ Bước 1: Đã tạo thư mục và các file tài liệu mẫu.');

  // 2. Test Plugin Tool: scan_and_index_folder
  const scanToolRes = await handleKnowledgeFolderTool('scan_and_index_folder', {
    folderPath: testFolder,
    forceReindex: true
  }, { language: 'vi' });

  console.log('✅ Bước 2: Scan Tool Result:', scanToolRes.success);
  console.log('Scan Tool Data:', scanToolRes.data);

  if (!scanToolRes.success || scanToolRes.data.parsedFiles !== 3) {
    throw new Error('E2E Failed at step 2: scan_and_index_folder');
  }

  // 3. Test Plugin Tool: search_folder_knowledge with matching query
  const searchToolRes = await handleKnowledgeFolderTool('search_folder_knowledge', {
    query: 'Thưởng tết 2026 được bao nhiêu tháng lương và đi du lịch ở đâu?',
    folderPath: testFolder
  }, { language: 'vi' });

  console.log('✅ Bước 3: Search Tool Result Found:', searchToolRes.found);
  console.log('Top match file:', searchToolRes.chunks?.[0]?.fileName);

  if (!searchToolRes.found || searchToolRes.chunks[0].fileName !== 'chinh_sach_thuong_tet.txt') {
    throw new Error('E2E Failed at step 3: Did not match chinh_sach_thuong_tet.txt');
  }

  // 4. Test Strict Prompt Generation (Zero-Hallucination)
  const indexData = getIndexedFolderData(testFolder);
  const matchedChunks = retrieveRelevantChunks('Thưởng tết', indexData.chunks, 3);
  const promptData = buildStrictRAGPrompt({
    query: 'Thưởng tết',
    retrievedChunks: matchedChunks,
    folderPath: testFolder,
    language: 'vi'
  });

  console.log('✅ Bước 4: Strict Prompt Built successfully.');
  console.log('Prompt contains ZERO HALLUCINATION directive:', promptData.systemPrompt.includes('ZERO HALLUCINATION'));

  // 5. Test Non-existent query (should strictly reject)
  const nonExistentQuery = 'Tỷ giá đồng Bitcoin năm 2010 là bao nhiêu?';
  const emptyMatch = retrieveRelevantChunks(nonExistentQuery, indexData.chunks, 3, 0.5);
  console.log('emptyMatch results:', JSON.stringify(emptyMatch, null, 2));
  const rejectPrompt = buildStrictRAGPrompt({
    query: nonExistentQuery,
    retrievedChunks: emptyMatch,
    folderPath: testFolder,
    language: 'vi'
  });

  console.log('✅ Bước 5: Non-existent query handled. Has context:', rejectPrompt.hasContext);
  if (rejectPrompt.hasContext !== false) {
    throw new Error('E2E Failed: Non-existent query should have hasContext = false');
  }

  console.log('🎉 --- ALL E2E FOLDER RAG TESTS PASSED 100% ---');
}

runE2ETest().catch(err => {
  console.error('❌ E2E Test Error:', err);
  process.exit(1);
});
