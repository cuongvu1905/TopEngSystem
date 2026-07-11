require('dotenv').config({ path: 'backend/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    const reports = await prisma.dailyreport.findMany();
    console.log(JSON.stringify(reports, null, 2));
  } catch (e) {
    console.error(e);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
