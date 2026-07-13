const fs = require('fs');
const filePath = 'd:/AntigravityFix/TopEngManager/src/app/projects/[id]/page.js';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

lines.forEach((line, index) => {
  if (line.includes('getPerformerForTask') || line.includes('getPerformer')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
