const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

walkDir('src', (filePath) => {
  if (filePath.endsWith('.js')) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      const lineLower = line.toLowerCase();
      if (lineLower.includes('cơ cấu team') || lineLower.includes('sơ đồ nhóm')) {
        console.log(`${filePath}:${index + 1}: ${line.trim()}`);
      }
    });
  }
});
