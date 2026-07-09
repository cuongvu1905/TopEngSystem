const { query } = require('../config/db');

exports.getNotifications = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const notifs = await query('SELECT id, user_id, title, content, link_url, is_read, create_at as created_at FROM Notificyations WHERE user_id = ? ORDER BY create_at DESC', [userId]);
    res.json(notifs.map(n => ({ ...n, is_read: !!n.is_read })));
  } catch (err) {
    next(err);
  }
};

exports.createNotification = async (req, res, next) => {
  try {
    const { userId, title, content, linkUrl } = req.body;
    await query(
      'INSERT INTO Notificyations (user_id, title, content, link_url, is_read) VALUES (?, ?, ?, ?, ?)',
      [userId, title, content, linkUrl || '', false]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    const { notificationId } = req.body;
    await query('UPDATE Notificyations SET is_read = ? WHERE id = ?', [true, notificationId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.markAllNotificationsRead = async (req, res, next) => {
  try {
    const { userId } = req.body;
    await query('UPDATE Notificyations SET is_read = ? WHERE user_id = ?', [true, userId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.getActivityLogs = async (req, res, next) => {
  try {
    const logs = await query('SELECT id, user_id, action_type, entity_type, description, meta_data as metadata, create_at as created_at FROM ActivityLogs ORDER BY create_at DESC LIMIT 100');
    res.json(logs.map(log => {
      let meta = {};
      if (log.metadata) {
        try {
          meta = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata;
        } catch (e) {
          meta = {};
        }
      }
      return { ...log, metadata: meta };
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
    await query(
      'INSERT INTO ActivityLogs (user_id, action_type, entity_type, description, meta_data) VALUES (?, ?, ?, ?, ?)',
      [userId, actionType, entityType, description, metaStr]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
