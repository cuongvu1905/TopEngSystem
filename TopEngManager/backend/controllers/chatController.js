const { query } = require('../config/db');

exports.getChatRooms = async (req, res, next) => {
  try {
    const rooms = await query('SELECT room_id as id, type, room_name as name, project_id, create_at as created_at FROM ChatRooms ORDER BY create_at ASC');
    res.json(rooms);
  } catch (err) {
    next(err);
  }
};

exports.getChatRoomMembers = async (req, res, next) => {
  try {
    const members = await query('SELECT id, room_id, user_id, join_at as joined_at, last_read_at FROM ChatRoomMember');
    res.json(members);
  } catch (err) {
    next(err);
  }
};

exports.getMessages = async (req, res, next) => {
  try {
    const { roomId } = req.body;
    let msgs;
    if (roomId) {
      msgs = await query('SELECT message_id as id, room_id, sender_id, content, is_edited, created_at FROM Messages WHERE room_id = ? ORDER BY created_at ASC', [roomId]);
    } else {
      msgs = await query('SELECT message_id as id, room_id, sender_id, content, is_edited, created_at FROM Messages ORDER BY created_at ASC');
    }
    res.json(msgs.map(m => ({ ...m, is_edited: !!m.is_edited, attachments: [] })));
  } catch (err) {
    next(err);
  }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { msg } = req.body;
    const messageId = msg.id || 'msg-' + Date.now();
    await query(
      'INSERT INTO Messages (message_id, room_id, sender_id, content) VALUES (?, ?, ?, ?)',
      [messageId, msg.room_id, msg.sender_id, msg.content]
    );
    const saved = await query('SELECT message_id as id, room_id, sender_id, content, is_edited, created_at FROM Messages WHERE message_id = ?', [messageId]);
    res.json({
      ...saved[0],
      is_edited: !!saved[0].is_edited,
      attachments: []
    });
  } catch (err) {
    next(err);
  }
};

exports.createDirectChat = async (req, res, next) => {
  try {
    const { userId1, userId2, name } = req.body;
    const roomId = 'room-direct-' + Date.now();
    await query(
      'INSERT INTO ChatRooms (room_id, type, room_name) VALUES (?, ?, ?)',
      [roomId, 'direct', name]
    );
    await query(
      'INSERT INTO ChatRoomMember (room_id, user_id) VALUES (?, ?), (?, ?)',
      [roomId, userId1, roomId, userId2]
    );
    res.json({ success: true, roomId });
  } catch (err) {
    next(err);
  }
};

exports.getTaskChats = async (req, res, next) => {
  try {
    // task_chats table is deleted in new UML, return empty array to prevent crashes
    res.json([]);
  } catch (err) {
    next(err);
  }
};

exports.sendTaskChat = async (req, res, next) => {
  try {
    // task_chats table is deleted, mock success response
    const { chat } = req.body;
    res.json({
      id: 'tchat-' + Date.now(),
      task_id: chat.task_id,
      sender_id: chat.sender_id,
      content: chat.content,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
};
