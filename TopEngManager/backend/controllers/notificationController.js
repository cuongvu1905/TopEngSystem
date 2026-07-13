const prisma = require('../config/prisma');

exports.getNotifications = async (req, res, next) => {
  try {
    const { userId } = req.body;
    
    const notifsRaw = await prisma.notificyations.findMany({
      where: { user_id: userId },
      orderBy: { create_at: 'desc' }
    });

    res.json(notifsRaw.map(n => ({
      id: n.id,
      user_id: n.user_id,
      title: n.title,
      content: n.content,
      link_url: n.link_url,
      is_read: !!n.is_read,
      created_at: n.create_at
    })));
  } catch (err) {
    next(err);
  }
};

exports.createNotificationSafe = async (data) => {
  try {
    const { user_id, title, content, link_url } = data;
    
    // Check if a similar notification was created in the last 5 seconds
    const threshold = new Date(Date.now() - 5000);
    const existing = await prisma.notificyations.findFirst({
      where: {
        user_id,
        title,
        content,
        create_at: {
          gte: threshold
        }
      }
    });

    if (existing) {
      console.log(`Duplicate notification prevented for user ${user_id}: "${title}"`);
      return existing;
    }

    return await prisma.notificyations.create({
      data: {
        user_id,
        title,
        content,
        link_url: link_url || '',
        is_read: false
      }
    });
  } catch (err) {
    console.error("Failed to create safe notification:", err);
    throw err;
  }
};

exports.createNotification = async (req, res, next) => {
  try {
    const { userId, title, content, linkUrl } = req.body;
    
    await exports.createNotificationSafe({
      user_id: userId,
      title: title,
      content: content,
      link_url: linkUrl
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    const { notificationId } = req.body;
    
    await prisma.notificyations.update({
      where: { id: parseInt(notificationId) },
      data: { is_read: true }
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.markAllNotificationsRead = async (req, res, next) => {
  try {
    const { userId } = req.body;
    
    await prisma.notificyations.updateMany({
      where: { user_id: userId },
      data: { is_read: true }
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.getActivityLogs = async (req, res, next) => {
  try {
    const logsRaw = await prisma.activitylogs.findMany({
      orderBy: { create_at: 'desc' },
      take: 100
    });

    res.json(logsRaw.map(log => {
      let meta = {};
      if (log.meta_data) {
        try {
          meta = typeof log.meta_data === 'string' ? JSON.parse(log.meta_data) : log.meta_data;
        } catch (e) {
          meta = {};
        }
      }
      return {
        id: log.id,
        user_id: log.user_id,
        action_type: log.action_type,
        entity_type: log.entity_type,
        description: log.description,
        metadata: meta,
        created_at: log.create_at
      };
    }));
  } catch (err) {
    next(err);
  }
};

exports.logActivity = async (req, res, next) => {
  try {
    const { userId, actionType, entityType, entityId, description, metadata } = req.body;
    const completeMetadata = { ...metadata, entity_id: entityId };
    const metaStr = JSON.stringify(completeMetadata);

    await prisma.activitylogs.create({
      data: {
        user_id: userId,
        action_type: actionType,
        entity_type: entityType,
        description: description,
        meta_data: metaStr
      }
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
