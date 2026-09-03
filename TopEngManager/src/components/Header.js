"use client";

import React from 'react';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { usePathname } from 'next/navigation';

export default function Header({ onToggleSidebar }) {
  const { currentUser, headerActions, headerTitle } = useApp();
  const { t } = useLanguage();
  const pathname = usePathname();

  if (!currentUser) return null;

  // Title translation logic based on pathname
  let pageTitle = headerTitle;
  if (!pageTitle) {
    pageTitle = t('sidebar.dashboard', 'Dashboard');
    if (pathname.startsWith('/projects')) {
      pageTitle = pathname.includes('/projects/') ? t('projects.projectDetailTitle', 'Chi tiết dự án') : t('sidebar.projects', 'Dự án');
    } else if (pathname === '/tasks') {
      pageTitle = t('sidebar.tasks', 'Công việc');
    } else if (pathname === '/room-booking') {
      pageTitle = t('sidebar.roomBooking', 'Đặt phòng họp');
    } else if (pathname === '/chat') {
      pageTitle = t('sidebar.chat', 'Trò chuyện');
    } else if (pathname === '/documents') {
      pageTitle = t('sidebar.documents', 'Tài liệu');
    } else if (pathname === '/activity-logs') {
      pageTitle = t('sidebar.activityLogs', 'Lịch sử làm việc');
    } else if (pathname === '/hr') {
      pageTitle = t('sidebar.teamManagement', 'Quản lý nhân sự');
    } else if (pathname === '/daily-reports') {
      pageTitle = t('sidebar.dailyReports', 'Báo cáo ngày');
    }
  }

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          type="button"
          className="sidebar-toggle-btn"
          aria-label={t('header.toggleMenu', 'Mở/đóng menu')}
          onClick={onToggleSidebar}
        >
          <i className="fa-solid fa-bars"></i>
        </button>
        <h1 id="page-title">{pageTitle}</h1>
      </div>
      
      <div className="header-right">
        {headerActions}
      </div>
    </header>
  );
}
