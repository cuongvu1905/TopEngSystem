const fs = require('fs');
const filePath = 'd:/AntigravityFix/TopEngManager/src/components/Modals.js';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

lines.forEach((line, index) => {
  if (line.includes('filteredMembers') || line.includes('filtered') || line.includes('assigneeSearchQuery')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
