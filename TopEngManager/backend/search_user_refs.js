const fs = require('fs');
const filePath = 'd:/AntigravityFix/TopEngManager/backend/prisma/schema.prisma';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

let currentModel = '';
lines.forEach((line) => {
  if (line.trim().startsWith('model ')) {
    currentModel = line.trim().split(/\s+/)[1];
  }
  if (line.includes('fields:') && line.includes('references: [user_id]')) {
    console.log(`Model [${currentModel}]: ${line.trim()}`);
  }
});
