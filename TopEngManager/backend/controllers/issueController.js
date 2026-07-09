const { query } = require('../config/db');

exports.getIssues = async (req, res, next) => {
  try {
    const { projectId, searchQuery, assigneeId, priority, type } = req.body;
    let sql = `SELECT i.id, i.issue_key, i.project_id, i.summary, i.description, i.type, i.status, i.priority, i.reporter_id, i.assignee_id, i.epic_id, i.parent_id, i.created_at, i.updated_at 
               FROM Issue i 
               WHERE i.project_id = ?`;
    const params = [projectId];

    if (searchQuery) {
      sql += ` AND (i.summary LIKE ? OR i.description LIKE ?)`;
      params.push(`%${searchQuery}%`, `%${searchQuery}%`);
    }
    if (assigneeId) {
      sql += ` AND i.assignee_id = ?`;
      params.push(assigneeId);
    }
    if (priority) {
      sql += ` AND i.priority = ?`;
      params.push(priority);
    }
    if (type) {
      sql += ` AND i.type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY i.created_at DESC`;
    const issues = await query(sql, params);
    res.json(issues);
  } catch (err) {
    next(err);
  }
};

exports.getIssueDetail = async (req, res, next) => {
  try {
    const { issueId } = req.body;
    const issues = await query('SELECT * FROM Issue WHERE id = ?', [issueId]);
    if (issues.length === 0) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    const issue = issues[0];

    const comments = await query(
      `SELECT ic.id, ic.issue_id, ic.user_id, ic.content, ic.created_at, u.full_name as user_name 
       FROM IssueComments ic 
       LEFT JOIN User u ON ic.user_id = u.user_id 
       WHERE ic.issue_id = ? 
       ORDER BY ic.created_at ASC`,
      [issueId]
    );

    const history = await query(
      `SELECT ih.id, ih.issue_id, ih.user_id, ih.field_changed, ih.old_value, ih.new_value, ih.changed_at, u.full_name as user_name 
       FROM IssueHistory ih 
       LEFT JOIN User u ON ih.user_id = u.user_id 
       WHERE ih.issue_id = ? 
       ORDER BY ih.changed_at DESC`,
      [issueId]
    );

    res.json({ issue, comments, history });
  } catch (err) {
    next(err);
  }
};

exports.createIssue = async (req, res, next) => {
  try {
    const { project_id, summary, description, type, status, priority, reporter_id, assignee_id, epic_id, parent_id } = req.body;

    // Get project key
    const proj = await query('SELECT project_key FROM Project WHERE project_id = ?', [project_id]);
    let projKey = 'PRJ';
    if (proj.length > 0 && proj[0].project_key) {
      projKey = proj[0].project_key;
    }

    // Get maximum issue key number
    const maxResult = await query(
      `SELECT MAX(CAST(SUBSTRING_INDEX(issue_key, '-', -1) AS UNSIGNED)) as max_num 
       FROM Issue 
       WHERE project_id = ?`,
      [project_id]
    );

    const nextNum = (maxResult[0].max_num || 100) + 1; // start from 101 like JIRA
    const issueKey = `${projKey}-${nextNum}`;

    const result = await query(
      `INSERT INTO Issue (issue_key, project_id, summary, description, type, status, priority, reporter_id, assignee_id, epic_id, parent_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [issueKey, project_id, summary, description, type, status || 'TO_DO', priority || 'MEDIUM', reporter_id, assignee_id || null, epic_id || null, parent_id || null]
    );

    const newId = result.insertId;

    // Save initial history
    await query(
      'INSERT INTO IssueHistory (issue_id, user_id, field_changed, old_value, new_value) VALUES (?, ?, ?, ?, ?)',
      [newId, reporter_id, 'created', null, issueKey]
    );

    // If assignee is set, notify them
    if (assignee_id) {
      await query(
        'INSERT INTO Notificyations (user_id, title, content, link_url, is_read) VALUES (?, ?, ?, ?, ?)',
        [
          assignee_id,
          'Bạn được phân công một Issue mới',
          `Bạn vừa được phân công giải quyết Issue: "${summary}" (${issueKey})`,
          `#projects/${project_id}`,
          false
        ]
      );
    }

    res.json({ success: true, id: newId, issue_key: issueKey });
  } catch (err) {
    next(err);
  }
};

exports.updateIssue = async (req, res, next) => {
  try {
    const { id, summary, description, type, status, priority, assignee_id, epic_id, parent_id, userId } = req.body;

    const oldIssues = await query('SELECT * FROM Issue WHERE id = ?', [id]);
    if (oldIssues.length === 0) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    const old = oldIssues[0];

    await query(
      `UPDATE Issue 
       SET summary = ?, description = ?, type = ?, status = ?, priority = ?, assignee_id = ?, epic_id = ?, parent_id = ? 
       WHERE id = ?`,
      [summary, description, type, status, priority, assignee_id || null, epic_id || null, parent_id || null, id]
    );

    const trackChange = async (field, oldVal, newVal) => {
      if (oldVal !== newVal) {
        await query(
          'INSERT INTO IssueHistory (issue_id, user_id, field_changed, old_value, new_value) VALUES (?, ?, ?, ?, ?)',
          [id, userId, field, oldVal ? String(oldVal) : null, newVal ? String(newVal) : null]
        );
      }
    };

    await trackChange('summary', old.summary, summary);
    await trackChange('description', old.description, description);
    await trackChange('type', old.type, type);
    await trackChange('status', old.status, status);
    await trackChange('priority', old.priority, priority);
    await trackChange('assignee_id', old.assignee_id, assignee_id);
    await trackChange('epic_id', old.epic_id, epic_id);
    await trackChange('parent_id', old.parent_id, parent_id);

    // If assignee was changed, notify new assignee
    if (assignee_id && old.assignee_id !== assignee_id) {
      await query(
        'INSERT INTO Notificyations (user_id, title, content, link_url, is_read) VALUES (?, ?, ?, ?, ?)',
        [
          assignee_id,
          'Bạn được phân công một Issue',
          `Bạn vừa được phân công giải quyết Issue: "${summary}" (${old.issue_key})`,
          `#projects/${old.project_id}`,
          false
        ]
      );
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.updateIssueStatus = async (req, res, next) => {
  try {
    const { issueId, status, userId } = req.body;

    const oldIssues = await query('SELECT status, issue_key, project_id FROM Issue WHERE id = ?', [issueId]);
    if (oldIssues.length === 0) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    const old = oldIssues[0];

    await query('UPDATE Issue SET status = ? WHERE id = ?', [status, issueId]);

    if (old.status !== status) {
      await query(
        'INSERT INTO IssueHistory (issue_id, user_id, field_changed, old_value, new_value) VALUES (?, ?, ?, ?, ?)',
        [issueId, userId, 'status', old.status, status]
      );
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.deleteIssue = async (req, res, next) => {
  try {
    const { issueId } = req.body;
    await query('DELETE FROM Issue WHERE id = ?', [issueId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.addComment = async (req, res, next) => {
  try {
    const { issueId, userId, content } = req.body;
    const result = await query(
      'INSERT INTO IssueComments (issue_id, user_id, content) VALUES (?, ?, ?)',
      [issueId, userId, content]
    );
    res.json({ success: true, commentId: result.insertId });
  } catch (err) {
    next(err);
  }
};

exports.deleteComment = async (req, res, next) => {
  try {
    const { commentId } = req.body;
    await query('DELETE FROM IssueComments WHERE id = ?', [commentId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// Keep old API methods for backward compatibility to prevent routes/controllers crashes
exports.getIssueTags = async (req, res, next) => {
  try {
    res.json([]);
  } catch (err) {
    next(err);
  }
};

exports.saveIssue = async (req, res, next) => {
  try {
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
