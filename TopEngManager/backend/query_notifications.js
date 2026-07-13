const prisma = require('./config/prisma');

async function main() {
  const notifs = await prisma.notificyations.findMany({
    orderBy: { id: 'desc' },
    take: 10
  });
  console.log(JSON.stringify(notifs, null, 2));
}

main().catch(err => console.error(err));
