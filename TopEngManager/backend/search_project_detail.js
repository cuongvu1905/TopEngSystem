const fs = require('fs');
const filePath = 'd:/AntigravityFix/TopEngManager/src/app/projects/[id]/page.js';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

lines.forEach((line, index) => {
  if (line.includes('thành viên') || line.includes('select') || line.includes('Thao tác') || line.includes('Vai trò dự án')) {
    if (line.toLowerCase().includes('chọn') || line.toLowerCase().includes('thêm') || line.toLowerCase().includes('role')) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  }
});
