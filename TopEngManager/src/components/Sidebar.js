"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';


export default function Sidebar() {
  const pathname = usePathname();
  const { currentUser, reloadAll, hasPermission } = useApp();
  const { t } = useLanguage();



  if (!currentUser) return null;

  const isAdmin = currentUser.system_role.includes("Admin");
  const isHR = currentUser.system_role.includes("Nhân sự");

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">
          <i className="fa-solid fa-cubes-stacked"></i>
        </div>
        <div className="brand-name">
          <h2>TOPVSystem</h2>
          <span>Manager</span>
        </div>
      </div>
      
      <nav className="sidebar-menu">
        <Link href="/dashboard" className={`menu-item ${pathname === '/dashboard' || pathname === '/' ? 'active' : ''}`}>
          <i className="fa-solid fa-chart-line"></i>
          <span>{t('sidebar.dashboard', 'Dashboard')}</span>
        </Link>
        <Link href="/projects" className={`menu-item ${pathname.startsWith('/projects') ? 'active' : ''}`}>
          <i className="fa-solid fa-folder-open"></i>
          <span>{t('sidebar.projects', 'Dự án')}</span>
        </Link>
        <Link href="/tasks" className={`menu-item ${pathname === '/tasks' ? 'active' : ''}`}>
          <i className="fa-solid fa-list-check"></i>
          <span>{t('sidebar.tasks', 'Công việc')}</span>
        </Link>
        <Link href="/chat" className={`menu-item ${pathname === '/chat' ? 'active' : ''}`}>
          <i className="fa-solid fa-comments"></i>
          <span>{t('sidebar.chat', 'Trò chuyện')}</span>
        </Link>
        <Link href="/documents" className={`menu-item ${pathname === '/documents' ? 'active' : ''}`}>
          <i className="fa-solid fa-file-lines"></i>
          <span>{t('sidebar.documents', 'Tài liệu')}</span>
        </Link>
        <Link href="/daily-reports" className={`menu-item ${pathname === '/daily-reports' ? 'active' : ''}`}>
          <i className="fa-solid fa-file-invoice"></i>
          <span>{t('sidebar.dailyReports', 'Báo cáo ngày')}</span>
        </Link>
        {hasPermission('view_activity_logs') && (
          <Link href="/activity-logs" className={`menu-item ${pathname === '/activity-logs' ? 'active' : ''}`}>
            <i className="fa-solid fa-clock-rotate-left"></i>
            <span>{t('sidebar.activityLogs', 'Lịch sử làm việc')}</span>
          </Link>
        )}
        {hasPermission('view_hr') && (
          <Link href="/hr" className={`menu-item ${pathname === '/hr' ? 'active' : ''}`}>
            <i className="fa-solid fa-user-gear"></i>
            <span>{t('sidebar.teamManagement', currentUser.system_role === 'Team Leader' ? 'Quản lý Team' : 'Quản lý nhân sự')}</span>
          </Link>
        )}
      </nav>
      
      <div className="sidebar-footer">
        <div className="current-user-widget">
          <div className="avatar" style={{ backgroundColor: currentUser.color }}>
            {currentUser.name.split(" ").pop().charAt(0)}
          </div>
          <div className="user-info">
            <h4>{currentUser.name}</h4>
            <span>{currentUser.system_role}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
