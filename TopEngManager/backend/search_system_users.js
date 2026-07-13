const fs = require('fs');
const filePath = 'd:/AntigravityFix/TopEngManager/src/components/Modals.js';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

lines.forEach((line, index) => {
  if (line.includes('systemUsers') || line.includes('setSystemUsers') || line.includes('db.getUsers')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
