const prisma = require('../config/prisma');

const taskLocks = {}; // key: taskId, value: { userId, userName, lockedAt }

exports.getTasks = async (req, res, next) => {
  try {
    const { projectId } = req.body;
    
    const tasksRaw = await prisma.task.findMany({
      where: projectId ? { project_id: projectId } : undefined,
      orderBy: { due_date: 'asc' }
    });

    res.json(tasksRaw.map(t => ({
      id: t.task_id,
      project_id: t.project_id,
      assignee_id: t.assignee_id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status || 'Todo',
      due_date: t.due_date,
      created_at: t.create_at,
      updated_at: t.update_at,
      attachments: []
    })));
  } catch (err) {
    next(err);
  }
};

exports.getSubtasks = async (req, res, next) => {
  try {
    const { taskId } = req.body;
    
    const subsRaw = await prisma.subtask.findMany({
      where: taskId ? { task_id: taskId } : undefined
    });

    res.json(subsRaw.map(s => ({
      ...s,
      is_done: !!s.is_done
    })));
  } catch (err) {
    next(err);
  }
};

exports.getComments = async (req, res, next) => {
  try {
    // Comments table is deleted, return empty array to prevent crashes
    res.json([]);
  } catch (err) {
    next(err);
  }
};

exports.saveTask = async (req, res, next) => {
  try {
    const { task } = req.body;
    const isNew = !task.id;
    const id = task.id || 'task-' + Date.now();

    if (isNew) {
      await prisma.task.create({
        data: {
          task_id: id,
          project_id: task.project_id,
          title: task.title,
          description: task.description,
          assignee_id: task.assignee_id || null,
          priority: task.priority || 'Trung bình',
          status: task.status || 'Todo',
          due_date: task.due_date ? new Date(task.due_date) : null
        }
      });
    } else {
      await prisma.task.update({
        where: { task_id: id },
        data: {
          title: task.title,
          description: task.description,
          assignee_id: task.assignee_id || null,
          priority: task.priority,
          status: task.status,
          due_date: task.due_date ? new Date(task.due_date) : null
        }
      });
    }

    const saved = await prisma.task.findUnique({
      where: { task_id: id }
    });

    res.json({
      id: saved.task_id,
      project_id: saved.project_id,
      assignee_id: saved.assignee_id,
      title: saved.title,
      description: saved.description,
      priority: saved.priority,
      due_date: saved.due_date,
      status: saved.status || 'Todo',
      attachments: []
    });
  } catch (err) {
    next(err);
  }
};

exports.updateTaskStatus = async (req, res, next) => {
  try {
    const { taskId, status } = req.body;
    await prisma.task.update({
      where: { task_id: taskId },
      data: { status: status }
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.saveSubtask = async (req, res, next) => {
  try {
    const { subtask } = req.body;
    const isNew = !subtask.id;
    if (isNew) {
      await prisma.subtask.create({
        data: {
          task_id: subtask.task_id,
          title: subtask.title,
          is_done: !!subtask.is_done
        }
      });
    } else {
      await prisma.subtask.update({
        where: { id: subtask.id },
        data: {
          title: subtask.title,
          is_done: !!subtask.is_done
        }
      });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.deleteSubtask = async (req, res, next) => {
  try {
    const { subId } = req.body;
    await prisma.subtask.delete({
      where: { id: subId }
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.addComment = async (req, res, next) => {
  try {
    // Comments table is deleted, return success mock
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.lockTask = async (req, res, next) => {
  try {
    const { taskId, userId } = req.body;
    const now = Date.now();
    const existingLock = taskLocks[taskId];

    if (existingLock && existingLock.userId !== userId && (now - existingLock.lockedAt) < 15000) {
      return res.json({ success: false, lockedBy: existingLock.userName, isLocked: true });
    }

    const user = await prisma.user.findUnique({
      where: { user_id: userId }
    });
    const userName = user ? user.full_name : 'Người dùng khác';

    taskLocks[taskId] = {
      userId,
      userName,
      lockedAt: now
    };

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.unlockTask = async (req, res, next) => {
  try {
    const { taskId, userId } = req.body;
    const existingLock = taskLocks[taskId];
    if (existingLock && existingLock.userId === userId) {
      delete taskLocks[taskId];
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
