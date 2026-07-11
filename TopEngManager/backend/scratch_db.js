require('dotenv').config({ path: 'backend/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Check columns of Project table
    const columns = await prisma.$queryRaw`DESCRIBE Project`;
    console.log("=== Project columns ===");
    console.log(columns);

    // Let's add missing columns if they don't exist
    const columnNames = columns.map(c => c.Field.toLowerCase());
    
    if (!columnNames.includes('status')) {
      console.log("Adding status column to Project table...");
      await prisma.$executeRawUnsafe("ALTER TABLE Project ADD COLUMN status VARCHAR(50) NULL DEFAULT 'Thực thi'");
    }
    if (!columnNames.includes('start_date')) {
      console.log("Adding start_date column to Project table...");
      await prisma.$executeRawUnsafe("ALTER TABLE Project ADD COLUMN start_date VARCHAR(50) NULL");
    }
    if (!columnNames.includes('end_date')) {
      console.log("Adding end_date column to Project table...");
      await prisma.$executeRawUnsafe("ALTER TABLE Project ADD COLUMN end_date VARCHAR(50) NULL");
    }

    const updatedColumns = await prisma.$queryRaw`DESCRIBE Project`;
    console.log("=== Updated Project columns ===");
    console.log(updatedColumns);

  } catch (err) {
    console.error("Migration failed:", err);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
