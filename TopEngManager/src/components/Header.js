"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { db, MockDB } from '@/utils/db';
import { DatabaseModal } from '@/components/Modals';
import { usePathname, useRouter } from 'next/navigation';

export default function Header() {
  const { currentUser, logout, users, notifications, reloadAll } = useApp();
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.user-switcher-wrapper')) setIsSwitcherOpen(false);
      if (!e.target.closest('.notification-dropdown-wrapper')) setIsNotificationsOpen(false);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  if (!currentUser) return null;

  // Title translation logic based on pathname
  let pageTitle = "Bảng điều khiển";
  if (pathname.startsWith('/projects')) {
    pageTitle = pathname.includes('/projects/') ? "Chi tiết dự án" : "Quản lý Dự án";
  } else if (pathname === '/tasks') {
    pageTitle = "Quản lý Công việc";
  } else if (pathname === '/chat') {
    pageTitle = "Hộp thoại Trò chuyện";
  } else if (pathname === '/documents') {
    pageTitle = "Quản lý Tài liệu";
  } else if (pathname === '/activity-logs') {
    pageTitle = "Lịch sử Hoạt động";
  }

  const handleLogout = async () => {
    setIsSwitcherOpen(false);
    await logout();
    router.push("/");
  };

  const handleMarkAllRead = async () => {
    await db.markAllNotificationsRead(currentUser.id);
    await reloadAll();
  };

  const unreadNotifsCount = notifications.filter(n => !n.is_read).length;

  return (
    <>
      <header className="app-header">
        <div className="header-left">
          <h1 id="page-title">{pageTitle}</h1>
        </div>
        
        <div className="header-right">
          {/* Notification dropdown */}
          <div className="header-action-item notification-dropdown-wrapper">
            <button className="icon-btn" onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}>
              <i className="fa-regular fa-bell"></i>
              {unreadNotifsCount > 0 && <span className="badge badge-danger">{unreadNotifsCount}</span>}
            </button>
            <div className={`dropdown-menu notification-menu ${isNotificationsOpen ? 'show' : ''}`} style={{ right: 0 }}>
              <div className="dropdown-header">
                <h3>Thông báo mới</h3>
                <button className="btn-text" onClick={handleMarkAllRead}>Đánh dấu tất cả đã đọc</button>
              </div>
              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--neutral-muted)' }}>Không có thông báo mới</div>
                ) : (
                  notifications.map(n => {
                    const date = new Date(n.created_at);
                    const timeStr = `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')} ${date.getDate()}/${date.getMonth()+1}`;
                    return (
                      <div className={`notification-item ${!n.is_read ? 'unread' : ''}`} key={n.id} onClick={async () => {
                        // Mark read
                        if (!n.is_read) {
                          await db.markNotificationRead(n.id);
                        }
                        setIsNotificationsOpen(false);
                        if (n.link_url.startsWith('#')) {
                          router.push('/' + n.link_url.replace('#', ''));
                        }
                        await reloadAll();
                      }}>
                        <div className="notification-title">{n.title}</div>
                        <div className="notification-body">{n.content}</div>
                        <div className="notification-time">{timeStr}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          
          {/* User Profile & Logout Dropdown */}
          <div className="user-switcher-wrapper">
            <div className="switcher-trigger" onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}>
              <div className="sw-avatar" style={{ backgroundColor: currentUser.color || '#1E40AF', marginRight: '8px', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: '600' }}>
                {currentUser.name.split(" ").pop().charAt(0)}
              </div>
              <span style={{ fontWeight: '500' }}>{currentUser.name}</span>
              <i className="fa-solid fa-chevron-down" style={{ marginLeft: '6px', fontSize: '10px' }}></i>
            </div>
            <div className={`dropdown-menu switcher-menu ${isSwitcherOpen ? 'show' : ''}`} style={{ right: 0, minWidth: '200px' }}>
              <div className="dropdown-header" style={{ paddingBottom: '4px' }}>Hồ sơ cá nhân</div>
              <div style={{ padding: '8px 16px', fontSize: '12px', color: 'var(--neutral-muted)', borderBottom: '1px solid var(--neutral-border)' }}>
                <div>Email: {currentUser.email}</div>
                <div style={{ marginTop: '2px' }}>Quyền: <span className="badge badge-info" style={{ fontSize: '10px' }}>{currentUser.system_role}</span></div>
              </div>
              <div style={{ padding: '8px' }}>
                <button 
                  onClick={handleLogout} 
                  className="btn btn-danger btn-sm" 
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <i className="fa-solid fa-arrow-right-from-bracket"></i> Đăng xuất
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Connection modal */}
      <DatabaseModal 
        isOpen={isDatabaseModalOpen} 
        onClose={() => setIsDatabaseModalOpen(false)} 
        onSaved={() => window.location.reload()} 
      />
    </>
  );
}
