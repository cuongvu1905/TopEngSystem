const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const prisma = require('../config/prisma');

const manpowerDir = path.join(__dirname, '../uploads/manpower');
if (!fs.existsSync(manpowerDir)) {
  fs.mkdirSync(manpowerDir, { recursive: true });
}

// Format check plus a real-calendar check, so values like "2026-02-31" or "2026-13-01"
// are rejected instead of creating a junk report row/file.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isValidReportDate(value) {
  if (!value || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDisplayDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// Mirrors authController/projectController: role is resolved from the requester's own
// user row rather than trusted from the request payload.
async function isRequesterAdmin(requesterId) {
  if (!requesterId) return false;
  const requester = await prisma.user.findUnique({
    where: { user_id: requesterId },
    select: { role: true }
  });
  return !!(requester && requester.role && requester.role.includes('Admin'));
}

// A board/project belongs to exactly one Team or Part (a department_id). '' means the
// legacy "unscoped" rows created before scoping existed.
function normalizeScope(departmentId) {
  return typeof departmentId === 'string' ? departmentId.trim() : '';
}

// department_id goes into a file name, so keep it to filesystem-safe characters.
function scopeFileSuffix(scope) {
  if (!scope) return '';
  return '-' + scope.replace(/[^A-Za-z0-9_-]/g, '_');
}

// Each day's board is persisted as a real, standalone .html file (openable/printable
// on its own). The structured data is embedded in a <script type="application/json">
// block inside that same file, so the app can read the exact numbers back for editing
// instead of having to scrape the rendered table markup.
const DATA_SCRIPT_OPEN = '<script type="application/json" id="manpower-data">';
const DATA_SCRIPT_CLOSE = '</script>';

function buildReportHtml(dateStr, payload) {
  const { locations = [], rows = [], department_name: departmentName = '' } = payload;
  const scopeLine = departmentName
    ? `<p class="scope">Bộ phận: ${escapeHtml(departmentName)}</p>`
    : '';
  const headerCells = locations.map(loc => `<th>${escapeHtml(loc.name)}</th>`).join('');
  const bodyRows = rows.map(row => {
    const valueCells = locations
      .map(loc => `<td class="num">${escapeHtml(row.values?.[loc.manpower_location_id] ?? '')}</td>`)
      .join('');
    return `      <tr><th class="row-head">${escapeHtml(row.project_name)}</th>${valueCells}<td class="detail">${escapeHtml(row.detail ?? '')}</td></tr>`;
  }).join('\n');

  // JSON is embedded verbatim except for "</" which would otherwise close the script
  // element early; JSON.parse still sees a valid document after the < escape.
  const embeddedJson = JSON.stringify(payload).replace(/</g, '\\u003c');

  const totalManpower = rows.reduce((sum, row) => (
    sum + locations.reduce((rowSum, loc) => {
      const n = parseInt(row.values?.[loc.manpower_location_id], 10);
      return rowSum + (Number.isNaN(n) ? 0 : n);
    }, 0)
  ), 0);

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>Bảng nhân lực ngày ${formatDisplayDate(dateStr)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #0f172a; }
  h1 { font-size: 18px; margin: 0 0 8px 0; }
  .scope { font-size: 14px; margin: 0 0 4px 0; }
  .total { font-size: 14px; font-weight: bold; margin: 0 0 16px 0; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { border: 1px solid #94a3b8; padding: 6px 8px; vertical-align: top; }
  thead th { background-color: #e2e8f0; text-align: center; }
  th.row-head { background-color: #f1f5f9; text-align: left; white-space: nowrap; }
  td.num { text-align: center; }
  /* Detail cells may hold multi-line text typed by the user */
  td.detail { text-align: left; white-space: pre-wrap; }
</style>
</head>
<body>
<h1>Bảng nhân lực ngày ${formatDisplayDate(dateStr)}</h1>
${scopeLine}
<p class="total">Tổng nhân lực: ${totalManpower}</p>
<table>
  <thead>
    <tr><th></th>${headerCells}<th>Chi tiết công việc của dự án</th></tr>
  </thead>
  <tbody>
${bodyRows}
  </tbody>
</table>
${DATA_SCRIPT_OPEN}${embeddedJson}${DATA_SCRIPT_CLOSE}
</body>
</html>
`;
}

function extractPayloadFromHtml(html) {
  const start = html.indexOf(DATA_SCRIPT_OPEN);
  if (start === -1) return null;
  const from = start + DATA_SCRIPT_OPEN.length;
  const end = html.indexOf(DATA_SCRIPT_CLOSE, from);
  if (end === -1) return null;
  try {
    return JSON.parse(html.slice(from, end).replace(/\\u003c/g, '<'));
  } catch (e) {
    return null;
  }
}

// ---------- Manpower projects ----------

// departmentIds scopes the result to a Team and/or its Parts. Omitting it returns every
// project (used only by Admin-wide views); an empty array is an explicit "nothing".
exports.getManpowerProjects = async (req, res, next) => {
  try {
    const { departmentIds } = req.body || {};
    const where = Array.isArray(departmentIds) ? { department_id: { in: departmentIds } } : {};
    const list = await prisma.manpowerproject.findMany({
      where,
      orderBy: [{ row_order: 'asc' }, { id: 'asc' }]
    });
    res.json(list);
  } catch (err) {
    next(err);
  }
};

exports.createManpowerProject = async (req, res, next) => {
  try {
    const { name, departmentId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tên dự án không được để trống' });
    }
    const scope = normalizeScope(departmentId);
    if (!scope) {
      return res.status(400).json({ error: 'Vui lòng chọn Team hoặc Part cho dự án.' });
    }
    const maxRow = await prisma.manpowerproject.aggregate({ _max: { row_order: true } });
    const created = await prisma.manpowerproject.create({
      data: {
        manpower_project_id: 'mprj-' + crypto.randomUUID(),
        name: name.trim(),
        department_id: scope,
        row_order: (maxRow._max.row_order || 0) + 1
      }
    });
    res.json(created);
  } catch (err) {
    next(err);
  }
};

// Moves a project to another Team/Part. Also the way legacy projects created before
// scoping existed (department_id = '') get assigned to a real Team or Part.
exports.setManpowerProjectScope = async (req, res, next) => {
  try {
    const { manpowerProjectId, departmentId } = req.body;
    if (!manpowerProjectId) {
      return res.status(400).json({ error: 'Thiếu mã dự án' });
    }
    const scope = normalizeScope(departmentId);
    if (!scope) {
      return res.status(400).json({ error: 'Vui lòng chọn Team hoặc Part cho dự án.' });
    }
    const updated = await prisma.manpowerproject.update({
      where: { manpower_project_id: manpowerProjectId },
      data: { department_id: scope }
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

exports.renameManpowerProject = async (req, res, next) => {
  try {
    const { manpowerProjectId, name } = req.body;
    if (!manpowerProjectId) {
      return res.status(400).json({ error: 'Thiếu mã dự án' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tên dự án không được để trống' });
    }
    const updated = await prisma.manpowerproject.update({
      where: { manpower_project_id: manpowerProjectId },
      data: { name: name.trim() }
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

exports.deleteManpowerProject = async (req, res, next) => {
  try {
    const { manpowerProjectId } = req.body;
    if (!manpowerProjectId) {
      return res.status(400).json({ error: 'Thiếu mã dự án' });
    }
    await prisma.manpowerproject.delete({ where: { manpower_project_id: manpowerProjectId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ---------- Work locations (the board's columns) ----------

exports.getManpowerLocations = async (req, res, next) => {
  try {
    const list = await prisma.manpowerlocation.findMany({
      orderBy: [{ col_order: 'asc' }, { id: 'asc' }]
    });
    res.json(list);
  } catch (err) {
    next(err);
  }
};

exports.createManpowerLocation = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tên địa điểm làm việc không được để trống' });
    }
    const maxCol = await prisma.manpowerlocation.aggregate({ _max: { col_order: true } });
    const created = await prisma.manpowerlocation.create({
      data: {
        manpower_location_id: 'mloc-' + crypto.randomUUID(),
        name: name.trim(),
        col_order: (maxCol._max.col_order || 0) + 1
      }
    });
    res.json(created);
  } catch (err) {
    next(err);
  }
};

exports.renameManpowerLocation = async (req, res, next) => {
  try {
    const { manpowerLocationId, name } = req.body;
    if (!manpowerLocationId) {
      return res.status(400).json({ error: 'Thiếu mã địa điểm làm việc' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tên địa điểm làm việc không được để trống' });
    }
    const updated = await prisma.manpowerlocation.update({
      where: { manpower_location_id: manpowerLocationId },
      data: { name: name.trim() }
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

exports.deleteManpowerLocation = async (req, res, next) => {
  try {
    const { manpowerLocationId } = req.body;
    if (!manpowerLocationId) {
      return res.status(400).json({ error: 'Thiếu mã địa điểm làm việc' });
    }
    await prisma.manpowerlocation.delete({ where: { manpower_location_id: manpowerLocationId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ---------- Headcount derived from that day's daily reports ----------

// Counts, per (manpower project, work location), how many people reported working there
// on a given day. Derived on every read rather than incremented on save, so editing,
// re-saving or deleting a daily report can never double count or leave a stale number.
// One person counts once per project+location even if they filed several time blocks on
// it — the board tracks headcount, not hours.
// Reports are stored at local noon of their date (see dailyReportController), so a
// local midnight..23:59:59 window selects exactly that calendar day and nothing else.
function dayBounds(reportDate) {
  const [y, m, d] = reportDate.split('-').map(Number);
  return {
    dayStart: new Date(y, m - 1, d, 0, 0, 0, 0),
    dayEnd: new Date(y, m - 1, d, 23, 59, 59, 999)
  };
}

async function fetchDayReports(reportDate, extraWhere = {}) {
  const { dayStart, dayEnd } = dayBounds(reportDate);
  return prisma.dailyreport.findMany({
    where: {
      created_at: { gte: dayStart, lte: dayEnd },
      // Project Reports are a different feature and must not inflate the board.
      OR: [{ comment: null }, { comment: { not: 'PROJECT_REPORT' } }],
      ...extraWhere
    },
    orderBy: { id: 'asc' },
    select: { id: true, user_id: true, content: true, status: true, created_at: true }
  });
}

function parseCards(content) {
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return []; // a legacy free-text report has no cards to read
  }
}

// Which cell a person belongs to for the day: the LAST time block they filed that names
// both a project and a work location. Someone who moved between projects/locations
// during the day is therefore counted exactly once, at where they ended up.
function pickLastPlacedCard(cards) {
  let best = null;
  cards.forEach((card, index) => {
    if (!card?.projectId || !card?.locationId) return;
    const start = String(card.startTime || '');
    const end = String(card.endTime || '');
    if (!best
      || start > best.start
      || (start === best.start && end > best.end)
      || (start === best.start && end === best.end && index > best.index)) {
      best = { card, start, end, index };
    }
  });
  return best ? best.card : null;
}

// Drops the people belonging to a Part the viewer has un-ticked in the board's Team
// picker. Deliberately expressed as an *exclude* list rather than an include list: with
// every Part ticked the caller passes nothing and the result is byte-identical to no
// filtering, so people with no department, or one outside the Team tree, are never
// silently dropped from a board that used to show them.
async function dropExcludedDepartments(occupants, excludedDepartmentIds) {
  const excluded = new Set((excludedDepartmentIds || []).filter(Boolean));
  if (excluded.size === 0 || occupants.length === 0) return occupants;

  const users = await prisma.user.findMany({
    where: { user_id: { in: [...new Set(occupants.map(o => o.userId))] } },
    select: { user_id: true, department_id: true }
  });
  const deptByUser = new Map(users.map(u => [u.user_id, u.department_id]));
  return occupants.filter(o => !excluded.has(deptByUser.get(o.userId)));
}

// Everyone placed into a cell for a day: one entry per person from their last time
// block, plus anyone an Admin/Team Leader/Part Leader added by hand.
async function collectCellOccupants(reportDate) {
  const reports = await fetchDayReports(reportDate);

  // A person may have several report rows in a day (e.g. a draft plus a submission);
  // merge all their cards before choosing the last placed one.
  const cardsByUser = new Map();
  for (const report of reports) {
    const list = cardsByUser.get(report.user_id) || [];
    list.push(...parseCards(report.content));
    cardsByUser.set(report.user_id, list);
  }

  const occupants = []; // { userId, projectId, locationId, source }
  for (const [userId, cards] of cardsByUser.entries()) {
    const placed = pickLastPlacedCard(cards);
    if (!placed) continue;
    occupants.push({
      userId,
      projectId: placed.projectId,
      locationId: placed.locationId,
      source: 'report'
    });
  }

  const manual = await prisma.manpowercellmember.findMany({ where: { report_date: reportDate } });
  for (const row of manual) {
    // A hand-added entry never double counts someone their report already placed.
    if (occupants.some(o => o.userId === row.user_id)) continue;
    occupants.push({
      userId: row.user_id,
      projectId: row.manpower_project_id,
      locationId: row.manpower_location_id,
      source: 'manual'
    });
  }

  return occupants;
}

exports.getManpowerHeadcount = async (req, res, next) => {
  try {
    const { reportDate, departmentIds, excludedDepartmentIds } = req.body;
    if (!isValidReportDate(reportDate)) {
      return res.status(400).json({ error: 'Ngày báo cáo không hợp lệ (định dạng YYYY-MM-DD).' });
    }

    const scopedProjects = Array.isArray(departmentIds)
      ? await prisma.manpowerproject.findMany({
        where: { department_id: { in: departmentIds } },
        select: { manpower_project_id: true }
      })
      : await prisma.manpowerproject.findMany({ select: { manpower_project_id: true } });
    const allowedProjects = new Set(scopedProjects.map(p => p.manpower_project_id));

    const occupants = await dropExcludedDepartments(
      (await collectCellOccupants(reportDate)).filter(o => allowedProjects.has(o.projectId)),
      excludedDepartmentIds
    );

    // Names ride along with the counts so the board can show who is in a cell on hover
    // without a second round trip per cell.
    const userRows = occupants.length > 0
      ? await prisma.user.findMany({
        where: { user_id: { in: [...new Set(occupants.map(o => o.userId))] } },
        select: { user_id: true, full_name: true }
      })
      : [];
    const nameById = new Map(userRows.map(u => [u.user_id, u.full_name]));

    const counts = {};
    for (const occupant of occupants) {
      if (!counts[occupant.projectId]) counts[occupant.projectId] = {};
      const cell = counts[occupant.projectId][occupant.locationId] || { count: 0, names: [] };
      cell.count += 1;
      cell.names.push(nameById.get(occupant.userId) || occupant.userId);
      counts[occupant.projectId][occupant.locationId] = cell;
    }
    Object.values(counts).forEach(byLocation =>
      Object.values(byLocation).forEach(cell => cell.names.sort((a, b) => a.localeCompare(b))));

    res.json(counts);
  } catch (err) {
    next(err);
  }
};

// The people making up one cell's number, for the cell detail popup.
exports.getManpowerCellMembers = async (req, res, next) => {
  try {
    const { reportDate, manpowerProjectId, manpowerLocationId, excludedDepartmentIds } = req.body;
    if (!isValidReportDate(reportDate)) {
      return res.status(400).json({ error: 'Ngày báo cáo không hợp lệ (định dạng YYYY-MM-DD).' });
    }
    if (!manpowerProjectId || !manpowerLocationId) {
      return res.status(400).json({ error: 'Thiếu mã dự án hoặc địa điểm làm việc.' });
    }

    // Same Part filter as the board, so the number on a cell and the names inside its
    // popup can never disagree.
    const occupants = await dropExcludedDepartments(
      (await collectCellOccupants(reportDate))
        .filter(o => o.projectId === manpowerProjectId && o.locationId === manpowerLocationId),
      excludedDepartmentIds
    );

    const users = occupants.length > 0
      ? await prisma.user.findMany({
        where: { user_id: { in: occupants.map(o => o.userId) } },
        select: { user_id: true, full_name: true, email: true, role: true }
      })
      : [];
    const byId = new Map(users.map(u => [u.user_id, u]));

    res.json(occupants.map(o => ({
      user_id: o.userId,
      user_name: byId.get(o.userId)?.full_name || o.userId,
      email: byId.get(o.userId)?.email || '',
      role: byId.get(o.userId)?.role || '',
      source: o.source
    })).sort((a, b) => a.user_name.localeCompare(b.user_name)));
  } catch (err) {
    next(err);
  }
};

// Every time block a person filed on that day — the board only counts their last one,
// but the popup shows the full picture.
exports.getUserDayReports = async (req, res, next) => {
  try {
    const { reportDate, userId } = req.body;
    if (!isValidReportDate(reportDate)) {
      return res.status(400).json({ error: 'Ngày báo cáo không hợp lệ (định dạng YYYY-MM-DD).' });
    }
    if (!userId) {
      return res.status(400).json({ error: 'Thiếu mã người dùng.' });
    }

    const reports = await fetchDayReports(reportDate, { user_id: userId });
    const [projects, locations] = await Promise.all([
      prisma.manpowerproject.findMany({ select: { manpower_project_id: true, name: true } }),
      prisma.manpowerlocation.findMany({ select: { manpower_location_id: true, name: true } })
    ]);
    const projectName = new Map(projects.map(p => [p.manpower_project_id, p.name]));
    const locationName = new Map(locations.map(l => [l.manpower_location_id, l.name]));

    res.json(reports.map(report => ({
      id: report.id,
      status: report.status,
      created_at: report.created_at,
      cards: parseCards(report.content).map(card => ({
        startTime: card?.startTime || '',
        endTime: card?.endTime || '',
        content: card?.content || '',
        fileName: card?.fileName || '',
        fileUrl: card?.fileUrl || '',
        // Prefer the name captured when the report was written, so a later rename or
        // deletion of the project/location never rewrites history.
        projectName: card?.projectName || projectName.get(card?.projectId) || '',
        locationName: card?.locationName || locationName.get(card?.locationId) || ''
      }))
    })));
  } catch (err) {
    next(err);
  }
};

// Org structure is BOD (root) -> Team -> Part, so a department's Team is its depth-1
// ancestor. Mirrors src/utils/orgScope.js, kept here because the backend is CommonJS.
async function resolveOwningTeamId(departmentId) {
  if (!departmentId) return null;
  const departments = await prisma.department.findMany({
    select: { department_id: true, parent_id: true }
  });
  const byId = new Map(departments.map(d => [d.department_id, d]));

  const chain = [];
  let current = byId.get(departmentId);
  const seen = new Set();
  while (current && !seen.has(current.department_id)) {
    seen.add(current.department_id);
    chain.unshift(current.department_id); // root first
    current = current.parent_id ? byId.get(current.parent_id) : null;
  }
  // chain[0] is the root (BOD), chain[1] is the Team
  return chain.length >= 2 ? chain[1] : null;
}

// Everyone already accounted for on that date, whether by their own daily report or by
// having been added to some cell by hand. The "add member by hand" picker hides them:
// each person belongs to exactly one cell, so offering them again in another cell would
// either duplicate the headcount or contradict where they already are.
exports.getPlacedUserIds = async (req, res, next) => {
  try {
    const { reportDate } = req.body;
    if (!isValidReportDate(reportDate)) {
      return res.status(400).json({ error: 'Ngày báo cáo không hợp lệ (định dạng YYYY-MM-DD).' });
    }
    const [reports, manual] = await Promise.all([
      fetchDayReports(reportDate),
      prisma.manpowercellmember.findMany({
        where: { report_date: reportDate },
        select: { user_id: true }
      })
    ]);
    res.json([...new Set([
      ...reports.map(r => r.user_id),
      ...manual.map(m => m.user_id)
    ])]);
  } catch (err) {
    next(err);
  }
};

exports.addManpowerCellMember = async (req, res, next) => {
  try {
    const { reportDate, manpowerProjectId, manpowerLocationId, userId, addedBy } = req.body;
    if (!isValidReportDate(reportDate)) {
      return res.status(400).json({ error: 'Ngày báo cáo không hợp lệ (định dạng YYYY-MM-DD).' });
    }
    if (!manpowerProjectId || !manpowerLocationId || !userId) {
      return res.status(400).json({ error: 'Thiếu dự án, địa điểm làm việc hoặc thành viên.' });
    }

    // A Team Leader / Part Leader may only add people from their own Team (any Part of
    // it). Enforced here as well as in the dropdown, so the restriction cannot be
    // sidestepped by calling the API directly.
    if (!(await isRequesterAdmin(addedBy))) {
      const [adder, target] = await Promise.all([
        prisma.user.findUnique({ where: { user_id: addedBy || '' }, select: { department_id: true } }),
        prisma.user.findUnique({ where: { user_id: userId }, select: { department_id: true } })
      ]);
      const adderTeam = await resolveOwningTeamId(adder?.department_id);
      const targetTeam = await resolveOwningTeamId(target?.department_id);
      if (!adderTeam || adderTeam !== targetTeam) {
        return res.status(403).json({ error: 'Bạn chỉ có thể thêm thành viên thuộc Team của mình.' });
      }
    }

    // Anyone who filed a daily report that day is placed by their own report, so they
    // must not also be added by hand. Kept in step with the picker, which hides them.
    const ownReports = await fetchDayReports(reportDate, { user_id: userId });
    if (ownReports.length > 0) {
      return res.status(400).json({ error: 'Thành viên này đã có báo cáo ngày hôm đó nên không thể thêm thủ công.' });
    }

    // One person belongs to exactly one cell per day. Without this, the same person
    // could be pinned to two cells and be counted twice.
    const placedElsewhere = await prisma.manpowercellmember.findFirst({
      where: {
        report_date: reportDate,
        user_id: userId,
        NOT: { manpower_project_id: manpowerProjectId, manpower_location_id: manpowerLocationId }
      }
    });
    if (placedElsewhere) {
      return res.status(400).json({ error: 'Thành viên này đã được thêm vào một ô khác trong ngày. Vui lòng xóa khỏi ô đó trước.' });
    }

    await prisma.manpowercellmember.upsert({
      where: {
        report_date_manpower_project_id_manpower_location_id_user_id: {
          report_date: reportDate,
          manpower_project_id: manpowerProjectId,
          manpower_location_id: manpowerLocationId,
          user_id: userId
        }
      },
      create: {
        report_date: reportDate,
        manpower_project_id: manpowerProjectId,
        manpower_location_id: manpowerLocationId,
        user_id: userId,
        added_by: addedBy || null
      },
      update: { added_by: addedBy || null }
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.removeManpowerCellMember = async (req, res, next) => {
  try {
    const { reportDate, manpowerProjectId, manpowerLocationId, userId } = req.body;
    if (!isValidReportDate(reportDate) || !manpowerProjectId || !manpowerLocationId || !userId) {
      return res.status(400).json({ error: 'Thiếu thông tin để xóa thành viên khỏi ô.' });
    }
    await prisma.manpowercellmember.deleteMany({
      where: {
        report_date: reportDate,
        manpower_project_id: manpowerProjectId,
        manpower_location_id: manpowerLocationId,
        user_id: userId
      }
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ---------- Daily manpower reports (.html files) ----------

exports.getManpowerReports = async (req, res, next) => {
  try {
    const { departmentId } = req.body || {};
    const where = departmentId === undefined ? {} : { department_id: normalizeScope(departmentId) };
    const list = await prisma.manpowerreport.findMany({
      where,
      orderBy: { report_date: 'desc' },
      take: 365
    });
    res.json(list.map(r => ({
      report_date: r.report_date,
      department_id: r.department_id,
      file_name: r.file_name,
      updated_by: r.updated_by,
      updated_at: r.updated_at
    })));
  } catch (err) {
    next(err);
  }
};

exports.getManpowerReport = async (req, res, next) => {
  try {
    const { reportDate, departmentId } = req.body;
    if (!isValidReportDate(reportDate)) {
      return res.status(400).json({ error: 'Ngày báo cáo không hợp lệ (định dạng YYYY-MM-DD).' });
    }
    const scope = normalizeScope(departmentId);

    const row = await prisma.manpowerreport.findUnique({
      where: { report_date_department_id: { report_date: reportDate, department_id: scope } }
    });
    if (!row) {
      // A day that has never been saved is not an error — the UI opens a blank board.
      return res.json({ exists: false, report_date: reportDate, data: null });
    }

    const absolutePath = path.join(__dirname, '..', row.file_path);
    if (!fs.existsSync(absolutePath)) {
      return res.json({ exists: false, report_date: reportDate, data: null });
    }

    const html = fs.readFileSync(absolutePath, 'utf8');
    res.json({
      exists: true,
      report_date: reportDate,
      file_name: row.file_name,
      updated_by: row.updated_by,
      updated_at: row.updated_at,
      data: extractPayloadFromHtml(html)
    });
  } catch (err) {
    next(err);
  }
};

exports.saveManpowerReport = async (req, res, next) => {
  try {
    const { reportDate, departmentId, departmentName, locations, rows, savedBy } = req.body;
    if (!isValidReportDate(reportDate)) {
      return res.status(400).json({ error: 'Ngày báo cáo không hợp lệ (định dạng YYYY-MM-DD).' });
    }
    const scope = normalizeScope(departmentId);

    // The locations/rows actually in effect are snapshotted into the file, so a saved
    // day keeps rendering exactly as it was even if projects/locations change later.
    const payload = {
      report_date: reportDate,
      department_id: scope,
      department_name: departmentName || '',
      locations: Array.isArray(locations) ? locations : [],
      rows: Array.isArray(rows) ? rows : []
    };

    // One file per (day, Team/Part). Legacy unscoped boards keep their original name.
    const fileName = `manpower-${reportDate}${scopeFileSuffix(scope)}.html`;
    const relativePath = `/uploads/manpower/${fileName}`;
    fs.writeFileSync(path.join(manpowerDir, fileName), buildReportHtml(reportDate, payload), 'utf8');

    const saved = await prisma.manpowerreport.upsert({
      where: { report_date_department_id: { report_date: reportDate, department_id: scope } },
      create: {
        report_date: reportDate,
        department_id: scope,
        file_name: fileName,
        file_path: relativePath,
        updated_by: savedBy || null,
        updated_at: new Date()
      },
      update: {
        file_name: fileName,
        file_path: relativePath,
        updated_by: savedBy || null,
        updated_at: new Date()
      }
    });

    res.json({ success: true, report_date: saved.report_date, department_id: saved.department_id, file_name: saved.file_name });
  } catch (err) {
    next(err);
  }
};

exports.deleteManpowerReport = async (req, res, next) => {
  try {
    const { reportDate, departmentId, requesterId } = req.body;
    if (!isValidReportDate(reportDate)) {
      return res.status(400).json({ error: 'Ngày báo cáo không hợp lệ (định dạng YYYY-MM-DD).' });
    }

    // Deleting a day's board is Admin-only, enforced here as well as in the UI so a
    // Team Leader / Part Leader cannot do it by calling the API directly.
    if (!(await isRequesterAdmin(requesterId))) {
      return res.status(403).json({ error: 'Chỉ tài khoản Admin mới có quyền xóa bảng nhân lực.' });
    }

    const scope = normalizeScope(departmentId);

    const row = await prisma.manpowerreport.findUnique({
      where: { report_date_department_id: { report_date: reportDate, department_id: scope } }
    });
    if (row) {
      const absolutePath = path.join(__dirname, '..', row.file_path);
      fs.unlink(absolutePath, (err) => {
        if (err && err.code !== 'ENOENT') console.error('Failed to delete manpower file:', absolutePath, err.message);
      });
      await prisma.manpowerreport.delete({ where: { id: row.id } });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.downloadManpowerReport = async (req, res, next) => {
  try {
    const { reportDate } = req.params;
    if (!isValidReportDate(reportDate)) {
      return res.status(400).json({ error: 'Ngày báo cáo không hợp lệ.' });
    }

    // Downloading the raw .html board is temporarily Admin-only. Enforced here as well
    // as in the UI, otherwise anyone who knows the URL could still fetch the file.
    if (!(await isRequesterAdmin(req.query.requesterId))) {
      return res.status(403).json({ error: 'Chỉ tài khoản Admin mới có quyền tải xuống file bảng nhân lực.' });
    }

    // Scope arrives as a query param so this stays a plain <a href> download link.
    const scope = normalizeScope(req.query.dept);
    const row = await prisma.manpowerreport.findUnique({
      where: { report_date_department_id: { report_date: reportDate, department_id: scope } }
    });
    if (!row) {
      return res.status(404).json({ error: 'Không tìm thấy bảng nhân lực của ngày này.' });
    }
    const absolutePath = path.join(__dirname, '..', row.file_path);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'Tệp không còn tồn tại trên máy chủ.' });
    }
    res.download(absolutePath, row.file_name);
  } catch (err) {
    next(err);
  }
};
