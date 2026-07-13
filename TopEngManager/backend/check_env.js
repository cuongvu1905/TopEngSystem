const fs = require('fs');
const path = require('path');

function checkEnv(dir) {
  const envPath = path.join(dir, '.env');
  if (fs.existsSync(envPath)) {
    console.log(`--- ${envPath} ---`);
    console.log(fs.readFileSync(envPath, 'utf8'));
  }
}

checkEnv('d:/AntigravityFix/TopEngManager');
checkEnv('d:/AntigravityFix/TopEngManager/backend');
