"use client";

import React, { useState, useEffect, useCallback } from 'react';
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

// Get array of 7 dates centered around referenceDate (index 3 is referenceDate: 3 days before, 3 days after)
// Ensures "today" (or the selected reference date) is always in the exact horizontal center of the screen
const getWeekDays = (referenceDate) => {
  const center = new Date(referenceDate);
  const week = [];
  
  for (let i = -3; i <= 3; i++) {
    const nextDay = new Date(center);
    nextDay.setDate(center.getDate() + i);
    week.push(nextDay);
  }
  return week;
};

export default function RoomBookingPage() {
  const { currentUser, setHeaderActions } = useApp();
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
      await db.createRoomBooking({
        location: modalLocation,
        roomId: modalRoomId,
        date: modalDate,
        startTime,
        endTime,
        team: modalTeam.trim(),
        bookerName: modalBookerName.trim(),
        bookerId: currentUser?.id || null,
        purpose: modalPurpose.trim() || t('roomBooking.defaultPurpose', 'Họp nhóm'),
        importance: modalImportance
      });
      await loadBookings();
      setIsModalOpen(false);
      Swal.fire({
        icon: 'success',
        title: t('common.success', 'Thành công'),
        text: t('roomBooking.bookSuccess', 'Đặt phòng họp thành công!'),
        confirmButtonColor: 'var(--primary-color)',
        timer: 1800,
        showConfirmButton: false
      });
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
      await db.deleteRoomBooking(bookingId, currentUser?.id);
      await loadBookings();
      setDetailBooking(null);
      Swal.fire({
        icon: 'success',
        title: t('common.deleted', 'Đã xóa'),
        text: t('roomBooking.cancelSuccess', 'Đã huỷ lịch đặt phòng thành công.'),
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err) {
      await loadBookings();
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    }
  };

  const getDayLabel = (dateOrIdx) => {
    const labels = [
      t('calendar.mon', 'Thứ 2'),
      t('calendar.tue', 'Thứ 3'),
      t('calendar.wed', 'Thứ 4'),
      t('calendar.thu', 'Thứ 5'),
      t('calendar.fri', 'Thứ 6'),
      t('calendar.sat', 'Thứ 7'),
      t('calendar.sun', 'CN')
    ];
    if (dateOrIdx instanceof Date) {
      const d = dateOrIdx.getDay();
      return labels[d === 0 ? 6 : d - 1];
    }
    return labels[dateOrIdx];
  };

  const isToday = (dateObj) => {
    const today = new Date();
    return dateObj.getDate() === today.getDate() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getFullYear() === today.getFullYear();
  };

  // Automatically center today's column in the viewport/wrapper when scrolling is needed
  const centerTodayColumn = useCallback((behavior = 'auto') => {
    const wrappers = document.querySelectorAll('.room-week-grid-wrapper');
    wrappers.forEach(wrapper => {
      const targetCol = wrapper.querySelector('.room-day-col.is-today') || wrapper.querySelector('.room-day-col:nth-child(4)');
      if (!targetCol) return;

      const wrapperRect = wrapper.getBoundingClientRect();
      const targetRect = targetCol.getBoundingClientRect();
      const currentRelativeLeft = targetRect.left - wrapperRect.left;
      const desiredRelativeLeft = (wrapper.clientWidth - targetCol.clientWidth) / 2;
      const delta = currentRelativeLeft - desiredRelativeLeft;

      if (Math.abs(delta) > 1) {
        wrapper.scrollTo({
          left: wrapper.scrollLeft + delta,
          behavior
        });
      }
    });
  }, []);

  useEffect(() => {
    centerTodayColumn('auto');
    const t1 = setTimeout(() => centerTodayColumn('auto'), 50);
    const t2 = setTimeout(() => centerTodayColumn('auto'), 200);
    const t3 = setTimeout(() => centerTodayColumn('smooth'), 500);

    const handleResize = () => centerTodayColumn('auto');
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', handleResize);
    };
  }, [currentDate, selectedLocation, isLoadingBookings, centerTodayColumn]);

  useEffect(() => {
    setHeaderActions(
      <div className="desktop-header-actions">
        <button 
          type="button" 
          className="btn btn-primary" 
          onClick={() => openBookingModal('room-large')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: '700' }}
        >
          <i className="fa-solid fa-plus-circle"></i>
          {t('roomBooking.bookBtn', 'Đặt phòng họp')}
        </button>
      </div>
    );
    return () => setHeaderActions(null);
  }, [t]);

  return (
    <div className="scrollable-view room-booking-view">

      {/* Mobile-only Action Bar */}
      <div className="mobile-room-booking-action-bar">
        <button 
          type="button" 
          className="btn btn-primary mobile-btn-create" 
          onClick={() => openBookingModal('room-large')}
        >
          <i className="fa-solid fa-plus-circle"></i>
          <span>{t('roomBooking.bookBtn', 'Đặt phòng họp')}</span>
        </button>
      </div>

      {/* Top Filter & Week Navigation Toolbar */}
      <div className="room-booking-toolbar">
        <div className="room-booking-toolbar-inputs">
          <div className="room-booking-toolbar-item">
            <label>
              {t('roomBooking.location', 'Địa điểm:')}
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="room-booking-select"
            >
              {LOCATIONS.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          <div className="room-booking-toolbar-item">
            <label>
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
              className="room-booking-date-input"
            />
          </div>
        </div>

        <div className="room-booking-toolbar-controls">
          <button
            type="button"
            className="btn btn-secondary btn-sm room-booking-today-btn"
            onClick={handleTodayWeek}
          >
            <i className="fa-solid fa-calendar-day" style={{ marginRight: '6px' }}></i> {t('roomBooking.thisWeek', 'Tuần này')}
          </button>

          <div className="room-booking-toolbar-nav">
            <span className="room-booking-range-badge">
              {formatDateShort(weekStart)} ~ {formatDateShort(weekEnd)}
            </span>
            <div className="room-booking-nav-group">
              <button
                type="button"
                onClick={handlePrevWeek}
                title={t('roomBooking.prevWeek', 'Tuần trước')}
                className="room-booking-nav-btn"
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
              <button
                type="button"
                onClick={handleNextWeek}
                title={t('roomBooking.nextWeek', 'Tuần sau')}
                className="room-booking-nav-btn"
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Room Grids */}
      <div className="room-sections-list">
        {ROOMS.map(room => (
          <div key={room.id} className="room-section-block">
            <div className="room-section-header">
              <div className="room-title-wrapper">
                <i className="fa-solid fa-door-open room-title-icon"></i>
                <h3 className="room-title-text">
                  {roomName(room, t)}
                </h3>
              </div>
              <span className="room-capacity-badge">
                {room.id === 'room-large' ? (
                  <><i className="fa-solid fa-users"></i> {t('roomBooking.largeRoomCapacity', 'Sức chứa 12-16 người • Máy chiếu • Tivi')}</>
                ) : (
                  <><i className="fa-solid fa-user-group"></i> {t('roomBooking.smallRoomCapacity', 'Sức chứa 4-8 người • Bảng kính')}</>
                )}
              </span>
            </div>

            <div className="room-week-grid-wrapper">
              <div className="room-week-grid">
                {weekDays.map((dayDate, dayIdx) => {
                  const dayStr = formatDateStr(dayDate);
                  const isPastDay = dayStr < formatDateStr(getToday());
                  const isCurrentDay = isToday(dayDate);
                  
                  const dayBookings = bookings
                    .filter(b => b.location === selectedLocation && b.roomId === room.id && b.date === dayStr)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));

                  return (
                    <div 
                      key={dayStr} 
                      className={`room-day-col ${isCurrentDay ? 'is-today' : ''} ${isPastDay ? 'is-past' : ''}`}
                    >
                      <div className="room-day-col-header">
                        <div className="day-name">
                          {getDayLabel(dayDate)}
                        </div>
                        <div className="day-date">
                          {formatDateShort(dayDate)}
                        </div>
                      </div>

                      <div className="room-day-col-body">
                        {isLoadingBookings ? (
                          <div className="room-col-empty-msg">
                            <i className="fa-solid fa-spinner fa-spin"></i> {t('common.loading', 'Đang tải...')}
                          </div>
                        ) : loadError ? (
                          <div className="room-col-error-msg">
                            <i className="fa-solid fa-triangle-exclamation"></i> {t('roomBooking.loadFailed', 'Lỗi tải')}
                          </div>
                        ) : dayBookings.length === 0 ? (
                          <div className="room-col-empty-msg">
                            {t('roomBooking.emptyDay', 'Trống')}
                          </div>
                        ) : (
                          dayBookings.map(b => {
                            const lvl = getImportanceLevel(b.importance);
                            const impClass = lvl ? `imp-${lvl.id.toLowerCase()}` : '';
                            return (
                              <div
                                key={b.id}
                                onDoubleClick={() => setDetailBooking(b)}
                                title={t('roomBooking.viewDetailHint', 'Nhấp đúp để xem chi tiết cuộc họp')}
                                className={`room-meeting-card ${impClass}`}
                              >
                                {lvl && (
                                  <span
                                    title={`${lvl.id} — ${t(lvl.descKey, lvl.descFallback)}`}
                                    className={`meeting-imp-dot imp-${lvl.id.toLowerCase()}`}
                                    style={{ backgroundColor: lvl.color, borderColor: lvl.border, boxShadow: `0 0 5px ${lvl.color}` }}
                                  ></span>
                                )}
                                <div className="meeting-team-title">
                                  {b.team}
                                </div>
                                <div className="meeting-booker-name">
                                  &lt;{b.bookerName}&gt;
                                </div>
                                <div className="meeting-time-badge">
                                  <i className="fa-regular fa-clock" style={{ marginRight: '4px', fontSize: '10px' }}></i>
                                  {b.startTime} ~ {b.endTime}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isPastDay}
                        title={isPastDay ? t('roomBooking.pastDateBlocked', 'Không thể đặt phòng cho ngày đã qua.') : undefined}
                        onClick={() => openBookingModal(room.id, dayStr)}
                        className={`room-book-slot-btn ${isPastDay ? 'is-disabled' : ''}`}
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

      {/* Booking Form Modal */}
      {isModalOpen && (
        <div className="modal show room-booking-modal" style={{ display: 'flex', zIndex: 1000 }}>
          <div className="modal-dialog" style={{ maxWidth: '660px', width: '95%' }}>
            <div className="modal-content">
              <div className="modal-header">
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-door-open" style={{ color: 'var(--primary-color)' }}></i>
                  {t('roomBooking.newBookingTitle', 'Đặt phòng họp mới')}
                </h3>
                <button className="btn-close-modal" onClick={() => setIsModalOpen(false)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <form onSubmit={handleSaveBooking}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label style={{ fontWeight: '700', fontSize: '12.5px', marginBottom: '4px', display: 'block' }}>
                        {t('roomBooking.locationLabel', 'Địa điểm')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select
                        value={modalLocation}
                        onChange={(e) => setModalLocation(e.target.value)}
                        className="room-modal-input"
                      >
                        {LOCATIONS.map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label style={{ fontWeight: '700', fontSize: '12.5px', marginBottom: '4px', display: 'block' }}>
                        {t('roomBooking.roomLabel', 'Phòng họp')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select
                        value={modalRoomId}
                        onChange={(e) => setModalRoomId(e.target.value)}
                        className="room-modal-input"
                      >
                        {ROOMS.map(r => (
                          <option key={r.id} value={r.id}>{roomName(r, t)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px' }}>
                    <div className="form-group">
                      <label style={{ fontWeight: '700', fontSize: '12.5px', marginBottom: '4px', display: 'block' }}>
                        {t('roomBooking.bookingDate', 'Ngày đặt')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="date"
                        value={modalDate}
                        min={formatDateStr(getToday())}
                        onChange={(e) => setModalDate(e.target.value)}
                        required
                        className="room-modal-input"
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontWeight: '700', fontSize: '12.5px', marginBottom: '4px', display: 'block' }}>
                        {t('roomBooking.startTime', 'Bắt đầu')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <TimeField
                        value={modalStartTime}
                        onChange={setModalStartTime}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontWeight: '700', fontSize: '12.5px', marginBottom: '4px', display: 'block' }}>
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
                      <label style={{ fontWeight: '700', fontSize: '12.5px', marginBottom: '4px', display: 'block' }}>
                        {t('roomBooking.team', 'Team / Bộ phận')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={modalTeam}
                        onChange={(e) => setModalTeam(e.target.value)}
                        placeholder={t('roomBooking.teamPlaceholder', 'VD: Team R&D')}
                        required
                        className="room-modal-input"
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontWeight: '700', fontSize: '12.5px', marginBottom: '4px', display: 'block' }}>
                        {t('roomBooking.bookerName', 'Tên người đặt')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={modalBookerName}
                        onChange={(e) => setModalBookerName(e.target.value)}
                        placeholder={t('roomBooking.bookerPlaceholder', 'VD: Nguyễn Văn A')}
                        required
                        className="room-modal-input"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ fontWeight: '700', fontSize: '12.5px', marginBottom: '4px', display: 'block' }}>
                      {t('roomBooking.purposeLabel', 'Nội dung / Mục đích cuộc họp')}
                    </label>
                    <textarea
                      rows={3}
                      value={modalPurpose}
                      onChange={(e) => setModalPurpose(e.target.value)}
                      placeholder={t('roomBooking.purposePlaceholder', 'Nhập nội dung hoặc mục đích cuộc họp...')}
                      className="room-modal-input"
                    />
                  </div>

                  {/* Importance selector */}
                  <div className="form-group">
                    <label style={{ fontWeight: '700', fontSize: '12.5px', marginBottom: '6px', display: 'block' }}>
                      {t('roomBooking.importance', 'Mức độ quan trọng')} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {IMPORTANCE_LEVELS.map(lvl => {
                        const isPicked = modalImportance === lvl.id;
                        return (
                          <label
                            key={lvl.id}
                            className={`room-importance-option ${isPicked ? 'is-selected' : ''} imp-${lvl.id.toLowerCase()}`}
                          >
                            <input
                              type="radio"
                              name="meeting-importance"
                              value={lvl.id}
                              checked={isPicked}
                              onChange={() => setModalImportance(lvl.id)}
                              style={{ cursor: 'pointer', margin: 0, accentColor: lvl.color }}
                            />
                            <span className={`importance-badge-tag imp-${lvl.id.toLowerCase()}`}>
                              {lvl.id}
                            </span>
                            <span className="importance-desc-text">
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

      {/* Meeting detail Modal */}
      {detailBooking && (() => {
        const b = detailBooking;
        const lvl = getImportanceLevel(b.importance);
        const isPastBooking = b.date < formatDateStr(getToday());
        const isOwnerOrAdmin = currentUser && (b.bookerName === currentUser.name || currentUser.system_role.includes('Admin'));
        const canCancel = !!isOwnerOrAdmin && !isPastBooking;
        const room = ROOMS.find(r => r.id === b.roomId);
        const loc = LOCATIONS.find(l => l.id === b.location);
        const dayDate = parseDateStr(b.date);
        const rows = [
          [t('roomBooking.locationLabel', 'Địa điểm'), loc ? loc.name : b.location],
          [t('roomBooking.roomLabel', 'Phòng họp'), room ? roomName(room, t) : b.roomId],
          [t('roomBooking.dateLabel', 'Ngày họp'), `${getDayLabel(dayDate)}, ${formatDateShort(dayDate)}`],
          [t('roomBooking.time', 'Khung giờ'), `${b.startTime} ~ ${b.endTime}`],
          [t('roomBooking.team', 'Team / Bộ phận'), b.team],
          [t('roomBooking.booker', 'Người đặt'), b.bookerName]
        ];

        return (
          <div className="modal show room-booking-modal" style={{ display: 'flex', zIndex: 1001 }}>
            <div className="modal-dialog" style={{ maxWidth: '560px', width: '95%' }}>
              <div className="modal-content">
                <div className="modal-header">
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-circle-info" style={{ color: 'var(--primary-color)' }}></i>
                    {t('roomBooking.detailTitle', 'Chi tiết cuộc họp')}
                  </h3>
                  <button className="btn-close-modal" onClick={() => setDetailBooking(null)}>
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
                  <div className="room-detail-info-grid">
                    {rows.map(([label, value]) => (
                      <React.Fragment key={label}>
                        <span className="room-detail-label">{label}</span>
                        <span className="room-detail-value">{value}</span>
                      </React.Fragment>
                    ))}
                  </div>

                  <div>
                    <div style={{ color: 'var(--neutral-muted)', fontWeight: '700', fontSize: '12.5px', marginBottom: '6px' }}>
                      {t('roomBooking.importance', 'Mức độ quan trọng')}
                    </div>
                    {lvl ? (
                      <div className={`room-importance-display imp-${lvl.id.toLowerCase()}`}>
                        <span className={`importance-badge-tag imp-${lvl.id.toLowerCase()}`}>
                          {lvl.id}
                        </span>
                        <span className="importance-desc-text">
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
                    <div style={{ color: 'var(--neutral-muted)', fontWeight: '700', fontSize: '12.5px', marginBottom: '6px' }}>
                      {t('roomBooking.purpose', 'Mục đích sử dụng')}
                    </div>
                    <div className="room-detail-purpose-box">
                      {b.purpose || t('roomBooking.noPurpose', '(Không có nội dung)')}
                    </div>
                  </div>
                </div>

                <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--neutral-border)', display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  {canCancel ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => handleDeleteBooking(b.id, b.team, `${b.startTime}~${b.endTime}`)}
                      style={{ backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#fff', fontWeight: '700' }}
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
