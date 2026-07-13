const fs = require('fs');
const filePath = 'd:/AntigravityFix/TopEngManager/src/app/hr/page.js';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

lines.forEach((line, index) => {
  if (line.includes('updateUser') || line.includes('updateMember') || line.includes('saveUser') || line.includes('api') || line.includes('db.')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
