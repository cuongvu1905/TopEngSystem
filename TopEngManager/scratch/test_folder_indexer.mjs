import path from 'path';
import fs from 'fs';
import { scanAndIndexFolder, getAllIndexedFolders } from '../src/utils/folderIndexer.js';

async function testFolderIndexer() {
  console.log('Testing folder indexer...');

  // Create sample folder in scratch
  const testDir = path.resolve('scratch', 'demo_knowledge_dir');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  fs.writeFileSync(path.join(testDir, 'policy.txt'), 'Chính sách công ty: Nhân viên được nghỉ phép 12 ngày mỗi năm và hưởng 100% lương.');
  fs.writeFileSync(path.join(testDir, 'servers.json'), JSON.stringify({ serverHN: '192.168.1.100', port: 5000, db: 'Top_Sys' }, null, 2));
  fs.writeFileSync(path.join(testDir, 'guide.md'), '# Hướng dẫn DeepSeek\nĐể sử dụng RAG, người dùng cung cấp thư mục và hỏi câu hỏi.');

  const result = await scanAndIndexFolder(testDir, true);
  console.log('Scan result success:', result.success);
  console.log('Parsed files:', result.parsedFiles);
  console.log('Total chunks:', result.totalChunks);
  console.log('Files summaries count:', result.fileSummaries?.length);

  const indexedList = getAllIndexedFolders();
  console.log('All indexed folders:', indexedList);

  if (result.success && result.totalChunks >= 3) {
    console.log('Folder Indexer Task 2 PASSED!');
  } else {
    throw new Error('Folder Indexer failed');
  }
}

testFolderIndexer().catch(console.error);
