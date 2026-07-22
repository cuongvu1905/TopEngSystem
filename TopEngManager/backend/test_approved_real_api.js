const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const http = require('http');

async function run() {
  try {
    // 1. Update status to Approved
    await prisma.dailyreport.update({
      where: { id: 3 },
      data: { status: 'Approved' }
    });
    console.log("Report ID 3 updated to Approved.");

    // 2. Call live API
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
      res.on('end', async () => {
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

        // Revert back
        await prisma.dailyreport.update({
          where: { id: 3 },
          data: { status: 'Pending' }
        });
        console.log("Report ID 3 reverted back to Pending.");
        prisma.$disconnect();
      });
    });

    req.write(data);
    req.end();

  } catch (err) {
    console.error(err);
    prisma.$disconnect();
  }
}

run();
