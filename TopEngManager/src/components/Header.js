"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { db } from '@/utils/db';
import { usePathname, useRouter } from 'next/navigation';
import { getSwal } from '@/utils/swal';


const translateDepartmentName = (name, t) => {
  if (!name || name === 'Chưa phân phòng') return t('dept.unassigned', 'Chưa phân phòng');
  if (name.includes('Hành chính Nhân sự') || name === 'HR') return t('dept.hr', 'Phòng Hành chính Nhân sự (HR)');
  if (name.includes('Phát triển Phần mềm') || name === 'R&D') return t('dept.rd', 'Phòng Phát triển Phần mềm (R&D)');
  if (name.includes('Kinh doanh') || name === 'Sales') return t('dept.sales', 'Phòng Kinh doanh (Sales)');
  if (name.includes('Kế toán Tài chính') || name.includes('Finance')) return t('dept.finance', 'Phòng Kế toán Tài chính');
  if (name.includes('Truyền thông Marketing') || name.includes('Marketing')) return t('dept.marketing', 'Phòng Truyền thông Marketing');
  if (name.includes('BOD TOPV') || name === 'BOD') return t('dept.bod', 'BOD TOPV');
  if (name === 'Nhân sự 1') return t('dept.hr1', 'Nhân sự 1');
  if (name === 'PC') return t('dept.pc', 'PC');
  if (name === 'PC1') return t('dept.pc1', 'PC1');
  if (name === 'PC2') return t('dept.pc2', 'PC2');
  return name;
};

const formatSystemRole = (role, t) => {
  if (!role) return t('role.staff', 'NHÂN VIÊN (STAFF)');
  if (role.includes('Admin') || role.includes('Quản trị viên')) return t('role.admin', 'QUẢN TRỊ VIÊN (ADMIN)');
  if (role.includes('HR') || role.includes('Nhân sự')) return t('role.hr', 'NHÂN SỰ (HR)');
  if (role.includes('Staff') || role.includes('Nhân viên')) return t('role.staff', 'NHÂN VIÊN (STAFF)');
  if (role.includes('Team Leader')) return t('role.teamLeader', 'TEAM LEADER');
  if (role.includes('Part Leader')) return t('role.partLeader', 'PART LEADER');
  if (role.includes('Sales') || role.includes('Kinh doanh')) return t('role.sales', 'KINH DOANH (SALES)');
  if (role.includes('BOD') || role.includes('Ban điều hành')) return t('role.bod', 'BAN ĐIỀU HÀNH (BOD)');
  return role.toUpperCase();
};


const translateNotifTitle = (title, t) => {
  if (!title) return '';
  const uTitle = String(title).trim();
  
  if (uTitle.includes("Bạn được phân công một Issue mới") || uTitle.includes("You have been assigned a new Issue")) {
    return t('notif.title.assignedNewIssue', "Bạn được phân công một Issue mới");
  }
  if (uTitle.includes("Bạn được phân công một Issue") || uTitle.includes("You have been assigned an Issue")) {
    return t('notif.title.assignedIssue', "Bạn được phân công một Issue");
  }
  if (uTitle.includes("Được nhắc tên trong Issue (Người chịu trách nhiệm)") || uTitle.includes("Mentioned in Issue (Assignee)")) {
    return t('notif.title.mentionedInIssueAssignee', "Được nhắc tên trong Issue (Người chịu trách nhiệm)");
  }
  if (uTitle.includes("Được nhắc tên trong chi tiết công việc Issue") || uTitle.includes("Mentioned in sub-task of Issue")) {
    return t('notif.title.mentionedInSubtask', "Được nhắc tên trong chi tiết công việc Issue");
  }
  if (uTitle.includes("Được nhắc tên trong Chat") || uTitle.includes("Mentioned in Chat")) {
    return t('notif.title.mentionedInChat', "Được nhắc tên trong Chat");
  }
  if (uTitle.includes("Công việc mới được giao") || uTitle.includes("New job assigned")) {
    return t('notif.title.newJobAssigned', "Công việc mới được giao");
  }
  if (uTitle.includes("Bình luận mới trong công việc") || uTitle.includes("New comment on task")) {
    return t('notif.title.newCommentOnTask', "Bình luận mới trong công việc");
  }
  if (uTitle.includes("Bạn được thêm vào dự án mới") || uTitle.includes("Added to new project")) {
    return t('notif.title.addedToNewProject', "Bạn được thêm vào dự án mới");
  }
  if (uTitle.includes("Bạn là thành viên liên quan của một Issue") || uTitle.includes("You are a related member of an Issue")) {
    return t('notif.title.relatedMember', "Bạn là thành viên liên quan của một Issue");
  }
  if (uTitle.includes("Lời mời tham gia dự án") || uTitle.includes("Project invitation")) {
    return t('notif.title.projectJoinInvitation', "Lời mời tham gia dự án");
  }
  if (uTitle.includes("Báo cáo ngày bị từ chối") || uTitle.includes("Daily report rejected")) {
    return t('notif.title.dailyReportRejected', "Báo cáo ngày bị từ chối");
  }
  return title;
};

const translateNotifContent = (title, content, t) => {
  if (!content) return '';
  
  let match;

  // 1. Assigned New Issue
  match = content.match(/^Bạn vừa được phân công giải quyết Issue: "(.*)" ((.*))$/) ||
          content.match(/^You have been assigned to resolve Issue: "(.*)" ((.*))$/);
  if (match) {
    return t('notif.content.assignedNewIssueTemplate', 'Bạn vừa được phân công giải quyết Issue: "{summary}" ({key})')
      .replace('{summary}', match[1]).replace('{key}', match[2]);
  }

  // 2. Assigned Responsibility
  match = content.match(/^(.*) đã giao trách nhiệm cho bạn trong Issue "(.*)" ((.*))$/) ||
          content.match(/^(.*) assigned responsibility to you in Issue "(.*)" ((.*))$/);
  if (match) {
    return t('notif.content.assignedResponsibilityTemplate', '{name} đã giao trách nhiệm cho bạn trong Issue "{summary}" ({key})')
      .replace('{name}', match[1]).replace('{summary}', match[2]).replace('{key}', match[3]);
  }

  // 3. Mentioned in Issue
  match = content.match(/^(.*) đã nhắc tên bạn trong Issue "(.*)" ((.*))$/) ||
          content.match(/^(.*) mentioned you in Issue "(.*)" ((.*))$/);
  if (match) {
    return t('notif.content.mentionedInIssueTemplate', '{name} đã nhắc tên bạn trong Issue "{summary}" ({key})')
      .replace('{name}', match[1]).replace('{summary}', match[2]).replace('{key}', match[3]);
  }

  // 4. Mentioned/Assigned in sub-task
  match = content.match(/^(.*) đã nhắc tên bạn trong chi tiết công việc "(.*)" ((.*))$/) ||
          content.match(/^(.*) đã giao một công việc cho bạn trong chi tiết của Issue "(.*)" ((.*))$/) ||
          content.match(/^(.*) mentioned you in sub-task of Issue "(.*)" ((.*))$/) ||
          content.match(/^(.*) assigned a task to you in sub-task of Issue "(.*)" ((.*))$/);
  if (match) {
    return t('notif.content.mentionedInSubtaskTemplate', '{name} đã nhắc tên bạn trong chi tiết công việc "{summary}" ({key})')
      .replace('{name}', match[1]).replace('{summary}', match[2]).replace('{key}', match[3]);
  }

  // 5. Mentioned in Chat
  match = content.match(/^(.*) đã nhắc tên bạn trong kênh trò chuyện.$/) ||
          content.match(/^(.*) mentioned you in chat.$/);
  if (match) {
    return t('notif.content.mentionedInChatTemplate', '{name} đã nhắc tên bạn trong kênh trò chuyện.')
      .replace('{name}', match[1]);
  }

  // 6. Assigned Task
  match = content.match(/^Bạn được giao công việc '(.*)'$/) ||
          content.match(/^You were assigned the task '(.*)'$/);
  if (match) {
    return t('notif.content.assignedTaskTemplate', "Bạn được giao công việc '{title}'")
      .replace('{title}', match[1]);
  }

  // 7. Comment on Task
  match = content.match(/^(.*) đã bình luận trong công việc '(.*)'$/) ||
          content.match(/^(.*) commented on task '(.*)'$/);
  if (match) {
    return t('notif.content.commentOnTaskTemplate', "{name} đã bình luận trong công việc '{title}'")
      .replace('{name}', match[1]).replace('{title}', match[2]);
  }

  // 8. Added to project
  match = content.match(/^Bạn vừa được thêm vào dự án "(.*)" với vai trò (.*).$/) ||
          content.match(/^You have been added to project "(.*)" with role (.*).$/);
  if (match) {
    return t('notif.content.addedToProjectTemplate', 'Bạn vừa được thêm vào dự án "{name}" với vai trò {role}.')
      .replace('{name}', match[1]).replace('{role}', match[2]);
  }

  // 9. Project Invitation
  match = content.match(/^Bạn vừa được mời tham gia dự án "(.*)" với vai trò (.*). Hãy mở chi tiết để xác nhận.$/) ||
          content.match(/^You have been invited to join project "(.*)" with role (.*). Please open details to confirm.$/);
  if (match) {
    return t('notif.content.projectInvitationTemplate', 'Bạn vừa được mời tham gia dự án "{name}" với vai trò {role}. Hãy mở chi tiết để xác nhận.')
      .replace('{name}', match[1]).replace('{role}', match[2]);
  }

  // 10. Related Member of Issue
  match = content.match(/^(.*) đã thêm bạn làm thành viên liên quan trong Issue "(.*)" ((.*))$/) ||
          content.match(/^(.*) added you as a related member in Issue "(.*)" ((.*))$/);
  if (match) {
    return t('notif.content.relatedMemberTemplate', '{name} đã thêm bạn làm thành viên liên quan trong Issue "{summary}" ({key})')
      .replace('{name}', match[1]).replace('{summary}', match[2]).replace('{key}', match[3]);
  }

  // 11. Daily report rejected
  match = content.match(/^Báo cáo ngày (.*) của bạn đã bị từ chối\. Nhận xét: (.*)$/) ||
          content.match(/^Your daily report for (.*) was rejected\. Comment: (.*)$/);
  if (match) {
    return t('notif.content.dailyReportRejectedTemplate', 'Báo cáo ngày {date} của bạn đã bị từ chối. Nhận xét: {comment}')
      .replace('{date}', match[1]).replace('{comment}', match[2]);
  }

  return content;
};

export default function Header() {
  const { currentUser, logout, users, notifications, reloadAll } = useApp();
  const { currentLang, changeLanguage, languages, currentLanguageObj, t } = useLanguage();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        setIsDarkMode(true);
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        setIsDarkMode(false);
        document.documentElement.removeAttribute('data-theme');
      }
    } catch (e) {}
  }, []);

  const toggleDarkMode = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    try {
      if (nextDark) {
        localStorage.setItem('theme', 'dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        localStorage.setItem('theme', 'light');
        document.documentElement.removeAttribute('data-theme');
      }
    } catch (e) {}
  };
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
  let pageTitle = t('sidebar.dashboard', 'Bảng điều khiển');
  if (pathname.startsWith('/projects')) {
    pageTitle = pathname.includes('/projects/') ? t('projects.projectDetailTitle', 'Chi tiết dự án') : t('sidebar.projects', 'Quản lý Dự án');
  } else if (pathname === '/tasks') {
    pageTitle = t('sidebar.tasks', 'Quản lý Công việc');
  } else if (pathname === '/chat') {
    pageTitle = t('sidebar.chat', 'Hộp thoại Trò chuyện');
  } else if (pathname === '/documents') {
    pageTitle = t('sidebar.documents', 'Quản lý Tài liệu');
  } else if (pathname === '/activity-logs') {
    pageTitle = t('sidebar.activityLogs', 'Lịch sử Hoạt động');
  } else if (pathname === '/hr') {
    pageTitle = t('sidebar.teamManagement', 'Quản lý nhân sự');
  } else if (pathname === '/daily-reports') {
    pageTitle = t('sidebar.dailyReports', 'Báo cáo hàng ngày');
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
            <div style="margin-bottom: 12px;">
              <div onclick="const target = document.getElementById('team-root-children'); const isHidden = target.style.display === 'none'; target.style.display = isHidden ? 'block' : 'none'; this.querySelector('.chevron-icon').className = isHidden ? 'fa-solid fa-chevron-down chevron-icon' : 'fa-solid fa-chevron-right chevron-icon'; this.querySelector('.folder-icon').className = isHidden ? 'fa-solid fa-folder-open folder-icon' : 'fa-solid fa-folder folder-icon';" style="cursor: pointer; font-weight: 600; color: var(--foreground-color); display: flex; align-items: center; gap: 6px; user-select: none;">
                <i class="fa-solid fa-chevron-down chevron-icon" style="font-size: 10px; color: var(--neutral-muted); transition: transform 0.2s; width: 12px;"></i>
                <i class="fa-solid fa-folder-open folder-icon" style="color: #1e40af; width: 16px;"></i>
                <span>${teamDept.name} (Root)</span>
              </div>
              <div id="team-root-children" style="margin-left: 32px; margin-top: 6px; display: block;">
      `;
      if (teamDeptUsers.length === 0) {
        treeHtml += `  <div style="color: var(--neutral-muted); font-style: italic; font-size: 12px;">Chưa có thành viên</div>`;
      } else {
        teamDeptUsers.forEach(u => {
          treeHtml += `
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <i class="fa-solid fa-user" style="font-size: 11px; color: var(--neutral-muted); width: 12px; text-align: center;"></i>
              <span>${u.name}</span>
              <span class="badge ${u.system_role.includes('Leader') ? 'badge-danger' : 'badge-info'}" style="font-size: 10px; padding: 1px 4px;">${formatSystemRole(u.system_role, t)}</span>
            </div>`;
        });
      }
      treeHtml += `
              </div>
            </div>
      `;

      // Add child parts and their members
      childDepts.forEach((child, index) => {
        const childUsers = usersList.filter(u => u.department_id === child.department_id);
        treeHtml += `
            <div style="margin-bottom: 12px; margin-top: 12px;">
              <div onclick="const target = document.getElementById('team-child-${index}'); const isHidden = target.style.display === 'none'; target.style.display = isHidden ? 'block' : 'none'; this.querySelector('.chevron-icon').className = isHidden ? 'fa-solid fa-chevron-down chevron-icon' : 'fa-solid fa-chevron-right chevron-icon'; this.querySelector('.folder-icon').className = isHidden ? 'fa-solid fa-folder-open folder-icon' : 'fa-solid fa-folder folder-icon';" style="cursor: pointer; font-weight: 600; color: var(--foreground-color); display: flex; align-items: center; gap: 6px; user-select: none;">
                <i class="fa-solid fa-chevron-down chevron-icon" style="font-size: 10px; color: var(--neutral-muted); transition: transform 0.2s; width: 12px;"></i>
                <i class="fa-solid fa-folder-open folder-icon" style="color: #eab308; width: 16px;"></i>
                <span>${child.name} (${child.department_id})</span>
              </div>
              <div id="team-child-${index}" style="margin-left: 32px; margin-top: 6px; display: block;">
        `;
        if (childUsers.length === 0) {
          treeHtml += `  <div style="color: var(--neutral-muted); font-style: italic; font-size: 12px;">Chưa có thành viên</div>`;
        } else {
          childUsers.forEach(u => {
            treeHtml += `
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <i class="fa-solid fa-user" style="font-size: 11px; color: var(--neutral-muted); width: 12px; text-align: center;"></i>
                <span>${u.name}</span>
                <span class="badge ${u.system_role.includes('Leader') ? 'badge-warning' : 'badge-info'}" style="font-size: 10px; padding: 1px 4px;">${formatSystemRole(u.system_role, t)}</span>
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
        confirmButtonText: t('header.close', 'Đóng'),
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
      title: t('header.profileTitle', 'Hồ sơ cá nhân'),
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
            <strong style="color: var(--neutral-muted);">` + t('header.employeeIdLabel', 'Mã nhân viên:') + `</strong>
            <span>${currentUser.id}</span>
            ${teamName ? `
              <strong style="color: var(--neutral-muted);">Team:</strong>
              <span id="view-team-link" style="color: #1e40af; text-decoration: underline; cursor: pointer; font-weight: 600;">${teamName}</span>
            ` : ''}
            <strong style="color: var(--neutral-muted);">Phòng ban:</strong>
            <span>${translateDepartmentName(currentUser.department_name, t)}</span>
            <strong style="color: var(--neutral-muted);">Quyền hạn:</strong>
            <span>${formatSystemRole(currentUser.system_role, t)}</span>
          </div>
        </div>
      `,
      showDenyButton: true,
      denyButtonText: t('header.changePassword', 'Đổi mật khẩu'),
      denyButtonColor: '#64748b',
      confirmButtonText: t('common.close', 'Đóng'),
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
      title: t('header.changePasswordTitle', 'Đổi mật khẩu'),
      html: `
        <div style="text-align: left; padding: 10px;">
          <div class="form-group" style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px;">${t('header.currentPasswordLabel', 'Mật khẩu hiện tại')} <span style="color: red;">*</span></label>
            <input type="password" id="current-password" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box; font-size: 14px;" placeholder="${t('header.currentPasswordPlaceholder', 'Nhập mật khẩu hiện tại...')}">
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px;">${t('header.newPasswordLabel', 'Mật khẩu mới')} <span style="color: red;">*</span></label>
            <input type="password" id="new-password" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box; font-size: 14px;" placeholder="${t('header.newPasswordPlaceholder', 'Nhập mật khẩu mới...')}">
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px;">${t('header.confirmPasswordLabel', 'Xác nhận mật khẩu mới')} <span style="color: red;">*</span></label>
            <input type="password" id="confirm-password" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box; font-size: 14px;" placeholder="${t('header.confirmPasswordPlaceholder', 'Xác nhận mật khẩu mới...')}">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: t('header.changePasswordTitle', 'Đổi mật khẩu'),
      cancelButtonText: t('header.cancel', 'Hủy'),
      confirmButtonColor: 'var(--primary-color)',
      focusConfirm: false,
      preConfirm: () => {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        if (!currentPassword || !newPassword || !confirmPassword) {
          Swal.showValidationMessage(t('team.requiredFieldsWarning', 'Vui lòng điền đầy đủ thông tin bắt buộc.'));
          return false;
        }
        if (newPassword !== confirmPassword) {
          Swal.showValidationMessage(t('header.passwordsDoNotMatch', 'Mật khẩu mới và xác nhận mật khẩu không khớp.'));
          return false;
        }
        if (newPassword.length < 6) {
          Swal.showValidationMessage(t('team.passwordTooShort', 'Mật khẩu mới phải từ 6 ký tự trở lên.'));
          return false;
        }
        return { currentPassword, newPassword };
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        const { currentPassword, newPassword } = result.value;
        try {
          Swal.fire({
            title: t('common.processing', 'Đang xử lý...'),
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
            title: t('common.success', 'Thành công'),
            text: t('header.changePasswordSuccess', 'Đổi mật khẩu thành công!'),
            confirmButtonColor: 'var(--primary-color)'
          });
        } catch (err) {
          console.error(err);
          Swal.fire({
            icon: 'error',
            title: t('common.failed', 'Thất bại'),
            text: err.message || t('header.changePasswordFailed', 'Không thể đổi mật khẩu.'),
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
          {/* Flag / Language Combobox Dropdown */}
          <div className="header-action-item language-dropdown-wrapper" style={{ position: 'relative', marginRight: '8px' }}>
            <button 
              className="icon-btn" 
              onClick={() => setIsLangOpen(!isLangOpen)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '50%', 
                border: '1px solid var(--neutral-border)', 
                backgroundColor: '#fff', 
                cursor: 'pointer', 
                fontSize: '11px', 
                fontWeight: '700',
                color: '#1e293b',
                padding: 0 
              }}
              title={currentLanguageObj.name}
            >
              <span>{currentLanguageObj.code.toUpperCase()}</span>
            </button>
            <div 
              className={`dropdown-menu ${isLangOpen ? 'show' : ''}`} 
              style={{ 
                position: 'absolute',
                top: '100%',
                right: 0, 
                minWidth: '160px',
                padding: '6px',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15)',
                backgroundColor: '#ffffff',
                zIndex: 1000,
                display: isLangOpen ? 'block' : 'none'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', padding: '6px 10px', textTransform: 'uppercase' }}>
                {t('header.language', 'Ngôn ngữ')}
              </div>
              {languages.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => {
                    changeLanguage(lang.code);
                    setIsLangOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: currentLang === lang.code ? '#eff6ff' : 'transparent',
                    color: currentLang === lang.code ? 'var(--primary-color)' : '#334155',
                    fontWeight: currentLang === lang.code ? '700' : '500',
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{lang.flag}</span>
                  <span>{lang.name}</span>
                  {currentLang === lang.code && <i className="fa-solid fa-check" style={{ marginLeft: 'auto', fontSize: '11px' }}></i>}
                </button>
              ))}
            </div>
          </div>

          <div className="header-action-item notification-dropdown-wrapper">
            <button className="icon-btn" onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}>
              <i className="fa-regular fa-bell"></i>
              {unreadNotifsCount > 0 && <span className="badge badge-danger">{unreadNotifsCount}</span>}
            </button>
            <div className={`dropdown-menu notification-menu ${isNotificationsOpen ? 'show' : ''}`} style={{ right: 0 }}>
              <div className="dropdown-header">
                <h3>{t('notif.newNotificationsTitle', 'Thông báo mới')}</h3>
                <button className="btn-text" onClick={handleMarkAllRead}>{t('notif.markAllAsRead', 'Đánh dấu tất cả đã đọc')}</button>
              </div>
              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--neutral-muted)' }}>{t('notif.noNewNotifications', 'Không có thông báo mới')}</div>
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
                        <div className="notification-title">{translateNotifTitle(n.title, t)}</div>
                        <div className="notification-body">{translateNotifContent(n.title, n.content, t)}</div>
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
              {/* <div className="dropdown-header" style={{ paddingBottom: '4px' }}>Hồ sơ cá nhân</div>
              <div style={{ padding: '8px 16px', fontSize: '12px', color: 'var(--neutral-muted)', borderBottom: '1px solid var(--neutral-border)' }}>
                <div>Email: {currentUser.email}</div>
                <div style={{ marginTop: '2px' }}>Phòng ban: {translateDepartmentName(currentUser.department_name, t)}</div>
                <div style={{ marginTop: '2px' }}>Quyền: <span className="badge badge-info" style={{ fontSize: '10px' }}>{formatSystemRole(currentUser.system_role, t)}</span></div>
              </div> */}
              <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button 
                  onClick={handleShowProfile} 
                  className="btn btn-secondary btn-sm" 
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <i className="fa-solid fa-user"></i> {t('header.accountDetails', 'Chi tiết tài khoản')}
                </button>
                <button 
                  onClick={handleShowChangePassword} 
                  className="btn btn-secondary btn-sm" 
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <i className="fa-solid fa-key"></i> {t('header.changePassword', 'Đổi mật khẩu')}
                </button>
                <button 
                  onClick={toggleDarkMode} 
                  className="btn btn-secondary btn-sm" 
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {isDarkMode ? (
                    <>
                      <i className="fa-solid fa-sun" style={{ color: '#fbbf24' }}></i> {t('header.lightMode', 'Chế độ sáng')}
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-moon"></i> {t('header.darkMode', 'Chế độ tối')}
                    </>
                  )}
                </button>
                <button 
                  onClick={handleLogout} 
                  className="btn btn-danger btn-sm" 
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <i className="fa-solid fa-arrow-right-from-bracket"></i> {t('header.logout', 'Đăng xuất')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
