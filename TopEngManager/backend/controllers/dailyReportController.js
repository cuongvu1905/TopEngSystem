const path = require('path');
const fs = require('fs');
const prisma = require('../config/prisma');

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

    const roleStr = typeof userRole === 'string' ? userRole : '';
    const canViewAll = hasPermission(roleStr, 'view_daily_reports');

    let where = {};
    if (!canViewAll && userId) {
      where.user_id = userId;
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

    const formattedReports = reports.map(r => ({
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
    const { reportId, status, comment } = req.body;

    if (!reportId || !status) {
      return res.status(400).json({ error: 'Thiếu mã báo cáo hoặc trạng thái cập nhật' });
    }

    const updatedReport = await prisma.dailyreport.update({
      where: { id: parseInt(reportId) },
      data: {
        status: status,
        comment: comment || null
      }
    });

    res.json({ success: true, report: updatedReport });
  } catch (err) {
    next(err);
  }
};

exports.updateDailyReport = async (req, res, next) => {
  try {
    const { reportId, content, fileUrl, projectId } = req.body;

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

    const updated = await prisma.dailyreport.update({
      where: { id: parseInt(reportId) },
      data: {
        content: content,
        file_url: fileUrl !== undefined ? fileUrl : report.file_url,
        project_id: projectId !== undefined ? projectId : report.project_id
      }
    });

    res.json({ success: true, report: updated });
  } catch (err) {
    next(err);
  }
};
