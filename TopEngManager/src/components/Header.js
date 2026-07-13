"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { db } from '@/utils/db';
import { usePathname, useRouter } from 'next/navigation';
import { getSwal } from '@/utils/swal';

export default function Header() {
  const { currentUser, logout, users, notifications, reloadAll } = useApp();
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
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

  const handleShowTeamTree = async () => {
    const Swal = await getSwal();
    Swal.fire({
      title: 'Đang tải sơ đồ nhóm...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const depts = await db.getDepartments();
      const usersList = await db.getUsers();
      
      let teamDept = null;
      const myDeptId = currentUser.department_id;
      const myDept = depts.find(d => d.department_id === myDeptId);
      
      if (myDept) {
        if (myDept.parent_id) {
          teamDept = depts.find(d => d.department_id === myDept.parent_id);
        } else {
          teamDept = myDept;
        }
      }

      if (!teamDept) {
        Swal.fire({
          icon: 'info',
          title: 'Thông báo',
          text: 'Tài khoản của bạn chưa được phân nhóm hoặc team không tồn tại.',
          confirmButtonColor: 'var(--primary-color)'
        });
        return;
      }

      const teamDeptUsers = usersList.filter(u => u.department_id === teamDept.department_id);
      const childDepts = depts.filter(d => d.parent_id === teamDept.department_id);

      let treeHtml = `
        <div style="text-align: left; padding: 10px; font-size: 13.5px; line-height: 1.6;">
          <div style="font-weight: 700; font-size: 15px; color: #1e40af; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-sitemap"></i> Sơ đồ nhóm: ${teamDept.name} (${teamDept.department_id})
          </div>
          <div style="border-left: 2px dashed #cbd5e1; margin-left: 8px; padding-left: 12px;">
      `;

      // Add root members
      treeHtml += `
            <div style="margin-bottom: 10px;">
              <span style="font-weight: 600; color: var(--foreground-color);"><i class="fa-solid fa-folder-open" style="color: #1e40af; margin-right: 6px;"></i> ${teamDept.name} (Root)</span>
              <div style="margin-left: 18px; margin-top: 4px;">
      `;
      if (teamDeptUsers.length === 0) {
        treeHtml += `  <div style="color: var(--neutral-muted); font-style: italic; font-size: 12px;">Chưa có thành viên</div>`;
      } else {
        teamDeptUsers.forEach(u => {
          treeHtml += `
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <i class="fa-solid fa-user" style="font-size: 11px; color: var(--neutral-muted);"></i>
              <span>${u.name}</span>
              <span class="badge ${u.system_role.includes('Leader') ? 'badge-danger' : 'badge-info'}" style="font-size: 10px; padding: 1px 4px;">${u.system_role}</span>
            </div>`;
        });
      }
      treeHtml += `
              </div>
            </div>
      `;

      // Add child parts and their members
      childDepts.forEach(child => {
        const childUsers = usersList.filter(u => u.department_id === child.department_id);
        treeHtml += `
            <div style="margin-bottom: 10px; margin-top: 12px;">
              <span style="font-weight: 600; color: var(--foreground-color);"><i class="fa-solid fa-folder" style="color: #eab308; margin-right: 6px;"></i> ${child.name} (${child.department_id})</span>
              <div style="margin-left: 18px; margin-top: 4px;">
        `;
        if (childUsers.length === 0) {
          treeHtml += `  <div style="color: var(--neutral-muted); font-style: italic; font-size: 12px;">Chưa có thành viên</div>`;
        } else {
          childUsers.forEach(u => {
            treeHtml += `
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <i class="fa-solid fa-user" style="font-size: 11px; color: var(--neutral-muted);"></i>
                <span>${u.name}</span>
                <span class="badge ${u.system_role.includes('Leader') ? 'badge-warning' : 'badge-info'}" style="font-size: 10px; padding: 1px 4px;">${u.system_role}</span>
              </div>`;
          });
        }
        treeHtml += `
              </div>
            </div>
        `;
      });

      treeHtml += `
          </div>
        </div>
      `;

      Swal.fire({
        title: 'Cơ cấu Team',
        html: treeHtml,
        confirmButtonText: 'Đóng',
        confirmButtonColor: 'var(--primary-color)'
      });

    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Lỗi',
        text: 'Không thể tải cơ cấu nhóm.',
        confirmButtonColor: 'var(--primary-color)'
      });
    }
  };

  const handleShowProfile = async () => {
    setIsSwitcherOpen(false);
    const Swal = await getSwal();
    
    // Fetch departments to find parent team
    let teamName = '';
    try {
      const depts = await db.getDepartments();
      const myDept = depts.find(d => d.department_id === currentUser.department_id);
      if (myDept && myDept.parent_id) {
        const parentDept = depts.find(d => d.department_id === myDept.parent_id);
        if (parentDept) {
          teamName = parentDept.name;
        }
      }
    } catch (e) {
      console.error("Failed to fetch departments in profile:", e);
    }

    Swal.fire({
      title: 'Hồ sơ cá nhân',
      html: `
        <div style="text-align: left; padding: 10px;">
          <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px; border-bottom: 1px solid var(--neutral-border); padding-bottom: 15px;">
            <div style="width: 50px; height: 50px; border-radius: 50%; background-color: ${currentUser.color || '#1E40AF'}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 600;">
              ${currentUser.name.split(" ").pop().charAt(0)}
            </div>
            <div>
              <div style="font-weight: 600; font-size: 16px; color: var(--foreground-color);">${currentUser.name}</div>
              <div style="font-size: 13px; color: var(--neutral-muted);">${currentUser.email}</div>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 100px 1fr; gap: 10px; font-size: 14px;">
            <strong style="color: var(--neutral-muted);">Mã nhân viên:</strong>
            <span>${currentUser.id}</span>
            ${teamName ? `
              <strong style="color: var(--neutral-muted);">Team:</strong>
              <span id="view-team-link" style="color: #1e40af; text-decoration: underline; cursor: pointer; font-weight: 600;">${teamName}</span>
            ` : ''}
            <strong style="color: var(--neutral-muted);">Phòng ban:</strong>
            <span>${currentUser.department_name || 'Chưa phân phòng'}</span>
            <strong style="color: var(--neutral-muted);">Quyền hạn:</strong>
            <span>${currentUser.system_role}</span>
          </div>
        </div>
      `,
      showDenyButton: true,
      denyButtonText: 'Đổi mật khẩu',
      denyButtonColor: '#64748b',
      confirmButtonText: 'Đóng',
      confirmButtonColor: 'var(--primary-color)',
      didOpen: () => {
        const link = document.getElementById('view-team-link');
        if (link) {
          link.onclick = () => {
            Swal.close();
            setTimeout(() => {
              handleShowTeamTree();
            }, 150);
          };
        }
      }
    }).then((result) => {
      if (result.isDenied) {
        handleShowChangePassword();
      }
    });
  };

  const handleShowChangePassword = async () => {
    const Swal = await getSwal();
    Swal.fire({
      title: 'Đổi mật khẩu',
      html: `
        <div style="text-align: left; padding: 10px;">
          <div class="form-group" style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px;">Mật khẩu hiện tại <span style="color: red;">*</span></label>
            <input type="password" id="current-password" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box; font-size: 14px;" placeholder="Nhập mật khẩu hiện tại...">
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px;">Mật khẩu mới <span style="color: red;">*</span></label>
            <input type="password" id="new-password" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box; font-size: 14px;" placeholder="Nhập mật khẩu mới...">
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px;">Xác nhận mật khẩu mới <span style="color: red;">*</span></label>
            <input type="password" id="confirm-password" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box; font-size: 14px;" placeholder="Xác nhận mật khẩu mới...">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Đổi mật khẩu',
      cancelButtonText: 'Hủy',
      confirmButtonColor: 'var(--primary-color)',
      focusConfirm: false,
      preConfirm: () => {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        if (!currentPassword || !newPassword || !confirmPassword) {
          Swal.showValidationMessage('Vui lòng nhập đầy đủ thông tin.');
          return false;
        }
        if (newPassword !== confirmPassword) {
          Swal.showValidationMessage('Mật khẩu mới và xác nhận mật khẩu không khớp.');
          return false;
        }
        if (newPassword.length < 6) {
          Swal.showValidationMessage('Mật khẩu mới phải từ 6 ký tự trở lên.');
          return false;
        }
        return { currentPassword, newPassword };
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        const { currentPassword, newPassword } = result.value;
        try {
          Swal.fire({
            title: 'Đang xử lý...',
            allowOutsideClick: false,
            didOpen: () => {
              Swal.showLoading();
            }
          });
          await db.changePassword(currentUser.id, currentPassword, newPassword);
          
          await db.logActivity(
            currentUser.id, 
            "UPDATE_PASSWORD", 
            "User", 
            currentUser.id, 
            `đã đổi mật khẩu cá nhân`
          );

          Swal.fire({
            icon: 'success',
            title: 'Thành công',
            text: 'Đổi mật khẩu thành công!',
            confirmButtonColor: 'var(--primary-color)'
          });
        } catch (err) {
          console.error(err);
          Swal.fire({
            icon: 'error',
            title: 'Thất bại',
            text: err.message || 'Không thể đổi mật khẩu.',
            confirmButtonColor: 'var(--primary-color)'
          });
        }
      }
    });
  };

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
                <div style={{ marginTop: '2px' }}>Phòng ban: {currentUser.department_name || 'Chưa phân phòng'}</div>
                <div style={{ marginTop: '2px' }}>Quyền: <span className="badge badge-info" style={{ fontSize: '10px' }}>{currentUser.system_role}</span></div>
              </div>
              <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button 
                  onClick={handleShowProfile} 
                  className="btn btn-secondary btn-sm" 
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <i className="fa-solid fa-user"></i> Chi tiết tài khoản
                </button>
                <button 
                  onClick={handleShowChangePassword} 
                  className="btn btn-secondary btn-sm" 
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <i className="fa-solid fa-key"></i> Đổi mật khẩu
                </button>
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
    </>
  );
}
