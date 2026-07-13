require('dotenv').config({ path: 'backend/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const list = await prisma.project.findMany();
    console.log("=== Projects in database ===");
    console.log(list);
  } catch (err) {
    console.error("Failed to fetch projects:", err);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
