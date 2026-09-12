const crypto = require('crypto');
const prisma = require('../config/prisma');

const REQUEST_TYPES = ['overtime', 'leave'];
const LEAVE_KINDS = ['morning', 'afternoon', 'full'];
const DECISIONS = ['Approved', 'Rejected'];

// The whole lifecycle in one place, so the buttons and the endpoints cannot drift apart:
//
//   Pending  -> the approver may approve or reject it; the filer may edit or delete it
//   Approved -> the approver may still reject it later; the filer may not touch it
//   Rejected -> it is back with the filer, who edits and resubmits it, or deletes it
//
// Editing always sends a request back to Pending, which is what "resubmit" means here.
function filerMayChange(status) {
  return status === 'Pending' || status === 'Rejected';
}
function approverMayDecide(status, decision) {
  if (status === 'Pending') return true;
  // An approval is not final: something changed, the request can still be turned down.
  if (status === 'Approved') return decision === 'Rejected';
  // Already rejected: the filer has it now, nothing to decide until they resubmit.
  return false;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Roles are always read from the requester's own row. Nothing here trusts a role, a
// department or an approver name sent in the request body: a hidden button is not a
// permission check, and neither is a form field.
async function loadUser(userId) {
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { user_id: userId },
    select: {
      user_id: true, full_name: true, role: true, department_id: true,
      partleadership: { select: { department_id: true } }
    }
  });
}

function isAdminLike(role) {
  const r = role || '';
  return r.includes('Admin') || r.includes('Owner') || r.includes('Quản trị viên');
}

// Org structure is BOD (root) -> Team -> Part. Everything below a department, including
// the department itself. The seen-set is what stops a mis-entered parent chain from
// looping forever.
function collectSubtree(departments, rootId) {
  if (!rootId) return [];
  const byParent = new Map();
  departments.forEach(dept => {
    const key = dept.parent_id || '';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(dept.department_id);
  });
  const ids = [];
  const seen = new Set();
  let frontier = [rootId];
  while (frontier.length > 0) {
    const next = [];
    frontier.forEach(id => {
      if (seen.has(id)) return;
      seen.add(id);
      ids.push(id);
      next.push(...(byParent.get(id) || []));
    });
    frontier = next;
  }
  return ids;
}

// A department's Team is its depth-1 ancestor (the child of the BOD root).
function owningTeamId(departments, departmentId) {
  const byId = new Map(departments.map(d => [d.department_id, d]));
  const chain = [];
  const seen = new Set();
  let current = byId.get(departmentId);
  while (current && !seen.has(current.department_id)) {
    seen.add(current.department_id);
    chain.unshift(current.department_id);
    current = current.parent_id ? byId.get(current.parent_id) : null;
  }
  return chain.length >= 2 ? chain[1] : (chain[0] || null);
}

// Which departments' requests this person may see and decide on.
//   Admin      -> every department (optionally narrowed to one Team by the picker)
//   Team Leader-> their whole Team, every Part in it
//   Part Leader-> only the Part(s) they lead
// Returns null when the person manages nothing at all.
async function managedDepartmentIds(user, teamFilterId) {
  if (!user) return null;
  const departments = await prisma.department.findMany({
    select: { department_id: true, parent_id: true }
  });

  if (isAdminLike(user.role)) {
    if (teamFilterId) return collectSubtree(departments, teamFilterId);
    return departments.map(d => d.department_id);
  }

  if ((user.role || '').includes('Team Leader')) {
    // A Team Leader's own department is the Team, so the whole subtree is theirs.
    const team = owningTeamId(departments, user.department_id) || user.department_id;
    const ids = collectSubtree(departments, team);
    if (!teamFilterId) return ids;
    // Narrowing can only ever shrink what they already manage, never widen it.
    const allowed = new Set(collectSubtree(departments, teamFilterId));
    return ids.filter(id => allowed.has(id));
  }

  if ((user.role || '').includes('Part Leader')) {
    // Their own Part, plus any extra Part they were made leader of.
    const ids = new Set([user.department_id, ...user.partleadership.map(pl => pl.department_id)]
      .filter(Boolean));
    return [...ids];
  }

  return null;
}

exports.canManageApprovals = async function canManageApprovals(userId) {
  const user = await loadUser(userId);
  const ids = await managedDepartmentIds(user);
  return Array.isArray(ids) && ids.length > 0;
};

// The Part Leader a request goes to. Falls back to the Team Leader when the Part has no
// leader of its own, so a request is never left with nobody to act on it.
async function resolveApprover(requester) {
  if (!requester?.department_id) return null;
  const leaders = await prisma.user.findMany({
    where: { role: { contains: 'Leader' } },
    select: {
      user_id: true, full_name: true, role: true, department_id: true,
      partleadership: { select: { department_id: true } }
    }
  });

  const partLeader = leaders.find(u =>
    (u.role || '').includes('Part Leader') &&
    (u.department_id === requester.department_id ||
      u.partleadership.some(pl => pl.department_id === requester.department_id)));
  if (partLeader) return partLeader;

  const departments = await prisma.department.findMany({
    select: { department_id: true, parent_id: true }
  });
  const team = owningTeamId(departments, requester.department_id);
  return leaders.find(u => (u.role || '').includes('Team Leader') && u.department_id === team) || null;
}

function parseWorkDetails(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(row => ({
      startTime: String(row?.startTime || '').trim(),
      endTime: String(row?.endTime || '').trim(),
      content: String(row?.content || '').trim()
    }))
    .filter(row => row.startTime || row.endTime || row.content);
}

function shapeRequest(row) {
  let workDetails = [];
  try {
    workDetails = row.work_details ? JSON.parse(row.work_details) : [];
  } catch (e) {
    workDetails = []; // a hand-edited row must not break the whole list
  }
  return { ...row, workDetails };
}

// Shared by create and update so a request can never be edited into a shape that would
// have been refused on the way in.
function validatePayload(body) {
  const requestType = String(body.requestType || '').trim();
  if (!REQUEST_TYPES.includes(requestType)) {
    return { error: 'Loại đơn không hợp lệ.' };
  }
  const requestDate = String(body.requestDate || '').trim();
  if (!DATE_RE.test(requestDate)) {
    return { error: 'Ngày không hợp lệ (định dạng YYYY-MM-DD).' };
  }
  const startTime = String(body.startTime || '').trim();
  const endTime = String(body.endTime || '').trim();
  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
    return { error: 'Giờ không hợp lệ (định dạng HH:MM).' };
  }
  if (endTime <= startTime) {
    return { error: 'Giờ kết thúc phải sau giờ bắt đầu.' };
  }
  const reason = String(body.reason || '').trim();
  if (!reason) {
    return { error: 'Vui lòng nhập lý do.' };
  }
  const leaveKind = String(body.leaveKind || '').trim();
  if (requestType === 'leave' && !LEAVE_KINDS.includes(leaveKind)) {
    return { error: 'Vui lòng chọn loại nghỉ phép.' };
  }
  return {
    data: {
      request_type: requestType,
      request_date: requestDate,
      start_time: startTime,
      end_time: endTime,
      reason,
      leave_kind: requestType === 'leave' ? leaveKind : null,
      project_name: String(body.projectName || '').trim() || null,
      work_location: requestType === 'overtime'
        ? (String(body.workLocation || '').trim() || null)
        : null,
      work_details: requestType === 'overtime'
        ? JSON.stringify(parseWorkDetails(body.workDetails))
        : null
    }
  };
}

// --- an employee's own requests ---------------------------------------------------

exports.getMyApprovalRequests = async (req, res, next) => {
  try {
    const { requesterId, requestType } = req.body || {};
    if (!requesterId) {
      return res.status(400).json({ error: 'Thiếu thông tin người dùng.' });
    }
    const rows = await prisma.approvalrequest.findMany({
      where: {
        requester_id: requesterId,
        ...(REQUEST_TYPES.includes(requestType) ? { request_type: requestType } : {})
      },
      // Newest first, with the id as a tiebreaker: two requests filed for the same day
      // would otherwise come back in whatever order the engine felt like.
      orderBy: [{ request_date: 'desc' }, { id: 'desc' }]
    });
    res.json(rows.map(shapeRequest));
  } catch (err) {
    next(err);
  }
};

exports.createApprovalRequest = async (req, res, next) => {
  try {
    const { requesterId } = req.body || {};
    const requester = await loadUser(requesterId);
    if (!requester) {
      return res.status(400).json({ error: 'Không tìm thấy người dùng.' });
    }
    const parsed = validatePayload(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const [department, approver] = await Promise.all([
      requester.department_id
        ? prisma.department.findUnique({
          where: { department_id: requester.department_id }, select: { name: true }
        })
        : null,
      resolveApprover(requester)
    ]);

    const created = await prisma.approvalrequest.create({
      data: {
        request_id: 'apr-' + crypto.randomUUID(),
        requester_id: requester.user_id,
        department_id: requester.department_id || null,
        employee_code: requester.user_id,
        department_name: department?.name || null,
        // Resolved from the org tree, not from what the form showed: routing must not
        // depend on a name somebody typed.
        approver_id: approver?.user_id || null,
        approver_name: approver?.full_name || null,
        status: 'Pending',
        ...parsed.data
      }
    });
    res.json(shapeRequest(created));
  } catch (err) {
    next(err);
  }
};

exports.updateApprovalRequest = async (req, res, next) => {
  try {
    const { requestId, requesterId } = req.body || {};
    const existing = await prisma.approvalrequest.findUnique({ where: { request_id: requestId } });
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy đơn.' });
    }
    // Only the person who filed it, and only while nobody has acted on it.
    if (existing.requester_id !== requesterId) {
      return res.status(403).json({ error: 'Bạn chỉ có thể sửa đơn của chính mình.' });
    }
    if (!filerMayChange(existing.status)) {
      return res.status(400).json({ error: 'Đơn đã được phê duyệt nên không thể sửa.' });
    }
    const parsed = validatePayload({ ...req.body, requestType: existing.request_type });
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const updated = await prisma.approvalrequest.update({
      where: { request_id: requestId },
      data: {
        ...parsed.data,
        // Back in the queue. The old decision is cleared so a stale "rejected by" cannot
        // sit next to a request that is waiting again; the comment stays, because it is
        // the reason the filer is meant to be addressing.
        status: 'Pending',
        decided_by: null,
        decided_at: null,
        updated_at: new Date()
      }
    });
    res.json(shapeRequest(updated));
  } catch (err) {
    next(err);
  }
};

exports.deleteApprovalRequest = async (req, res, next) => {
  try {
    const { requestId, requesterId } = req.body || {};
    const existing = await prisma.approvalrequest.findUnique({ where: { request_id: requestId } });
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy đơn.' });
    }
    const requester = await loadUser(requesterId);
    const ownsIt = existing.requester_id === requesterId;
    if (!ownsIt && !isAdminLike(requester?.role)) {
      return res.status(403).json({ error: 'Bạn chỉ có thể xóa đơn của chính mình.' });
    }
    if (ownsIt && !isAdminLike(requester?.role) && !filerMayChange(existing.status)) {
      return res.status(400).json({ error: 'Đơn đã được phê duyệt nên không thể xóa.' });
    }
    await prisma.approvalrequest.delete({ where: { request_id: requestId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// --- the approver's queue ----------------------------------------------------------

// The Teams an Admin may pick between. Team Leaders and Part Leaders get no picker:
// their scope is fixed by where they sit.
exports.getApprovalTeams = async (req, res, next) => {
  try {
    const { requesterId } = req.body || {};
    const user = await loadUser(requesterId);
    if (!isAdminLike(user?.role)) {
      return res.json([]);
    }
    const departments = await prisma.department.findMany({
      select: { department_id: true, name: true, parent_id: true, is_hidden: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }]
    });
    const byId = new Map(departments.map(d => [d.department_id, d]));
    // A Team is a department whose parent is the root, i.e. a department whose parent has
    // no parent of its own.
    const teams = departments.filter(dept => {
      if (!dept.parent_id) return false;
      const parent = byId.get(dept.parent_id);
      return !!parent && !parent.parent_id;
    });
    res.json(teams.map(t => ({ department_id: t.department_id, name: t.name })));
  } catch (err) {
    next(err);
  }
};

exports.getManagedApprovalRequests = async (req, res, next) => {
  try {
    const { requesterId, requestType, teamId, status } = req.body || {};
    const user = await loadUser(requesterId);
    const departmentIds = await managedDepartmentIds(user, teamId ? String(teamId) : null);
    if (!departmentIds || departmentIds.length === 0) {
      return res.status(403).json({ error: 'Bạn không có quyền xem đơn phê duyệt.' });
    }
    const rows = await prisma.approvalrequest.findMany({
      where: {
        department_id: { in: departmentIds },
        // Nobody approves their own request, whatever their role.
        requester_id: { not: user.user_id },
        ...(REQUEST_TYPES.includes(requestType) ? { request_type: requestType } : {}),
        ...(status ? { status: String(status) } : {})
      },
      orderBy: [{ status: 'asc' }, { request_date: 'desc' }, { id: 'desc' }]
    });

    // The names are looked up here so the list does not depend on a snapshot taken when
    // somebody's account was still called something else.
    const requesters = await prisma.user.findMany({
      where: { user_id: { in: [...new Set(rows.map(r => r.requester_id))] } },
      select: { user_id: true, full_name: true }
    });
    const nameById = new Map(requesters.map(u => [u.user_id, u.full_name]));
    res.json(rows.map(row => ({
      ...shapeRequest(row),
      requester_name: nameById.get(row.requester_id) || row.requester_id
    })));
  } catch (err) {
    next(err);
  }
};

exports.decideApprovalRequest = async (req, res, next) => {
  try {
    const { requestId, requesterId, status, comment } = req.body || {};
    if (!DECISIONS.includes(status)) {
      return res.status(400).json({ error: 'Quyết định không hợp lệ.' });
    }
    const existing = await prisma.approvalrequest.findUnique({ where: { request_id: requestId } });
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy đơn.' });
    }
    const user = await loadUser(requesterId);
    const departmentIds = await managedDepartmentIds(user);
    // The same scope that decides what the queue shows decides what may be acted on, so
    // a request nobody can see is also a request nobody can approve.
    if (!departmentIds || !departmentIds.includes(existing.department_id)) {
      return res.status(403).json({ error: 'Bạn không có quyền phê duyệt đơn này.' });
    }
    if (existing.requester_id === user.user_id) {
      return res.status(403).json({ error: 'Bạn không thể tự phê duyệt đơn của mình.' });
    }
    if (!approverMayDecide(existing.status, status)) {
      return res.status(400).json({
        error: existing.status === 'Rejected'
          ? 'Đơn đã bị từ chối, người nộp cần sửa và nộp lại.'
          : 'Đơn đã được phê duyệt, chỉ có thể từ chối.'
      });
    }

    const updated = await prisma.approvalrequest.update({
      where: { request_id: requestId },
      data: {
        status,
        comment: String(comment || '').trim() || null,
        decided_by: user.user_id,
        decided_at: new Date(),
        updated_at: new Date()
      }
    });
    res.json(shapeRequest(updated));
  } catch (err) {
    next(err);
  }
};

// Tells the frontend which tabs to render. The answer is recomputed from the database
// rather than read off the session, and every endpoint re-checks anyway.
exports.getApprovalPermissions = async (req, res, next) => {
  try {
    const { requesterId } = req.body || {};
    const user = await loadUser(requesterId);
    const departmentIds = await managedDepartmentIds(user);
    res.json({
      canManage: Array.isArray(departmentIds) && departmentIds.length > 0,
      isAdmin: isAdminLike(user?.role),
      departmentId: user?.department_id || null
    });
  } catch (err) {
    next(err);
  }
};
