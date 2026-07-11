const fs = require('fs');
const content = fs.readFileSync('insertdemodata.sql', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.toLowerCase().includes('insert into') && line.toLowerCase().includes('dailyreport')) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});
