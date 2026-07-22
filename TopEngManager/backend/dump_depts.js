const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const depts = await prisma.department.findMany();
    console.log("=== DEPARTMENTS ===");
    depts.forEach(d => {
      console.log({
        department_id: d.department_id,
        name: d.name,
        parent_id: d.parent_id
      });
    });
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
