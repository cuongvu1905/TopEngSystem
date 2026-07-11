const prisma = require('../config/prisma');

exports.getProjects = async (req, res, next) => {
  try {
    const dbProjects = await prisma.$queryRaw`SELECT * FROM Project`;
    const projects = dbProjects.map(p => {
      const prefix = p.customer_id ? `[${p.customer_id}] ` : '';
      return {
        id: p.project_id,
        name: `${prefix}${p.project_name}`,
        description: p.project_description,
        project_key: p.project_key || p.project_id.split('-').pop().toUpperCase().slice(0, 5),
        status: p.status || 'Thực thi',
        start_date: p.start_date || '2026-06-01',
        end_date: p.end_date || '2026-12-31',
        create_by: p.create_by,
        customer_id: p.customer_id || null,
        is_public: true
      };
    });
    res.json(projects);
  } catch (err) {
    next(err);
  }
};

exports.getProjectMembers = async (req, res, next) => {
  try {
    const dbMembers = await prisma.projectmember.findMany();
    const members = dbMembers.map(m => ({
      id: m.id,
      project_id: m.project_id,
      user_id: m.userId,
      project_role: m.role
    }));
    res.json(members);
  } catch (err) {
    next(err);
  }
};

exports.saveProject = async (req, res, next) => {
  try {
    const { proj, membersList } = req.body;
    const isNew = !proj.id;
    const id = proj.id || 'proj-' + Date.now();

    let finalProjectName = proj.name;
    if (finalProjectName && finalProjectName.trim().startsWith('[')) {
      const closeBracketIndex = finalProjectName.indexOf(']');
      if (closeBracketIndex !== -1) {
        finalProjectName = finalProjectName.slice(closeBracketIndex + 1).trim();
      }
    }

    if (isNew) {
      let projectKey = proj.project_key ? proj.project_key.trim().toUpperCase() : null;

      if (!projectKey) {
        // Derive a unique key from the project name
        projectKey = finalProjectName
          .toUpperCase()
          .replace(/[^A-Z0-9\s]/g, '')
          .split(/\s+/)
          .map(w => w.charAt(0))
          .join('')
          .slice(0, 5);
      }
      
      if (!projectKey || projectKey.length === 0) {
        projectKey = 'PRJ';
      }

      // Check unique
      const existing = await prisma.project.findFirst({
        where: { project_key: projectKey }
      });
      if (existing) {
        projectKey = `${projectKey}${Date.now().toString().slice(-2)}`;
      }

      await prisma.$executeRaw`
        INSERT INTO Project (project_id, project_name, project_description, project_key, create_by, customer_id, status, start_date, end_date)
        VALUES (${id}, ${finalProjectName}, ${proj.description}, ${projectKey}, ${proj.create_by || null}, ${proj.customer_id || null}, ${proj.status || 'Thực thi'}, ${proj.start_date || '2026-06-01'}, ${proj.end_date || '2026-12-31'})
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE Project 
        SET project_name = ${finalProjectName}, 
            project_description = ${proj.description}, 
            customer_id = ${proj.customer_id || null},
            status = ${proj.status || 'Thực thi'}, 
            start_date = ${proj.start_date || '2026-06-01'}, 
            end_date = ${proj.end_date || '2026-12-31'}
        WHERE project_id = ${id}
      `;
    }

    // Sync project members
    if (membersList && membersList.length > 0) {
      const oldMembers = await prisma.projectmember.findMany({
        where: { project_id: id }
      });
      const oldUserIds = oldMembers.map(om => om.userId);

      await prisma.projectmember.deleteMany({
        where: { project_id: id }
      });
      for (const m of membersList) {
        await prisma.projectmember.create({
          data: {
            project_id: id,
            userId: m.user_id,
            role: m.project_role
          }
        });

        if (!oldUserIds.includes(m.user_id)) {
          try {
            await prisma.notificyations.create({
              data: {
                user_id: m.user_id,
                title: 'Bạn được thêm vào dự án mới',
                content: `Bạn vừa được thêm vào dự án "${proj.name}" với vai trò ${m.project_role || 'Member'}.`,
                link_url: `#projects/${id}`,
                is_read: false
              }
            });
          } catch (notifErr) {
            console.error("Failed to send bulk member notification:", notifErr);
          }
        }
      }
    }

    const savedList = await prisma.$queryRaw`SELECT * FROM Project WHERE project_id = ${id}`;
    const saved = savedList[0];

    res.json({
      id: saved.project_id,
      name: saved.project_name,
      description: saved.project_description,
      project_key: saved.project_key || 'PRJ',
      status: saved.status || 'Thực thi',
      start_date: saved.start_date || '2026-06-01',
      end_date: saved.end_date || '2026-12-31',
      create_by: saved.create_by,
      is_public: true
    });
  } catch (err) {
    next(err);
  }
};

exports.addProjectMember = async (req, res, next) => {
  try {
    const { projectId, userId, projectRole } = req.body;
    await prisma.projectmember.deleteMany({
      where: {
        project_id: projectId,
        userId: userId
      }
    });
    await prisma.projectmember.create({
      data: {
        project_id: projectId,
        userId: userId,
        role: projectRole
      }
    });

    try {
      const proj = await prisma.project.findUnique({
        where: { project_id: projectId }
      });
      await prisma.notificyations.create({
        data: {
          user_id: userId,
          title: 'Bạn được thêm vào dự án mới',
          content: `Bạn vừa được thêm vào dự án "${proj?.project_name || 'Dự án'}" với vai trò ${projectRole || 'Member'}.`,
          link_url: `#projects/${projectId}`,
          is_read: false
        }
      });
    } catch (notifErr) {
      console.error("Failed to send single member notification:", notifErr);
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.removeProjectMember = async (req, res, next) => {
  try {
    const { projectId, userId } = req.body;
    await prisma.projectmember.deleteMany({
      where: {
        project_id: projectId,
        userId: userId
      }
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.getCustomers = async (req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { customer_name: 'asc' }
    });
    res.json(customers);
  } catch (err) {
    next(err);
  }
};

exports.getDepartments = async (req, res, next) => {
  try {
    const depts = await prisma.department.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(depts);
  } catch (err) {
    next(err);
  }
};

exports.saveCustomer = async (req, res, next) => {
  try {
    const { customer } = req.body;
    const isNew = !customer.id;

    if (isNew) {
      if (!customer.customer_id) {
        return res.status(400).json({ error: 'Mã khách hàng là bắt buộc.' });
      }
      const existing = await prisma.customer.findUnique({
        where: { customer_id: customer.customer_id }
      });
      if (existing) {
        return res.status(400).json({ error: 'Mã khách hàng đã tồn tại.' });
      }

      await prisma.customer.create({
        data: {
          customer_id: customer.customer_id,
          customer_name: customer.customer_name,
          address: customer.address || null,
          tax_code: customer.tax_code || null
        }
      });
    } else {
      await prisma.customer.update({
        where: { id: parseInt(customer.id) },
        data: {
          customer_name: customer.customer_name,
          address: customer.address || null,
          tax_code: customer.tax_code || null
        }
      });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
