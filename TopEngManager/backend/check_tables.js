require('dotenv').config({ path: 'backend/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const columns = await prisma.$queryRaw`DESCRIBE customer`;
    console.log("=== Customer table columns ===");
    console.log(columns);
  } catch (err) {
    console.error("Failed to describe customer table:", err);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
