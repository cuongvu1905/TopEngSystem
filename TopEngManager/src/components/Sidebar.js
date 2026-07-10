"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { db, MockDB } from '@/utils/db';
import Swal from 'sweetalert2';

export default function Sidebar() {
  const pathname = usePathname();
  const { currentUser, reloadAll, hasPermission } = useApp();

  const handleResetData = async () => {
    const confirmResult = await Swal.fire({
      title: 'Thiết lập lại dữ liệu?',
      text: "Bạn có chắc chắn muốn thiết lập lại toàn bộ dữ liệu mẫu ban đầu? Tất cả thay đổi của bạn sẽ bị mất.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy'
    });
    if (confirmResult.isConfirmed) {
      if (db === MockDB) {
        MockDB.resetAll();
        localStorage.removeItem("ems_current_user_id");
        await Swal.fire({ icon: 'success', title: 'Thành công', text: "Dữ liệu đã được khôi phục về mặc định!" });
        window.location.reload();
      } else {
        Swal.fire({
          icon: 'info',
          title: 'Thông báo',
          text: "Nút Reset chỉ áp dụng cho dữ liệu cục bộ (MockDB). Để thiết lập lại dữ liệu trên MySQL, vui lòng chạy lại script schema.sql trong trình quản lý cơ sở dữ liệu MySQL của bạn."
        });
      }
    }
  };

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
          <h2>TopEng</h2>
          <span>Manager</span>
        </div>
      </div>
      
      <nav className="sidebar-menu">
        <Link href="/dashboard" className={`menu-item ${pathname === '/dashboard' || pathname === '/' ? 'active' : ''}`}>
          <i className="fa-solid fa-chart-line"></i>
          <span>Dashboard</span>
        </Link>
        <Link href="/projects" className={`menu-item ${pathname.startsWith('/projects') ? 'active' : ''}`}>
          <i className="fa-solid fa-folder-open"></i>
          <span>Dự án</span>
        </Link>
        <Link href="/tasks" className={`menu-item ${pathname === '/tasks' ? 'active' : ''}`}>
          <i className="fa-solid fa-list-check"></i>
          <span>Công việc</span>
        </Link>
        <Link href="/chat" className={`menu-item ${pathname === '/chat' ? 'active' : ''}`}>
          <i className="fa-solid fa-comments"></i>
          <span>Trò chuyện</span>
        </Link>
        <Link href="/documents" className={`menu-item ${pathname === '/documents' ? 'active' : ''}`}>
          <i className="fa-solid fa-file-lines"></i>
          <span>Tài liệu</span>
        </Link>
        <Link href="/daily-reports" className={`menu-item ${pathname === '/daily-reports' ? 'active' : ''}`}>
          <i className="fa-solid fa-file-invoice"></i>
          <span>Báo cáo ngày</span>
        </Link>
        {hasPermission('view_activity_logs') && (
          <Link href="/activity-logs" className={`menu-item ${pathname === '/activity-logs' ? 'active' : ''}`}>
            <i className="fa-solid fa-clock-rotate-left"></i>
            <span>Lịch sử làm việc</span>
          </Link>
        )}
        {hasPermission('view_hr') && (
          <Link href="/hr" className={`menu-item ${pathname === '/hr' ? 'active' : ''}`}>
            <i className="fa-solid fa-user-gear"></i>
            <span>Quản lý nhân sự</span>
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
        <button onClick={handleResetData} title="Reset dữ liệu về mặc định" className="btn-reset-icon">
          <i className="fa-solid fa-arrows-rotate"></i>
        </button>
      </div>
    </aside>
  );
}
