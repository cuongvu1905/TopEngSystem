const fs = require('fs');
const filePath = 'd:/AntigravityFix/TopEngManager/src/app/hr/page.js';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

lines.forEach((line, index) => {
  const lineLower = line.toLowerCase();
  if (lineLower.includes('team') && (lineLower.includes('cơ cấu') || lineLower.includes('sơ đồ') || lineLower.includes('nhóm') || lineLower.includes('root'))) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
