const http = require('http');

const data = JSON.stringify({
  userId: 'usr-leader',
  userRole: 'Team Leader'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/getDailyReports',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log("=== API RESPONSE STATUS ===", res.statusCode);
    console.log("=== API RESPONSE BODY ===");
    try {
      const parsed = JSON.parse(body);
      console.log(`Returned ${parsed.length} reports.`);
      parsed.forEach(r => {
        console.log({
          id: r.id,
          user_id: r.user_id,
          user_name: r.user_name,
          user_role: r.user_role,
          status: r.status
        });
      });
    } catch (e) {
      console.log(body);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
