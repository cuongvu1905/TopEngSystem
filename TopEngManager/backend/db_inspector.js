const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function inspect() {
  try {
    const users = await prisma.user.findMany({
      select: {
        user_id: true,
        full_name: true,
        role: true,
        department_id: true
      }
    });

    const reports = await prisma.dailyreport.findMany({
      include: {
        user: true
      }
    });

    const output = {
      users,
      reports: reports.map(r => ({
        id: r.id,
        user_id: r.user_id,
        user_name: r.user?.full_name,
        role: r.user?.role,
        status: r.status,
        created_at: r.created_at,
        content: r.content
      }))
    };

    const outputPath = "c:/Users/mrcuo/Downloads/TopEngSystem-main/TopEngSystem-main/TopEngManager/backend/db_output.log";
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log("[INSPECTOR] Database state successfully dumped to " + outputPath);
  } catch (err) {
    console.error("[INSPECTOR] Error:", err);
  }
}

inspect();
