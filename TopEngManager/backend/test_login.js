const http = require('http');

function makeRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            ok: res.statusCode >= 200 && res.statusCode < 300,
            body: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            ok: false,
            body: data
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

async function testLogin(identifier, password) {
  try {
    const res = await makeRequest('/api/login', 'POST', { email: identifier, password });
    console.log(`[TEST] Login with "${identifier}" -> status: ${res.status}`);
    if (res.ok) {
      console.log(`  Success! User: ${res.body.session.user.full_name} (${res.body.session.user.role_name})`);
      return true;
    } else {
      console.log(`  Expected Failure/Error: ${res.body.error}`);
      return false;
    }
  } catch (err) {
    console.error(`[ERROR] Connection failed:`, err.message);
    return false;
  }
}

async function runTests() {
  console.log("=== STARTING AUTHENTICATION VERIFICATION TESTS ===");
  
  console.log("\n1. Testing Login with Email:");
  const test1 = await testLogin('admin@test.com', 'TopEngManager2026@');
  
  console.log("\n2. Testing Login with Employee Code:");
  const test2 = await testLogin('usr-admin', 'TopEngManager2026@');
  
  console.log("\n3. Testing Login with Staff Account (Employee Code):");
  const test3 = await testLogin('usr-staff', 'TopEngManager2026@');

  console.log("\n4. Testing Login with Incorrect Password:");
  const test4 = await testLogin('admin@test.com', 'wrong_password_123');

  if (test1 && test2 && test3 && !test4) {
    console.log("\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<");
  } else {
    console.error("\n>>> SOME TESTS FAILED! <<<");
    process.exit(1);
  }
}

runTests();
