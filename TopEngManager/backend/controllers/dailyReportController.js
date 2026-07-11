const prisma = require('../config/prisma');

exports.getDailyReports = async (req, res, next) => {
  try {
    const { userId, userRole } = req.body;

    const roleStr = typeof userRole === 'string' ? userRole : '';
    const isAdminOrManagement = 
      roleStr.includes("Admin") || 
      roleStr.includes("HR") || 
      roleStr.includes("BOD") || 
      roleStr.includes("Leader");

    let where = {};
    if (!isAdminOrManagement && userId) {
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
    const { userId, content, fileUrl, projectId } = req.body;

    if (!userId || !content) {
      return res.status(400).json({ error: 'Thiếu thông tin người dùng hoặc nội dung báo cáo' });
    }

    const newReport = await prisma.dailyreport.create({
      data: {
        user_id: userId,
        project_id: projectId || null,
        content: content,
        file_url: fileUrl || null,
        status: 'Pending',
        comment: null
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
