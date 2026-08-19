"use client";

import React, { useState, useEffect } from 'react';
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

// Default initial demo bookings matching the user's wireframe
const INITIAL_BOOKINGS = [
  // Large Room Monday
  {
    id: 'b-1',
    location: 'HN',
    roomId: 'room-large',
    date: '2026-08-10', // Monday
    startTime: '09:00',
    endTime: '11:00',
    team: 'Team R&D',
    bookerName: 'Lê Nhân Viên',
    purpose: 'Họp quy hoạch hệ thống mới'
  },
  {
    id: 'b-2',
    location: 'HN',
    roomId: 'room-large',
    date: '2026-08-10',
    startTime: '11:00',
    endTime: '12:00',
    team: 'Team Sales',
    bookerName: 'Vũ Kinh Doanh',
    purpose: 'Họp với đối tác khách hàng'
  },
  {
    id: 'b-3',
    location: 'HN',
    roomId: 'room-large',
    date: '2026-08-10',
    startTime: '14:00',
    endTime: '16:00',
    team: 'Team HR',
    bookerName: 'Phạm Trưởng Nhóm',
    purpose: 'Phỏng vấn nhân sự quý III'
  },
  // Large Room Tuesday
  {
    id: 'b-4',
    location: 'HN',
    roomId: 'room-large',
    date: '2026-08-11', // Tuesday
    startTime: '09:00',
    endTime: '11:00',
    team: 'Team PC',
    bookerName: 'PC Team Leader',
    purpose: 'Họp giao ban tuần'
  },
  {
    id: 'b-5',
    location: 'HN',
    roomId: 'room-large',
    date: '2026-08-11',
    startTime: '11:00',
    endTime: '12:00',
    team: 'Team R&D',
    bookerName: 'Hoàng Phát Triển',
    purpose: 'Review tính năng mới'
  },
  {
    id: 'b-6',
    location: 'HN',
    roomId: 'room-large',
    date: '2026-08-11',
    startTime: '14:00',
    endTime: '16:00',
    team: 'Team BOD',
    bookerName: 'Nguyễn Admin',
    purpose: 'Họp chiến lược ban điều hành'
  },
  // Small Room Wednesday
  {
    id: 'b-7',
    location: 'HN',
    team: 'Team R&D',
    bookerName: 'Ngo Lập Trình',
    purpose: 'Code review nội bộ'
  }
];

export default function RoomBookingPage() {
  const { currentUser } = useApp();
  const { t } = useLanguage();

  const [selectedLocation, setSelectedLocation] = useState('HN');
  const [currentDate, setCurrentDate] = useState(getToday);
  const [bookings, setBookings] = useState([]);
  
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

  // Load stored bookings or initialize
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ems_room_bookings');
      if (stored) {
        setBookings(JSON.parse(stored));
      } else {
        setBookings(INITIAL_BOOKINGS);
        localStorage.setItem('ems_room_bookings', JSON.stringify(INITIAL_BOOKINGS));
      }
    } catch (e) {
      setBookings(INITIAL_BOOKINGS);
    }
  }, []);

  // Update booker name when currentUser is loaded
  useEffect(() => {
    if (currentUser && !modalBookerName) {
      setModalBookerName(currentUser.name || '');
      if (currentUser.department_name) {
        setModalTeam(`Team ${currentUser.department_name}`);
      }
    }
  }, [currentUser]);

  // Save bookings to localStorage
  const saveBookingsState = (newBookings) => {
    setBookings(newBookings);
    try {
      localStorage.setItem('ems_room_bookings', JSON.stringify(newBookings));
    } catch (e) {
      console.error("Failed to save room bookings to localStorage", e);
    }
  };

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

    if (modalStartTime >= modalEndTime) {
      Swal.fire({
        icon: 'warning',
        title: t('common.notice', 'Thông báo'),
        text: t('roomBooking.endAfterStart', 'Thời gian kết thúc phải lớn hơn thời gian bắt đầu.'),
        confirmButtonColor: 'var(--primary-color)'
      });
      setIsSavingBooking(false);
      return;
    }

    // Check overlap for the same location, room, and date
    const isOverlap = bookings.some(b => 
      b.location === modalLocation &&
      b.roomId === modalRoomId &&
      b.date === modalDate &&
      (
        (modalStartTime >= b.startTime && modalStartTime < b.endTime) ||
        (modalEndTime > b.startTime && modalEndTime <= b.endTime) ||
        (modalStartTime <= b.startTime && modalEndTime >= b.endTime)
      )
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

    const newBooking = {
      id: `booking-${Date.now()}`,
      location: modalLocation,
      roomId: modalRoomId,
      date: modalDate,
      startTime: modalStartTime,
      endTime: modalEndTime,
      team: modalTeam.trim(),
      bookerName: modalBookerName.trim(),
      purpose: modalPurpose.trim() || t('roomBooking.defaultPurpose', 'Họp nhóm'),
      importance: modalImportance
    };

    const updated = [...bookings, newBooking];
    saveBookingsState(updated);
    setIsModalOpen(false);
    setIsSavingBooking(false);

    Swal.fire({
      icon: 'success',
      title: t('common.success', 'Thành công'),
      text: t('roomBooking.bookSuccess', 'Đặt phòng họp thành công!'),
      confirmButtonColor: 'var(--primary-color)',
      timer: 1800,
      showConfirmButton: false
    });
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

    if (result.isConfirmed) {
      const updated = bookings.filter(b => b.id !== bookingId);
      saveBookingsState(updated);
      setDetailBooking(null);
      Swal.fire({
        icon: 'success',
        title: t('common.deleted', 'Đã xóa'),
        text: t('roomBooking.cancelSuccess', 'Đã huỷ lịch đặt phòng thành công.'),
        timer: 1500,
        showConfirmButton: false
      });
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
                        {dayBookings.length === 0 ? (
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

                      <button
                        type="button"
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
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--primary-color)';
                          e.currentTarget.style.color = 'var(--primary-color)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--neutral-border)';
                          e.currentTarget.style.color = 'var(--neutral-muted)';
                        }}
                      >
                        + {t('roomBooking.bookThisSlot', 'Đặt giờ này')}
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
                        onChange={(e) => setModalDate(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', outline: 'none' }}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontWeight: '600', fontSize: '13px', color: 'var(--neutral-dark)', marginBottom: '4px', display: 'block' }}>
                        {t('roomBooking.startTime', 'Bắt đầu')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select
                        value={modalStartTime}
                        onChange={(e) => setModalStartTime(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', outline: 'none' }}
                      >
                        {['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label style={{ fontWeight: '600', fontSize: '13px', color: 'var(--neutral-dark)', marginBottom: '4px', display: 'block' }}>
                        {t('roomBooking.endTime', 'Kết thúc')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select
                        value={modalEndTime}
                        onChange={(e) => setModalEndTime(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', outline: 'none' }}
                      >
                        {['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
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
                      {t('roomBooking.purposeLabel', 'Nội dung / Mục đích cuộc họp')}
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
        const canCancel = currentUser && (b.bookerName === currentUser.name || currentUser.system_role.includes('Admin'));
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
