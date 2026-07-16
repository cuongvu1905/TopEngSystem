const prisma = require('../config/prisma');
const { createNotificationSafe } = require('./notificationController');

const formatProjectDto = (p) => {
  if (!p) return null;
  const prefix = p.customer_id && !p.project_name.startsWith('[') ? `[${p.customer_id}] ` : '';
  return {
    id: p.project_id,
    name: `${prefix}${p.project_name}`,
    description: p.project_description || 'Không có mô tả.',
    project_key: p.project_key || p.project_id.split('-').pop().toUpperCase().slice(0, 5),
    status: p.status || 'Thực thi',
    start_date: p.start_date || '2026-06-01',
    end_date: p.end_date || '2026-12-31',
    create_by: p.create_by,
    creator: p.user ? p.user.full_name : 'Hệ thống',
    customer_id: p.customer_id || null,
    visibility: p.visibility || 'Private',
    is_public: p.visibility === 'Public'
  };
};

exports.getProjects = async (req, res, next) => {
  try {
    const dbProjects = await prisma.project.findMany({
      include: {
        user: true
      }
    });
    const projects = dbProjects.map(formatProjectDto);
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
      project_role: m.role,
      status: m.status || 'ACTIVE'
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
    const visibility = proj.visibility || 'Private';

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
        INSERT INTO Project (project_id, project_name, project_description, project_key, create_by, customer_id, status, start_date, end_date, visibility)
        VALUES (${id}, ${finalProjectName}, ${proj.description}, ${projectKey}, ${proj.create_by || proj.created_by || null}, ${proj.customer_id || null}, ${proj.status || 'Thực thi'}, ${proj.start_date || '2026-06-01'}, ${proj.end_date || '2026-12-31'}, ${visibility})
      `;
    } else {
      let projectKey = proj.project_key ? proj.project_key.trim().toUpperCase() : null;
      if (!projectKey) {
        return res.status(400).json({ error: 'Mã dự án không được để trống.' });
      }

      // Check unique
      const existing = await prisma.project.findFirst({
        where: { 
          project_key: projectKey,
          NOT: { project_id: id }
        }
      });
      if (existing) {
        return res.status(400).json({ error: `Mã dự án '${projectKey}' đã tồn tại ở dự án khác!` });
      }

      await prisma.$executeRaw`
        UPDATE Project 
        SET project_name = ${finalProjectName}, 
            project_description = ${proj.description}, 
            project_key = ${projectKey},
            customer_id = ${proj.customer_id || null},
            status = ${proj.status || 'Thực thi'}, 
            start_date = ${proj.start_date || '2026-06-01'}, 
            end_date = ${proj.end_date || '2026-12-31'},
            visibility = ${visibility}
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
        const existingMember = oldMembers.find(om => om.userId === m.user_id);
        const status = existingMember ? existingMember.status : 'ACTIVE';
        await prisma.projectmember.create({
          data: {
            project_id: id,
            userId: m.user_id,
            role: m.project_role,
            status: status
          }
        });

        if (!oldUserIds.includes(m.user_id)) {
          try {
            await createNotificationSafe({
              user_id: m.user_id,
              title: 'Bạn được thêm vào dự án mới',
              content: `Bạn vừa được thêm vào dự án "${proj.name}" với vai trò ${m.project_role || 'Member'}.`,
              link_url: `#projects/${id}`
            });
          } catch (notifErr) {
            console.error("Failed to send bulk member notification:", notifErr);
          }
        }
      }
    }

    const saved = await prisma.project.findUnique({
      where: { project_id: id },
      include: { user: true }
    });

    res.json(formatProjectDto(saved));
  } catch (err) {
    next(err);
  }
};

exports.addProjectMember = async (req, res, next) => {
  try {
    const { projectId, userId, projectRole, status } = req.body;
    await prisma.projectmember.deleteMany({
      where: {
        project_id: projectId,
        userId: userId
      }
    });
    
    const finalStatus = status || 'ACTIVE';
    await prisma.projectmember.create({
      data: {
        project_id: projectId,
        userId: userId,
        role: projectRole || 'Member',
        status: finalStatus
      }
    });

    try {
      const proj = await prisma.project.findUnique({
        where: { project_id: projectId }
      });
      
      const isPending = finalStatus === 'PENDING';
      const notifTitle = isPending ? 'Lời mời tham gia dự án' : 'Bạn được thêm vào dự án mới';
      const notifContent = isPending
        ? `Bạn vừa được mời tham gia dự án "${proj?.project_name || 'Dự án'}" với vai trò ${projectRole || 'Member'}. Hãy mở chi tiết để xác nhận.`
        : `Bạn vừa được thêm vào dự án "${proj?.project_name || 'Dự án'}" với vai trò ${projectRole || 'Member'}.`;

      await createNotificationSafe({
        user_id: userId,
        title: notifTitle,
        content: notifContent,
        link_url: `#projects/${projectId}`
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

exports.saveDepartment = async (req, res, next) => {
  try {
    const { department } = req.body;
    const isNew = !department.id;

    if (isNew) {
      if (!department.department_id) {
        return res.status(400).json({ error: 'Mã phòng ban là bắt buộc.' });
      }
      const existing = await prisma.department.findUnique({
        where: { department_id: department.department_id }
      });
      if (existing) {
        return res.status(400).json({ error: 'Mã phòng ban đã tồn tại.' });
      }

      await prisma.department.create({
        data: {
          department_id: department.department_id,
          name: department.name,
          parent_id: department.parent_id || null
        }
      });
    } else {
      const oldDept = await prisma.department.findUnique({
        where: { id: parseInt(department.id) }
      });
      if (!oldDept) {
        return res.status(400).json({ error: 'Không tìm thấy phòng ban cần chỉnh sửa.' });
      }

      if (department.department_id !== oldDept.department_id) {
        // Verify new code is not taken by another record
        const existing = await prisma.department.findFirst({
          where: {
            department_id: department.department_id,
            id: { not: parseInt(department.id) }
          }
        });
        if (existing) {
          return res.status(400).json({ error: 'Mã phòng ban mới đã được sử dụng.' });
        }

        // Disable constraint checks temporarily to perform update cascades
        await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
        try {
          await prisma.$executeRaw`UPDATE \`department\` SET \`department_id\` = ${department.department_id}, \`name\` = ${department.name}, \`parent_id\` = ${department.parent_id || null} WHERE \`id\` = ${parseInt(department.id)}`;
          await prisma.$executeRaw`UPDATE \`department\` SET \`parent_id\` = ${department.department_id} WHERE \`parent_id\` = ${oldDept.department_id}`;
          await prisma.$executeRaw`UPDATE \`user\` SET \`department_id\` = ${department.department_id} WHERE \`department_id\` = ${oldDept.department_id}`;
        } finally {
          await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
        }
      } else {
        await prisma.department.update({
          where: { id: parseInt(department.id) },
          data: {
            name: department.name,
            parent_id: department.parent_id || null
          }
        });
      }
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.deleteDepartment = async (req, res, next) => {
  try {
    const { id } = req.body;
    await prisma.department.delete({
      where: { id: parseInt(id) }
    });
    res.json({ success: true });
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

exports.findProjectById = async (req, res, next) => {
  try {
    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'Thiếu mã dự án để tìm kiếm.' });
    }

    const trimmedId = projectId.trim();
    const dbProject = await prisma.project.findFirst({
      where: {
        OR: [
          { project_id: trimmedId },
          { project_key: trimmedId }
        ]
      },
      include: {
        user: true
      }
    });

    if (!dbProject) {
      return res.status(404).json({ error: 'Không tìm thấy dự án nào khớp với mã vừa nhập.' });
    }

    res.json(formatProjectDto(dbProject));
  } catch (err) {
    next(err);
  }
};
