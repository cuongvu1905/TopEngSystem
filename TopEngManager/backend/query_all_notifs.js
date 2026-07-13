const prisma = require('./config/prisma');

async function main() {
  const notifs = await prisma.notificyations.findMany({
    orderBy: { id: 'desc' }
  });
  console.log(`Total notifications: ${notifs.length}`);
  notifs.forEach(n => {
    console.log(`ID: ${n.id} | User: ${n.user_id} | Title: ${n.title} | Content: ${n.content.slice(0, 60)} | Created: ${n.create_at}`);
  });
}

main().catch(err => console.error(err));
