require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const reports = await prisma.dailyreport.findMany({
      include: {
        user: true
      }
    });
    console.log("=== DAILY REPORTS ===");
    reports.forEach(r => {
      console.log({
        id: r.id,
        user_id: r.user_id,
        user_name: r.user?.full_name,
        role: r.user?.role,
        department_id: r.user?.department_id,
        status: r.status,
        created_at: r.created_at
      });
    });
  } catch (err) {
    console.error(err);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
