import path from 'path';
import fs from 'fs';
import { parseFileContent } from '../src/utils/documentParsers.js';

async function runTest() {
  console.log('Testing document parsers...');

  // Create temporary test files in scratch
  const scratchDir = path.resolve('scratch');
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

  // 1. Text test
  const txtPath = path.join(scratchDir, 'test_sample.txt');
  fs.writeFileSync(txtPath, 'TopEng System is an enterprise ERP and project management platform.');
  const txtRes = await parseFileContent(txtPath);
  console.log('TXT Parse Result:', txtRes.success, txtRes.text.slice(0, 40));

  // 2. Markdown test
  const mdPath = path.join(scratchDir, 'test_sample.md');
  fs.writeFileSync(mdPath, '# Quy định Công ty\n- Giờ làm việc: 8h00 - 17h30\n- Địa điểm: Tòa nhà TopEng');
  const mdRes = await parseFileContent(mdPath);
  console.log('MD Parse Result:', mdRes.success, mdRes.text.slice(0, 40));

  // 3. JSON test
  const jsonPath = path.join(scratchDir, 'test_sample.json');
  fs.writeFileSync(jsonPath, JSON.stringify({ project: 'DeepSeek RAG', version: '1.0' }));
  const jsonRes = await parseFileContent(jsonPath);
  console.log('JSON Parse Result:', jsonRes.success, jsonRes.text.slice(0, 40));

  console.log('All basic parser tests completed successfully!');
}

runTest().catch(console.error);
