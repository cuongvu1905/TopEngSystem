"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { getSwal } from '@/utils/swal';

const LOCATIONS = [
  { id: 'HN', name: 'Hà Nội (HN)' },
  { id: 'VP', name: 'Vĩnh Phúc (VP)' }
];

const ROOMS = [
  { id: 'room-large', name: 'Phòng họp lớn' },
  { id: 'room-small', name: 'Phòng họp nhỏ' }
];

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
  // Tính năng "Đặt phòng họp" đang tạm thời comment theo yêu cầu
  return null;

  /*
  const { currentUser } = useApp();
  const { t } = useLanguage();

  const [selectedLocation, setSelectedLocation] = useState('HN');
  const [currentDate, setCurrentDate] = useState(new Date('2026-08-10'));
  const [bookings, setBookings] = useState([]);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLocation, setModalLocation] = useState('HN');
  const [modalRoomId, setModalRoomId] = useState('room-large');
  const [modalDate, setModalDate] = useState(formatDateStr(new Date('2026-08-10')));
  const [modalStartTime, setModalStartTime] = useState('09:00');
  const [modalEndTime, setModalEndTime] = useState('11:00');
  const [modalTeam, setModalTeam] = useState('Team R&D');
  const [modalBookerName, setModalBookerName] = useState('');
  const [modalPurpose, setModalPurpose] = useState('');

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
    setCurrentDate(new Date('2026-08-10'));
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
    setIsModalOpen(true);
  };

  // Handle Submit Booking
  const handleSaveBooking = async (e) => {
    e.preventDefault();
    const Swal = await getSwal();

    if (!modalBookerName.trim() || !modalTeam.trim() || !modalDate) {
      Swal.fire({
        icon: 'warning',
        title: t('common.notice', 'Thông báo'),
        text: 'Vui lòng điền đầy đủ thông tin đặt phòng.',
        confirmButtonColor: 'var(--primary-color)'
      });
      return;
    }

    if (modalStartTime >= modalEndTime) {
      Swal.fire({
        icon: 'warning',
        title: t('common.notice', 'Thông báo'),
        text: 'Thời gian kết thúc phải lớn hơn thời gian bắt đầu.',
        confirmButtonColor: 'var(--primary-color)'
      });
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
        text: 'Khung giờ này đã có nhóm khác đặt phòng. Vui lòng chọn khung giờ khác!',
        confirmButtonColor: 'var(--primary-color)'
      });
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
      purpose: modalPurpose.trim() || 'Họp nhóm'
    };

    const updated = [...bookings, newBooking];
    saveBookingsState(updated);
    setIsModalOpen(false);

    Swal.fire({
      icon: 'success',
      title: t('common.success', 'Thành công'),
      text: 'Đặt phòng họp thành công!',
      confirmButtonColor: 'var(--primary-color)',
      timer: 1800,
      showConfirmButton: false
    });
  };

  // Delete booking
  const handleDeleteBooking = async (bookingId, bookingTeam, timeSlot) => {
    const Swal = await getSwal();
    const result = await Swal.fire({
      title: t('common.confirmDelete', 'Xác nhận xóa'),
      text: `Bạn có chắc chắn muốn hủy lịch đặt phòng [${timeSlot}] của ${bookingTeam}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b'
    });

    if (result.isConfirmed) {
      const updated = bookings.filter(b => b.id !== bookingId);
      saveBookingsState(updated);
      Swal.fire({
        icon: 'success',
        title: t('common.deleted', 'Đã xóa'),
        text: 'Đã hủy lịch đặt phòng thành công.',
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
                  setCurrentDate(new Date(e.target.value));
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
            <i className="fa-solid fa-calendar-day" style={{ marginRight: '4px' }}></i> Tuần này
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
              title="Tuần trước"
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
              title="Tuần sau"
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
                {t(`roomBooking.${room.id === 'room-large' ? 'largeRoom' : 'smallRoom'}`, room.name)}
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
                            Trống
                          </div>
                        ) : (
                          dayBookings.map(b => {
                            const isMyBooking = currentUser && (b.bookerName === currentUser.name || currentUser.system_role.includes('Admin'));
                            return (
                              <div
                                key={b.id}
                                title={`Mục đích: ${b.purpose}`}
                                style={{
                                  border: '1.5px solid rgba(56, 189, 248, 0.65)',
                                  borderRadius: '10px',
                                  padding: '10px 8px',
                                  backgroundColor: 'var(--neutral-bg-main)',
                                  textAlign: 'center',
                                  position: 'relative',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                {isMyBooking && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBooking(b.id, b.team, `${b.startTime}~${b.endTime}`)}
                                    title="Hủy đặt phòng"
                                    style={{
                                      position: 'absolute',
                                      top: '4px',
                                      right: '6px',
                                      border: 'none',
                                      background: 'transparent',
                                      color: '#ef4444',
                                      fontSize: '11px',
                                      cursor: 'pointer',
                                      padding: '2px'
                                    }}
                                  >
                                    <i className="fa-solid fa-xmark"></i>
                                  </button>
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
                        + Đặt giờ này
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
          <div className="modal-dialog" style={{ maxWidth: '540px', width: '95%' }}>
            <div className="modal-content">
              <div className="modal-header">
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--neutral-dark)' }}>
                  <i className="fa-solid fa-door-open" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>
                  Đặt phòng họp mới
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
                        Địa điểm <span style={{ color: '#ef4444' }}>*</span>
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
                        Phòng họp <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select
                        value={modalRoomId}
                        onChange={(e) => setModalRoomId(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', outline: 'none' }}
                      >
                        {ROOMS.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px' }}>
                    <div className="form-group">
                      <label style={{ fontWeight: '600', fontSize: '13px', color: 'var(--neutral-dark)', marginBottom: '4px', display: 'block' }}>
                        Ngày đặt <span style={{ color: '#ef4444' }}>*</span>
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
                        Bắt đầu <span style={{ color: '#ef4444' }}>*</span>
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
                        Kết thúc <span style={{ color: '#ef4444' }}>*</span>
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
                        Team / Bộ phận <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={modalTeam}
                        onChange={(e) => setModalTeam(e.target.value)}
                        placeholder="VD: Team R&D"
                        required
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', outline: 'none' }}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontWeight: '600', fontSize: '13px', color: 'var(--neutral-dark)', marginBottom: '4px', display: 'block' }}>
                        Tên người đặt <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={modalBookerName}
                        onChange={(e) => setModalBookerName(e.target.value)}
                        placeholder="VD: Nguyễn Văn A"
                        required
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', outline: 'none' }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ fontWeight: '600', fontSize: '13px', color: 'var(--neutral-dark)', marginBottom: '4px', display: 'block' }}>
                      Nội dung / Mục đích cuộc họp
                    </label>
                    <textarea
                      rows={3}
                      value={modalPurpose}
                      onChange={(e) => setModalPurpose(e.target.value)}
                      placeholder="Nhập nội dung hoặc mục đích cuộc họp..."
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', outline: 'none', resize: 'vertical' }}
                    />
                  </div>
                </div>

                <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--neutral-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsModalOpen(false)}
                  >
                    {t('common.cancel', 'Hủy')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    {t('roomBooking.bookBtn', 'Đặt phòng họp')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    {t('roomBooking.bookBtn', 'Đặt phòng họp')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  */
}
