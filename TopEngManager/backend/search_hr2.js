const fs = require('fs');
const filePath = 'd:/AntigravityFix/TopEngManager/src/app/hr/page.js';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

lines.forEach((line, index) => {
  if (line.trim().startsWith('const handle') || line.trim().startsWith('async function') || line.trim().startsWith('function')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
