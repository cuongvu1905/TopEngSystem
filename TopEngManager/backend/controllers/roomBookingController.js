const crypto = require('crypto');
const prisma = require('../config/prisma');

// Meeting-room bookings are shared: everyone in the company sees the same schedule.
// They used to live in each browser's localStorage, so a booking was only ever visible to
// the person who made it.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const IMPORTANCE = ['HIGH', 'MEDIUM', 'LOW'];

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
  importance: row.importance || null
});

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

exports.createRoomBooking = async (req, res, next) => {
  try {
    const {
      location, roomId, date, startTime, endTime,
      team, bookerName, bookerId, purpose, importance
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
        importance: importance || null
      }
    });
    res.json(toClient(created));
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

    await prisma.roombooking.delete({ where: { booking_id: bookingId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
