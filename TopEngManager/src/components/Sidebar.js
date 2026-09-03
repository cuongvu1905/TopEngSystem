"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { db } from '@/utils/db';
import { getSwal } from '@/utils/swal';

const REJECTED_REPORT_TITLE = 'Báo cáo ngày bị từ chối';

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
  const r = String(role);
  if (r.includes('Admin') || r.includes('Quản trị viên')) return t('role.admin', 'QUẢN TRỊ VIÊN (ADMIN)');
  if (r.includes('HR') || r.includes('Nhân sự')) return t('role.hr', 'NHÂN SỰ (HR)');
  if (r.includes('Staff') || r.includes('Nhân viên')) return t('role.staff', 'NHÂN VIÊN (STAFF)');
  if (r.includes('Team Leader')) return t('role.teamLeader', 'TEAM LEADER');
  if (r.includes('Part Leader')) return t('role.partLeader', 'PART LEADER');
  if (r.includes('Sales') || r.includes('Kinh doanh')) return t('role.sales', 'KINH DOANH (SALES)');
  if (r.includes('BOD') || r.includes('Ban điều hành')) return t('role.bod', 'BAN ĐIỀU HÀNH (BOD)');
  return r.toUpperCase();
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

  match = content.match(/^Bạn vừa được phân công giải quyết Issue: "(.*)" \((.*)\)$/) ||
          content.match(/^You have been assigned to resolve Issue: "(.*)" \((.*)\)$/);
  if (match) {
    return t('notif.content.assignedNewIssueTemplate', 'Bạn vừa được phân công giải quyết Issue: "{summary}" ({key})')
      .replace('{summary}', match[1]).replace('{key}', match[2]);
  }

  match = content.match(/^(.*) đã giao trách nhiệm cho bạn trong Issue "(.*)" \((.*)\)$/) ||
          content.match(/^(.*) assigned responsibility to you in Issue "(.*)" \((.*)\)$/);
  if (match) {
    return t('notif.content.assignedResponsibilityTemplate', '{name} đã giao trách nhiệm cho bạn trong Issue "{summary}" ({key})')
      .replace('{name}', match[1]).replace('{summary}', match[2]).replace('{key}', match[3]);
  }

  match = content.match(/^(.*) đã nhắc tên bạn trong Issue "(.*)" \((.*)\)$/) ||
          content.match(/^(.*) mentioned you in Issue "(.*)" \((.*)\)$/);
  if (match) {
    return t('notif.content.mentionedInIssueTemplate', '{name} đã nhắc tên bạn trong Issue "{summary}" ({key})')
      .replace('{name}', match[1]).replace('{summary}', match[2]).replace('{key}', match[3]);
  }

  match = content.match(/^(.*) đã nhắc tên bạn trong chi tiết công việc "(.*)" \((.*)\)$/) ||
          content.match(/^(.*) đã giao một công việc cho bạn trong chi tiết của Issue "(.*)" \((.*)\)$/) ||
          content.match(/^(.*) mentioned you in sub-task of Issue "(.*)" \((.*)\)$/) ||
          content.match(/^(.*) assigned a task to you in sub-task of Issue "(.*)" \((.*)\)$/);
  if (match) {
    return t('notif.content.mentionedInSubtaskTemplate', '{name} đã nhắc tên bạn trong chi tiết công việc "{summary}" ({key})')
      .replace('{name}', match[1]).replace('{summary}', match[2]).replace('{key}', match[3]);
  }

  match = content.match(/^(.*) đã nhắc tên bạn trong kênh trò chuyện\.$/) ||
          content.match(/^(.*) mentioned you in chat\.$/);
  if (match) {
    return t('notif.content.mentionedInChatTemplate', '{name} đã nhắc tên bạn trong kênh trò chuyện.')
      .replace('{name}', match[1]);
  }

  match = content.match(/^Bạn được giao công việc '(.*)'$/) ||
          content.match(/^You were assigned the task '(.*)'$/);
  if (match) {
    return t('notif.content.assignedTaskTemplate', "Bạn được giao công việc '{title}'")
      .replace('{title}', match[1]);
  }

  match = content.match(/^(.*) đã bình luận trong công việc '(.*)'$/) ||
          content.match(/^(.*) commented on task '(.*)'$/);
  if (match) {
    return t('notif.content.commentOnTaskTemplate', "{name} đã bình luận trong công việc '{title}'")
      .replace('{name}', match[1]).replace('{title}', match[2]);
  }

  match = content.match(/^Bạn vừa được thêm vào dự án "(.*)" với vai trò (.*)\.$/) ||
          content.match(/^You have been added to project "(.*)" with role (.*)\.$/);
  if (match) {
    return t('notif.content.addedToProjectTemplate', 'Bạn vừa được thêm vào dự án "{name}" với vai trò {role}.')
      .replace('{name}', match[1]).replace('{role}', match[2]);
  }

  match = content.match(/^Bạn vừa được mời tham gia dự án "(.*)" với vai trò (.*)\. Hãy mở chi tiết để xác nhận\.$/) ||
          content.match(/^You have been invited to join project "(.*)" with role (.*)\. Please open details to confirm\.$/);
  if (match) {
    return t('notif.content.projectInvitationTemplate', 'Bạn vừa được mời tham gia dự án "{name}" với vai trò {role}. Hãy mở chi tiết để xác nhận.')
      .replace('{name}', match[1]).replace('{role}', match[2]);
  }

  match = content.match(/^(.*) đã thêm bạn làm thành viên liên quan trong Issue "(.*)" \((.*)\)$/) ||
          content.match(/^(.*) added you as a related member in Issue "(.*)" \((.*)\)$/);
  if (match) {
    return t('notif.content.relatedMemberTemplate', '{name} đã thêm bạn làm thành viên liên quan trong Issue "{summary}" ({key})')
      .replace('{name}', match[1]).replace('{summary}', match[2]).replace('{key}', match[3]);
  }

  match = content.match(/^Báo cáo ngày (.*) của bạn đã bị từ chối\. Nhận xét: (.*)$/) ||
          content.match(/^Your daily report for (.*) was rejected\. Comment: (.*)$/);
  if (match) {
    return t('notif.content.dailyReportRejectedTemplate', 'Báo cáo ngày {date} của bạn đã bị từ chối. Nhận xét: {comment}')
      .replace('{date}', match[1]).replace('{comment}', match[2]);
  }

  return content;
};

export default function Sidebar({ isOpen = false, onClose }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout, reloadAll, hasPermission, notifications } = useApp();
  const { currentLang, changeLanguage, languages, currentLanguageObj, t } = useLanguage();
  const { currentTheme, currentThemeObj, themeStyle, themeMode, themeStyles, colorModes, themes, changeTheme, changeStyleAndMode } = useTheme();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const footerRef = useRef(null);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (footerRef.current && !footerRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  if (!currentUser) return null;

  const handleNavigate = () => onClose && onClose();

  const handleMarkAllRead = async () => {
    await db.markAllNotificationsRead(currentUser.id);
    await reloadAll();
  };

  const unreadNotifsCount = notifications ? notifications.filter(n => !n.is_read).length : 0;

  const handleShowTeamTree = async () => {
    setIsUserMenuOpen(false);
    const Swal = await getSwal();
    Swal.fire({
      title: t('team.loadingDiagram', 'Đang tải sơ đồ nhóm...'),
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const depts = await db.getDepartments(currentUser?.id);
      const usersList = await db.getUsers(currentUser?.id);
      
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
          title: t('common.notice', 'Thông báo'),
          text: t('team.noTeamAssigned', 'Tài khoản của bạn chưa được phân nhóm hoặc team không tồn tại.'),
          confirmButtonColor: 'var(--primary-color)'
        });
        return;
      }

      const teamDeptUsers = usersList.filter(u => u.department_id === teamDept.department_id);
      const childDepts = depts.filter(d => d.parent_id === teamDept.department_id);

      let treeHtml = `
        <div style="text-align: left; padding: 10px; font-size: 13.5px; line-height: 1.6;">
          <div style="font-weight: 700; font-size: 15px; color: var(--primary-color); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-sitemap"></i> ${t('team.groupDiagram', 'Sơ đồ nhóm:')} ${translateDepartmentName(teamDept.name, t)} (${teamDept.department_id})
          </div>
          <div style="border-left: 2px dashed #cbd5e1; margin-left: 8px; padding-left: 12px;">
      `;

      // Add root members
      treeHtml += `
            <div style="margin-bottom: 12px;">
              <div onclick="const target = document.getElementById('team-root-children'); const isHidden = target.style.display === 'none'; target.style.display = isHidden ? 'block' : 'none'; this.querySelector('.chevron-icon').className = isHidden ? 'fa-solid fa-chevron-down chevron-icon' : 'fa-solid fa-chevron-right chevron-icon'; this.querySelector('.folder-icon').className = isHidden ? 'fa-solid fa-folder-open folder-icon' : 'fa-solid fa-folder folder-icon';" style="cursor: pointer; font-weight: 600; color: var(--foreground-color); display: flex; align-items: center; gap: 6px; user-select: none;">
                <i class="fa-solid fa-chevron-down chevron-icon" style="font-size: 10px; color: var(--neutral-muted); transition: transform 0.2s; width: 12px;"></i>
                <i class="fa-solid fa-folder-open folder-icon" style="color: var(--primary-color); width: 16px;"></i>
                <span>${translateDepartmentName(teamDept.name, t)} (Root)</span>
              </div>
              <div id="team-root-children" style="margin-left: 32px; margin-top: 6px; display: block;">
      `;
      if (teamDeptUsers.length === 0) {
        treeHtml += `  <div style="color: var(--neutral-muted); font-style: italic; font-size: 12px;">${t('team.noMembers', 'Chưa có thành viên')}</div>`;
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
                <span>${translateDepartmentName(child.name, t)} (${child.department_id})</span>
              </div>
              <div id="team-child-${index}" style="margin-left: 32px; margin-top: 6px; display: block;">
        `;
        if (childUsers.length === 0) {
          treeHtml += `  <div style="color: var(--neutral-muted); font-style: italic; font-size: 12px;">${t('team.noMembers', 'Chưa có thành viên')}</div>`;
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
        title: t('team.orgStructure', 'Cơ cấu Team'),
        html: treeHtml,
        confirmButtonText: t('common.close', 'Đóng'),
        confirmButtonColor: 'var(--primary-color)'
      });

    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: t('common.error', 'Lỗi'),
        text: t('team.loadDiagramFailed', 'Không thể tải cơ cấu nhóm.'),
        confirmButtonColor: 'var(--primary-color)'
      });
    }
  };

  const handleShowProfile = async () => {
    setIsUserMenuOpen(false);
    const Swal = await getSwal();
    
    let teamName = '';
    try {
      const depts = await db.getDepartments(currentUser?.id);
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
            <strong style="color: var(--neutral-muted);">${t('header.employeeIdLabel', 'Mã nhân viên:')}</strong>
            <span>${currentUser.id}</span>
            ${teamName ? `
              <strong style="color: var(--neutral-muted);">Team:</strong>
              <span id="view-team-link" style="color: #1e40af; text-decoration: underline; cursor: pointer; font-weight: 600;">${teamName}</span>
            ` : ''}
            <strong style="color: var(--neutral-muted);">Phòng ban:</strong>
            <span>${translateDepartmentName(currentUser.department_name, t)}</span>
            <strong style="color: var(--neutral-muted);">Quyền hạn:</strong>
            <span>${formatSystemRole(currentUser.system_role, t)}</span>
            <strong style="color: var(--neutral-muted);">${t('header.phoneLabel', 'Số điện thoại:')}</strong>
            <span id="profile-phone-display" style="display: flex; align-items: center; gap: 8px;">
              <span id="profile-phone-value">${currentUser.phone || t('header.phoneNotSet', 'Chưa cập nhật')}</span>
              <button type="button" id="profile-phone-edit-btn" title="${t('common.edit', 'Sửa')}" style="background: none; border: none; cursor: pointer; color: var(--primary-color); font-size: 12px; padding: 2px;">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button type="button" id="profile-phone-delete-btn" title="${t('common.delete', 'Xóa')}" style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 12px; padding: 2px; display: ${currentUser.phone ? 'inline-block' : 'none'};">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </span>
            <span id="profile-phone-edit-row" style="display: none; grid-column: 1 / -1; align-items: center; gap: 8px; margin-top: 4px;">
              <input type="tel" id="profile-phone-input" value="${currentUser.phone || ''}" placeholder="${t('header.phonePlaceholder', 'Nhập số điện thoại...')}" style="flex: 1; min-width: 0; padding: 6px 10px; border-radius: 4px; border: 1px solid var(--neutral-border); background-color: var(--neutral-bg-card); color: var(--neutral-dark); font-size: 13px; outline: none; box-sizing: border-box;" />
              <button type="button" id="profile-phone-save-btn" style="flex-shrink: 0; white-space: nowrap; padding: 6px 14px; border-radius: 4px; border: none; background-color: var(--primary-color); color: #fff; font-size: 12px; font-weight: 600; cursor: pointer;">${t('common.save', 'Lưu')}</button>
              <button type="button" id="profile-phone-cancel-btn" style="flex-shrink: 0; white-space: nowrap; padding: 6px 14px; border-radius: 4px; border: 1px solid var(--neutral-border); background: none; color: var(--neutral-dark); font-size: 12px; cursor: pointer;">${t('common.cancel', 'Hủy')}</button>
            </span>
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

        const displayRow = document.getElementById('profile-phone-display');
        const editRow = document.getElementById('profile-phone-edit-row');
        const valueSpan = document.getElementById('profile-phone-value');
        const deleteBtn = document.getElementById('profile-phone-delete-btn');
        const input = document.getElementById('profile-phone-input');

        const showEditRow = () => {
          displayRow.style.display = 'none';
          editRow.style.display = 'flex';
          input.focus();
        };
        const showDisplayRow = () => {
          displayRow.style.display = 'flex';
          editRow.style.display = 'none';
        };
        const savePhone = async (newPhone) => {
          try {
            await db.updateUserPhone(currentUser.id, newPhone);
            valueSpan.textContent = newPhone || t('header.phoneNotSet', 'Chưa cập nhật');
            deleteBtn.style.display = newPhone ? 'inline-block' : 'none';
            showDisplayRow();
            reloadAll();
          } catch (err) {
            const SwalErr = await getSwal();
            SwalErr.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
          }
        };

        document.getElementById('profile-phone-edit-btn').onclick = showEditRow;
        document.getElementById('profile-phone-cancel-btn').onclick = () => { input.value = valueSpan.textContent === t('header.phoneNotSet', 'Chưa cập nhật') ? '' : valueSpan.textContent; showDisplayRow(); };
        document.getElementById('profile-phone-save-btn').onclick = () => savePhone(input.value.trim());
        deleteBtn.onclick = () => savePhone('');
      }
    }).then((result) => {
      if (result.isDenied) {
        handleShowChangePassword();
      }
    });
  };

  const handleShowChangePassword = async () => {
    setIsUserMenuOpen(false);
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

  // Synchronous Settings Modal matching system SweetAlert style with Instant Multi-language Support
  const handleShowSettings = async () => {
    setIsUserMenuOpen(false);
    const Swal = await getSwal();

    let selectedStyle = themeStyle || (currentTheme.includes('cyber') || currentTheme === 'trollllm' ? 'cyber' : 'classic');
    let selectedMode = themeMode || (currentTheme === 'light' || currentTheme === 'cyber-light' ? 'light' : 'dark');
    let selectedLang = currentLang;

    let currentSections = { issues: true, tasks: true, projects: true, reports: true };
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboard_visible_sections');
      if (saved) {
        try {
          currentSections = { ...currentSections, ...JSON.parse(saved) };
        } catch (e) {}
      }
    }

    const getModalDict = (lCode) => {
      const i18n = {
        vi: {
          title: 'Cài đặt hệ thống',
          styleTitle: 'Chủ đề (Style)',
          classic: 'Classic',
          cyber: 'Cyber',
          modeTitle: 'Chế độ (Mode)',
          light: 'Sáng (Light)',
          dark: 'Tối (Dark)',
          langTitle: 'Ngôn ngữ',
          customizeTitle: 'Tùy chỉnh Dashboard',
          issues: 'Vướng mắc (Issues)',
          tasks: 'Việc cần làm (Tasks)',
          projects: 'Dự án tham gia',
          reports: 'Báo cáo hàng ngày',
          close: 'Đóng'
        },
        en: {
          title: 'System Settings',
          styleTitle: 'Theme Style',
          classic: 'Classic',
          cyber: 'Cyber',
          modeTitle: 'Color Mode',
          light: 'Light',
          dark: 'Dark',
          langTitle: 'Language',
          customizeTitle: 'Customize Dashboard',
          issues: 'Issues',
          tasks: 'Tasks',
          projects: 'Joined Projects',
          reports: 'Daily Reports',
          close: 'Close'
        },
        ko: {
          title: '시스템 설정',
          styleTitle: '테마 스타일 (Style)',
          classic: '클래식 (Classic)',
          cyber: '사이버 (Cyber)',
          modeTitle: '컬러 모드 (Mode)',
          light: '라이트 (Light)',
          dark: '다크 (Dark)',
          langTitle: '언어 (Language)',
          customizeTitle: '대시보드 맞춤설정',
          issues: '이슈 (Issues)',
          tasks: '할 일 (Tasks)',
          projects: '참여 프로젝트',
          reports: '일일 보고서',
          close: '닫기'
        },
        zh: {
          title: '系统设置',
          styleTitle: '主题风格 (Style)',
          classic: '经典 (Classic)',
          cyber: '赛博 (Cyber)',
          modeTitle: '颜色模式 (Mode)',
          light: '浅色 (Light)',
          dark: '深色 (Dark)',
          langTitle: '系统语言 (Language)',
          customizeTitle: '自定义仪表盘',
          issues: '问题 (Issues)',
          tasks: '任务 (Tasks)',
          projects: '参与项目',
          reports: '每日工作报告',
          close: '关闭'
        },
        ja: {
          title: 'システム設定',
          styleTitle: 'テーマスタイル (Style)',
          classic: 'クラシック (Classic)',
          cyber: 'サイバー (Cyber)',
          modeTitle: 'カラーモード (Mode)',
          light: 'ライト (Light)',
          dark: 'ダーク (Dark)',
          langTitle: 'システム言語 (Language)',
          customizeTitle: 'ダッシュボード設定',
          issues: '課題 (Issues)',
          tasks: 'タスク (Tasks)',
          projects: '参加プロジェクト',
          reports: '日報 (Daily Reports)',
          close: '閉じる'
        }
      };
      return i18n[lCode] || i18n.vi;
    };

    const renderContent = () => {
      const curI18n = getModalDict(selectedLang);
      return `
      <div style="text-align: left; padding: 6px 4px; display: flex; flex-direction: column; gap: 16px;">
        <!-- 1. Theme Style Section -->
        <div>
          <div style="font-weight: 700; font-size: 11.5px; color: var(--neutral-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-shapes" style="color: var(--primary-color);"></i> ${curI18n.styleTitle}
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            ${(themeStyles || []).map(st => {
              const isSel = selectedStyle === st.id;
              const styleName = st.id === 'cyber' ? curI18n.cyber : curI18n.classic;
              return `
                <button 
                  type="button" 
                  class="swal-style-btn" 
                  data-style-id="${st.id}"
                  style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 12px; border-radius: ${selectedStyle === 'cyber' ? '0px' : '8px'}; border: ${isSel ? '2px solid var(--primary-color)' : '1px solid var(--neutral-border)'}; background-color: ${isSel ? 'var(--primary-light)' : 'var(--neutral-bg-card)'}; color: ${isSel ? 'var(--primary-color)' : 'var(--neutral-dark)'}; cursor: pointer; transition: all 0.15s ease;"
                >
                  <i class="${st.icon}" style="font-size: 14px; color: ${isSel ? 'var(--primary-color)' : (st.id === 'cyber' ? '#10b981' : '#3b82f6')};"></i>
                  <span style="font-weight: ${isSel ? '700' : '600'}; font-size: 13px;">${styleName}</span>
                  ${isSel ? `<i class="fa-solid fa-check" style="color: var(--primary-color); font-size: 11px; margin-left: 4px;"></i>` : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 2. Color Mode Section -->
        <div>
          <div style="font-weight: 700; font-size: 11.5px; color: var(--neutral-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-circle-half-stroke" style="color: var(--primary-color);"></i> ${curI18n.modeTitle}
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            ${(colorModes || []).map(md => {
              const isSel = selectedMode === md.id;
              const modeName = md.id === 'light' ? curI18n.light : curI18n.dark;
              return `
                <button 
                  type="button" 
                  class="swal-mode-btn" 
                  data-mode-id="${md.id}"
                  style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 12px; border-radius: ${selectedStyle === 'cyber' ? '0px' : '8px'}; border: ${isSel ? '2px solid var(--primary-color)' : '1px solid var(--neutral-border)'}; background-color: ${isSel ? 'var(--primary-light)' : 'var(--neutral-bg-card)'}; color: ${isSel ? 'var(--primary-color)' : 'var(--neutral-dark)'}; cursor: pointer; transition: all 0.15s ease;"
                >
                  <i class="${md.icon}" style="font-size: 14px; color: ${isSel ? 'var(--primary-color)' : (md.id === 'light' ? '#f59e0b' : '#818cf8')};"></i>
                  <span style="font-weight: ${isSel ? '700' : '600'}; font-size: 13px;">${modeName}</span>
                  ${isSel ? `<i class="fa-solid fa-check" style="color: var(--primary-color); font-size: 11px; margin-left: 4px;"></i>` : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 3. Language Section -->
        <div>
          <div style="font-weight: 700; font-size: 12px; color: var(--neutral-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-globe" style="color: var(--primary-color);"></i> ${curI18n.langTitle}
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
            ${languages.map(lang => {
              const isSel = selectedLang === lang.code;
              return `
                <button 
                  type="button" 
                  class="swal-lang-btn" 
                  data-lang-code="${lang.code}"
                  style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: ${selectedStyle === 'cyber' ? '0px' : '8px'}; border: ${isSel ? '2px solid var(--primary-color)' : '1px solid var(--neutral-border)'}; background-color: ${isSel ? 'var(--primary-light)' : 'var(--neutral-bg-card)'}; color: ${isSel ? 'var(--primary-color)' : 'var(--neutral-dark)'}; cursor: pointer; text-align: left; transition: all 0.15s ease;"
                >
                  <span style="font-size: 16px;">${lang.flag}</span>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: ${isSel ? '700' : '600'}; font-size: 12px;">${lang.name}</div>
                    <div style="font-size: 10px; color: var(--neutral-muted);">${lang.code.toUpperCase()}</div>
                  </div>
                  ${isSel ? `<i class="fa-solid fa-circle-check" style="color: var(--primary-color); font-size: 13px;"></i>` : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 4. Dashboard Customization Section -->
        <div>
          <div style="font-weight: 700; font-size: 12px; color: var(--neutral-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-sliders" style="color: var(--primary-color);"></i> ${curI18n.customizeTitle}
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
            <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: ${selectedStyle === 'cyber' ? '0px' : '8px'}; border: 1px solid var(--neutral-border); background-color: var(--neutral-bg-card); cursor: pointer; font-size: 12.5px; font-weight: 500;">
              <input type="checkbox" class="swal-section-chk" data-sec-key="issues" ${currentSections.issues ? 'checked' : ''} style="cursor: pointer;" />
              <span>${curI18n.issues}</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: ${selectedStyle === 'cyber' ? '0px' : '8px'}; border: 1px solid var(--neutral-border); background-color: var(--neutral-bg-card); cursor: pointer; font-size: 12.5px; font-weight: 500;">
              <input type="checkbox" class="swal-section-chk" data-sec-key="tasks" ${currentSections.tasks ? 'checked' : ''} style="cursor: pointer;" />
              <span>${curI18n.tasks}</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: ${selectedStyle === 'cyber' ? '0px' : '8px'}; border: 1px solid var(--neutral-border); background-color: var(--neutral-bg-card); cursor: pointer; font-size: 12.5px; font-weight: 500;">
              <input type="checkbox" class="swal-section-chk" data-sec-key="projects" ${currentSections.projects ? 'checked' : ''} style="cursor: pointer;" />
              <span>${curI18n.projects}</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: ${selectedStyle === 'cyber' ? '0px' : '8px'}; border: 1px solid var(--neutral-border); background-color: var(--neutral-bg-card); cursor: pointer; font-size: 12.5px; font-weight: 500;">
              <input type="checkbox" class="swal-section-chk" data-sec-key="reports" ${currentSections.reports ? 'checked' : ''} style="cursor: pointer;" />
              <span>${curI18n.reports}</span>
            </label>
          </div>
        </div>
      </div>
    `;
    };

    const initialI18n = getModalDict(selectedLang);

    Swal.fire({
      title: initialI18n.title,
      html: `<div id="swal-settings-container">${renderContent()}</div>`,
      showConfirmButton: true,
      confirmButtonText: initialI18n.close,
      confirmButtonColor: 'var(--primary-color)',
      didOpen: () => {
        const attachHandlers = () => {
          const styleBtns = document.querySelectorAll('.swal-style-btn');
          styleBtns.forEach(btn => {
            btn.onclick = () => {
              const stId = btn.getAttribute('data-style-id');
              selectedStyle = stId;
              changeStyleAndMode(selectedStyle, selectedMode);
              const container = document.getElementById('swal-settings-container');
              if (container) {
                container.innerHTML = renderContent();
                attachHandlers();
              }
            };
          });

          const modeBtns = document.querySelectorAll('.swal-mode-btn');
          modeBtns.forEach(btn => {
            btn.onclick = () => {
              const mdId = btn.getAttribute('data-mode-id');
              selectedMode = mdId;
              changeStyleAndMode(selectedStyle, selectedMode);
              const container = document.getElementById('swal-settings-container');
              if (container) {
                container.innerHTML = renderContent();
                attachHandlers();
              }
            };
          });

          const langBtns = document.querySelectorAll('.swal-lang-btn');
          langBtns.forEach(btn => {
            btn.onclick = () => {
              const lCode = btn.getAttribute('data-lang-code');
              changeLanguage(lCode);
              selectedLang = lCode;

              const updatedI18n = getModalDict(selectedLang);

              // Update Swal modal title in real-time
              const titleEl = Swal.getTitle();
              if (titleEl) titleEl.textContent = updatedI18n.title;

              // Update Swal confirm button text in real-time
              const confirmBtn = Swal.getConfirmButton();
              if (confirmBtn) confirmBtn.textContent = updatedI18n.close;

              const container = document.getElementById('swal-settings-container');
              if (container) {
                container.innerHTML = renderContent();
                attachHandlers();
              }
            };
          });

          const chkBoxes = document.querySelectorAll('.swal-section-chk');
          chkBoxes.forEach(chk => {
            chk.onchange = () => {
              const secKey = chk.getAttribute('data-sec-key');
              currentSections[secKey] = chk.checked;
              if (typeof window !== 'undefined') {
                localStorage.setItem('dashboard_visible_sections', JSON.stringify(currentSections));
                window.dispatchEvent(new Event('dashboard_sections_changed'));
              }
            };
          });
        };

        attachHandlers();
      }
    });
  };

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    setIsNotificationsOpen(false);
    await logout();
    router.push("/");
  };

  return (
    <aside className={`sidebar ${isOpen ? 'show' : ''}`}>
      <Link href="/dashboard" onClick={handleNavigate} className="sidebar-brand" style={{ cursor: 'pointer', textDecoration: 'none' }}>
        <div className="brand-logo">
          <img src="/TOP_RED_178x134.png" alt="TOPVSystem" />
        </div>
        <div className="brand-name">
          <h2>TOPVSystem</h2>
          <span>Manager</span>
        </div>
      </Link>

      <nav className="sidebar-menu">
        <Link href="/dashboard" onClick={handleNavigate} className={`menu-item ${pathname === '/dashboard' || pathname === '/' ? 'active' : ''}`}>
          <i className="fa-solid fa-chart-line"></i>
          <span>{t('sidebar.dashboard', 'Dashboard')}</span>
        </Link>
        <Link href="/projects" onClick={handleNavigate} className={`menu-item ${pathname.startsWith('/projects') ? 'active' : ''}`}>
          <i className="fa-solid fa-folder-open"></i>
          <span>{t('sidebar.projects', 'Dự án')}</span>
        </Link>
        <Link href="/tasks" onClick={handleNavigate} className={`menu-item ${pathname === '/tasks' ? 'active' : ''}`}>
          <i className="fa-solid fa-list-check"></i>
          <span>{t('sidebar.tasks', 'Công việc')}</span>
        </Link>
        <Link href="/room-booking" onClick={handleNavigate} className={`menu-item ${pathname === '/room-booking' ? 'active' : ''}`}>
          <i className="fa-solid fa-door-open"></i>
          <span>{t('sidebar.roomBooking', 'Đặt phòng họp')}</span>
        </Link>
        <Link href="/chat" onClick={handleNavigate} className={`menu-item ${pathname === '/chat' ? 'active' : ''}`}>
          <i className="fa-solid fa-robot"></i>
          <span>{t('sidebar.chat', 'AI Chat')}</span>
        </Link>
        <Link href="/documents" onClick={handleNavigate} className={`menu-item ${pathname === '/documents' ? 'active' : ''}`}>
          <i className="fa-solid fa-file-lines"></i>
          <span>{t('sidebar.documents', 'Tài liệu')}</span>
        </Link>
        <Link href="/daily-reports" onClick={handleNavigate} className={`menu-item ${pathname === '/daily-reports' ? 'active' : ''}`}>
          <i className="fa-solid fa-file-invoice"></i>
          <span>{t('sidebar.dailyReports', 'Báo cáo ngày')}</span>
        </Link>
        {hasPermission('view_activity_logs') && (
          <Link href="/activity-logs" onClick={handleNavigate} className={`menu-item ${pathname === '/activity-logs' ? 'active' : ''}`}>
            <i className="fa-solid fa-clock-rotate-left"></i>
            <span>{t('sidebar.activityLogs', 'Lịch sử làm việc')}</span>
          </Link>
        )}
        {hasPermission('view_hr') && (
          <Link href="/hr" onClick={handleNavigate} className={`menu-item ${pathname === '/hr' ? 'active' : ''}`}>
            <i className="fa-solid fa-user-gear"></i>
            <span>{t('sidebar.teamManagement', (currentUser.system_role === 'Team Leader' || currentUser.system_role === 'Part Leader') ? 'Quản lý Team' : 'Quản lý nhân sự')}</span>
          </Link>
        )}
      </nav>
      
      {/* Bottom Left Profile & Notification Widget */}
      <div className="sidebar-footer" ref={footerRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div 
          className="current-user-widget" 
          onClick={() => {
            setIsNotificationsOpen(false);
            setIsUserMenuOpen(!isUserMenuOpen);
          }}
          title={t('header.accountDetails', 'Cá nhân & Cài đặt')}
          style={{
            cursor: 'pointer',
            padding: '6px 8px',
            borderRadius: '8px',
            transition: 'all 0.15s ease',
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <div className="avatar" style={{ backgroundColor: currentUser.color || '#1E40AF', flexShrink: 0 }}>
              {currentUser.name.split(" ").pop().charAt(0)}
            </div>
            <div className="user-info" style={{ minWidth: 0, flex: 1 }}>
              <h4 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser.name}</h4>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{formatSystemRole(currentUser.system_role, t)}</span>
            </div>
          </div>
          <i className={`fa-solid ${isUserMenuOpen ? 'fa-chevron-down' : 'fa-chevron-up'}`} style={{ fontSize: '11px', color: 'var(--neutral-muted)', flexShrink: 0, marginLeft: '4px' }}></i>
        </div>

        {/* Notification Bell Button at Bottom Left */}
        <button
          type="button"
          onClick={() => {
            setIsUserMenuOpen(false);
            setIsNotificationsOpen(!isNotificationsOpen);
          }}
          className="sidebar-notif-btn"
          title={t('notif.newNotificationsTitle', 'Thông báo mới')}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            border: '1px solid var(--neutral-border)',
            backgroundColor: 'var(--neutral-bg-card)',
            color: unreadNotifsCount > 0 ? '#00ff88' : 'var(--neutral-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s ease'
          }}
        >
          <i className="fa-regular fa-bell" style={{ fontSize: '15px' }}></i>
          {unreadNotifsCount > 0 && (
            <span className="badge badge-danger" style={{ position: 'absolute', top: '-4px', right: '-4px', minWidth: '16px', height: '16px', fontSize: '9px', padding: '1px 3px' }}>
              {unreadNotifsCount}
            </span>
          )}
        </button>

        {/* User Profile Popover Menu */}
        {isUserMenuOpen && (
          <div 
            className="sidebar-user-popover"
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: '8px',
              right: '8px',
              backgroundColor: 'var(--neutral-bg-card)',
              border: '1px solid var(--neutral-border)',
              borderRadius: '12px',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.25)',
              padding: '12px',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            {/* User Header Summary */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '10px', borderBottom: '1px solid var(--neutral-border)', marginBottom: '4px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: currentUser.color || '#1E40AF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '15px', flexShrink: 0 }}>
                {currentUser.name.split(" ").pop().charAt(0)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: '700', fontSize: '13.5px', color: 'var(--foreground-color)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--neutral-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser.email}</div>
              </div>
            </div>

            {/* Profile Action Buttons */}
            <button 
              onClick={handleShowProfile} 
              className="btn btn-secondary btn-sm" 
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', padding: '8px 10px', fontSize: '12.5px' }}
            >
              <i className="fa-solid fa-user" style={{ width: '14px', textAlign: 'center', color: 'var(--primary-color)' }}></i> 
              <span>{t('header.accountDetails', 'Hồ sơ cá nhân')}</span>
            </button>

            <button 
              onClick={handleShowSettings} 
              className="btn btn-secondary btn-sm" 
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', padding: '8px 10px', fontSize: '12.5px' }}
            >
              <i className="fa-solid fa-gear" style={{ width: '14px', textAlign: 'center', color: '#00ff88' }}></i> 
              <span>{t('header.settings', 'Cài đặt hệ thống')}</span>
            </button>

            <button 
              onClick={handleShowChangePassword} 
              className="btn btn-secondary btn-sm" 
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', padding: '8px 10px', fontSize: '12.5px' }}
            >
              <i className="fa-solid fa-key" style={{ width: '14px', textAlign: 'center', color: '#eab308' }}></i> 
              <span>{t('header.changePassword', 'Đổi mật khẩu')}</span>
            </button>

            <button 
              onClick={handleShowTeamTree} 
              className="btn btn-secondary btn-sm" 
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', padding: '8px 10px', fontSize: '12.5px' }}
            >
              <i className="fa-solid fa-sitemap" style={{ width: '14px', textAlign: 'center', color: '#06b6d4' }}></i> 
              <span>{t('team.orgStructure', 'Sơ đồ nhóm')}</span>
            </button>

            {/* Logout Action */}
            <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '8px', marginTop: '4px' }}>
              <button 
                onClick={handleLogout} 
                className="btn btn-danger btn-sm" 
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 10px', fontSize: '12.5px' }}
              >
                <i className="fa-solid fa-arrow-right-from-bracket"></i> {t('header.logout', 'Đăng xuất')}
              </button>
            </div>
          </div>
        )}

        {/* Notifications Popover at Bottom Left */}
        {isNotificationsOpen && (
          <div 
            className="dropdown-menu notification-menu show" 
            style={{ 
              position: 'absolute', 
              bottom: 'calc(100% + 8px)', 
              top: 'auto',
              left: '8px', 
              right: '8px', 
              width: 'calc(100% - 16px)',
              maxWidth: 'calc(100% - 16px)',
              maxHeight: '75vh',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1100,
              backgroundColor: 'var(--neutral-bg-card)',
              border: '1px solid var(--neutral-border)',
              borderRadius: '12px',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.35)'
            }}
          >
            <div className="dropdown-header">
              <h3>{t('notif.newNotificationsTitle', 'Thông báo mới')}</h3>
              <button className="btn-text" onClick={handleMarkAllRead}>{t('notif.markAllAsRead', 'Đánh dấu tất cả đã đọc')}</button>
            </div>
            <div className="notification-list" style={{ overflowY: 'auto', flex: 1, maxHeight: '60vh' }}>
              {(!notifications || notifications.length === 0) ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--neutral-muted)' }}>{t('notif.noNewNotifications', 'Không có thông báo mới')}</div>
              ) : (
                notifications.map(n => {
                  const date = new Date(n.created_at);
                  const timeStr = `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')} ${date.getDate()}/${date.getMonth()+1}`;
                  return (
                    <div className={`notification-item ${!n.is_read ? 'unread' : ''}`} key={n.id} onClick={async () => {
                      if (!n.is_read) {
                        await db.markNotificationRead(n.id);
                      }
                      setIsNotificationsOpen(false);
                      if (n.link_url && n.link_url.startsWith('#')) {
                        const isRejectedReport = n.title === REJECTED_REPORT_TITLE;
                        const reportIdMatch = n.link_url.match(/reportId=(\d+)/);
                        if (isRejectedReport && reportIdMatch) {
                          if (!n.modal_shown) {
                            await db.markNotificationModalShown(n.id).catch(() => {});
                          }
                          router.push(`/daily-reports?reportId=${reportIdMatch[1]}`);
                        } else {
                          let target = '/' + n.link_url.replace('#', '');
                          if (target.includes('/projects/') && !target.includes('issueId=')) {
                            const issueKeyMatch = n.content?.match(/\(([A-Za-z0-9]+-[A-Za-z0-9]+)\)\s*$/);
                            if (issueKeyMatch) {
                              target += (target.includes('?') ? '&' : '?') + `issueId=${issueKeyMatch[1]}`;
                            }
                          }
                          router.push(target);
                        }
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
        )}
      </div>
    </aside>
  );
}
