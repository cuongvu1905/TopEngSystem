const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const userId = 'usr-leader';
    const userRole = 'Team Leader';

    // First, update report ID 3 to 'Approved'
    await prisma.dailyreport.update({
      where: { id: 3 },
      data: { status: 'Approved' }
    });
    console.log("Report ID 3 updated to Approved.");

    // Simulate getDailyReports
    const requestingUser = await prisma.user.findUnique({
      where: { user_id: userId }
    });

    let allowedDepartmentIds = [];
    if (requestingUser && requestingUser.department_id) {
      allowedDepartmentIds.push(requestingUser.department_id);
      let queue = [requestingUser.department_id];
      let index = 0;
      while (index < queue.length) {
        const currentId = queue[index];
        const subDepts = await prisma.department.findMany({
          where: { parent_id: currentId },
          select: { department_id: true }
        });
        for (const sd of subDepts) {
          if (!queue.includes(sd.department_id)) {
            queue.push(sd.department_id);
            allowedDepartmentIds.push(sd.department_id);
          }
        }
        index++;
      }
    }

    const where = {
      OR: [
        { user_id: userId },
        {
          user: {
            department_id: { in: allowedDepartmentIds }
          }
        }
      ]
    };

    const reports = await prisma.dailyreport.findMany({
      where,
      include: {
        user: true
      }
    });

    console.log("Fetched Reports count for usr-leader:", reports.length);
    reports.forEach(r => {
      console.log({
        id: r.id,
        user_id: r.user_id,
        user_name: r.user?.full_name,
        status: r.status
      });
    });

    // Revert status back to 'Pending' to keep database clean
    await prisma.dailyreport.update({
      where: { id: 3 },
      data: { status: 'Pending' }
    });
    console.log("Report ID 3 reverted back to Pending.");

  } catch (err) {
    console.error(err);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
