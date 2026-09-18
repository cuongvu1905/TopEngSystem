const crypto = require('crypto');
const prisma = require('../config/prisma');
const { sendMail, isMailConfigured } = require('../utils/mailer');

// Meeting-room bookings are shared: everyone in the company sees the same schedule.
// They used to live in each browser's localStorage, so a booking was only ever visible to
// the person who made it.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const IMPORTANCE = ['HIGH', 'MEDIUM', 'LOW'];

// Room and location names for the notification email. The browser has its own translated
// copies, but an email is written by the server and must read the same whatever language
// the booker happened to have selected - and the recipient is not the booker.
const LOCATION_NAMES = { HN: 'Hà Nội (HN)', VP: 'Vĩnh Phúc (VP)' };
const ROOM_NAMES = { 'room-large': 'Phòng họp lớn', 'room-small': 'Phòng họp nhỏ' };
const IMPORTANCE_NAMES = {
  HIGH: 'HIGH - Lịch họp không thể thay đổi',
  MEDIUM: 'MEDIUM - Chỉ thay đổi khi được Sếp Hàn đồng ý',
  LOW: 'LOW - Họp nội bộ, có thể thoả thuận để đổi lịch'
};
const WEEKDAY_NAMES = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

function isValidDate(value) {
  if (!value || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// Today in the server's local timezone, as the same YYYY-MM-DD the client sends.
function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Mirrors authController/projectController: the role is read from the requester's own user
// row rather than trusted from the request body.
async function isRequesterAdmin(requesterId) {
  if (!requesterId) return false;
  const requester = await prisma.user.findUnique({
    where: { user_id: requesterId },
    select: { role: true }
  });
  return !!(requester && requester.role && requester.role.includes('Admin'));
}

// The interpreters column holds JSON. A row written before the column existed, or one
// somehow left malformed, must not take the whole schedule down with it.
function parseInterpreters(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const toClient = (row) => ({
  id: row.booking_id,
  location: row.location,
  roomId: row.room_id,
  date: row.booking_date,
  startTime: row.start_time,
  endTime: row.end_time,
  team: row.team,
  bookerName: row.booker_name,
  bookerId: row.booker_id,
  purpose: row.purpose || '',
  importance: row.importance || null,
  interpreters: parseInterpreters(row.interpreters)
});

// Every interpreter already committed to a meeting that overlaps the given window.
// Rooms are deliberately not part of this: a person cannot be in two rooms at once, so a
// clash in any room - at either location - makes them unavailable.
async function busyInterpreterIds(date, startTime, endTime) {
  const busy = new Set();
  if (!isValidDate(date) || !TIME_RE.test(startTime) || !TIME_RE.test(endTime) || startTime >= endTime) {
    return busy;
  }
  const overlapping = await prisma.roombooking.findMany({
    where: {
      booking_date: date,
      interpreters: { not: null },
      // half-open intervals, same rule as the room clash check: a meeting that ends
      // exactly when another starts is not an overlap
      AND: [{ start_time: { lt: endTime } }, { end_time: { gt: startTime } }]
    },
    select: { interpreters: true }
  });
  for (const row of overlapping) {
    for (const person of parseInterpreters(row.interpreters)) {
      if (person && person.id) busy.add(person.id);
    }
  }
  return busy;
}

// Everyone who may be requested as an interpreter. Readable by any signed-in user: you
// cannot ask for an interpreter without being able to see who they are.
exports.getInterpreters = async (req, res, next) => {
  try {
    const { date, startTime, endTime } = req.body || {};
    const rows = await prisma.user.findMany({
      where: { is_interpreter: true },
      select: { user_id: true, full_name: true, email: true, department: { select: { name: true } } },
      orderBy: { full_name: 'asc' }
    });

    // An interpreter already booked against this window is left off the list entirely.
    // The count is still reported, so somebody vanishing from the list reads as "busy"
    // rather than "deleted".
    const busy = await busyInterpreterIds(date, startTime, endTime);
    const free = rows.filter(u => !busy.has(u.user_id));

    res.json({
      interpreters: free.map(u => ({
        id: u.user_id,
        name: u.full_name,
        email: u.email,
        departmentName: u.department ? u.department.name : null
      })),
      busyCount: rows.length - free.length
    });
  } catch (err) {
    next(err);
  }
};

// The whole schedule, or one location / date window. The client renders a week at a time,
// so it asks for that window rather than pulling every booking ever made.
exports.getRoomBookings = async (req, res, next) => {
  try {
    const { location, fromDate, toDate } = req.body || {};
    const where = {};
    if (location) where.location = String(location);
    if (fromDate && toDate) {
      if (!isValidDate(fromDate) || !isValidDate(toDate)) {
        return res.status(400).json({ error: 'Khoảng ngày không hợp lệ (định dạng YYYY-MM-DD).' });
      }
      where.booking_date = { gte: fromDate, lte: toDate };
    }
    const rows = await prisma.roombooking.findMany({
      where,
      orderBy: [{ booking_date: 'asc' }, { start_time: 'asc' }]
    });
    res.json(rows.map(toClient));
  } catch (err) {
    next(err);
  }
};

// dd/mm/yyyy plus the weekday, for an email a person reads rather than a field a
// program sorts on.
function formatMeetingDate(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAY_NAMES[date.getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// The two messages an interpreter can get about a meeting. Same fields in the same
// order either way; a cancellation just says so first:
//   Team, người đặt, nội dung, khung giờ, rồi "통역 요청 건 도착"
//   "Huỷ cuộc họp" + the same line
const MAIL_KINDS = {
  invite: {
    prefix: '',
    lead: 'Anh/chị được mời tham gia phiên dịch cho cuộc họp sau:',
    leadHtml: 'Anh/chị được mời tham gia <strong>phiên dịch</strong> cho cuộc họp sau:'
  },
  cancelled: {
    prefix: 'Huỷ cuộc họp',
    lead: 'Cuộc họp sau đã được huỷ, anh/chị không cần tham gia phiên dịch nữa:',
    leadHtml: 'Cuộc họp sau <strong>đã được huỷ</strong>, anh/chị không cần tham gia phiên dịch nữa:'
  }
};

function buildMeetingEmail(booking, kind) {
  const shape = MAIL_KINDS[kind] || MAIL_KINDS.invite;

  // A subject is a single header line: newlines in the meeting content would break it,
  // and an essay would be truncated by the mail client anyway.
  const oneLine = (value, max) => {
    const flat = String(value ?? '').replace(/\s+/g, ' ').trim();
    return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
  };
  const subject = [
    shape.prefix,
    oneLine(booking.team, 60),
    oneLine(booking.booker_name, 60),
    oneLine(booking.purpose, 120),
    `${booking.start_time}-${booking.end_time}`,
    '통역 요청 건 도착'
  ].filter(Boolean).join(' ');

  const rows = [
    ['Thời gian', `${booking.start_time} - ${booking.end_time}, ${formatMeetingDate(booking.booking_date)}`],
    ['Địa điểm', `${LOCATION_NAMES[booking.location] || booking.location} - ${ROOM_NAMES[booking.room_id] || booking.room_id}`],
    ['Team / Bộ phận', booking.team],
    ['Người đặt phòng', booking.booker_name],
    ['Mức độ quan trọng', IMPORTANCE_NAMES[booking.importance] || '(không xác định)'],
    ['Nội dung cuộc họp', booking.purpose || '(không có nội dung)']
  ];

  const text = [
    'Kính gửi anh/chị,',
    '',
    shape.lead,
    '',
    ...rows.map(([label, value]) => `- ${label}: ${value}`),
    '',
    'Email này được gửi tự động từ hệ thống TopEng Manager.'
  ].join('\n');

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.55;">
      <p>Kính gửi anh/chị,</p>
      <p>${shape.leadHtml}</p>
      <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;">
        ${rows.map(([label, value]) => `
        <tr>
          <td style="border:1px solid #e5e7eb;background:#f8fafc;font-weight:600;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="border:1px solid #e5e7eb;white-space:pre-wrap;">${escapeHtml(value)}</td>
        </tr>`).join('')}
      </table>
      <p style="color:#6b7280;font-size:12px;margin-top:18px;">Email này được gửi tự động từ hệ thống TopEng Manager.</p>
    </div>
  `;

  return { subject, text, html };
}

// Tells the interpreters about a meeting, or about its cancellation. Deliberately never
// throws: by the time this runs the room is already held, or already released, and a mail
// server being unreachable must not undo either. The outcome comes back so the caller can
// say plainly that the notification did not go out.
async function notifyInterpreters(booking, interpreters, kind) {
  const recipients = (interpreters || []).map(p => p && p.email).filter(Boolean);
  if (recipients.length === 0) return null;

  if (!(await isMailConfigured())) {
    return {
      sent: false,
      recipients,
      error: 'Hệ thống chưa cấu hình tài khoản gửi mail. Admin vào Nhân sự > Cấu hình Email để khai báo.'
    };
  }

  const { subject, text, html } = buildMeetingEmail(booking, kind);
  try {
    await sendMail({ to: recipients, subject, text, html, fromName: 'TopEng Manager' });
    return { sent: true, recipients };
  } catch (err) {
    console.error(`Interpreter ${kind} notification failed:`, err.message);
    return { sent: false, recipients, error: err.message };
  }
}

// Resolves the ids the client sent into real interpreters. An id that is not a flagged
// interpreter is rejected rather than quietly dropped: silently ignoring it would leave
// the booker believing somebody had been notified.
async function resolveInterpreters(interpreterIds) {
  const ids = Array.from(new Set(
    (Array.isArray(interpreterIds) ? interpreterIds : [])
      .map(id => String(id || '').trim())
      .filter(Boolean)
  ));
  if (ids.length === 0) return [];

  const rows = await prisma.user.findMany({
    where: { user_id: { in: ids }, is_interpreter: true },
    select: { user_id: true, full_name: true, email: true }
  });
  if (rows.length !== ids.length) {
    const found = new Set(rows.map(r => r.user_id));
    const missing = ids.filter(id => !found.has(id));
    const err = new Error(`Không tìm thấy phiên dịch được chọn: ${missing.join(', ')}.`);
    err.status = 400;
    throw err;
  }
  const noEmail = rows.filter(r => !r.email || !r.email.trim());
  if (noEmail.length > 0) {
    const err = new Error(`Phiên dịch chưa có địa chỉ email: ${noEmail.map(r => r.full_name).join(', ')}.`);
    err.status = 400;
    throw err;
  }
  // Keep the order the user picked them in.
  const byId = new Map(rows.map(r => [r.user_id, r]));
  return ids.map(id => {
    const row = byId.get(id);
    return { id: row.user_id, name: row.full_name, email: row.email.trim() };
  });
}

exports.createRoomBooking = async (req, res, next) => {
  try {
    const {
      location, roomId, date, startTime, endTime,
      team, bookerName, bookerId, purpose, importance, interpreterIds
    } = req.body || {};

    if (!location || !roomId) {
      return res.status(400).json({ error: 'Thiếu địa điểm hoặc phòng họp.' });
    }
    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Ngày đặt không hợp lệ (định dạng YYYY-MM-DD).' });
    }
    // A room cannot be booked for a day that has already gone. Enforced here as well as in
    // the form, because a disabled button is not a rule.
    if (date < todayStr()) {
      return res.status(400).json({ error: 'Không thể đặt phòng cho ngày đã qua.' });
    }
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      return res.status(400).json({ error: 'Giờ không hợp lệ (định dạng HH:MM).' });
    }
    if (startTime >= endTime) {
      return res.status(400).json({ error: 'Thời gian kết thúc phải lớn hơn thời gian bắt đầu.' });
    }
    if (!team || !String(team).trim() || !bookerName || !String(bookerName).trim()) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin đặt phòng.' });
    }
    if (importance && !IMPORTANCE.includes(importance)) {
      return res.status(400).json({ error: 'Mức độ quan trọng không hợp lệ.' });
    }

    // Checked here and not only in the form: the ids arrive from the client, so whether
    // they really belong to interpreters is the server's question to answer.
    let interpreters;
    try {
      interpreters = await resolveInterpreters(interpreterIds);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    // An interpreter has to know what they are turning up to translate, so the meeting
    // content stops being optional the moment one is requested. Checked here as well as
    // in the form: the form can be bypassed, and the email is written from this value.
    if (interpreters.length > 0 && (!purpose || !String(purpose).trim())) {
      return res.status(400).json({ error: 'Vui lòng nhập nội dung cuộc họp khi có yêu cầu phiên dịch.' });
    }

    // The overlap check has to happen here, not only in the browser: two people booking at
    // the same moment each see a schedule without the other's booking in it.
    const clash = await prisma.roombooking.findFirst({
      where: {
        location: String(location),
        room_id: String(roomId),
        booking_date: date,
        // half-open intervals: a booking ending exactly when another starts is fine
        AND: [{ start_time: { lt: endTime } }, { end_time: { gt: startTime } }]
      }
    });
    if (clash) {
      return res.status(409).json({
        error: 'Khung giờ này đã có nhóm khác đặt phòng. Vui lòng chọn khung giờ khác!',
        conflict: toClient(clash)
      });
    }

    // The form hides an interpreter who is already booked, but hiding is not the rule:
    // two bookers picking the same free interpreter at the same moment each saw a list
    // drawn before the other had committed.
    if (interpreters.length > 0) {
      const busy = await busyInterpreterIds(date, startTime, endTime);
      const taken = interpreters.filter(person => busy.has(person.id));
      if (taken.length > 0) {
        return res.status(409).json({
          error: `Phiên dịch đã có lịch trùng khung giờ này: ${taken.map(p => p.name).join(', ')}. Vui lòng chọn người khác hoặc đổi khung giờ.`,
          busyInterpreters: taken
        });
      }
    }

    const created = await prisma.roombooking.create({
      data: {
        booking_id: 'rbk-' + crypto.randomUUID(),
        location: String(location),
        room_id: String(roomId),
        booking_date: date,
        start_time: startTime,
        end_time: endTime,
        team: String(team).trim().slice(0, 150),
        booker_name: String(bookerName).trim().slice(0, 150),
        booker_id: bookerId || null,
        purpose: purpose ? String(purpose) : null,
        importance: importance || null,
        interpreters: interpreters.length > 0 ? JSON.stringify(interpreters) : null
      }
    });

    // The room is booked whether or not the mail server cooperates. A failed notification
    // is reported back so the booker can tell the interpreter another way, but it never
    // rolls back a booking that is already holding the room.
    const mail = await notifyInterpreters(created, interpreters, 'invite');

    res.json({ ...toClient(created), mail });
  } catch (err) {
    next(err);
  }
};

// Only the person who booked the room, or an Admin, may cancel it. Enforced here and not
// just by hiding the button, because hiding a button is not access control.
exports.deleteRoomBooking = async (req, res, next) => {
  try {
    const { bookingId, requesterId } = req.body || {};
    if (!bookingId) {
      return res.status(400).json({ error: 'Thiếu mã lịch đặt phòng.' });
    }
    const booking = await prisma.roombooking.findUnique({ where: { booking_id: bookingId } });
    if (!booking) {
      return res.status(404).json({ error: 'Không tìm thấy lịch đặt phòng.' });
    }

    // Past meetings are locked for everyone, Admin included: the schedule of what already
    // happened should not be rewritable. Enforced here, not only by hiding the button.
    if (booking.booking_date < todayStr()) {
      return res.status(400).json({ error: 'Cuộc họp đã diễn ra, không thể huỷ.' });
    }

    const admin = await isRequesterAdmin(requesterId);
    let isOwner = !!(requesterId && booking.booker_id && booking.booker_id === requesterId);
    if (!isOwner && requesterId && !booking.booker_id) {
      // Rows created before booker_id existed can only be matched by name.
      const requester = await prisma.user.findUnique({
        where: { user_id: requesterId },
        select: { full_name: true }
      });
      isOwner = !!(requester && requester.full_name === booking.booker_name);
    }
    if (!admin && !isOwner) {
      return res.status(403).json({ error: 'Bạn không có quyền hủy lịch đặt phòng này.' });
    }

    // Read before the row goes, then told after it has gone: an interpreter should never
    // be told a meeting is cancelled while it is in fact still on the schedule.
    const interpreters = parseInterpreters(booking.interpreters);
    await prisma.roombooking.delete({ where: { booking_id: bookingId } });
    const mail = await notifyInterpreters(booking, interpreters, 'cancelled');

    res.json({ success: true, mail });
  } catch (err) {
    next(err);
  }
};
