require('dotenv').config({ path: 'backend/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const list = await prisma.user.findMany({
      select: {
        id: true,
        user_id: true,
        email: true,
        full_name: true
      }
    });
    console.log("=== Users in database ===");
    console.log(list);
  } catch (err) {
    console.error("Failed to fetch users:", err);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
