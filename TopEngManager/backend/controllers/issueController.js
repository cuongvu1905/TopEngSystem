const prisma = require('../config/prisma');
const { createNotificationSafe } = require('./notificationController');

const issueLocks = {}; // key: issueId, value: { userId, userName, lockedAt }

exports.getIssues = async (req, res, next) => {
  try {
    const { projectId, searchQuery, assigneeId, priority, type } = req.body;
    
    const where = {};
    if (projectId) {
      where.project_id = projectId;
    }

    if (searchQuery) {
      where.OR = [
        { summary: { contains: searchQuery } },
        { description: { contains: searchQuery } }
      ];
    }
    if (assigneeId) {
      where.assignee_id = assigneeId;
    }
    if (priority) {
      where.priority = priority;
    }
    if (type) {
      where.type = type;
    }

    const issues = await prisma.issue.findMany({
      where,
      orderBy: { created_at: 'desc' }
    });
    
    res.json(issues);
  } catch (err) {
    next(err);
  }
};

exports.getIssueDetail = async (req, res, next) => {
  try {
    const { issueId, userId } = req.body;
    const issue = await prisma.issue.findUnique({
      where: { id: parseInt(issueId) }
    });
    
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const existingLock = issueLocks[issueId];
    const now = Date.now();
    const isLocked = existingLock && existingLock.userId !== userId && (now - existingLock.lockedAt) < 15000;

    const dbComments = await prisma.issuecomments.findMany({
      where: { issue_id: parseInt(issueId) },
      orderBy: { created_at: 'asc' },
      include: { user: true }
    });

    const comments = dbComments.map(ic => ({
      id: ic.id,
      issue_id: ic.issue_id,
      user_id: ic.user_id,
      content: ic.content,
      created_at: ic.created_at,
      user_name: ic.user ? ic.user.full_name : null
    }));

    const dbHistory = await prisma.issuehistory.findMany({
      where: { issue_id: parseInt(issueId) },
      orderBy: { changed_at: 'desc' },
      include: { user: true }
    });

    const history = dbHistory.map(ih => ({
      id: ih.id,
      issue_id: ih.issue_id,
      user_id: ih.user_id,
      field_changed: ih.field_changed,
      old_value: ih.old_value,
      new_value: ih.new_value,
      changed_at: ih.changed_at,
      user_name: ih.user ? ih.user.full_name : null
    }));

    res.json({ 
      issue, 
      comments, 
      history, 
      lock: isLocked ? { isLocked: true, lockedBy: existingLock.userName } : { isLocked: false } 
    });
  } catch (err) {
    next(err);
  }
};

exports.createIssue = async (req, res, next) => {
  try {
    const { project_id, summary, description, type, status, priority, reporter_id, assignee_id, epic_id, parent_id } = req.body;

    // Get project key
    const proj = await prisma.project.findUnique({
      where: { project_id: project_id }
    });
    const projKey = proj?.project_key || 'PRJ';

    // Get all issue keys of this project to find max index
    const issues = await prisma.issue.findMany({
      where: { project_id: project_id },
      select: { issue_key: true }
    });

    let maxNum = 0;
    issues.forEach(iss => {
      if (!iss.issue_key) return;
      const parts = iss.issue_key.split('-I');
      if (parts.length > 1) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      } else {
        // Fallback for older formats like CRM-101 or CRM_101
        const hyphenParts = iss.issue_key.split('-');
        const underscoreParts = iss.issue_key.split('_');
        const numPart = hyphenParts.length > 1 ? hyphenParts[1] : (underscoreParts.length > 1 ? underscoreParts[1] : '');
        // Extract digits
        const cleanNumPart = numPart.replace(/\D/g, '');
        if (cleanNumPart) {
          const cleanNum = parseInt(cleanNumPart, 10);
          if (!isNaN(cleanNum) && cleanNum > maxNum) {
            maxNum = cleanNum;
          }
        }
      }
    });

    const nextNum = maxNum + 1;
    const paddedNum = String(nextNum).padStart(3, '0');
    const issueKey = `${projKey}-I${paddedNum}`;

    const result = await prisma.issue.create({
      data: {
        issue_key: issueKey,
        project_id: project_id,
        summary,
        description,
        type,
        status: status || 'TO_DO',
        priority: priority || 'MEDIUM',
        reporter_id: reporter_id,
        assignee_id: assignee_id || null,
        epic_id: epic_id ? parseInt(epic_id) : null,
        parent_id: parent_id ? parseInt(parent_id) : null
      }
    });

    const newId = result.id;

    // Save initial history
    await prisma.issuehistory.create({
      data: {
        issue_id: newId,
        user_id: reporter_id,
        field_changed: 'created',
        old_value: null,
        new_value: issueKey
      }
    });

    // If assignee is set, notify them
    if (assignee_id) {
      await createNotificationSafe({
        user_id: assignee_id,
        title: 'Bạn được phân công một Issue mới',
        content: `Bạn vừa được phân công giải quyết Issue: "${summary}" (${issueKey})`,
        link_url: `#projects/${project_id}`
      });
    }

    res.json({ success: true, id: newId, issue_key: issueKey });
  } catch (err) {
    next(err);
  }
};

const checkIssuePermission = async (issueId, userId) => {
  // Find user
  const user = await prisma.user.findUnique({
    where: { user_id: userId }
  });
  if (!user) return false;

  // Find issue
  const issue = await prisma.issue.findUnique({
    where: { id: parseInt(issueId) }
  });
  if (!issue) return false;

  // Check reporter
  if (issue.reporter_id === userId) return true;

  // Check assignee
  if (issue.assignee_id === userId) return true;

  // Check description JSON fields (relatedUserIds & issueTasks)
  if (issue.description) {
    try {
      const parsed = JSON.parse(issue.description);
      if (parsed) {
        if (parsed.relatedUserIds?.includes(userId)) return true;
        if (Array.isArray(parsed.issueTasks)) {
          const isAssigned = parsed.issueTasks.some(t => {
            const assignedNames = t.assignee ? t.assignee.split('@').map(s => s.trim()).filter(Boolean) : [];
            return assignedNames.includes(user.full_name.trim());
          });
          if (isAssigned) return true;
        }
      }
    } catch (e) {
      // not JSON description
    }
  }

  return false;
};

exports.updateIssue = async (req, res, next) => {
  try {
    const { id, summary, description, type, status, priority, assignee_id, epic_id, parent_id, userId } = req.body;

    const old = await prisma.issue.findUnique({
      where: { id: parseInt(id) }
    });
    if (!old) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const hasPermission = await checkIssuePermission(id, userId);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa Issue này (Chỉ dành cho người liên quan).' });
    }

    let finalStatus = status;
    try {
      if (description) {
        const parsed = JSON.parse(description);
        if (parsed && Array.isArray(parsed.issueTasks)) {
          const hasInProgress = parsed.issueTasks.some(t => t.status === 'Đang thực hiện');
          if (hasInProgress && finalStatus === 'TO_DO') {
            finalStatus = 'IN_PROGRESS';
          }
        }
      }
    } catch (e) {
      // ignore
    }

    await prisma.issue.update({
      where: { id: parseInt(id) },
      data: {
        summary,
        description,
        type,
        status: finalStatus,
        priority,
        assignee_id: assignee_id || null,
        epic_id: epic_id ? parseInt(epic_id) : null,
        parent_id: parent_id ? parseInt(parent_id) : null
      }
    });

    const trackChange = async (field, oldVal, newVal) => {
      if (oldVal !== newVal) {
        await prisma.issuehistory.create({
          data: {
            issue_id: parseInt(id),
            user_id: userId,
            field_changed: field,
            old_value: oldVal ? String(oldVal) : null,
            new_value: newVal ? String(newVal) : null
          }
        });
      }
    };

    await trackChange('summary', old.summary, summary);
    await trackChange('description', old.description, description);
    await trackChange('type', old.type, type);
    await trackChange('status', old.status, finalStatus);
    await trackChange('priority', old.priority, priority);
    await trackChange('assignee_id', old.assignee_id, assignee_id);
    await trackChange('epic_id', old.epic_id, epic_id);
    await trackChange('parent_id', old.parent_id, parent_id);

    // If assignee was changed, notify new assignee
    if (assignee_id && old.assignee_id !== assignee_id) {
      await createNotificationSafe({
        user_id: assignee_id,
        title: 'Bạn được phân công một Issue',
        content: `Bạn vừa được phân công giải quyết Issue: "${summary}" (${old.issue_key})`,
        link_url: `#projects/${old.project_id}`
      });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.updateIssueStatus = async (req, res, next) => {
  try {
    const { issueId, status, userId } = req.body;

    // Check lock
    const lock = issueLocks[issueId];
    if (lock && lock.isLocked && lock.lockedByUserId !== userId && lock.expiresAt > Date.now()) {
      return res.status(403).json({ error: `Issue is locked by ${lock.lockedByUserName}` });
    }

    const old = await prisma.issue.findUnique({
      where: { id: parseInt(issueId) },
      select: { status: true, issue_key: true, project_id: true, description: true }
    });
    if (!old) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const hasPermission = await checkIssuePermission(issueId, userId);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa Issue này (Chỉ dành cho người liên quan).' });
    }

    let updatedDescription = old.description;
    try {
      if (old.description) {
        const parsed = JSON.parse(old.description);
        if (parsed && Array.isArray(parsed.issueTasks)) {
          parsed.issueTasks = parsed.issueTasks.map(t => {
            if (status === 'DONE') {
              return { ...t, status: 'Hoàn thành' };
            } else if (status === 'TO_DO') {
              return { ...t, status: 'Chưa thực hiện' };
            }
            return t;
          });
          updatedDescription = JSON.stringify(parsed);
        }
      }
    } catch (e) {
      // ignore
    }

    await prisma.issue.update({
      where: { id: parseInt(issueId) },
      data: { 
        status: status,
        description: updatedDescription
      }
    });

    if (old.status !== status) {
      await prisma.issuehistory.create({
        data: {
          issue_id: parseInt(issueId),
          user_id: userId,
          field_changed: 'status',
          old_value: old.status,
          new_value: status
        }
      });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.deleteIssue = async (req, res, next) => {
  try {
    const { issueId, userId } = req.body;
    if (userId) {
      const hasPermission = await checkIssuePermission(issueId, userId);
      if (!hasPermission) {
        return res.status(403).json({ error: 'Bạn không có quyền xóa Issue này (Chỉ dành cho người liên quan).' });
      }
    }
    await prisma.issue.delete({
      where: { id: parseInt(issueId) }
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.addComment = async (req, res, next) => {
  try {
    const { issueId, userId, content } = req.body;
    const result = await prisma.issuecomments.create({
      data: {
        issue_id: parseInt(issueId),
        user_id: userId,
        content: content
      }
    });
    res.json({ success: true, commentId: result.id });
  } catch (err) {
    next(err);
  }
};

exports.deleteComment = async (req, res, next) => {
  try {
    const { commentId } = req.body;
    await prisma.issuecomments.delete({
      where: { id: parseInt(commentId) }
    });
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

exports.lockIssue = async (req, res, next) => {
  try {
    const { issueId, userId } = req.body;
    const now = Date.now();
    const existingLock = issueLocks[issueId];

    if (existingLock && existingLock.userId !== userId && (now - existingLock.lockedAt) < 15000) {
      return res.json({ success: false, lockedBy: existingLock.userName, isLocked: true });
    }

    const user = await prisma.user.findUnique({
      where: { user_id: userId }
    });
    const userName = user ? user.full_name : 'Người dùng khác';

    issueLocks[issueId] = {
      userId,
      userName,
      lockedAt: now
    };

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.unlockIssue = async (req, res, next) => {
  try {
    const { issueId, userId } = req.body;
    const existingLock = issueLocks[issueId];
    if (existingLock && existingLock.userId === userId) {
      delete issueLocks[issueId];
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
