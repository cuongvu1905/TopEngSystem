require('dotenv').config({ path: 'backend/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Starting migration v0.9: Verify schema columns...");
    
    // 1. Check Project columns
    const projColumns = await prisma.$queryRaw`DESCRIBE Project`;
    const projColNames = projColumns.map(c => c.Field.toLowerCase());
    
    if (!projColNames.includes('visibility')) {
      console.log("Adding visibility column to Project...");
      await prisma.$executeRawUnsafe("ALTER TABLE Project ADD COLUMN visibility VARCHAR(10) NULL DEFAULT 'Private'");
      console.log("visibility column added.");
    } else {
      console.log("visibility column already exists in Project.");
    }

    // 2. Check ProjectMember columns
    const pmColumns = await prisma.$queryRaw`DESCRIBE ProjectMember`;
    const pmColNames = pmColumns.map(c => c.Field.toLowerCase());

    if (!pmColNames.includes('status')) {
      console.log("Adding status column to ProjectMember...");
      await prisma.$executeRawUnsafe("ALTER TABLE ProjectMember ADD COLUMN status VARCHAR(20) NULL DEFAULT 'ACTIVE'");
      console.log("status column added.");
    } else {
      console.log("status column already exists in ProjectMember.");
    }

    // 3. Check Customer columns
    const custColumns = await prisma.$queryRaw`DESCRIBE customer`;
    const custColNames = custColumns.map(c => c.Field.toLowerCase());

    if (!custColNames.includes('address')) {
      console.log("Adding address column to customer...");
      await prisma.$executeRawUnsafe("ALTER TABLE customer ADD COLUMN address VARCHAR(255) NULL DEFAULT NULL");
      console.log("address column added.");
    } else {
      console.log("address column already exists in customer.");
    }

    if (!custColNames.includes('tax_code')) {
      console.log("Adding tax_code column to customer...");
      await prisma.$executeRawUnsafe("ALTER TABLE customer ADD COLUMN tax_code VARCHAR(50) NULL DEFAULT NULL");
      console.log("tax_code column added.");
    } else {
      console.log("tax_code column already exists in customer.");
    }
    
    console.log("Migration v0.9 completed successfully!");
  } catch (err) {
    console.error("Migration v0.9 failed:", err);
    process.exit(1);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
