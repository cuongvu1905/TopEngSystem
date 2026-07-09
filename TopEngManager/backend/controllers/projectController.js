const prisma = require('../config/prisma');

exports.getProjects = async (req, res, next) => {
  try {
    const dbProjects = await prisma.project.findMany();
    const projects = dbProjects.map(p => ({
      id: p.project_id,
      name: p.project_name,
      description: p.project_description,
      project_key: p.project_key || p.project_id.split('-').pop().toUpperCase().slice(0, 5),
      status: 'Thực thi',
      start_date: '2026-06-01',
      end_date: '2026-12-31',
      create_by: p.create_by,
      is_public: true
    }));
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

    if (isNew) {
      // Derive a unique key from the project name
      let projectKey = proj.name
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .split(/\s+/)
        .map(w => w.charAt(0))
        .join('')
        .slice(0, 5);
      
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

      await prisma.project.create({
        data: {
          project_id: id,
          project_name: proj.name,
          project_description: proj.description,
          project_key: projectKey,
          create_by: proj.create_by || null
        }
      });
    } else {
      await prisma.project.update({
        where: { project_id: id },
        data: {
          project_name: proj.name,
          project_description: proj.description
        }
      });
    }

    // Sync project members
    if (membersList && membersList.length > 0) {
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
      }
    }

    const saved = await prisma.project.findUnique({
      where: { project_id: id }
    });

    res.json({
      id: saved.project_id,
      name: saved.project_name,
      description: saved.project_description,
      project_key: saved.project_key || 'PRJ',
      create_by: saved.create_by,
      status: proj.status || 'Thực thi',
      start_date: proj.start_date || '2026-06-01',
      end_date: proj.end_date || '2026-12-31',
      is_public: !!proj.is_public
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
