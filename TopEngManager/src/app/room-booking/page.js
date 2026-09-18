"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/utils/db';
import TimeField, { normalizeTime, TIME_RE } from '@/components/TimeField';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { getSwal } from '@/utils/swal';

const LOCATIONS = [
  { id: 'HN', name: 'Hà Nội (HN)' },
  { id: 'VP', name: 'Vĩnh Phúc (VP)' }
];

// Room names are UI labels, not data, so they carry a translation key. LOCATIONS keep
// their literal names on purpose: "Hà Nội (HN)" / "Vĩnh Phúc (VP)" are place names and
// read the same in every language.
const ROOMS = [
  { id: 'room-large', name: 'Phòng họp lớn', nameKey: 'roomBooking.largeRoom' },
  { id: 'room-small', name: 'Phòng họp nhỏ', nameKey: 'roomBooking.smallRoom' }
];

const roomName = (room, t) => (room ? t(room.nameKey, room.name) : '');

// Meeting importance. The colour and the wording together tell a viewer how negotiable a
// slot is, which is the whole point of the field: HIGH is immovable, LOW is a conversation.
// `id` is what gets stored on a booking; bookings made before this field existed have none
// and stay visually neutral rather than being labelled something nobody chose.
const IMPORTANCE_LEVELS = [
  {
    id: 'HIGH',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.16)',
    border: 'rgba(239, 68, 68, 0.55)',
    descKey: 'roomBooking.importanceHighDesc',
    descFallback: 'Cuộc họp với TOPK, Khách hàng, Sếp Hàn. Lịch họp không thể thay đổi.'
  },
  {
    id: 'MEDIUM',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.16)',
    border: 'rgba(245, 158, 11, 0.55)',
    descKey: 'roomBooking.importanceMediumDesc',
    descFallback: 'Cuộc họp với Sếp Hàn là quản lý ở Việt Nam, lịch họp chỉ có thể thay đổi khi Sếp Hàn đồng ý.'
  },
  {
    id: 'LOW',
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.16)',
    border: 'rgba(34, 197, 94, 0.55)',
    descKey: 'roomBooking.importanceLowDesc',
    descFallback: 'Họp nội bộ Team (có thể thoả thuận với người đặt để thay đổi lịch họp).'
  }
];

const getImportanceLevel = (id) => IMPORTANCE_LEVELS.find(lvl => lvl.id === id) || null;

// Helper to format Date object to YYYY-MM-DD
const formatDateStr = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Helper to format Date to dd/mm/yy
const formatDateShort = (dateObj) => {
  const d = String(dateObj.getDate()).padStart(2, '0');
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const y = String(dateObj.getFullYear()).slice(-2);
  return `${d}/${m}/${y}`;
};

// Local midnight today. Every "which week am I looking at" decision goes through this so
// the view follows the real clock instead of a date that was pinned during development.
const getToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

// Parses the YYYY-MM-DD a <input type="date"> produces into a LOCAL date.
// new Date('2026-08-17') would parse as UTC midnight, which lands on the previous day -
// and therefore in the previous week - for anyone in a timezone behind UTC.
const parseDateStr = (str) => {
  const [y, m, d] = String(str).split('-').map(Number);
  if (!y || !m || !d) return getToday();
  return new Date(y, m - 1, d);
};

// Get array of 7 dates for the week containing referenceDate (Monday to Sunday)
const getWeekDays = (referenceDate) => {
  const curr = new Date(referenceDate);
  const day = curr.getDay(); // 0 is Sun, 1 is Mon
  const diffToMon = curr.getDate() - day + (day === 0 ? -6 : 1);
  
  const monday = new Date(curr.setDate(diffToMon));
  const week = [];
  
  for (let i = 0; i < 7; i++) {
    const nextDay = new Date(monday);
    nextDay.setDate(monday.getDate() + i);
    week.push(nextDay);
  }
  return week;
};

export default function RoomBookingPage() {
  const { currentUser } = useApp();
  const { t } = useLanguage();

  const [selectedLocation, setSelectedLocation] = useState('HN');
  const [currentDate, setCurrentDate] = useState(getToday);
  const [bookings, setBookings] = useState([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [loadError, setLoadError] = useState(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  // The booking whose detail popup is open, or null. Anyone may open it; only the owner
  // (or an Admin) is offered the cancel button inside.
  const [detailBooking, setDetailBooking] = useState(null);
  const [isSavingBooking, setIsSavingBooking] = useState(false);
  const [modalLocation, setModalLocation] = useState('HN');
  const [modalRoomId, setModalRoomId] = useState('room-large');
  const [modalDate, setModalDate] = useState(() => formatDateStr(getToday()));
  const [modalStartTime, setModalStartTime] = useState('09:00');
  const [modalEndTime, setModalEndTime] = useState('11:00');
  const [modalTeam, setModalTeam] = useState('Team R&D');
  const [modalBookerName, setModalBookerName] = useState('');
  const [modalPurpose, setModalPurpose] = useState('');
  // Defaults to LOW on purpose: leaving the field untouched should describe the most
  // common case (an internal team meeting), never lock a slot nobody agreed to lock.
  const [modalImportance, setModalImportance] = useState('LOW');
  // Interpreter request. The people on offer come from the server (accounts flagged as
  // interpreters in HR), never from a list hardcoded here, so adding an interpreter is a
  // personnel change rather than a code change.
  const [interpreters, setInterpreters] = useState([]);
  const [isLoadingInterpreters, setIsLoadingInterpreters] = useState(false);
  const [needsInterpreter, setNeedsInterpreter] = useState(false);
  const [selectedInterpreterIds, setSelectedInterpreterIds] = useState([]);
  // How many interpreters were left out because they are already booked at this hour,
  // so a name disappearing from the list reads as "busy" rather than "deleted".
  const [busyInterpreterCount, setBusyInterpreterCount] = useState(0);
  const [droppedInterpreters, setDroppedInterpreters] = useState([]);

  // Bookings come from the server: a meeting room is shared, so everyone must see the same
  // schedule. They used to be kept in localStorage, which is per-browser - that is why a
  // booking was invisible to every other member, including Admin.
  const loadBookings = useCallback(async () => {
    setIsLoadingBookings(true);
    try {
      const list = await db.getRoomBookings({});
      setBookings(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load room bookings', err);
      setBookings([]);
      setLoadError(err.message || 'error');
    } finally {
      setIsLoadingBookings(false);
    }
  }, []);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  // The selection is mirrored in a ref so the loader can prune it without reading stale
  // state or doing work inside a state updater.
  const selectionRef = useRef([]);
  const knownNames = useRef(new Map());
  const setSelection = useCallback((next) => {
    selectionRef.current = next;
    setSelectedInterpreterIds(next);
  }, []);

  // Who is free depends on the slot being booked, so this is re-read whenever the date or
  // the hours move. The sequence number stops a slow earlier reply landing on a newer one.
  const interpreterRequest = useRef(0);
  const loadInterpreters = useCallback(async (slot) => {
    const seq = ++interpreterRequest.current;
    setIsLoadingInterpreters(true);
    try {
      const result = await db.getInterpreters(slot);
      if (seq !== interpreterRequest.current) return;
      const list = Array.isArray(result?.interpreters) ? result.interpreters : [];
      list.forEach(person => knownNames.current.set(person.id, person.name));
      setInterpreters(list);
      setBusyInterpreterCount(Number(result?.busyCount) || 0);

      // Someone picked earlier can become busy once the hours move. Dropping them in
      // silence is how a booking ends up notifying nobody, so name whoever was dropped.
      const free = new Set(list.map(person => person.id));
      const dropped = selectionRef.current.filter(id => !free.has(id));
      if (dropped.length > 0) {
        setSelection(selectionRef.current.filter(id => free.has(id)));
        setDroppedInterpreters(dropped.map(id => knownNames.current.get(id) || id));
      } else {
        setDroppedInterpreters([]);
      }
    } catch (err) {
      if (seq !== interpreterRequest.current) return;
      console.error('Failed to load interpreters', err);
      setInterpreters([]);
      setBusyInterpreterCount(0);
    } finally {
      if (seq === interpreterRequest.current) setIsLoadingInterpreters(false);
    }
  }, [setSelection]);

  // Only asked for once the box is ticked, and re-asked as the slot is edited.
  useEffect(() => {
    if (!isModalOpen || !needsInterpreter) return;
    const start = normalizeTime(modalStartTime);
    const end = normalizeTime(modalEndTime);
    const slotReady = TIME_RE.test(start) && TIME_RE.test(end) && start < end;
    loadInterpreters(slotReady ? { date: modalDate, startTime: start, endTime: end } : {});
  }, [isModalOpen, needsInterpreter, modalDate, modalStartTime, modalEndTime, loadInterpreters]);

  const toggleInterpreter = useCallback((id) => {
    const current = selectionRef.current;
    setSelection(current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  }, [setSelection]);


  // Update booker name when currentUser is loaded
  useEffect(() => {
    if (currentUser && !modalBookerName) {
      setModalBookerName(currentUser.name || '');
      if (currentUser.department_name) {
        setModalTeam(`Team ${currentUser.department_name}`);
      }
    }
  }, [currentUser]);


  // Week navigation
  const weekDays = getWeekDays(currentDate);
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  const handlePrevWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 7);
    setCurrentDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    setCurrentDate(next);
  };

  const handleTodayWeek = () => {
    setCurrentDate(getToday());
  };

  // Open booking modal
  const openBookingModal = (roomId = 'room-large', dateStr = null, timeStart = '09:00') => {
    setModalLocation(selectedLocation);
    setModalRoomId(roomId);
    setModalDate(dateStr || formatDateStr(currentDate));
    setModalStartTime(timeStart);
    // calculate end time + 2 hours
    const startHour = parseInt(timeStart.split(':')[0]) || 9;
    const endHour = Math.min(startHour + 2, 18);
    setModalEndTime(`${String(endHour).padStart(2, '0')}:00`);
    
    if (currentUser) {
      setModalBookerName(currentUser.name || '');
      if (currentUser.department_name) {
        setModalTeam(`Team ${currentUser.department_name}`);
      }
    }
    setModalPurpose('');
    setModalImportance('LOW');
    // A fresh form asks for nothing: carrying the previous meeting’s interpreters over
    // would quietly email people about a meeting nobody chose them for.
    setNeedsInterpreter(false);
    setSelection([]);
    setDroppedInterpreters([]);
    setBusyInterpreterCount(0);
    setIsModalOpen(true);
  };

  // Handle Submit Booking
  const handleSaveBooking = async (e) => {
    e.preventDefault();
    if (isSavingBooking) return;
    setIsSavingBooking(true);
    const Swal = await getSwal();

    if (!modalBookerName.trim() || !modalTeam.trim() || !modalDate) {
      Swal.fire({
        icon: 'warning',
        title: t('common.notice', 'Thông báo'),
        text: t('roomBooking.fillAllFields', 'Vui lòng điền đầy đủ thông tin đặt phòng.'),
        confirmButtonColor: 'var(--primary-color)'
      });
      setIsSavingBooking(false);
      return;
    }

    if (modalDate < formatDateStr(getToday())) {
      Swal.fire({
        icon: 'warning',
        title: t('common.notice', 'Thông báo'),
        text: t('roomBooking.pastDateBlocked', 'Không thể đặt phòng cho ngày đã qua.'),
        confirmButtonColor: 'var(--primary-color)'
      });
      setIsSavingBooking(false);
      return;
    }

    // Free-typed times are normalised here rather than trusted: the string comparison below
    // and the overlap check both rely on zero-padded HH:MM.
    const startTime = normalizeTime(modalStartTime);
    const endTime = normalizeTime(modalEndTime);
    if (!startTime || !endTime || !TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      Swal.fire({
        icon: 'warning',
        title: t('common.notice', 'Thông báo'),
        text: t('roomBooking.invalidTime', 'Giờ không hợp lệ. Vui lòng nhập theo dạng HH:MM (ví dụ 09:30).'),
        confirmButtonColor: 'var(--primary-color)'
      });
      setIsSavingBooking(false);
      return;
    }
    // Show the user the cleaned-up values they are about to book.
    setModalStartTime(startTime);
    setModalEndTime(endTime);

    if (startTime >= endTime) {
      Swal.fire({
        icon: 'warning',
        title: t('common.notice', 'Thông báo'),
        text: t('roomBooking.endAfterStart', 'Thời gian kết thúc phải lớn hơn thời gian bắt đầu.'),
        confirmButtonColor: 'var(--primary-color)'
      });
      setIsSavingBooking(false);
      return;
    }

    // "Cần phiên dịch" with nobody picked would book the room and notify no one, which
    // is the one outcome the person who ticked that box did not want.
    if (needsInterpreter && selectedInterpreterIds.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: t('common.notice', 'Thông báo'),
        text: t('roomBooking.pickInterpreter', 'Vui lòng chọn ít nhất một phiên dịch, hoặc bỏ tick "Cần phiên dịch".'),
        confirmButtonColor: 'var(--primary-color)'
      });
      setIsSavingBooking(false);
      return;
    }

    // An interpreter has to know what they are turning up to translate. The hours are
    // already required for every booking; the meeting content is not, until now.
    if (needsInterpreter && !modalPurpose.trim()) {
      Swal.fire({
        icon: 'warning',
        title: t('common.notice', 'Thông báo'),
        text: t('roomBooking.purposeRequiredForInterpreter', 'Vui lòng nhập nội dung cuộc họp khi có yêu cầu phiên dịch.'),
        confirmButtonColor: 'var(--primary-color)'
      });
      setIsSavingBooking(false);
      return;
    }

    // A local overlap check catches the common case instantly, but it can only see the
    // schedule this browser has already loaded. The server repeats the check and is the
    // authority: two people booking the same slot at the same moment both pass here.
    const isOverlap = bookings.some(b =>
      b.location === modalLocation &&
      b.roomId === modalRoomId &&
      b.date === modalDate &&
      startTime < b.endTime && endTime > b.startTime
    );

    if (isOverlap) {
      Swal.fire({
        icon: 'error',
        title: t('common.error', 'Lỗi'),
        text: t('roomBooking.slotTaken', 'Khung giờ này đã có nhóm khác đặt phòng. Vui lòng chọn khung giờ khác!'),
        confirmButtonColor: 'var(--primary-color)'
      });
      setIsSavingBooking(false);
      return;
    }

    try {
      const created = await db.createRoomBooking({
        location: modalLocation,
        roomId: modalRoomId,
        date: modalDate,
        startTime,
        endTime,
        team: modalTeam.trim(),
        bookerName: modalBookerName.trim(),
        bookerId: currentUser?.id || null,
        // With an interpreter requested the content is the email subject, so the
        // "Họp nhóm" stand-in would defeat the check the server makes on it.
        purpose: needsInterpreter
          ? modalPurpose.trim()
          : (modalPurpose.trim() || t('roomBooking.defaultPurpose', 'Họp nhóm')),
        importance: modalImportance,
        interpreterIds: needsInterpreter ? selectedInterpreterIds : []
      });
      await loadBookings();
      setIsModalOpen(false);

      // The room is held either way. If the notification did not go out, say so rather
      // than reporting a bare success the booker would read as "the interpreter knows".
      const mail = created && created.mail;
      if (mail && !mail.sent) {
        const who = (mail.recipients || []).join(', ');
        Swal.fire({
          icon: 'warning',
          title: t('roomBooking.mailFailedTitle', 'Đã đặt phòng, nhưng chưa gửi được email'),
          text: t('roomBooking.mailFailedText', 'Lịch họp đã được lưu. Hệ thống chưa gửi được email cho phiên dịch ({who}), vui lòng báo trực tiếp cho họ.').replace('{who}', who)
            + (mail.error ? ' (' + mail.error + ')' : ''),
          confirmButtonColor: 'var(--primary-color)'
        });
      } else {
        Swal.fire({
          icon: 'success',
          title: t('common.success', 'Thành công'),
          text: t('roomBooking.bookSuccess', 'Đặt phòng họp thành công!'),
          confirmButtonColor: 'var(--primary-color)',
          timer: 1800,
          showConfirmButton: false
        });
      }
    } catch (err) {
      // A 409 means somebody else took the slot between this page loading and now, so
      // refresh the schedule to show what actually happened.
      await loadBookings();
      Swal.fire({
        icon: 'error',
        title: t('common.error', 'Lỗi'),
        text: err.message || t('roomBooking.slotTaken', 'Khung giờ này đã có nhóm khác đặt phòng. Vui lòng chọn khung giờ khác!'),
        confirmButtonColor: 'var(--primary-color)'
      });
    } finally {
      setIsSavingBooking(false);
    }
  };

  // Delete booking
  const handleDeleteBooking = async (bookingId, bookingTeam, timeSlot) => {
    const Swal = await getSwal();
    const result = await Swal.fire({
      title: t('roomBooking.cancelMeeting', 'Huỷ cuộc họp'),
      text: t('roomBooking.cancelConfirmText', 'Bạn có chắc chắn muốn huỷ lịch đặt phòng [{time}] của {team}?')
        .replace('{time}', timeSlot).replace('{team}', bookingTeam),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: t('common.confirm', 'Đồng ý'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b'
    });

    if (!result.isConfirmed) return;
    try {
      const cancelled = await db.deleteRoomBooking(bookingId, currentUser?.id);
      await loadBookings();
      setDetailBooking(null);

      // The meeting is off either way. If the interpreters were not told, say so rather
      // than reporting a bare success the canceller would read as "they know".
      const mail = cancelled && cancelled.mail;
      if (mail && !mail.sent) {
        const who = (mail.recipients || []).join(', ');
        Swal.fire({
          icon: 'warning',
          title: t('roomBooking.cancelMailFailedTitle', 'Đã huỷ họp, nhưng chưa gửi được email'),
          text: t('roomBooking.cancelMailFailedText', 'Cuộc họp đã được huỷ. Hệ thống chưa gửi được email báo huỷ cho phiên dịch ({who}), vui lòng báo trực tiếp cho họ.').replace('{who}', who)
            + (mail.error ? ' (' + mail.error + ')' : ''),
          confirmButtonColor: 'var(--primary-color)'
        });
      } else {
        Swal.fire({
          icon: 'success',
          title: t('common.deleted', 'Đã xóa'),
          text: t('roomBooking.cancelSuccess', 'Đã huỷ lịch đặt phòng thành công.'),
          timer: 1500,
          showConfirmButton: false
        });
      }
    } catch (err) {
      await loadBookings();
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    }
  };

  const getDayLabel = (idx) => {
    const labels = [
      t('calendar.mon', 'Thứ 2'),
      t('calendar.tue', 'Thứ 3'),
      t('calendar.wed', 'Thứ 4'),
      t('calendar.thu', 'Thứ 5'),
      t('calendar.fri', 'Thứ 6'),
      t('calendar.sat', 'Thứ 7'),
      t('calendar.sun', 'CN')
    ];
    return labels[idx];
  };

  const isToday = (dateObj) => {
    const today = new Date();
    return dateObj.getDate() === today.getDate() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getFullYear() === today.getFullYear();
  };

  return (
    <div className="scrollable-view" style={{ padding: '24px' }}>
      <div className="view-header" style={{ marginBottom: '20px' }}>
        <div className="view-title-group">
          <h2>{t('roomBooking.title', 'Đặt phòng họp')}</h2>
          <p>{t('roomBooking.subtitle', 'Theo dõi lịch và đặt thời gian sử dụng phòng họp')}</p>
        </div>
        <div className="view-actions">
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={() => openBookingModal('room-large')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <i className="fa-solid fa-plus-circle"></i>
            {t('roomBooking.bookBtn', 'Đặt phòng họp')}
          </button>
        </div>
      </div>

      <div 
        style={{ 
          backgroundColor: 'var(--neutral-bg-card)', 
          border: '1px solid var(--neutral-border)', 
          borderRadius: '8px', 
          padding: '16px 20px', 
          marginBottom: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: '600', fontSize: '13.5px', color: 'var(--neutral-dark)' }}>
              {t('roomBooking.location', 'Địa điểm:')}
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="doc-select-filter"
              style={{
                minWidth: '160px',
                padding: '7px 12px',
                fontSize: '13.5px',
                fontWeight: '600',
                borderRadius: '6px',
                border: '1px solid var(--neutral-border)',
                backgroundColor: 'var(--neutral-bg-main)',
                color: 'var(--neutral-dark)'
              }}
            >
              {LOCATIONS.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: '600', fontSize: '13.5px', color: 'var(--neutral-dark)' }}>
              {t('roomBooking.date', 'Ngày:')}
            </label>
            <input
              type="date"
              value={formatDateStr(currentDate)}
              onChange={(e) => {
                if (e.target.value) {
                  setCurrentDate(parseDateStr(e.target.value));
                }
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--neutral-border)',
                backgroundColor: 'var(--neutral-bg-main)',
                color: 'var(--neutral-dark)',
                fontSize: '13.5px',
                outline: 'none'
              }}
            />
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleTodayWeek}
            style={{ fontSize: '12.5px' }}
          >
            <i className="fa-solid fa-calendar-day" style={{ marginRight: '4px' }}></i> {t('roomBooking.thisWeek', 'Tuần này')}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--neutral-dark)' }}>
            {formatDateShort(weekStart)} ~ {formatDateShort(weekEnd)}
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={handlePrevWeek}
              title={t('roomBooking.prevWeek', 'Tuần trước')}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '6px',
                border: '1px solid var(--neutral-border)',
                backgroundColor: 'var(--neutral-bg-hover)',
                color: 'var(--neutral-dark)',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
            >
              &lt;
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              title={t('roomBooking.nextWeek', 'Tuần sau')}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '6px',
                border: '1px solid var(--neutral-border)',
                backgroundColor: 'var(--neutral-bg-hover)',
                color: 'var(--neutral-dark)',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {ROOMS.map(room => (
          <div key={room.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div 
              style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '2px 0 4px 4px'
              }}
            >
              <i className="fa-solid fa-door-open" style={{ fontSize: '18px', color: 'var(--primary-color)' }}></i>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--neutral-dark)' }}>
                {roomName(room, t)}
              </h3>
            </div>

            <div 
              style={{ 
                border: '1px solid var(--neutral-border)', 
                borderRadius: '12px', 
                padding: '16px',
                backgroundColor: 'var(--neutral-bg-card)',
                boxShadow: 'var(--shadow-sm)',
                overflowX: 'auto'
              }}
            >
              <div 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(7, minmax(130px, 1fr))', 
                  gap: '12px',
                  minWidth: '950px'
                }}
              >
                {weekDays.map((dayDate, dayIdx) => {
                  const dayStr = formatDateStr(dayDate);
                  // Comparing the YYYY-MM-DD strings is safe because both are built the same
                  // way from local dates; today itself is bookable, only earlier days are not.
                  const isPastDay = dayStr < formatDateStr(getToday());
                  const isCurrentDay = isToday(dayDate);
                  
                  const dayBookings = bookings
                    .filter(b => b.location === selectedLocation && b.roomId === room.id && b.date === dayStr)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));

                  return (
                    <div 
                      key={dayStr} 
                      style={{ 
                        border: isCurrentDay ? '2px solid var(--primary-color)' : '2px solid var(--neutral-border)',
                        borderRadius: '16px',
                        backgroundColor: 'var(--neutral-bg-card)',
                        padding: '12px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: '380px'
                      }}
                    >
                      <div style={{ textAlign: 'center', marginBottom: '12px', borderBottom: '1px solid var(--neutral-border)', paddingBottom: '8px' }}>
                        <div style={{ fontWeight: '700', fontSize: '15px', color: isCurrentDay ? 'var(--primary-color)' : 'var(--neutral-dark)' }}>
                          {getDayLabel(dayIdx)}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--neutral-muted)', marginTop: '2px' }}>
                          {formatDateShort(dayDate)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                        {isLoadingBookings ? (
                          <div style={{ textAlign: 'center', padding: '24px 4px', color: 'var(--neutral-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                            <i className="fa-solid fa-spinner fa-spin"></i> {t('common.loading', 'Đang tải...')}
                          </div>
                        ) : loadError ? (
                          <div style={{ textAlign: 'center', padding: '24px 4px', color: '#f59e0b', fontSize: '12px' }}>
                            <i className="fa-solid fa-triangle-exclamation"></i> {t('roomBooking.loadFailed', 'Không tải được lịch đặt phòng.')}
                          </div>
                        ) : dayBookings.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '24px 4px', color: 'var(--neutral-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                            {t('roomBooking.emptyDay', 'Trống')}
                          </div>
                        ) : (
                          dayBookings.map(b => {
                            // Bookings saved before the importance field existed have no level:
                            // they keep the original neutral look instead of being relabelled.
                            const lvl = getImportanceLevel(b.importance);
                            return (
                              <div
                                key={b.id}
                                onDoubleClick={() => setDetailBooking(b)}
                                title={t('roomBooking.viewDetailHint', 'Nhấp đúp để xem chi tiết cuộc họp')}
                                style={{
                                  border: `1.5px solid ${lvl ? lvl.border : 'rgba(56, 189, 248, 0.65)'}`,
                                  borderRadius: '10px',
                                  padding: '10px 8px',
                                  backgroundColor: 'var(--neutral-bg-main)',
                                  textAlign: 'center',
                                  position: 'relative',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                {/* Importance as a dot in the corner the × used to occupy: it costs no
                                    row height, and the colour alone carries the level. */}
                                {lvl && (
                                  <span
                                    title={`${lvl.id} — ${t(lvl.descKey, lvl.descFallback)}`}
                                    style={{
                                      position: 'absolute',
                                      top: '7px',
                                      right: '7px',
                                      width: '9px',
                                      height: '9px',
                                      borderRadius: '50%',
                                      backgroundColor: lvl.color,
                                      border: `1px solid ${lvl.border}`,
                                      boxShadow: `0 0 5px ${lvl.color}`
                                    }}
                                  ></span>
                                )}
                                <div style={{ fontWeight: '700', fontSize: '12.5px', color: 'var(--neutral-dark)', marginBottom: '2px' }}>
                                  {b.team}
                                </div>
                                <div style={{ fontSize: '11.5px', color: '#cbd5e1', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  &lt;{b.bookerName}&gt;
                                </div>
                                <div 
                                  style={{ 
                                    display: 'inline-block',
                                    fontSize: '11px', 
                                    fontWeight: '700', 
                                    color: '#38bdf8', 
                                    backgroundColor: 'rgba(56, 189, 248, 0.18)',
                                    border: '1px solid rgba(56, 189, 248, 0.45)',
                                    padding: '2.5px 8px',
                                    borderRadius: '6px'
                                  }}
                                >
                                  {b.startTime} ~ {b.endTime}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* A day that has already passed cannot be booked, so the button says so
                          instead of opening a form that would be refused on submit. */}
                      <button
                        type="button"
                        disabled={isPastDay}
                        title={isPastDay ? t('roomBooking.pastDateBlocked', 'Không thể đặt phòng cho ngày đã qua.') : undefined}
                        onClick={() => openBookingModal(room.id, dayStr)}
                        style={{
                          marginTop: '10px',
                          width: '100%',
                          padding: '6px',
                          border: '1.5px dashed var(--neutral-border)',
                          borderRadius: '8px',
                          backgroundColor: 'transparent',
                          color: 'var(--neutral-muted)',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          cursor: isPastDay ? 'not-allowed' : 'pointer',
                          opacity: isPastDay ? 0.4 : 1,
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          if (isPastDay) return;
                          e.currentTarget.style.borderColor = 'var(--primary-color)';
                          e.currentTarget.style.color = 'var(--primary-color)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--neutral-border)';
                          e.currentTarget.style.color = 'var(--neutral-muted)';
                        }}
                      >
                        {isPastDay
                          ? t('roomBooking.pastDay', 'Đã qua')
                          : `+ ${t('roomBooking.bookThisSlot', 'Đặt giờ này')}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="modal show" style={{ display: 'flex', zIndex: 1000 }}>
          <div className="modal-dialog" style={{ maxWidth: '660px', width: '95%' }}>
            <div className="modal-content">
              <div className="modal-header">
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--neutral-dark)' }}>
                  <i className="fa-solid fa-door-open" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>
                  {t('roomBooking.newBookingTitle', 'Đặt phòng họp mới')}
                </h3>
                <button className="btn-close-modal" onClick={() => setIsModalOpen(false)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <form onSubmit={handleSaveBooking}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
                  {/* Interpreter request, first thing on the form: it changes what the rest
                      of the form demands (the meeting content stops being optional), so it
                      cannot sit below the fields it governs. */}
                  <div className="form-group" style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', color: 'var(--neutral-dark)', margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={needsInterpreter}
                        onChange={(e) => setNeedsInterpreter(e.target.checked)}
                        style={{ cursor: 'pointer', margin: 0, width: '16px', height: '16px', accentColor: 'var(--primary-color)' }}
                      />
                      <i className="fa-solid fa-language" style={{ color: 'var(--primary-color)' }}></i>
                      {t('roomBooking.needInterpreter', 'Cần phiên dịch')}
                    </label>

                    {needsInterpreter && (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--neutral-muted)', marginBottom: '8px', lineHeight: 1.45 }}>
                          {t('roomBooking.interpreterHint', 'Chọn phiên dịch cần mời (có thể chọn nhiều người). Danh sách chỉ hiện những người còn trống trong ngày và khung giờ đã chọn bên dưới. Hệ thống sẽ gửi email thông báo tới từng người được chọn.')}
                        </div>

                        {/* Changing the hours can take a chosen interpreter away. Saying so is
                            the difference between a visible change and a silent one. */}
                        {droppedInterpreters.length > 0 && (
                          <div style={{
                            fontSize: '12px', lineHeight: 1.45, marginBottom: '8px',
                            padding: '8px 10px', borderRadius: '6px',
                            color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.55)',
                            backgroundColor: 'rgba(245, 158, 11, 0.14)'
                          }}>
                            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }}></i>
                            {t('roomBooking.interpreterDropped', 'Đã bỏ chọn {names} vì khung giờ vừa đổi bị trùng lịch của họ.').replace('{names}', droppedInterpreters.join(', '))}
                          </div>
                        )}

                        {isLoadingInterpreters ? (
                          <div style={{ fontSize: '12.5px', color: 'var(--neutral-muted)', padding: '6px 2px' }}>
                            {t('roomBooking.loadingInterpreters', 'Đang tải danh sách phiên dịch...')}
                          </div>
                        ) : interpreters.length === 0 ? (
                          <div style={{ fontSize: '12.5px', color: 'var(--neutral-muted)', fontStyle: 'italic', padding: '6px 2px', lineHeight: 1.45 }}>
                            {busyInterpreterCount > 0
                              ? t('roomBooking.allInterpretersBusy', 'Tất cả phiên dịch đều đã có lịch trùng khung giờ này. Vui lòng chọn khung giờ khác.')
                              : t('roomBooking.noInterpreters', 'Chưa có tài khoản nào được đánh dấu là phiên dịch. Nhờ HR/Admin bật mục "Phiên dịch" trong hồ sơ nhân viên.')}
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '170px', overflowY: 'auto' }}>
                              {interpreters.map(person => {
                                const picked = selectedInterpreterIds.includes(person.id);
                                return (
                                  <label
                                    key={person.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '9px',
                                      padding: '7px 9px',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      margin: 0,
                                      border: `1.5px solid ${picked ? 'var(--primary-color)' : 'transparent'}`,
                                      backgroundColor: picked ? 'rgba(30, 64, 175, 0.12)' : 'var(--neutral-bg-card, transparent)'
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={picked}
                                      onChange={() => toggleInterpreter(person.id)}
                                      style={{ cursor: 'pointer', margin: 0, width: '15px', height: '15px', accentColor: 'var(--primary-color)', flexShrink: 0 }}
                                    />
                                    <span style={{ minWidth: 0 }}>
                                      <span style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--neutral-dark)' }}>{person.name}</span>
                                      <span style={{ fontSize: '11.5px', color: 'var(--neutral-muted)', marginLeft: '6px', wordBreak: 'break-all' }}>{person.email}</span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                            {busyInterpreterCount > 0 && (
                              <div style={{ fontSize: '11.5px', color: 'var(--neutral-muted)', marginTop: '7px', fontStyle: 'italic' }}>
                                {t('roomBooking.interpreterBusyHidden', 'Đang ẩn {count} phiên dịch đã có lịch trùng khung giờ này.').replace('{count}', String(busyInterpreterCount))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label style={{ fontWeight: '600', fontSize: '13px', color: 'var(--neutral-dark)', marginBottom: '4px', display: 'block' }}>
                        {t('roomBooking.locationLabel', 'Địa điểm')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select
                        value={modalLocation}
                        onChange={(e) => setModalLocation(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', outline: 'none' }}
                      >
                        {LOCATIONS.map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label style={{ fontWeight: '600', fontSize: '13px', color: 'var(--neutral-dark)', marginBottom: '4px', display: 'block' }}>
                        {t('roomBooking.roomLabel', 'Phòng họp')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select
                        value={modalRoomId}
                        onChange={(e) => setModalRoomId(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', outline: 'none' }}
                      >
                        {ROOMS.map(r => (
                          <option key={r.id} value={r.id}>{roomName(r, t)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px' }}>
                    <div className="form-group">
                      <label style={{ fontWeight: '600', fontSize: '13px', color: 'var(--neutral-dark)', marginBottom: '4px', display: 'block' }}>
                        {t('roomBooking.bookingDate', 'Ngày đặt')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="date"
                        value={modalDate}
                        min={formatDateStr(getToday())}
                        onChange={(e) => setModalDate(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', outline: 'none' }}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontWeight: '600', fontSize: '13px', color: 'var(--neutral-dark)', marginBottom: '4px', display: 'block' }}>
                        {t('roomBooking.startTime', 'Bắt đầu')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <TimeField
                        value={modalStartTime}
                        onChange={setModalStartTime}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontWeight: '600', fontSize: '13px', color: 'var(--neutral-dark)', marginBottom: '4px', display: 'block' }}>
                        {t('roomBooking.endTime', 'Kết thúc')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <TimeField
                        value={modalEndTime}
                        onChange={setModalEndTime}
                        align="right"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label style={{ fontWeight: '600', fontSize: '13px', color: 'var(--neutral-dark)', marginBottom: '4px', display: 'block' }}>
                        {t('roomBooking.team', 'Team / Bộ phận')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={modalTeam}
                        onChange={(e) => setModalTeam(e.target.value)}
                        placeholder={t('roomBooking.teamPlaceholder', 'VD: Team R&D')}
                        required
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', outline: 'none' }}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontWeight: '600', fontSize: '13px', color: 'var(--neutral-dark)', marginBottom: '4px', display: 'block' }}>
                        {t('roomBooking.bookerName', 'Tên người đặt')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={modalBookerName}
                        onChange={(e) => setModalBookerName(e.target.value)}
                        placeholder={t('roomBooking.bookerPlaceholder', 'VD: Nguyễn Văn A')}
                        required
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', outline: 'none' }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ fontWeight: '600', fontSize: '13px', color: 'var(--neutral-dark)', marginBottom: '4px', display: 'block' }}>
                      {t('roomBooking.purposeLabel', 'Nội dung / Mục đích cuộc họp')}{needsInterpreter && <span style={{ color: '#ef4444' }}> *</span>}
                    </label>
                    <textarea
                      rows={3}
                      value={modalPurpose}
                      onChange={(e) => setModalPurpose(e.target.value)}
                      placeholder={t('roomBooking.purposePlaceholder', 'Nhập nội dung hoặc mục đích cuộc họp...')}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', outline: 'none', resize: 'vertical' }}
                    />
                  </div>
                  {/* Importance: the level badge on the left, what it commits you to on the
                      right, so the choice is made against its meaning rather than a bare word. */}
                  <div className="form-group">
                    <label style={{ fontWeight: '600', fontSize: '13px', color: 'var(--neutral-dark)', marginBottom: '6px', display: 'block' }}>
                      {t('roomBooking.importance', 'Mức độ quan trọng')} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {IMPORTANCE_LEVELS.map(lvl => {
                        const isPicked = modalImportance === lvl.id;
                        return (
                          <label
                            key={lvl.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'auto 88px 1fr',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '9px 11px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              border: `1.5px solid ${isPicked ? lvl.border : 'var(--neutral-border)'}`,
                              backgroundColor: isPicked ? lvl.bg : 'var(--neutral-bg-main)',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <input
                              type="radio"
                              name="meeting-importance"
                              value={lvl.id}
                              checked={isPicked}
                              onChange={() => setModalImportance(lvl.id)}
                              style={{ cursor: 'pointer', margin: 0, accentColor: lvl.color }}
                            />
                            <span
                              style={{
                                fontSize: '11.5px',
                                fontWeight: '800',
                                letterSpacing: '0.04em',
                                textAlign: 'center',
                                color: lvl.color,
                                backgroundColor: lvl.bg,
                                border: `1px solid ${lvl.border}`,
                                borderRadius: '6px',
                                padding: '3px 0'
                              }}
                            >
                              {lvl.id}
                            </span>
                            <span style={{ fontSize: '12px', lineHeight: 1.45, color: isPicked ? 'var(--neutral-dark)' : 'var(--neutral-muted)' }}>
                              {t(lvl.descKey, lvl.descFallback)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                </div>

                <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--neutral-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSavingBooking}
                  >
                    {t('common.cancel', 'Hủy')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSavingBooking}
                  >
                    {isSavingBooking ? t('common.processing', 'Đang xử lý...') : t('roomBooking.bookBtn', 'Đặt phòng họp')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Meeting detail. Opened by double-clicking a booking; readable by everyone, and the
          place the cancel action now lives so it can never be hit by a stray single click. */}
      {detailBooking && (() => {
        const b = detailBooking;
        const lvl = getImportanceLevel(b.importance);
        // A meeting that has already happened is a record, not a plan: it stays readable but
        // can no longer be cancelled by anyone. Viewing the detail is never restricted.
        const isPastBooking = b.date < formatDateStr(getToday());
        const isOwnerOrAdmin = currentUser && (b.bookerName === currentUser.name || currentUser.system_role.includes('Admin'));
        const canCancel = !!isOwnerOrAdmin && !isPastBooking;
        const room = ROOMS.find(r => r.id === b.roomId);
        const loc = LOCATIONS.find(l => l.id === b.location);
        const dayDate = parseDateStr(b.date);
        const rows = [
          [t('roomBooking.locationLabel', 'Địa điểm'), loc ? loc.name : b.location],
          [t('roomBooking.roomLabel', 'Phòng họp'), room ? roomName(room, t) : b.roomId],
          [t('roomBooking.dateLabel', 'Ngày họp'), `${getDayLabel(dayDate.getDay() === 0 ? 6 : dayDate.getDay() - 1)}, ${formatDateShort(dayDate)}`],
          [t('roomBooking.time', 'Khung giờ'), `${b.startTime} ~ ${b.endTime}`],
          [t('roomBooking.team', 'Team / Bộ phận'), b.team],
          [t('roomBooking.booker', 'Người đặt'), b.bookerName]
        ];

        return (
          <div className="modal show" style={{ display: 'flex', zIndex: 1001 }}>
            <div className="modal-dialog" style={{ maxWidth: '560px', width: '95%' }}>
              <div className="modal-content">
                <div className="modal-header">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-circle-info" style={{ color: 'var(--primary-color)' }}></i>
                    {t('roomBooking.detailTitle', 'Chi tiết cuộc họp')}
                  </h3>
                  <button className="btn-close-modal" onClick={() => setDetailBooking(null)}>
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '132px 1fr', rowGap: '10px', columnGap: '12px', fontSize: '13px' }}>
                    {rows.map(([label, value]) => (
                      <React.Fragment key={label}>
                        <span style={{ color: 'var(--neutral-muted)', fontWeight: '600' }}>{label}</span>
                        <span style={{ color: 'var(--neutral-dark)', fontWeight: '600' }}>{value}</span>
                      </React.Fragment>
                    ))}
                  </div>

                  {/* The level is shown with its meaning, not just its name: what a viewer needs
                      to know is whether this slot can be moved. */}
                  <div>
                    <div style={{ color: 'var(--neutral-muted)', fontWeight: '600', fontSize: '13px', marginBottom: '6px' }}>
                      {t('roomBooking.importance', 'Mức độ quan trọng')}
                    </div>
                    {lvl ? (
                      <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                        padding: '10px 12px', borderRadius: '8px',
                        border: `1.5px solid ${lvl.border}`, backgroundColor: lvl.bg
                      }}>
                        <span style={{
                          fontSize: '11.5px', fontWeight: '800', letterSpacing: '0.04em',
                          color: lvl.color, border: `1px solid ${lvl.border}`,
                          borderRadius: '6px', padding: '3px 8px', flexShrink: 0
                        }}>
                          {lvl.id}
                        </span>
                        <span style={{ fontSize: '12.5px', lineHeight: 1.45, color: 'var(--neutral-dark)' }}>
                          {t(lvl.descKey, lvl.descFallback)}
                        </span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12.5px', color: 'var(--neutral-muted)', fontStyle: 'italic' }}>
                        {t('roomBooking.noImportance', 'Lịch này được đặt trước khi có mục mức độ quan trọng.')}
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ color: 'var(--neutral-muted)', fontWeight: '600', fontSize: '13px', marginBottom: '6px' }}>
                      {t('roomBooking.purpose', 'Mục đích sử dụng')}
                    </div>
                    <div style={{
                      fontSize: '12.5px', lineHeight: 1.5, color: 'var(--neutral-dark)',
                      whiteSpace: 'pre-wrap', padding: '10px 12px', borderRadius: '8px',
                      border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)'
                    }}>
                      {b.purpose || t('roomBooking.noPurpose', '(Không có nội dung)')}
                    </div>
                  </div>

                  {/* Who was asked to interpret. Bookings made before this field existed have
                      none, and then the section is simply absent rather than showing "(none)". */}
                  {b.interpreters && b.interpreters.length > 0 && (
                    <div>
                      <div style={{ color: 'var(--neutral-muted)', fontWeight: '600', fontSize: '13px', marginBottom: '6px' }}>
                        <i className="fa-solid fa-language" style={{ marginRight: '6px', color: 'var(--primary-color)' }}></i>
                        {t('roomBooking.interpreterLabel', 'Phiên dịch')}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {b.interpreters.map((person, idx) => (
                          <div
                            key={person.id || idx}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
                              padding: '8px 10px', borderRadius: '8px',
                              border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)'
                            }}
                          >
                            <span style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--neutral-dark)' }}>{person.name}</span>
                            <span style={{ fontSize: '11.5px', color: 'var(--neutral-muted)', wordBreak: 'break-all' }}>{person.email}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--neutral-border)', display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  {canCancel ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => handleDeleteBooking(b.id, b.team, `${b.startTime}~${b.endTime}`)}
                      style={{ backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#fff' }}
                    >
                      <i className="fa-solid fa-trash-can"></i> {t('roomBooking.cancelMeeting', 'Huỷ cuộc họp')}
                    </button>
                  ) : isPastBooking && isOwnerOrAdmin ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--neutral-muted)' }}>
                      <i className="fa-solid fa-lock"></i>
                      {t('roomBooking.pastMeetingLocked', 'Cuộc họp đã diễn ra, không thể huỷ.')}
                    </span>
                  ) : <span></span>}
                  <button type="button" className="btn btn-secondary" onClick={() => setDetailBooking(null)}>
                    {t('common.close', 'Đóng')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
