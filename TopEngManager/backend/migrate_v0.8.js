require('dotenv').config({ path: 'backend/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Starting migration: Verify and fix schema...");
    
    // 1. Check columns of Department table
    const deptColumns = await prisma.$queryRaw`DESCRIBE Department`;
    const deptColNames = deptColumns.map(c => c.Field.toLowerCase());
    
    if (!deptColNames.includes('parent_id')) {
      console.log("Adding parent_id column to Department...");
      await prisma.$executeRawUnsafe("ALTER TABLE Department ADD COLUMN parent_id VARCHAR(36) NULL DEFAULT NULL");
      
      console.log("Adding foreign key constraint for parent_id...");
      await prisma.$executeRawUnsafe("ALTER TABLE Department ADD CONSTRAINT fk_department_parent FOREIGN KEY (parent_id) REFERENCES Department(department_id) ON DELETE SET NULL ON UPDATE CASCADE");
    } else {
      console.log("parent_id column already exists in Department.");
    }

    // 2. Check columns of Task table
    const taskColumns = await prisma.$queryRaw`DESCRIBE task`;
    const taskColNames = taskColumns.map(c => c.Field.toLowerCase());

    if (!taskColNames.includes('status')) {
      console.log("Adding status column to task...");
      await prisma.$executeRawUnsafe("ALTER TABLE task ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Todo'");
      console.log("Added status column to task successfully!");
    } else {
      console.log("status column already exists in task.");
    }
    
    console.log("Migration check and fix completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
