const prisma = require('../config/prisma');

exports.getChatRooms = async (req, res, next) => {
  try {
    const dbRooms = await prisma.chatrooms.findMany({
      orderBy: { create_at: 'asc' }
    });
    const rooms = dbRooms.map(r => ({
      id: r.room_id,
      type: r.type,
      name: r.room_name,
      project_id: r.project_id,
      created_at: r.create_at
    }));
    res.json(rooms);
  } catch (err) {
    next(err);
  }
};

exports.getChatRoomMembers = async (req, res, next) => {
  try {
    const dbMembers = await prisma.chatroommember.findMany();
    const members = dbMembers.map(m => ({
      id: m.id,
      room_id: m.room_id,
      user_id: m.user_id,
      joined_at: m.join_at,
      last_read_at: m.last_read_at
    }));
    res.json(members);
  } catch (err) {
    next(err);
  }
};

exports.getMessages = async (req, res, next) => {
  try {
    const { roomId } = req.body;
    
    const msgs = await prisma.messages.findMany({
      where: roomId ? { room_id: roomId } : undefined,
      orderBy: { created_at: 'asc' }
    });

    res.json(msgs.map(m => ({
      id: m.message_id,
      room_id: m.room_id,
      sender_id: m.sender_id,
      content: m.content,
      is_edited: !!m.is_edited,
      created_at: m.created_at,
      attachments: []
    })));
  } catch (err) {
    next(err);
  }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { msg } = req.body;
    const messageId = msg.id || 'msg-' + Date.now();
    
    await prisma.messages.create({
      data: {
        message_id: messageId,
        room_id: msg.room_id,
        sender_id: msg.sender_id,
        content: msg.content
      }
    });

    const saved = await prisma.messages.findUnique({
      where: { message_id: messageId }
    });

    res.json({
      id: saved.message_id,
      room_id: saved.room_id,
      sender_id: saved.sender_id,
      content: saved.content,
      is_edited: !!saved.is_edited,
      created_at: saved.created_at,
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

    await prisma.chatrooms.create({
      data: {
        room_id: roomId,
        type: 'direct',
        room_name: name
      }
    });

    await prisma.chatroommember.createMany({
      data: [
        { room_id: roomId, user_id: userId1 },
        { room_id: roomId, user_id: userId2 }
      ]
    });

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
