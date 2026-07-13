const fs = require('fs');
const filePath = 'd:/AntigravityFix/TopEngManager/src/app/hr/page.js';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

lines.forEach((line, index) => {
  if (line.includes('handleEditMember') || line.includes('editMember') || line.includes('EditMember')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
