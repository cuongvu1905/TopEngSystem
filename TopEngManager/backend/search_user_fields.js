const fs = require('fs');
const filePath = 'd:/AntigravityFix/TopEngManager/backend/prisma/schema.prisma';
const content = fs.readFileSync(filePath, 'utf8');

const regex = /model\s+user\s+{[^}]+}/gi;
const matches = content.match(regex);
if (matches) {
  console.log(matches[0]);
} else {
  // Let's print models starting with 'user'
  const modelRegex = /model\s+(\w+)\s+{/g;
  let match;
  while ((match = modelRegex.exec(content)) !== null) {
    console.log(match[1]);
  }
}
