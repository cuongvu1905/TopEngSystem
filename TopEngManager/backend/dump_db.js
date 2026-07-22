const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const issues = await prisma.issue.findMany();
    console.log("=== ISSUES ===");
    issues.forEach(iss => {
      console.log({
        id: iss.id,
        issue_key: iss.issue_key,
        summary: iss.summary,
        project_id: iss.project_id
      });
    });

    const notifications = await prisma.notificyations.findMany({
      orderBy: { create_at: 'desc' },
      take: 15
    });
    console.log("=== NOTIFICATIONS ===");
    notifications.forEach(n => {
      console.log({
        id: n.id,
        user_id: n.user_id,
        title: n.title,
        link_url: n.link_url
      });
    });
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
