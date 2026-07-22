const path = require('path');
const fs = require('fs');
const prisma = require('../config/prisma');
const { createNotificationSafe } = require('./notificationController');

function hasPermission(userRole, permissionKey) {
  try {
    const configPath = path.join(__dirname, '../config/roles_permissions.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (userRole.includes("Admin") || userRole.includes("Owner")) return true;
      const permissions = config.role_permissions[userRole] || [];
      return permissions.includes(permissionKey);
    }
  } catch (err) {
    console.error('Error checking permission in backend:', err);
  }
  return userRole.includes("Admin") || userRole.includes("HR") || userRole.includes("BOD") || userRole.includes("Leader");
}

exports.getDailyReports = async (req, res, next) => {
  try {
    const { userId, userRole } = req.body;
    if (!userId) {
      return res.json([]);
    }

    const roleStr = typeof userRole === 'string' ? userRole : '';

    // Check if the requesting user exists to find their department
    const requestingUser = userId ? await prisma.user.findUnique({
      where: { user_id: userId }
    }) : null;
    let where = {};

    const hasViewPermission = hasPermission(roleStr, 'view_daily_reports');
    if (!hasViewPermission) {
      where = { user_id: userId };
    } else {
      if (roleStr === 'Quản trị viên (Admin)' || roleStr === 'Nhân sự (HR)') {
        // Admins and HR see all reports
        where = {};
      } else if (roleStr === 'Ban điều hành (BOD)') {
        // BOD only sees reports of Team Leaders and their own reports
        where = {
          OR: [
            { user_id: userId },
            {
              user: {
                role: 'Team Leader'
              }
            }
          ]
        };
      } else {
        // Team Leaders, Part Leaders, and other roles with permission see reports of users in their department and any sub-departments recursively
        let allowedDepartmentIds = [];
        if (requestingUser && requestingUser.department_id) {
          allowedDepartmentIds.push(requestingUser.department_id);
          
          // Recursive sub-departments lookup
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

        if (allowedDepartmentIds.length > 0) {
          where = {
            OR: [
              { user_id: userId }, // include their own reports
              {
                user: {
                  department_id: { in: allowedDepartmentIds }
                }
              }
            ]
          };
        } else {
          where = { user_id: userId };
        }
      }
    }

    const reports = await prisma.dailyreport.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: {
            full_name: true,
            email: true,
            role: true
          }
        }
      }
    });

    // Exclude Project Reports (keep all Daily Reports)
    const dailyOnlyReports = reports.filter(r => r.comment !== 'PROJECT_REPORT');

    const formattedReports = dailyOnlyReports.map(r => ({
      id: r.id,
      user_id: r.user_id,
      project_id: r.project_id,
      content: r.content,
      file_url: r.file_url,
      created_at: r.created_at,
      status: r.status || 'Pending',
      comment: r.comment || '',
      user_name: r.user?.full_name || 'Không xác định',
      user_email: r.user?.email || '',
      user_role: r.user?.role || ''
    }));

    res.json(formattedReports);
  } catch (err) {
    next(err);
  }
};

exports.getProjectReports = async (req, res, next) => {
  try {
    const { projectId } = req.body;
    if (!projectId) {
      return res.json([]);
    }

    const reports = await prisma.dailyreport.findMany({
      where: { project_id: projectId, comment: 'PROJECT_REPORT' },
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: {
            full_name: true,
            email: true,
            role: true
          }
        }
      }
    });

    // Exclude daily report cards (serialized JSON array with time slots)
    const projectOnlyReports = reports.filter(r => {
      if (!r.content) return false;
      const trimmed = r.content.trim();
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0].startTime || parsed[0].endTime || parsed[0].id)) {
            return false;
          }
        } catch (e) {}
      }
      return true;
    });

    const formattedReports = projectOnlyReports.map(r => ({
      id: r.id,
      user_id: r.user_id,
      project_id: r.project_id,
      content: r.content,
      file_url: r.file_url,
      created_at: r.created_at,
      status: r.status || 'Pending',
      comment: r.comment === 'PROJECT_REPORT' ? '' : (r.comment || ''),
      user_name: r.user?.full_name || 'Không xác định',
      user_email: r.user?.email || '',
      user_role: r.user?.role || ''
    }));

    res.json(formattedReports);
  } catch (err) {
    next(err);
  }
};

exports.createProjectReport = async (req, res, next) => {
  try {
    const { userId, projectId, content, fileUrl, createdAt } = req.body;

    if (!userId || !projectId || !content) {
      return res.status(400).json({ error: 'Thiếu thông tin người dùng, dự án hoặc nội dung báo cáo' });
    }

    let finalDate = new Date();
    if (createdAt) {
      const dateParts = createdAt.split('-');
      if (dateParts.length === 3) {
        finalDate = new Date(
          parseInt(dateParts[0], 10),
          parseInt(dateParts[1], 10) - 1,
          parseInt(dateParts[2], 10),
          12, 0, 0
        );
      } else {
        finalDate = new Date(createdAt);
      }
    }

    const newReport = await prisma.dailyreport.create({
      data: {
        user_id: userId,
        project_id: projectId,
        content: content,
        file_url: fileUrl || null,
        status: 'Pending',
        comment: 'PROJECT_REPORT',
        created_at: finalDate
      }
    });

    await prisma.activitylogs.create({
      data: {
        user_id: userId,
        action_type: "CREATE_PROJECT_REPORT",
        entity_type: "DailyReport",
        description: `đã gửi báo cáo mới cho dự án`
      }
    });

    res.json({ success: true, report: newReport });
  } catch (err) {
    next(err);
  }
};

exports.createDailyReport = async (req, res, next) => {
  try {
    const { userId, content, fileUrl, projectId, createdAt } = req.body;

    if (!userId || !content) {
      return res.status(400).json({ error: 'Thiếu thông tin người dùng hoặc nội dung báo cáo' });
    }

    let finalDate = new Date();
    if (createdAt) {
      const dateParts = createdAt.split('-');
      if (dateParts.length === 3) {
        finalDate = new Date(
          parseInt(dateParts[0], 10),
          parseInt(dateParts[1], 10) - 1,
          parseInt(dateParts[2], 10),
          12, 0, 0
        );
      }
    }

    const newReport = await prisma.dailyreport.create({
      data: {
        user_id: userId,
        project_id: projectId || null,
        content: content,
        file_url: fileUrl || null,
        status: 'Pending',
        comment: null,
        created_at: finalDate
      }
    });

    // Log activity
    await prisma.activitylogs.create({
      data: {
        user_id: userId,
        action_type: "CREATE_REPORT",
        entity_type: "DailyReport",
        description: `đã gửi báo cáo ngày mới`
      }
    });

    res.json({ success: true, report: newReport });
  } catch (err) {
    next(err);
  }
};

exports.updateDailyReportStatus = async (req, res, next) => {
  try {
    const { reportId, status, comment, userRole } = req.body;

    if (userRole && !hasPermission(userRole, 'approve_daily_report')) {
      return res.status(403).json({ error: 'Bạn không có quyền phê duyệt báo cáo ngày.' });
    }

    if (!reportId || !status) {
      return res.status(400).json({ error: 'Thiếu mã báo cáo hoặc trạng thái cập nhật' });
    }

    const existingReport = await prisma.dailyreport.findUnique({
      where: { id: parseInt(reportId) }
    });

    if (!existingReport) {
      return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
    }

    if (existingReport.status === 'Approved' || existingReport.status === 'Rejected') {
      return res.status(400).json({ error: 'Báo cáo đã được duyệt hoặc từ chối và không thể thay đổi thông tin nữa.' });
    }

    const updatedReport = await prisma.dailyreport.update({
      where: { id: parseInt(reportId) },
      data: {
        status: status,
        comment: comment || null
      }
    });

    if (status === 'Rejected') {
      const reportDate = new Date(existingReport.created_at).toLocaleDateString('vi-VN');
      await createNotificationSafe({
        user_id: existingReport.user_id,
        title: 'Báo cáo ngày bị từ chối',
        content: `Báo cáo ngày ${reportDate} của bạn đã bị từ chối. Nhận xét: ${comment || 'Không có'}`,
        link_url: `#dashboard?reportId=${reportId}`
      });
    }

    res.json({ success: true, report: updatedReport });
  } catch (err) {
    next(err);
  }
};

exports.updateDailyReport = async (req, res, next) => {
  try {
    const { reportId, content, fileUrl, projectId, createdAt } = req.body;

    if (!reportId || !content) {
      return res.status(400).json({ error: 'Thiếu mã báo cáo hoặc nội dung cập nhật' });
    }

    const report = await prisma.dailyreport.findUnique({
      where: { id: parseInt(reportId) }
    });

    if (!report) {
      return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
    }

    if (report.status !== 'Pending' && report.status !== 'pending' && report.status !== 'Chờ duyệt') {
      return res.status(400).json({ error: 'Chỉ có thể chỉnh sửa báo cáo ở trạng thái Chờ duyệt' });
    }

    const updateData = {
      content: content,
      file_url: fileUrl !== undefined ? fileUrl : report.file_url,
      project_id: projectId !== undefined ? projectId : report.project_id
    };

    // Update report date if provided
    if (createdAt) {
      updateData.created_at = new Date(createdAt);
    }

    const updated = await prisma.dailyreport.update({
      where: { id: parseInt(reportId) },
      data: updateData
    });

    res.json({ success: true, report: updated });
  } catch (err) {
    next(err);
  }
};

exports.deleteDailyReport = async (req, res, next) => {
  try {
    const { reportId } = req.body;

    if (!reportId) {
      return res.status(400).json({ error: 'Thiếu mã báo cáo cần xóa' });
    }

    const report = await prisma.dailyreport.findUnique({
      where: { id: parseInt(reportId) }
    });

    if (!report) {
      return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
    }

    if (report.status !== 'Pending' && report.status !== 'pending' && report.status !== 'Chờ duyệt') {
      return res.status(400).json({ error: 'Chỉ có thể xóa báo cáo ở trạng thái Chờ duyệt' });
    }

    await prisma.dailyreport.delete({
      where: { id: parseInt(reportId) }
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
