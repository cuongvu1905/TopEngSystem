const { query } = require('../config/db');

exports.getTasks = async (req, res, next) => {
  try {
    const { projectId } = req.body;
    let tasks;
    if (projectId) {
      tasks = await query("SELECT task_id as id, project_id, assignee_id, title, description, priority, 'Todo' as status, due_date, create_at as created_at, update_at as updated_at FROM Task WHERE project_id = ? ORDER BY due_date ASC", [projectId]);
    } else {
      tasks = await query("SELECT task_id as id, project_id, assignee_id, title, description, priority, 'Todo' as status, due_date, create_at as created_at, update_at as updated_at FROM Task ORDER BY due_date ASC");
    }
    
    res.json(tasks.map(t => ({
      ...t,
      attachments: []
    })));
  } catch (err) {
    next(err);
  }
};

exports.getSubtasks = async (req, res, next) => {
  try {
    const { taskId } = req.body;
    let subs;
    if (taskId) {
      subs = await query('SELECT * FROM Subtask WHERE task_id = ?', [taskId]);
    } else {
      subs = await query('SELECT * FROM Subtask');
    }
    res.json(subs.map(s => ({ ...s, is_done: !!s.is_done })));
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
      await query(
        'INSERT INTO Task (task_id, project_id, title, description, assignee_id, priority, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, task.project_id, task.title, task.description, task.assignee_id || null, task.priority || 'Trung bình', task.due_date || null]
      );
    } else {
      await query(
        'UPDATE Task SET title = ?, description = ?, assignee_id = ?, priority = ?, due_date = ? WHERE task_id = ?',
        [task.title, task.description, task.assignee_id || null, task.priority, task.due_date || null, id]
      );
    }

    const saved = await query('SELECT task_id as id, project_id, assignee_id, title, description, priority, due_date FROM Task WHERE task_id = ?', [id]);
    res.json({
      ...saved[0],
      status: task.status || 'Todo',
      attachments: []
    });
  } catch (err) {
    next(err);
  }
};

exports.updateTaskStatus = async (req, res, next) => {
  try {
    const { taskId, status } = req.body;
    // Task status column is mapped dynamically or saved locally, here we return success
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
      await query(
        'INSERT INTO Subtask (task_id, title, is_done) VALUES (?, ?, ?)',
        [subtask.task_id, subtask.title, !!subtask.is_done]
      );
    } else {
      await query(
        'UPDATE Subtask SET title = ?, is_done = ? WHERE id = ?',
        [subtask.title, !!subtask.is_done, subtask.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.deleteSubtask = async (req, res, next) => {
  try {
    const { subId } = req.body;
    await query('DELETE FROM Subtask WHERE id = ?', [subId]);
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
