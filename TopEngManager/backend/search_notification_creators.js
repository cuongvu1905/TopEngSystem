const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath);
    } else if (file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (line.includes('notificyations') || line.includes('notification')) {
          if (line.includes('create') || line.includes('insert') || line.includes('db.') || line.includes('prisma.')) {
            console.log(`${fullPath}:${index + 1}: ${line.trim()}`);
          }
        }
      });
    }
  });
}

searchDir('d:/AntigravityFix/TopEngManager/backend');
