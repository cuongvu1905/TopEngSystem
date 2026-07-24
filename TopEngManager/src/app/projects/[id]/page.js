"use client";

import React, { useState, useEffect, useRef, use, useCallback, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { db } from '@/utils/db';
import { StreamChatAdapter } from '@/utils/streamChatClient';
import { ProjectModal, TaskModal, DocumentModal } from '@/components/Modals';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSwal } from '@/utils/swal';

const Swal = {
  fire: async (...args) => {
    const instance = await getSwal();
    return instance.fire(...args);
  },
  mixin: async (...args) => {
    const instance = await getSwal();
    return instance.mixin(...args);
  },
  close: async (...args) => {
    const instance = await getSwal();
    return instance.close(...args);
  }
};

const formatDateForInput = (dateVal) => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
    return dateVal;
  }
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return '';
  }
};

function parseDescription(desc) {
  try {
    const data = JSON.parse(desc);
    if (data && typeof data === 'object') {
      return {
        text: data.text || '',
        hientrang: data.hientrang || '',
        nguyennhan: data.nguyennhan || '',
        huonggiaiquyet: data.huonggiaiquyet || '',
        ketqua: data.ketqua || '',
        deadline: data.deadline || '',
        issueTasks: data.issueTasks || [],
        assigneesText: data.assigneesText || '',
        relatedUserIds: data.relatedUserIds || []
      };
    }
  } catch (e) {
    // Not JSON
  }
  return {
    text: desc || '',
    hientrang: '',
    nguyennhan: '',
    huonggiaiquyet: '',
    ketqua: '',
    deadline: '',
    issueTasks: [],
    assigneesText: ''
  };
}

const parseTaskDescription = (desc) => {
  try {
    const data = JSON.parse(desc);
    if (data && typeof data === 'object' && 'text' in data) {
      return {
        text: data.text || '',
        assigneeIds: data.assignee_ids || []
      };
    }
  } catch (e) {}
  return {
    text: desc || '',
    assigneeIds: []
  };
};

const renderReportContentVisual = (content, projects) => {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          {parsed.map((card, idx) => {
            const projName = projects?.find(p => p.id === card.projectId)?.name || 'Dự án';
            return (
              <div 
                key={card.id || idx} 
                style={{ 
                  border: '1px solid var(--neutral-border)', 
                  borderRadius: '6px', 
                  padding: '10px 12px', 
                  backgroundColor: 'var(--neutral-bg-main)',
                  marginBottom: '8px'
                }}
              >
                <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center', marginBottom: '6px', borderBottom: '1px dashed #e2e8f0', paddingBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary-hover)', backgroundColor: 'var(--primary-light)', padding: '1px 5px', borderRadius: '4px' }}>
                    <i className="fa-regular fa-clock"></i> {card.startTime} - {card.endTime}
                  </span>
                  <span style={{ fontSize: '10.5px', fontWeight: '600', backgroundColor: 'var(--primary-light)', color: 'var(--primary-hover)', padding: '1px 5px', borderRadius: '4px' }}>
                    {projName}
                  </span>
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--neutral-dark)', whiteSpace: 'pre-wrap', lineheight: '1.5' }}>
                  {card.content}
                </div>
                {card.fileUrl && (
                  <div style={{ marginTop: '6px', fontSize: '11px' }}>
                    <a href={card.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <i className="fa-solid fa-paperclip"></i>
                      {card.fileName || 'Tệp đính kèm'}
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }
  } catch (e) {}
  
  return <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', lineheight: '1.5', color: 'var(--neutral-dark)' }}>{content}</div>;
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


const translateDepartmentName = (name, t) => {
  if (!name || name === 'Chưa phân phòng') return t('dept.unassigned', 'Chưa phân phòng');
  const n = String(name);
  if (n.includes('Hành chính Nhân sự') || n === 'HR') return t('dept.hr', 'Phòng Hành chính Nhân sự (HR)');
  if (n.includes('Phát triển Phần mềm') || n === 'R&D') return t('dept.rd', 'Phòng Phát triển Phần mềm (R&D)');
  if (n.includes('Kinh doanh') || n === 'Sales') return t('dept.sales', 'Phòng Kinh doanh (Sales)');
  if (n.includes('Kế toán Tài chính') || n.includes('Finance')) return t('dept.finance', 'Phòng Kế toán Tài chính');
  if (n.includes('Truyền thông Marketing') || n.includes('Marketing')) return t('dept.marketing', 'Phòng Truyền thông Marketing');
  if (n.includes('BOD TOPV') || n === 'BOD') return t('dept.bod', 'BOD TOPV');
  if (n === 'Nhân sự 1') return t('dept.hr1', 'Nhân sự 1');
  if (n === 'PC') return t('dept.pc', 'PC');
  if (n === 'PC1') return t('dept.pc1', 'PC1');
  if (n === 'PC2') return t('dept.pc2', 'PC2');
  return n;
};

const formatPriorityLabel = (priority, translateFn) => {
  if (!priority) return '';
  const p = String(priority).trim().toUpperCase();
  const tFn = typeof translateFn === 'function' ? translateFn : (key, fallback) => fallback;
  if (p === 'KHẨN CẤP' || p === 'CRITICAL') return tFn('tasks.priorityCritical', 'Khẩn cấp');
  if (p === 'CAO' || p === 'HIGH') return tFn('tasks.priorityHigh', 'Cao');
  if (p === 'TRUNG BÌNH' || p === 'MEDIUM') return tFn('tasks.priorityMedium', 'Trung bình');
  if (p === 'THẤP' || p === 'LOW') return tFn('tasks.priorityLow', 'Thấp');
  return priority;
};

const formatTaskStatus = (status, translateFn) => {
  if (!status) return '';
  const s = String(status).trim().toLowerCase();
  const tFn = typeof translateFn === 'function' ? translateFn : (key, fallback) => fallback;
  if (s === 'todo' || s === 'cần làm') return tFn('common.status.todo', 'Todo');
  if (s === 'inprogress' || s === 'in_progress' || s === 'đang thực hiện') return tFn('common.status.inProgress', 'In Progress');
  if (s === 'review' || s === 'xem xét') return tFn('common.status.review', 'In Review');
  if (s === 'done' || s === 'hoàn thành') return tFn('common.status.done', 'Done');
  return status;
};

export default function ProjectDetail({ params }) {
  const { id: projectId } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryIssueId = searchParams.get('issueId');
  const queryTaskId = searchParams.get('taskId');
  const { currentUser, projects, tasks, documents, documentVersions, documentCategories, projectMembers, users, chatRooms, chatRoomMembers, reloadAll, hasPermission } = useApp();
  const { t } = useLanguage();

   const [activeSubTab, setActiveSubTab] = useState('kanban');
   const [isPendingInvite, setIsPendingInvite] = useState(false);

   const [memberSearchQuery, setMemberSearchQuery] = useState('');
   const [selectedMemberToAdd, setSelectedMemberToAdd] = useState(null);
   const [showMemberDropdown, setShowMemberDropdown] = useState(false);

  // Chat state inside project room
  const [chatRoomId, setChatRoomId] = useState(null);
  
  // Project reports states
  const [projectReports, setProjectReports] = useState([]);
  const [isReportsLoading, setIsReportsLoading] = useState(false);
  const [isProjectReportModalOpen, setIsProjectReportModalOpen] = useState(false);
  const [projectReportContent, setProjectReportContent] = useState('');
  const [projectReportDate, setProjectReportDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [projectReportFileUrl, setProjectReportFileUrl] = useState('');
  const [projectReportFileName, setProjectReportFileName] = useState('');
  const [isSubmittingProjectReport, setIsSubmittingProjectReport] = useState(false);

  // Project report detail & edit states
  const [isProjectReportDetailModalOpen, setIsProjectReportDetailModalOpen] = useState(false);
  const [activeProjectReportDetail, setActiveProjectReportDetail] = useState(null);
  const [editProjectReportContent, setEditProjectReportContent] = useState('');
  const [editProjectReportDate, setEditProjectReportDate] = useState('');
  const [editProjectReportFileUrl, setEditProjectReportFileUrl] = useState('');
  const [editProjectReportFileName, setEditProjectReportFileName] = useState('');
  const [isSavingProjectReport, setIsSavingProjectReport] = useState(false);
  const [isDeletingProjectReport, setIsDeletingProjectReport] = useState(false);

  // Project tasks states (JIRA Issue sub-tasks & solutions)
  const [projectTasks, setProjectTasks] = useState([]);
  const [activeSubTaskData, setActiveSubTaskData] = useState(null);
  const [isSubTaskPopupOpen, setIsSubTaskPopupOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [typingUser, setTypingUser] = useState(null);
  
  // Mentions
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionList, setMentionList] = useState([]);
  const chatInputRef = useRef(null);

  // Issues Tab States (JIRA style)
  const [issues, setIssues] = useState([]);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDesc, setIssueDesc] = useState('');
  const [issueType, setIssueType] = useState('TASK');
  const [issueStatus, setIssueStatus] = useState('TO_DO');
  const [issuePriority, setIssuePriority] = useState('MEDIUM');
  const [issueAssigneeId, setIssueAssigneeId] = useState('');
  const [issueAssigneeIds, setIssueAssigneeIds] = useState([]); // Multi-select related members
  const [openAssigneeDropdownId, setOpenAssigneeDropdownId] = useState(null);
  const [jiraCreateAssigneeIds, setJiraCreateAssigneeIds] = useState([]);
  const [isLockedByOther, setIsLockedByOther] = useState(false);
  const [lockOwnerName, setLockOwnerName] = useState('');
  const lockIntervalRef = useRef(null);
  const [jiraCreateDeadline, setJiraCreateDeadline] = useState('');
  const [jiraCreateHienTrang, setJiraCreateHienTrang] = useState('');
  const [jiraCreateNguyenNhan, setJiraCreateNguyenNhan] = useState('');
  const [jiraCreateHuongGiaiQuyet, setJiraCreateHuongGiaiQuyet] = useState('');
  const [jiraCreateKetQua, setJiraCreateKetQua] = useState('');

  const [isReportPopupOpen, setIsReportPopupOpen] = useState(false);
  const [tempNguyenNhan, setTempNguyenNhan] = useState('');
  const [tempHuongGiaiQuyet, setTempHuongGiaiQuyet] = useState('');
  const [tempKetQua, setTempKetQua] = useState('');
  const [reportModalSource, setReportModalSource] = useState('create'); // 'create' | 'detail'

  const [jiraDetailDeadline, setJiraDetailDeadline] = useState('');
  const [jiraDetailHienTrang, setJiraDetailHienTrang] = useState('');
  const [jiraDetailNguyenNhan, setJiraDetailNguyenNhan] = useState('');
  const [jiraDetailHuongGiaiQuyet, setJiraDetailHuongGiaiQuyet] = useState('');
  const [jiraDetailKetQua, setJiraDetailKetQua] = useState('');

  const [detailText, setDetailText] = useState('');

  // Mentions inside the assignee text area
  const [activeMentionInput, setActiveMentionInput] = useState(null); // { modal: 'create'|'detail', field: 'assignee', elementId: string } or null
  const [issueAssigneesText, setIssueAssigneesText] = useState('');
  const [detailAssigneesText, setDetailAssigneesText] = useState('');
  const [isEditingAssignee, setIsEditingAssignee] = useState(false);
  const [jiraCreateAssigneeSearchQuery, setJiraCreateAssigneeSearchQuery] = useState('');
  const [jiraCreateAssigneeSelectedDept, setJiraCreateAssigneeSelectedDept] = useState('');
  const [jiraDetailAssigneeSearchQuery, setJiraDetailAssigneeSearchQuery] = useState('');
  const [jiraDetailAssigneeSelectedDept, setJiraDetailAssigneeSelectedDept] = useState('');

  // Filters for issues board
  const [issueSearchQuery, setIssueSearchQuery] = useState('');
  const [issueFilterAssignee, setIssueFilterAssignee] = useState('');
  const [issueFilterPriority, setIssueFilterPriority] = useState('');
  const [issueFilterType, setIssueFilterType] = useState('');

  // Issue Detail Modal states
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeIssueDetail, setActiveIssueDetail] = useState(null);
  const [issueComments, setIssueComments] = useState([]);
  const [issueHistory, setIssueHistory] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isEditingIssue, setIsEditingIssue] = useState(false);
  const [editIssueDesc, setEditIssueDesc] = useState('');

  const [departments, setDepartments] = useState([]);

  // Modals state
  const [isProjModalOpen, setIsProjModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  const [draggedTaskId, setDraggedTaskId] = useState(null);

  useEffect(() => {
    const checkInvitation = async () => {
      const myMembership = projectMembers.find(m => m.project_id === projectId && m.user_id === currentUser.id);
      if (myMembership && myMembership.status === 'PENDING') {
        setIsPendingInvite(true);
        const Swal = await getSwal();
        const showTermsDialog = (initialChecked = false) => {
          Swal.fire({
            title: 'Điều khoản dự án',
            html: `
              <div style="text-align: left; padding: 10px; font-size: 14.5px; line-height: 1.6;">
                <div style="margin-bottom: 8px;"><strong>Tên dự án:</strong> ${project?.name}</div>
                <div style="margin-bottom: 8px;"><strong>Mã khóa (Key):</strong> <span class="badge badge-info">${project?.project_key}</span></div>
                <div style="margin-bottom: 8px;"><strong>Người tạo:</strong> ${project?.creator || 'Hệ thống'}</div>
                <div style="margin-bottom: 8px;"><strong>Trạng thái:</strong> ${project?.status}</div>
                <div style="margin-bottom: 16px;"><strong>Mô tả:</strong> ${project?.description}</div>

                <div style="background-color: rgba(30, 64, 175, 0.05); border-left: 4px solid #1e40af; padding: 12px; border-radius: 4px; margin-bottom: 16px;">
                  <strong style="color: #1e40af;">Điều khoản tham gia dự án:</strong>
                  <p style="margin-top: 6px; font-size: 13px;">Bằng cách tham gia dự án, bạn đồng ý tuân thủ các quy định bảo mật, hoàn thành các nhiệm vụ được giao đúng hạn và chia sẻ thông tin công việc một cách minh bạch với các thành viên khác.</p>
                </div>
                <p style="font-weight: 500; font-size: 13.5px; text-align: center; margin-bottom: 12px;">Bạn có xác nhận đồng ý tham gia dự án "${project?.name || 'này'}"?</p>
                
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 15px; font-size: 13px; border-top: 1px solid var(--neutral-border); padding-top: 12px;">
                  <input type="checkbox" id="agree-terms-checkbox-inv" style="width: 16px; height: 16px; cursor: pointer;" ${initialChecked ? 'checked' : ''} />
                  <label for="agree-terms-checkbox-inv" style="cursor: pointer; font-weight: 500; color: var(--foreground-color);">Tôi đồng ý với điều khoản bảo mật của dự án</label>
                  <span id="view-terms-detail-inv" style="color: #1e40af; text-decoration: underline; cursor: pointer; font-weight: 600; margin-left: 4px;">[Chi tiết]</span>
                </div>
              </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Đồng ý',
            cancelButtonText: 'Hủy (Từ chối)',
            confirmButtonColor: 'var(--primary-color)',
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => {
              const confirmBtn = Swal.getConfirmButton();
              if (confirmBtn) {
                confirmBtn.disabled = !initialChecked;
              }

              const checkbox = document.getElementById('agree-terms-checkbox-inv');
              if (checkbox && confirmBtn) {
                checkbox.onchange = (e) => {
                  confirmBtn.disabled = !e.target.checked;
                };
              }

              const detailBtn = document.getElementById('view-terms-detail-inv');
              if (detailBtn) {
                detailBtn.onclick = async () => {
                  const isCurrentlyChecked = checkbox ? checkbox.checked : false;
                  const InnerSwal = await getSwal();
                  InnerSwal.fire({
                    title: 'Chi tiết điều khoản bảo mật',
                    html: `
                      <div style="text-align: left; padding: 10px; font-size: 13.5px; line-height: 1.6;">
                        <p><strong>1. Bảo mật thông tin:</strong> Thành viên cam kết không tiết lộ, chuyển nhượng hoặc sao chép bất kỳ tài liệu, mã nguồn hay thông tin mật nào của dự án ra bên ngoài.</p>
                        <p style="margin-top: 8px;"><strong>2. Minh bạch công việc:</strong> Các hoạt động phát triển, tài liệu và tiến độ phải được cập nhật thường xuyên trên hệ thống.</p>
                        <p style="margin-top: 8px;"><strong>3. Trách nhiệm cá nhân:</strong> Thành viên chịu hoàn toàn trách nhiệm đối với tài khoản của mình và các công việc được bàn giao.</p>
                        <p style="margin-top: 8px;"><strong>4. Kỷ luật dự án:</strong> Hoàn thành nhiệm vụ đúng hạn và tuân thủ các quy chuẩn kỹ thuật đã thống nhất.</p>
                      </div>
                    `,
                    confirmButtonText: 'Đã hiểu',
                    confirmButtonColor: 'var(--primary-color)'
                  }).then(() => {
                    showTermsDialog(isCurrentlyChecked);
                  });
                };
              }
            }
          }).then(async (result) => {
            if (result.isConfirmed) {
              try {
                await db.addProjectMember(projectId, currentUser.id, myMembership.project_role || 'Member', 'ACTIVE');
                await db.logActivity(
                  currentUser.id,
                  "ACCEPT_INVITATION",
                  "Project",
                  projectId,
                  `đã đồng ý điều khoản và tham gia dự án '${project?.name || projectId}'`
                );
                setIsPendingInvite(false);
                await reloadAll();
              } catch (err) {
                console.error(err);
                router.push('/projects');
              }
            } else {
              // Declined
              try {
                await db.removeProjectMember(projectId, currentUser.id);
                await db.logActivity(
                  currentUser.id,
                  "DECLINE_INVITATION",
                  "Project",
                  projectId,
                  `đã từ chối tham gia dự án '${project?.name || projectId}'`
                );
              } catch (err) {
                console.error(err);
              }
              router.push('/projects');
            }
          });
        };

        showTermsDialog();
      } else {
        setIsPendingInvite(false);
      }
    };

    if (currentUser && projectMembers.length > 0) {
      checkInvitation();
    }
  }, [projectMembers, projectId, currentUser]);

  const loadIssueDetail = useCallback(async (issueId) => {
    try {
      const res = await db.getIssueDetail(issueId);
      setActiveIssueDetail(res.issue);
      setIssueComments(res.comments);
      setIssueHistory(res.history);

      const parsed = parseDescription(res.issue.description);

      // Check permission to edit
      if (!currentUser) return { isRelated: false, lock: res.lock };

      const isReporter = res.issue.reporter_id === currentUser.id;
      const isAssignee = res.issue.assignee_id === currentUser.id;
      
      const isRelatedUser = parsed.relatedUserIds?.includes(currentUser.id);
      const isAssignedInSubtask = (parsed.issueTasks || []).some(t => {
        const assignedNames = t.assignee ? t.assignee.split('@').map(s => s.trim()).filter(Boolean) : [];
        return assignedNames.includes(currentUser.name.trim());
      });

      const isRelated = isReporter || isAssignee || isRelatedUser || isAssignedInSubtask;

      console.log("=== ISSUE PERMISSION DEBUG ===");
      console.log("Current User ID:", currentUser.id);
      console.log("Current User Name:", currentUser.name);
      console.log("isReporter (issue reporter:", res.issue.reporter_id, "):", isReporter);
      console.log("isAssignee (issue assignee:", res.issue.assignee_id, "):", isAssignee);
      console.log("isRelatedUser:", isRelatedUser);
      console.log("isAssignedInSubtask:", isAssignedInSubtask);
      console.log("Final isRelated:", isRelated);

      if (!isRelated) {
        setIsLockedByOther(true);
        setLockOwnerName('Chế độ xem (Chỉ dành cho người liên quan)');
      } else if (res.lock && res.lock.isLocked) {
        setIsLockedByOther(true);
        setLockOwnerName(res.lock.lockedBy);
      } else {
        setIsLockedByOther(false);
        setLockOwnerName('');
      }
      
      setDetailText(parsed.text || '');
      setEditIssueDesc(parsed.text || '');
      setJiraDetailDeadline(formatDateForInput(parsed.deadline) || '');
      setJiraDetailHienTrang(parsed.hientrang || '');
      setJiraDetailNguyenNhan(parsed.nguyennhan || '');
      setJiraDetailHuongGiaiQuyet(parsed.huonggiaiquyet || '');
      setJiraDetailKetQua(parsed.ketqua || '');
      setDetailAssigneesText(parsed.assigneesText || (res.issue.assignee_id ? `@${users.find(u => u.id === res.issue.assignee_id)?.name || ''} ` : ''));
      setIssueAssigneeIds(parsed.relatedUserIds || (res.issue.assignee_id ? [res.issue.assignee_id] : []));
      
      if (parsed.issueTasks && Array.isArray(parsed.issueTasks)) {
        setProjectTasks(parsed.issueTasks);
      } else {
        setProjectTasks([
          {
            id: 'task-1',
            name: 'Công việc 1',
            deadline: '2026-07-20',
            assignee: '@Nguyễn Đình Thắng',
            creator: currentUser?.full_name || currentUser?.name || 'Admin',
            contentNeeded: '- Làm việc a\n- Làm việc b\n- Làm việc c',
            solutions: [
              { id: 'sol-1-1', action: 'Nội dung thực hiện mẫu 1', executor: currentUser?.full_name || currentUser?.name || 'Admin', date: new Date().toISOString().split('T')[0] },
              { id: 'sol-1-2', action: '', executor: '', date: '' }
            ]
          },
          {
            id: 'task-2',
            name: '',
            deadline: '',
            assignee: '',
            creator: currentUser?.full_name || currentUser?.name || 'Admin',
            contentNeeded: '',
            solutions: [
              { id: 'sol-2-1', action: '', executor: '', date: '' },
              { id: 'sol-2-2', action: '', executor: '', date: '' }
            ]
          }
        ]);
      }
      return { isRelated, lock: res.lock };
    } catch (e) {
      console.error("Failed to load issue detail:", e);
      return { isRelated: false, lock: null };
    }
  }, [currentUser, users, setActiveIssueDetail, setIssueComments, setIssueHistory, setIsLockedByOther, setLockOwnerName, setDetailText, setEditIssueDesc, setJiraDetailDeadline, setJiraDetailHienTrang, setJiraDetailNguyenNhan, setJiraDetailHuongGiaiQuyet, setJiraDetailKetQua, setDetailAssigneesText, setIssueAssigneeIds, setProjectTasks]);

  const handleOpenIssueDetail = useCallback(async (issueId) => {
    if (lockIntervalRef.current) {
      clearInterval(lockIntervalRef.current);
      lockIntervalRef.current = null;
    }

    try {
      const { isRelated } = await loadIssueDetail(issueId);

      if (isRelated) {
        const lockRes = await db.lockIssue(issueId, currentUser?.id);
        if (lockRes.success) {
          setIsLockedByOther(false);
          setLockOwnerName('');
          lockIntervalRef.current = setInterval(async () => {
            await db.lockIssue(issueId, currentUser?.id);
          }, 10000);
        } else {
          setIsLockedByOther(true);
          setLockOwnerName(lockRes.lockedBy || 'Người dùng khác');
        }
      } else {
        setIsLockedByOther(true)
        setLockOwnerName('Chế độ xem (Chỉ dành cho người liên quan)');
      }
    } catch (err) {
      console.error("Locking issue failed:", err);
    }

    setIsDetailModalOpen(true);
    setIsEditingIssue(false);
  }, [currentUser, loadIssueDetail, setIsLockedByOther, setLockOwnerName, setIsDetailModalOpen, setIsEditingIssue]);

  useEffect(() => {
    if (queryIssueId && currentUser && projectMembers.length > 0) {
      setActiveSubTab('issues');
      handleOpenIssueDetail(queryIssueId);
    }
  }, [queryIssueId, currentUser, projectMembers, handleOpenIssueDetail]);
  
  // Chat state and issue details states have been moved to the top of the component



  const handleAssigneesTextChange = (val) => {
    setIssueAssigneesText(val);
    const textarea = document.getElementById('create-assignee-text');
    if (!textarea) return;
    const cursor = textarea.selectionStart || 0;
    const beforeText = val.slice(0, cursor);
    const lastAt = beforeText.lastIndexOf('@');

    if (lastAt !== -1 && !beforeText.slice(lastAt).includes(' ')) {
      const query = beforeText.slice(lastAt + 1).toLowerCase();
      setMentionQuery(query);
      const pMembers = projectMembers.filter(m => m.project_id === projectId);
      const pUsers = pMembers.map(m => users.find(u => u.id === m.user_id)).filter(Boolean);
      setMentionList(pUsers.filter(u => u.name.toLowerCase().includes(query)));
      setActiveMentionInput({ modal: 'create', field: 'assignee', elementId: 'create-assignee-text' });
    } else {
      setMentionQuery(null);
      setActiveMentionInput(null);
    }
  };

  const handleDetailAssigneesTextChange = (val) => {
    setDetailAssigneesText(val);
    const textarea = document.getElementById('detail-assignee-text');
    if (!textarea) return;
    const cursor = textarea.selectionStart || 0;
    const beforeText = val.slice(0, cursor);
    const lastAt = beforeText.lastIndexOf('@');

    if (lastAt !== -1 && !beforeText.slice(lastAt).includes(' ')) {
      const query = beforeText.slice(lastAt + 1).toLowerCase();
      setMentionQuery(query);
      const pMembers = projectMembers.filter(m => m.project_id === projectId);
      const pUsers = pMembers.map(m => users.find(u => u.id === m.user_id)).filter(Boolean);
      setMentionList(pUsers.filter(u => u.name.toLowerCase().includes(query)));
      setActiveMentionInput({ modal: 'detail', field: 'assignee', elementId: 'detail-assignee-text' });
    } else {
      setMentionQuery(null);
      setActiveMentionInput(null);
    }
  };

  const selectGridMention = (user) => {
    if (!activeMentionInput) return;
    const { modal, field, elementId, rowId } = activeMentionInput;
    const textarea = document.getElementById(elementId);
    if (!textarea) return;

    const val = textarea.value;
    const cursor = textarea.selectionStart || 0;
    const beforeText = val.slice(0, cursor);
    const lastAt = beforeText.lastIndexOf('@');

    if (lastAt !== -1) {
      const replaced = val.slice(0, lastAt) + `@${user.name} ` + val.slice(cursor);
      if (field === 'assignee') {
        if (modal === 'create') {
          setIssueAssigneesText(replaced);
        } else {
          setDetailAssigneesText(replaced);
        }
      } else if (field === 'grid-assignee') {
        handleIssueTaskChange(rowId, 'assignee', replaced);
      }
      setMentionQuery(null);
      setActiveMentionInput(null);
      setTimeout(() => {
        const el = document.getElementById(elementId);
        if (el) {
          el.focus();
          const newCursor = lastAt + user.name.length + 2;
          el.setSelectionRange(newCursor, newCursor);
        }
      }, 50);
    }
  };

  const handleGridAssigneeChange = (rowId, val, modalType = 'detail') => {
    handleIssueTaskChange(rowId, 'assignee', val);

    const elementId = `grid-assignee-${modalType}-${rowId}`;
    const textarea = document.getElementById(elementId);
    if (!textarea) return;
    const cursor = textarea.selectionStart || 0;
    const beforeText = val.slice(0, cursor);
    const lastAt = beforeText.lastIndexOf('@');

    if (lastAt !== -1 && !beforeText.slice(lastAt).includes(' ')) {
      const query = beforeText.slice(lastAt + 1).toLowerCase();
      setMentionQuery(query);
      const pMembers = projectMembers.filter(m => m.project_id === projectId);
      const pUsers = pMembers.map(m => users.find(u => u.id === m.user_id)).filter(Boolean);
      setMentionList(pUsers.filter(u => u.name.toLowerCase().includes(query)));
      setActiveMentionInput({ modal: `${modalType}-grid`, field: 'grid-assignee', elementId, rowId });
    } else {
      setMentionQuery(null);
      setActiveMentionInput(null);
    }
  };

  const notifyMentionedUsersInGrid = async (tasks, issueKey, issueSummary, issueId) => {
    const targetIssueId = issueId || (activeIssueDetail ? activeIssueDetail.id : '');
    const notifiedUserIds = new Set();
    tasks.forEach(t => {
      if (t.assignee) {
        const parts = t.assignee.split('@');
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          const matchedUser = (users || []).find(u => u && u.name && part.toLowerCase().startsWith(u.name.toLowerCase()));
          if (matchedUser && matchedUser.id !== currentUser.id) {
            notifiedUserIds.add(matchedUser.id);
          }
        }
      }
    });

    for (const userId of notifiedUserIds) {
      try {
        await db.createNotification(
          userId,
          "Được nhắc tên trong chi tiết công việc Issue",
          `${currentUser.name} đã giao một công việc cho bạn trong chi tiết của Issue "${issueSummary}" (${issueKey})`,
          `#projects/${projectId}?issueId=${targetIssueId}`
        );
      } catch (err) {
        console.error("Failed to send grid mention notification", userId, err);
      }
    }
  };

  const notifyMentionedUsers = async (assigneeText, issueKey, issueSummary, issueId) => {
    const targetIssueId = issueId || (activeIssueDetail ? activeIssueDetail.id : '');
    const notifiedUserIds = new Set();
    const parts = assigneeText.split('@');
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const matchedUser = (users || []).find(u => u && u.name && part.toLowerCase().startsWith(u.name.toLowerCase()));
      if (matchedUser && matchedUser.id !== currentUser.id) {
        notifiedUserIds.add(matchedUser.id);
      }
    }

    for (const userId of notifiedUserIds) {
      try {
        await db.createNotification(
          userId,
          "Được nhắc tên trong Issue (Người chịu trách nhiệm)",
          `${currentUser.name} đã giao trách nhiệm cho bạn trong Issue "${issueSummary}" (${issueKey})`,
          `#projects/${projectId}?issueId=${targetIssueId}`
        );
      } catch (err) {
        console.error("Failed to send notification to user", userId, err);
      }
    }
  };

  const handleSaveAssigneeText = async (targetIds) => {
    if (!activeIssueDetail) return;
    const selectedUsers = users.filter(u => targetIds.includes(u.id));
    const calculatedAssigneesText = selectedUsers.map(u => `@${u.name}`).join(' ') + (selectedUsers.length > 0 ? ' ' : '');

    const parsed = parseDescription(activeIssueDetail.description);

    const newDescription = JSON.stringify({
      text: editIssueDesc || parsed.text || '',
      hientrang: parsed.hientrang || jiraDetailHienTrang || '',
      nguyennhan: parsed.nguyennhan || jiraDetailNguyenNhan || '',
      huonggiaiquyet: parsed.huonggiaiquyet || jiraDetailHuongGiaiQuyet || '',
      ketqua: parsed.ketqua || jiraDetailKetQua || '',
      deadline: parsed.deadline || jiraDetailDeadline || '',
      issueTasks: projectTasks,
      assigneesText: calculatedAssigneesText,
      relatedUserIds: targetIds
    });

    try {
      const updatedIssue = { 
        ...activeIssueDetail, 
        assignee_id: targetIds[0] || null,
        description: newDescription
      };
      await db.updateIssue(updatedIssue, currentUser.id);
      
      // Send notifications to all selected related members
      for (const targetId of targetIds) {
        if (targetId !== currentUser.id) {
          try {
            await db.createNotification(
              targetId,
              'Bạn là thành viên liên quan của một Issue',
              `${currentUser.name} đã thêm bạn làm thành viên liên quan trong Issue "${activeIssueDetail.summary}" (${activeIssueDetail.issue_key})`,
              `#projects/${projectId}?issueId=${activeIssueDetail.id}`
            );
          } catch (nErr) {
            console.error("Failed to notify user", targetId, nErr);
          }
        }
      }

      await loadIssueDetail(activeIssueDetail.id);
      loadIssues();
      setIsEditingAssignee(false);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi cập nhật thành viên liên quan: " + err.message });
    }
  };

  // Filter & detail states moved to top

  // Departments state moved to top
  useEffect(() => {
    const loadDepts = async () => {
      try {
        const list = await db.getDepartments();
        setDepartments(list);
      } catch (e) {
        console.error(e);
      }
    };
    loadDepts();
  }, []);

  // Modal open states moved to top

  useEffect(() => {
    if (queryTaskId) {
      setActiveSubTab('kanban');
      setActiveTaskId(queryTaskId);
      setIsTaskModalOpen(true);
    }
  }, [queryTaskId]);

  // Dragged task ID state moved to top

  const project = projects.find(p => p.id === projectId);

  const projectUserMembers = useMemo(() => {
    return projectMembers
      .filter(m => m.project_id === projectId)
      .map(m => {
        const u = users.find(usr => usr.id === m.user_id);
        return u ? { ...u, project_role: m.project_role } : null;
      })
      .filter(Boolean);
  }, [projectMembers, projectId, users]);

  const filteredCreateAssignees = useMemo(() => {
    return projectUserMembers.filter(u => {
      const q = jiraCreateAssigneeSearchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
                            u.name.toLowerCase().includes(q) ||
                            u.email.toLowerCase().includes(q) ||
                            (u.employee_id && u.employee_id.toLowerCase().includes(q)) ||
                            (u.department_name && u.department_name.toLowerCase().includes(q));
      const matchesDept = !jiraCreateAssigneeSelectedDept || u.department_id === jiraCreateAssigneeSelectedDept;
      return matchesSearch && matchesDept;
    });
  }, [projectUserMembers, jiraCreateAssigneeSearchQuery, jiraCreateAssigneeSelectedDept]);

  const filteredDetailAssignees = useMemo(() => {
    return projectUserMembers.filter(u => {
      const q = jiraDetailAssigneeSearchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
                            u.name.toLowerCase().includes(q) ||
                            u.email.toLowerCase().includes(q) ||
                            (u.employee_id && u.employee_id.toLowerCase().includes(q)) ||
                            (u.department_name && u.department_name.toLowerCase().includes(q));
      const matchesDept = !jiraDetailAssigneeSelectedDept || u.department_id === jiraDetailAssigneeSelectedDept;
      return matchesSearch && matchesDept;
    });
  }, [projectUserMembers, jiraDetailAssigneeSearchQuery, jiraDetailAssigneeSelectedDept]);


  // Resolve chat room linked to project
  useEffect(() => {
    if (project && chatRooms.length > 0) {
      const room = chatRooms.find(r => r.project_id === projectId);
      if (room) {
        setChatRoomId(room.id);
      }
    }
  }, [project, chatRooms, projectId]);

  // Load chat messages
  const loadChatMessages = async () => {
    if (!chatRoomId) return;
    try {
      let msgs = await db.getMessages(chatRoomId);
      if (chatSearchQuery) {
        msgs = msgs.filter(m => m.content.toLowerCase().includes(chatSearchQuery.toLowerCase()));
      }
      setChatMessages(msgs);
    } catch (e) {
      console.error(e);
    }
  };

  // Load issues with JIRA filters
  const loadIssues = async () => {
    try {
      const list = await db.getIssues(projectId, issueSearchQuery, issueFilterAssignee, issueFilterPriority, issueFilterType);
      setIssues(list);
    } catch (e) {
      console.error("Failed to load issues:", e);
    }
  };

  useEffect(() => {
    if (project) {
      loadIssues();
    }
  }, [project, activeSubTab, issueSearchQuery, issueFilterAssignee, issueFilterPriority, issueFilterType]);

  const loadProjectReports = async () => {
    try {
      setIsReportsLoading(true);
      const list = await db.getProjectReports(projectId);
      setProjectReports(list);
    } catch (e) {
      console.error("Failed to load project reports:", e);
    } finally {
      setIsReportsLoading(false);
    }
  };

  useEffect(() => {
    if (project && activeSubTab === 'reports') {
      loadProjectReports();
    }
  }, [project, activeSubTab]);

  const handleProjectReportFileUpload = async (file) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.url) {
        setProjectReportFileUrl(data.url);
        setProjectReportFileName(file.name);
      }
    } catch (err) {
      console.error("File upload error:", err);
    }
  };

  const handleSubmitProjectReport = async (e) => {
    e.preventDefault();
    if (!projectReportContent.trim()) {
      const instance = await getSwal();
      instance.fire({ icon: 'warning', title: 'Thông báo', text: 'Vui lòng nhập nội dung báo cáo dự án' });
      return;
    }
    try {
      setIsSubmittingProjectReport(true);
      await db.createProjectReport({
        userId: currentUser.id,
        projectId: projectId,
        content: projectReportContent,
        fileUrl: projectReportFileUrl || null,
        createdAt: projectReportDate
      });

      const instance = await getSwal();
      instance.fire({ icon: 'success', title: 'Thành công', text: 'Đã gửi báo cáo dự án thành công!' });
      
      setIsProjectReportModalOpen(false);
      setProjectReportContent('');
      setProjectReportFileUrl('');
      setProjectReportFileName('');
      loadProjectReports();
    } catch (err) {
      const instance = await getSwal();
      instance.fire({ icon: 'error', title: 'Lỗi', text: 'Gửi báo cáo dự án thất bại: ' + (err.message || err) });
    } finally {
      setIsSubmittingProjectReport(false);
    }
  };

  const handleOpenProjectReportDetailModal = (report) => {
    setActiveProjectReportDetail(report);
    setEditProjectReportContent(report.content || '');
    let dateStr = new Date().toISOString().split('T')[0];
    if (report.created_at) {
      try {
        dateStr = new Date(report.created_at).toISOString().split('T')[0];
      } catch (e) {}
    }
    setEditProjectReportDate(dateStr);
    setEditProjectReportFileUrl(report.file_url || '');
    setEditProjectReportFileName(report.file_url ? 'Tệp đính kèm hiện tại' : '');
    setIsProjectReportDetailModalOpen(true);
  };

  const handleEditProjectReportFileUpload = async (file) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.url) {
        setEditProjectReportFileUrl(data.url);
        setEditProjectReportFileName(file.name);
      }
    } catch (err) {
      console.error("File upload error:", err);
    }
  };

  const handleSaveProjectReport = async (e) => {
    e.preventDefault();
    if (!editProjectReportContent.trim() || !activeProjectReportDetail) {
      const instance = await getSwal();
      instance.fire({ icon: 'warning', title: 'Thông báo', text: 'Vui lòng nhập nội dung báo cáo dự án' });
      return;
    }
    try {
      setIsSavingProjectReport(true);
      await db.updateDailyReport(
        activeProjectReportDetail.id,
        editProjectReportContent,
        editProjectReportFileUrl || null,
        projectId,
        editProjectReportDate
      );

      const instance = await getSwal();
      instance.fire({ icon: 'success', title: 'Thành công', text: 'Đã cập nhật báo cáo dự án thành công!' });
      
      setIsProjectReportDetailModalOpen(false);
      setActiveProjectReportDetail(null);
      loadProjectReports();
    } catch (err) {
      const instance = await getSwal();
      instance.fire({ icon: 'error', title: 'Lỗi', text: 'Cập nhật báo cáo thất bại: ' + (err.message || err) });
    } finally {
      setIsSavingProjectReport(false);
    }
  };

  const handleDeleteProjectReport = async () => {
    if (!activeProjectReportDetail) return;
    const instance = await getSwal();
    const confirm = await instance.fire({
      icon: 'warning',
      title: 'Xác nhận xóa',
      text: 'Bạn có chắc chắn muốn xóa hoàn toàn báo cáo dự án này?',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Xóa ngay',
      cancelButtonText: 'Hủy'
    });

    if (!confirm.isConfirmed) return;

    try {
      setIsDeletingProjectReport(true);
      await db.deleteDailyReport(activeProjectReportDetail.id);

      instance.fire({ icon: 'success', title: 'Thành công', text: 'Đã xóa báo cáo dự án!' });

      setIsProjectReportDetailModalOpen(false);
      setActiveProjectReportDetail(null);
      loadProjectReports();
    } catch (err) {
      instance.fire({ icon: 'error', title: 'Lỗi', text: 'Xóa báo cáo thất bại: ' + (err.message || err) });
    } finally {
      setIsDeletingProjectReport(false);
    }
  };

  // Note: loadIssueDetail was moved to the top of the component as a useCallback hook to satisfy React hook dependency requirements.;

  const handleIssueTaskChange = (taskId, field, value) => {
    setProjectTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const updated = { ...t, [field]: value };
        if (!updated.creator) {
          updated.creator = currentUser?.full_name || currentUser?.name || 'User';
        }
        return updated;
      }
      return t;
    }));
  };

  const handleAddIssueTaskRow = () => {
    setProjectTasks(prev => [
      ...prev,
      {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: '',
        deadline: '',
        assignee: '',
        status: 'Chưa thực hiện',
        creator: currentUser?.full_name || currentUser?.name || 'User',
        contentNeeded: '',
        solutions: [
          { id: `sol-${Date.now()}-1`, action: '', executor: '', date: '' },
          { id: `sol-${Date.now()}-2`, action: '', executor: '', date: '' }
        ]
      }
    ]);
  };

  const handleRemoveIssueTaskRow = (taskId) => {
    setProjectTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleOpenTaskPopup = (task) => {
    setActiveSubTaskData(JSON.parse(JSON.stringify(task)));
    setIsSubTaskPopupOpen(true);
  };

  const handleSubTaskFieldChange = (field, value) => {
    setActiveSubTaskData(prev => {
      if (!prev) return null;
      return { ...prev, [field]: value };
    });
  };

  const handleSolutionChange = (solId, field, value) => {
    setActiveSubTaskData(prev => {
      if (!prev) return null;
      const updatedSolutions = prev.solutions.map(s => {
        if (s.id === solId) {
          const updatedSol = { ...s, [field]: value };
          if (field === 'action' && value.trim() !== '') {
            if (!updatedSol.executor) {
              updatedSol.executor = currentUser?.full_name || currentUser?.name || 'User';
            }
            if (!updatedSol.date) {
              updatedSol.date = new Date().toISOString().split('T')[0];
            }
          }
          return updatedSol;
        }
        return s;
      });
      return { ...prev, solutions: updatedSolutions };
    });
  };

  const handleAddSolutionRow = () => {
    setActiveSubTaskData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        solutions: [
          ...prev.solutions,
          {
            id: `sol-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            action: '',
            executor: currentUser?.full_name || currentUser?.name || 'User',
            date: new Date().toISOString().split('T')[0]
          }
        ]
      };
    });
  };

  const handleRemoveSolutionRow = (solId) => {
    setActiveSubTaskData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        solutions: prev.solutions.filter(s => s.id !== solId)
      };
    });
  };

  const handleSaveTaskPopup = () => {
    if (!activeSubTaskData) return;
    setProjectTasks(prev => prev.map(t => {
      if (t.id === activeSubTaskData.id) {
        return activeSubTaskData;
      }
      return t;
    }));
    setIsSubTaskPopupOpen(false);
  };

  const validateSubTasks = (tasksList) => {
    for (let i = 0; i < tasksList.length; i++) {
      const t = tasksList[i];
      const name = t.name ? t.name.trim() : '';
      const deadline = t.deadline ? t.deadline.trim() : '';
      const performer = getPerformerForTask(t);
      const assignedNames = performer ? performer.split('@').map(s => s.trim()).filter(Boolean) : [];
      
      const hasName = name !== '';
      const hasDeadline = deadline !== '';
      const hasAssignee = assignedNames.length > 0;

      if (hasName || hasDeadline || hasAssignee) {
        if (!hasName || !hasDeadline || !hasAssignee) {
          return {
            valid: false,
            message: t('issues.incompleteSubtaskInfo', 'Vui lòng điền đầy đủ Tên công việc, Deadline và Người được giao cho công việc số {num} trong bảng chi tiết.').replace('{num}', i + 1)
          };
        }
      }
    }
    return { valid: true };
  };

  const handleSaveAllIssueTasks = async () => {
    if (!activeIssueDetail) return;

    // Validate subtasks
    const subTaskCheck = validateSubTasks(projectTasks);
    if (!subTaskCheck.valid) {
      Swal.fire({ icon: 'warning', title: t('issues.incompleteInfo', 'Thông tin chưa đầy đủ'), text: subTaskCheck.message });
      return;
    }

    if (activeIssueDetail.status === 'DONE') {
      if (!jiraDetailHienTrang.trim() || !jiraDetailNguyenNhan.trim() || !jiraDetailHuongGiaiQuyet.trim() || !jiraDetailKetQua.trim()) {
        Swal.fire({ icon: 'warning', title: t('common.warning', 'Cảnh báo'), text: t('issues.doneValidationMessage', 'Lỗi: Trạng thái Issue hiện tại là DONE. Chỉ khi cả 4 mục (Hiện trạng, Nguyên nhân, Hướng giải quyết, Kết quả) đều có thông tin mới có thể lưu!') });
        return;
      }
    }
    try {
      const newDescription = JSON.stringify({
        text: editIssueDesc,
        hientrang: jiraDetailHienTrang,
        nguyennhan: jiraDetailNguyenNhan,
        huonggiaiquyet: jiraDetailHuongGiaiQuyet,
        ketqua: jiraDetailKetQua,
        deadline: jiraDetailDeadline,
        issueTasks: projectTasks,
        assigneesText: detailAssigneesText,
        relatedUserIds: issueAssigneeIds
      });
      const updatedIssue = { 
        ...activeIssueDetail, 
        description: newDescription
      };
      await db.updateIssue(updatedIssue, currentUser.id);
      
      // Send notifications for mentions in grid
      await notifyMentionedUsersInGrid(projectTasks, activeIssueDetail.issue_key, activeIssueDetail.summary, activeIssueDetail.id);

      await loadIssueDetail(activeIssueDetail.id);
      loadIssues();
      Swal.fire({ icon: 'success', title: 'Thành công', text: "Đã lưu thay đổi thành công!" });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi lưu thay đổi: " + err.message });
    }
  }

  const handleCloseIssueDetail = async () => {
    if (lockIntervalRef.current) {
      clearInterval(lockIntervalRef.current);
      lockIntervalRef.current = null;
    }
    if (activeIssueDetail) {
      try {
        await db.unlockIssue(activeIssueDetail.id, currentUser.id);
      } catch (e) {
        console.error("Failed to unlock issue:", e);
      }
    }
    setIsDetailModalOpen(false);
  };

  // Inactivity close timer for Issue Detail Popup (10 minutes)
  useEffect(() => {
    if (!isDetailModalOpen) return;

    let timeoutId;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // Automatically close popup after 10 minutes of inactivity
        handleCloseIssueDetail();
        Swal.fire({
          icon: 'info',
          title: 'Hết thời gian chờ',
          text: 'Popup Chi tiết Issue đã tự động đóng do bạn không hoạt động trong 10 phút.',
          timer: 3000,
          showConfirmButton: false
        });
      }, 10 * 60 * 1000); // 10 minutes
    };

    // Initial start
    resetTimer();

    // Event listeners for activity
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    
    activityEvents.forEach(evt => {
      window.addEventListener(evt, resetTimer);
    });

    // Cleanup
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach(evt => {
        window.removeEventListener(evt, resetTimer);
      });
    };
  }, [isDetailModalOpen, activeIssueDetail]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim() || !activeIssueDetail) return;
    try {
      await db.addComment(activeIssueDetail.id, currentUser.id, newCommentText);
      setNewCommentText('');
      loadIssueDetail(activeIssueDetail.id);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi thêm bình luận: " + err.message });
    }
  };

  const handleDeleteComment = async (commentId) => {
    const confirmResult = await Swal.fire({
      title: 'Xác nhận xóa',
      text: "Bạn có chắc chắn muốn xóa bình luận này?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy'
    });
    if (!confirmResult.isConfirmed) return;
    try {
      await db.deleteComment(commentId);
      loadIssueDetail(activeIssueDetail.id);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi xóa bình luận: " + err.message });
    }
  };

  const handleUpdateIssueField = async (field, value) => {
    if (!activeIssueDetail) return;
    if (field === 'status' && value === 'DONE') {
      const parsed = parseDescription(activeIssueDetail.description);
      if (!parsed.hientrang?.trim() || !parsed.nguyennhan?.trim() || !parsed.huonggiaiquyet?.trim() || !parsed.ketqua?.trim()) {
        Swal.fire({ icon: 'warning', title: 'Cảnh báo', text: "Lỗi: Chỉ khi cả 4 mục (Hiện trạng, Nguyên nhân, Hướng giải quyết, Kết quả) đều có thông tin mới có thể chuyển Issue sang trạng thái DONE!" });
        return;
      }
    }
    try {
      const updatedIssue = { ...activeIssueDetail, [field]: value };
      await db.updateIssue(updatedIssue, currentUser.id);
      loadIssueDetail(activeIssueDetail.id);
      loadIssues();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi cập nhật issue: " + err.message });
    }
  };

  const handleIssueDragStart = (e, issueId) => {
    e.dataTransfer.setData('text/plain', issueId);
  };

  const handleIssueDrop = async (e, targetStatus) => {
    e.preventDefault();
    const issueId = e.dataTransfer.getData('text/plain');
    if (!issueId) return;
    try {
      const issue = issues.find(i => String(i.id) === String(issueId));
      if (!issue) return;

      // Check permission to drag/drop
      const isReporter = issue.reporter_id === currentUser.id;
      const issueAssigneeId = issue.assignee_id;
      const isAssignee = issueAssigneeId === currentUser.id;
      
      const parsed = parseDescription(issue.description);
      const isRelatedUser = parsed.relatedUserIds?.includes(currentUser.id);
      const isAssignedInSubtask = (parsed.issueTasks || []).some(t => {
        const assignedNames = t.assignee ? t.assignee.split('@').map(s => s.trim()).filter(Boolean) : [];
        return assignedNames.includes(currentUser.name.trim());
      });

      const isRelated = isReporter || isAssignee || isRelatedUser || isAssignedInSubtask;

      if (!isRelated) {
        Swal.fire({
          icon: 'error',
          title: 'Từ chối truy cập',
          text: 'Bạn không có quyền chuyển trạng thái Issue này (Chế độ Read-only).'
        });
        return;
      }

      await db.updateIssueStatus(issueId, targetStatus, currentUser.id);
      loadIssues();
    } catch (err) {
      alert("Lỗi cập nhật trạng thái kéo thả: " + err.message);
    }
  };

  useEffect(() => {
    if (StreamChatAdapter.isEnabled() && currentUser) {
      StreamChatAdapter.init(currentUser.id, currentUser.name);
    }
    return () => {
      if (StreamChatAdapter.isEnabled()) {
        StreamChatAdapter.disconnect();
      }
    };
  }, [currentUser]);

  useEffect(() => {
    return () => {
      if (lockIntervalRef.current) {
        clearInterval(lockIntervalRef.current);
        lockIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let activeChannel = null;
    const initStreamChannel = async () => {
      if (StreamChatAdapter.isEnabled() && chatRoomId && project && currentUser) {
        await StreamChatAdapter.init(currentUser.id, currentUser.name);
        const channel = await StreamChatAdapter.joinChannel(chatRoomId, `📂 {t('common.project', 'Dự án')}: ${project.name}`);
        if (channel) {
          activeChannel = channel;
          
          // Format state messages
          const stateMessages = channel.state.messages || [];
          const formatted = stateMessages.map(msg => ({
            id: msg.id,
            room_id: chatRoomId,
            sender_id: msg.user.id,
            content: msg.text,
            created_at: msg.created_at,
            attachments: msg.attachments || []
          }));
          setChatMessages(formatted);

          // Listen to message.new event
          channel.on('message.new', event => {
            setChatMessages(prev => {
              if (prev.some(m => m.id === event.message.id)) return prev;
              return [...prev, {
                id: event.message.id,
                room_id: chatRoomId,
                sender_id: event.message.user.id,
                content: event.message.text,
                created_at: event.message.created_at,
                attachments: event.message.attachments || []
              }];
            });
          });
        }
      } else {
        loadChatMessages();
      }
    };

    initStreamChannel();

    return () => {
      if (activeChannel) {
        activeChannel.off('message.new');
      }
    };
  }, [chatRoomId, chatSearchQuery, project]);

  if (!currentUser || !project) {
    return <div style={{ padding: '20px', fontWeight: '500' }}>Đang tải chi tiết dự án...</div>;
  }

  if (isPendingInvite) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: '16px' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid var(--neutral-border)', borderTopColor: '#1e40af', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--neutral-muted)' }}>Vui lòng xác nhận điều khoản để tham gia dự án...</p>
      </div>
    );
  }

  // --- NEW 6-ROLE MATRIX ENFORCEMENT ---
  const isAdmin = currentUser.system_role.includes("Admin");
  const isHR = currentUser.system_role.includes("Nhân sự");
  const isStaff = currentUser.system_role.includes("Nhân viên");
  const isLeader = currentUser.system_role.includes("Leader");
  const isSales = currentUser.system_role.includes("Kinh doanh");
  const isBOD = currentUser.system_role.includes("Ban điều hành");

  // HR is completely blocked from projects detail
  if (isHR) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--danger-color)' }}>
        <i className="fa-solid fa-lock" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
        <h2>Không có quyền truy cập</h2>
        <p className="text-muted" style={{ fontSize: '13px', marginTop: '8px' }}>Nhân sự (HR) không được phép truy cập chi tiết dự án.</p>
      </div>
    );
  }

  // Check access permission (including pending invites so they can confirm terms)
  const isProjectMember = projectMembers.some(m => m.project_id === projectId && m.user_id === currentUser.id && m.status !== 'PENDING');
  const isPendingMember = projectMembers.some(m => m.project_id === projectId && m.user_id === currentUser.id && m.status === 'PENDING');
  const hasAccess = hasPermission('view_all_projects') || isProjectMember || isPendingMember;

  if (!hasAccess) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--danger-color)' }}>
        <i className="fa-solid fa-lock" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
        <h2>Không có quyền truy cập</h2>
        <p className="text-muted" style={{ fontSize: '13px', marginTop: '8px' }}>Bạn không có quyền truy cập vì không thuộc dự án này.</p>
      </div>
    );
  }

  // Define granular action checkers
  const canManageProject = hasPermission('edit_project'); // Thêm / Xóa / Điều chỉnh plan dự án
  const canManageTasks = hasPermission('create_task'); // Giao task, cập nhật tiến độ
  const canPostIssue = hasPermission('create_issue'); // Đăng issue

  // Calculations
  const pTasks = tasks.filter(t => t.project_id === projectId);
  const done = pTasks.filter(t => t.status === "Done").length;
  const progress = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0;
  const pMembers = projectMembers.filter(m => m.project_id === projectId);

  const filteredEligible = users.filter(u => {
    if (pMembers.some(m => m.user_id === u.id)) return false;
    const q = memberSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || 
           (u.employee_id && u.employee_id.toLowerCase().includes(q)) || 
           (u.department_name && u.department_name.toLowerCase().includes(q)) ||
           u.email.toLowerCase().includes(q);
  });

  // Drag and drop task status change
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    if (!draggedTaskId) return;

    const task = tasks.find(t => t.id === draggedTaskId);
    if (!task) return;

    if (!hasPermission('update_task_status')) {
      Swal.fire({ icon: 'error', title: 'Từ chối truy cập', text: "Bạn không có quyền cập nhật trạng thái công việc này!" });
      return;
    }

    const oldStatus = task.status;
    if (oldStatus === targetStatus) return;

    await db.updateTaskStatus(draggedTaskId, targetStatus);
    await db.logActivity(
      currentUser.id, 
      "UPDATE_STATUS", 
      "Task", 
      draggedTaskId, 
      `đã chuyển trạng thái công việc '${task.title}' từ '${oldStatus}' sang '${targetStatus}'`,
      { old_status: oldStatus, new_status: targetStatus }
    );

    setDraggedTaskId(null);
    await reloadAll();
  };

  // Add project member
  const handleAddMember = async (e) => {
    e.preventDefault();
    const userId = selectedMemberToAdd?.id;
    const role = e.target.elements.role.value;
    if (!userId || !role) {
      Swal.fire({
        icon: 'warning',
        title: t('common.notice', 'Thông báo'),
        text: t('project.selectMemberToAddPrompt', 'Vui lòng tìm và chọn một nhân viên để thêm.'),
        confirmButtonColor: 'var(--primary-color)'
      });
      return;
    }

    const isPublic = project.visibility === 'Public';
    const status = isPublic ? 'PENDING' : 'ACTIVE';

    await db.addProjectMember(projectId, userId, role, status);
    const u = users.find(usr => usr.id === userId);
    
    await db.logActivity(
      currentUser.id, 
      "ADD_MEMBER", 
      "Project", 
      projectId, 
      isPublic 
        ? `đã gửi lời mời tham gia dự án cho thành viên '${u ? u.name : userId}' với vai trò ${role}`
        : `đã thêm thành viên '${u ? u.name : userId}' với vai trò ${role}`
    );
    
    Swal.fire({
      icon: 'success',
      title: t('common.success', 'Thành công'),
      text: isPublic ? t('project.inviteSentPendingAgreement', 'Đã gửi lời mời tham gia dự án (đang chờ xác nhận điều khoản)!') : t('project.memberAddedSuccess', 'Đã thêm thành viên thành công!'),
      confirmButtonColor: 'var(--primary-color)'
    });

    e.target.reset();
    setSelectedMemberToAdd(null);
    setMemberSearchQuery('');
    await reloadAll();
  };

  const handleRemoveMember = async (userId, name) => {
    const confirmResult = await Swal.fire({
      title: 'Xác nhận xóa',
      text: `Bạn có chắc chắn muốn xóa thành viên ${name} khỏi dự án?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy'
    });
    if (confirmResult.isConfirmed) {
      await db.removeProjectMember(projectId, userId);
      await db.logActivity(currentUser.id, "REMOVE_MEMBER", "Project", projectId, `đã xóa thành viên '${name}' khỏi dự án`);
      await reloadAll();
    }
  };

  // Chat message sending & simulated reply
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !chatRoomId) return;

    // Check asking before send tag @all confirmation if Sales / BOD / Admin
    if (chatInput.includes("@all")) {
      const canTagAll = isAdmin || isLeader || isSales; // project chat tag @all
      if (!canTagAll) {
        Swal.fire({ icon: 'error', title: 'Quyền hạn', text: "Bạn không có quyền tag @all trong nhóm dự án." });
        return;
      }
      
      const shouldAsk = isAdmin || isSales || isBOD;
      if (shouldAsk) {
        const confirmResult = await Swal.fire({
          title: 'Xác nhận gửi',
          text: "Bạn có chắc chắn muốn gửi tin nhắn có tag @all đến toàn nhóm dự án?",
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#3085d6',
          cancelButtonColor: '#d33',
          confirmButtonText: 'Gửi',
          cancelButtonText: 'Hủy'
        });
        if (!confirmResult.isConfirmed) {
          return;
        }
      }
    }

    if (StreamChatAdapter.isEnabled()) {
      await StreamChatAdapter.sendMessage(chatInput.trim());
    } else {
      await db.sendMessage({
        room_id: chatRoomId,
        sender_id: currentUser.id,
        content: chatInput.trim()
      });

      // Mentions check
      users.forEach(async (u) => {
        if (chatInput.includes(`@${u.name}`)) {
          await db.createNotification(u.id, "Được nhắc tên trong Chat", `${currentUser.name} đã nhắc tên bạn trong kênh trò chuyện.`, `#chat`);
        }
      });

      await loadChatMessages();

      // simulated auto response
      const otherMembers = pMembers.filter(m => m.user_id !== currentUser.id);
      if (otherMembers.length > 0 && Math.random() > 0.4) {
        const randomMember = otherMembers[Math.floor(Math.random() * otherMembers.length)];
        const responder = users.find(u => u.id === randomMember.user_id);
        if (responder) {
          setTypingUser(responder.name);
          setTimeout(async () => {
            setTypingUser(null);
            const replies = [
              "Tôi đồng ý với quan điểm này.",
              "Vấn đề này cần được nghiên cứu kỹ thêm.",
              "Để tôi cập nhật tiến độ công việc này ngay nhé.",
              "Cảm ơn bạn đã thông báo!",
              "Okay, ghi nhận thông tin."
            ];
            const replyText = replies[Math.floor(Math.random() * replies.length)];
            await db.sendMessage({
              room_id: chatRoomId,
              sender_id: responder.id,
              content: `@${currentUser.name} ${replyText}`
            });
            await loadChatMessages();
          }, 2000);
        }
      }
    }

    setChatInput('');
    setMentionQuery(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleChatInputChange = (e) => {
    const val = e.target.value;
    setChatInput(val);

    const cursor = e.target.selectionStart;
    const beforeText = val.slice(0, cursor);
    const lastAt = beforeText.lastIndexOf('@');

    if (lastAt !== -1 && !beforeText.slice(lastAt).includes(' ')) {
      const query = beforeText.slice(lastAt + 1).toLowerCase();
      setMentionQuery(query);
      const otherUsers = users.filter(u => u.id !== currentUser.id);
      setMentionList(otherUsers.filter(u => u.name.toLowerCase().includes(query)));
    } else {
      setMentionQuery(null);
    }
  };

  const selectMention = (user) => {
    const val = chatInput;
    const cursor = chatInputRef.current?.selectionStart || 0;
    const beforeText = val.slice(0, cursor);
    const lastAt = beforeText.lastIndexOf('@');
    
    if (lastAt !== -1) {
      const replaced = val.slice(0, lastAt) + `@${user.name} ` + val.slice(cursor);
      setChatInput(replaced);
      setMentionQuery(null);
      chatInputRef.current?.focus();
    }
  };

  const handleDownloadDoc = (att) => {
    Swal.fire({ 
      icon: 'info', 
      title: 'Đang tải file', 
      html: `Đang tải file: <code>${att.file_url}</code><br>Dung lượng: <b>${att.file_size || 'N/A'}</b>` 
    });
  };

  const openTaskDetail = (taskId) => {
    setActiveTaskId(taskId);
    setIsTaskModalOpen(true);
  };

  const openDocVersion = (docId) => {
    setActiveDocId(docId);
    setIsDocModalOpen(true);
  };

  const getPerformerForTask = (row) => {
    if (!row.solutions || !Array.isArray(row.solutions)) return row.assignee || '';
    const executors = row.solutions
      .filter(s => s.action?.trim() && s.executor?.trim())
      .map(s => s.executor.trim());
    if (executors.length > 0) {
      const uniqueExecutors = Array.from(new Set(executors));
      return uniqueExecutors.map(name => name.startsWith('@') ? name : `@${name}`).join(' ');
    }
    return row.assignee || '';
  };

  const getPerformerFromSolution = (row) => {
    if (!row.solutions || !Array.isArray(row.solutions)) return t('issues.unassigned', 'Chưa gán...');
    const executors = row.solutions
      .filter(s => s.action?.trim() && s.executor?.trim())
      .map(s => s.executor.trim());
    if (executors.length > 0) {
      const uniqueExecutors = Array.from(new Set(executors));
      return uniqueExecutors.map(name => name.startsWith('@') ? name : `@${name}`).join(', ');
    }
    return t('issues.unassigned', 'Chưa gán...');
  };

  const getCompletedOrAssignedExecutorsText = () => {
    const names = new Set();
    projectTasks.forEach(t => {
      const performerText = getPerformerForTask(t);
      if (performerText) {
        performerText.split(' ').forEach(p => {
          names.add(p.replace(/^@/, '').trim());
        });
      }
    });
    const uniqueNames = Array.from(names).filter(Boolean);
    return uniqueNames.length > 0 ? uniqueNames.join(', ') : 'Chưa có người thực hiện';
  };

  return (
    <div className="scrollable-view">
      <div className="view-header" style={{ marginBottom: '12px' }}>
        <div className="view-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link href="/projects" style={{ fontSize: '18px', color: 'var(--neutral-muted)' }}>
              <i className="fa-solid fa-arrow-left"></i>
            </Link>
            <h2>{t('common.project', 'Dự án')}: {project.name}</h2>
          </div>
          <p>{project.description || 'Không có mô tả.'}</p>
        </div>
        <div className="view-actions" style={{ display: 'flex', gap: '8px' }}>
          {project.is_public && (
            <Link href={`/public-projects/${projectId}`} target="_blank" className="btn btn-secondary">
              <i className="fa-solid fa-globe"></i> {t('project.publicView', 'Xem trang công khai')}
            </Link>
          )}
          {canManageProject && (
            <button className="btn btn-secondary" onClick={() => setIsProjModalOpen(true)}>
              <i className="fa-solid fa-pen"></i> {t('common.edit', 'Chỉnh sửa')}
            </button>
          )}
        </div>
      </div>

      <div className="project-meta-strip">
        <div className="project-meta-item">
          <label>{t('project.classification', 'Phân loại')}</label>
          <span>
            <span className={`badge ${project.visibility === 'Public' ? 'badge-info' : 'badge-secondary'}`} style={{ fontSize: '11px', padding: '3px 6px' }}>
              {project.visibility === 'Public' ? 'PUBLIC' : 'PRIVATE'}
            </span>
          </span>
        </div>
        <div className="project-meta-item">
          <label>{t('common.status', 'Trạng thái')}</label>
          {canManageProject ? (
            <select
              value={project.status || 'Thực thi'}
              onChange={async (e) => {
                try {
                  const updatedProj = { ...project, status: e.target.value };
                  const pMembers = projectMembers.filter(m => m.project_id === projectId);
                  const membersList = pMembers.map(m => ({ user_id: m.user_id, project_role: m.project_role }));
                  await db.saveProject(updatedProj, membersList);
                  await reloadAll();
                } catch (err) {
                  Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi cập nhật trạng thái: " + err.message });
                }
              }}
              className="doc-select-filter"
              style={{ padding: '2px 6px', borderRadius: '4px', height: '26px', fontSize: '12px', border: '1px solid var(--neutral-border)' }}
            >
              <option value="Khởi tạo">INITIATING</option>
              <option value="Lập kế hoạch">PLANNING</option>
              <option value="Thực thi">EXECUTING</option>
              <option value="Giám sát">MONITORING</option>
              <option value="Kết thúc">CLOSED</option>
            </select>
          ) : (
            <span><span className="badge badge-info">{project.status === 'Khởi tạo' ? 'INITIATING' : project.status === 'Lập kế hoạch' ? 'PLANNING' : project.status === 'Thực thi' ? 'EXECUTING' : project.status === 'Giám sát' ? 'MONITORING' : project.status === 'Kết thúc' ? 'CLOSED' : (project.status || 'EXECUTING')}</span></span>
          )}
        </div>
        <div className="project-meta-item">
          <label>{t('project.timeframe', 'Thời gian')}</label>
          {canManageProject ? (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input
                type="date"
                value={formatDateForInput(project.start_date) || ''}
                onChange={async (e) => {
                  try {
                    const updatedProj = { ...project, start_date: e.target.value };
                    const pMembers = projectMembers.filter(m => m.project_id === projectId);
                    const membersList = pMembers.map(m => ({ user_id: m.user_id, project_role: m.project_role }));
                    await db.saveProject(updatedProj, membersList);
                    await reloadAll();
                  } catch (err) {
                    Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi cập nhật ngày bắt đầu: " + err.message });
                  }
                }}
                style={{ padding: '2px 4px', fontSize: '12px', border: '1px solid var(--neutral-border)', borderRadius: '4px', outline: 'none' }}
              />
              <span>~</span>
              <input
                type="date"
                value={formatDateForInput(project.end_date) || ''}
                onChange={async (e) => {
                  try {
                    const updatedProj = { ...project, end_date: e.target.value };
                    const pMembers = projectMembers.filter(m => m.project_id === projectId);
                    const membersList = pMembers.map(m => ({ user_id: m.user_id, project_role: m.project_role }));
                    await db.saveProject(updatedProj, membersList);
                    await reloadAll();
                  } catch (err) {
                    Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi cập nhật ngày kết thúc: " + err.message });
                  }
                }}
                style={{ padding: '2px 4px', fontSize: '12px', border: '1px solid var(--neutral-border)', borderRadius: '4px', outline: 'none' }}
              />
            </div>
          ) : (
            <span>{project.start_date ? new Date(project.start_date).toLocaleDateString('vi-VN') : 'N/A'} ~ {project.end_date ? new Date(project.end_date).toLocaleDateString('vi-VN') : 'N/A'}</span>
          )}
        </div>
        <div className="project-meta-item">
          <label>{t('project.taskCount', 'Số lượng việc')}</label>
          <span>{pTasks.length} {t('project.tasksSuffix', 'công việc')}</span>
        </div>
        <div className="project-meta-item" style={{ flex: 1, maxWidth: '250px' }}>
          <label>{t('project.progress', 'Tiến độ dự án')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="progress-bar-outer" style={{ flex: 1, height: '6px' }}>
              <div className="progress-bar-inner" style={{ width: `${progress}%` }}></div>
            </div>
            <span style={{ fontWeight: 600, fontSize: '12px' }}>{progress}%</span>
          </div>
        </div>
      </div>

      <div className="project-tabs" style={{ marginTop: '20px' }}>
        <button className={`tab-btn ${activeSubTab === 'kanban' ? 'active' : ''}`} onClick={() => setActiveSubTab('kanban')}><i className="fa-solid fa-cubes"></i> {t('project.kanban', 'Bảng Kanban')}</button>
        <button className={`tab-btn ${activeSubTab === 'gantt' ? 'active' : ''}`} onClick={() => setActiveSubTab('gantt')}><i className="fa-solid fa-chart-gantt"></i> {t('project.gantt', 'Biểu đồ Gantt')}</button>
        <button className={`tab-btn ${activeSubTab === 'issues' ? 'active' : ''}`} onClick={() => setActiveSubTab('issues')}><i className="fa-solid fa-triangle-exclamation"></i> {t('project.issues', 'Vấn đề (Issues)')}</button>
        <button className={`tab-btn ${activeSubTab === 'members' ? 'active' : ''}`} onClick={() => setActiveSubTab('members')}><i className="fa-solid fa-users"></i> {t('project.members', 'Thành viên')}</button>
        <button className={`tab-btn ${activeSubTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveSubTab('documents')}><i className="fa-solid fa-file-invoice"></i> {t('project.documents', 'Tài liệu')}</button>
        <button className={`tab-btn ${activeSubTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveSubTab('reports')}><i className="fa-solid fa-file-signature"></i> {t('project.reports', 'Báo cáo')}</button>
        <button className={`tab-btn ${activeSubTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveSubTab('chat')}><i className="fa-solid fa-comments"></i> {t('project.chat', 'Kênh Thảo luận')}</button>
      </div>

      <div className="project-tab-content">
        {/* ================= TABS: KANBAN ================= */}
        {activeSubTab === 'kanban' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600 }}>{t('project.taskAssignment', 'Phân công công việc')}</h3>
              {canManageTasks && (
                <button className="btn btn-primary btn-sm" onClick={() => { setActiveTaskId(null); setIsTaskModalOpen(true); }}>
                  <i className="fa-solid fa-plus"></i> {t('project.assignNewTask', 'Giao việc mới')}
                </button>
              )}
            </div>
            
            <div className="kanban-board">
              {[
                { id: "Todo", title: "TO DO", class: "todo" },
                { id: "InProgress", title: "IN PROGRESS", class: "inprogress" },
                { id: "Review", title: "IN REVIEW", class: "review" },
                { id: "Done", title: "DONE", class: "done" }
              ].map(col => {
                const colTasks = pTasks.filter(t => t.status === col.id);
                return (
                  <div className="kanban-col" key={col.id}>
                    <div className="kanban-col-header">
                      <div className="kanban-col-title">
                        <span className={`badge badge-${col.class}`}><i className="fa-solid fa-circle" style={{ fontSize: '8px' }}></i></span>
                        <span>{col.title}</span>
                      </div>
                      <span className="kanban-col-count">{colTasks.length}</span>
                    </div>
                    <div 
                      className="kanban-cards-container" 
                      onDragOver={handleDragOver} 
                      onDrop={(e) => handleDrop(e, col.id)}
                    >
                      {colTasks.map(taskItem => {
                        const parsedTask = parseTaskDescription(taskItem.description);
                        const isOverdue = new Date(taskItem.due_date) < new Date() && taskItem.status !== "Done";
                        let pClass = "badge-info";
                        const pUpper = String(taskItem.priority || '').trim().toUpperCase();
                        if (pUpper === "CAO" || pUpper === "HIGH" || pUpper === "CRITICAL" || pUpper === "KHẨN CẤP") pClass = "badge-danger";
                        else if (pUpper === "TRUNG BÌNH" || pUpper === "MEDIUM") pClass = "badge-warning";
                        else pClass = "badge-success";

                        let currentAssigneeIds = parsedTask.assigneeIds;
                        if (currentAssigneeIds.length === 0 && taskItem.assignee_id) {
                          currentAssigneeIds = [taskItem.assignee_id];
                        }

                        return (
                          <div 
                            className="task-card" 
                            draggable 
                            onDragStart={() => setDraggedTaskId(taskItem.id)} 
                            onClick={() => openTaskDetail(taskItem.id)}
                            key={taskItem.id}
                          >
                            <div className="task-card-header">
                              <span className={`badge ${pClass}`}>{formatPriorityLabel(taskItem.priority, t)}</span>
                              <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                                {currentAssigneeIds.length > 0 ? (
                                  currentAssigneeIds.map((id, idx) => {
                                    const u = users.find(usr => usr.id === id);
                                    if (!u) return null;
                                    return (
                                      <div 
                                        key={id} 
                                        className="task-card-assignee" 
                                        style={{ 
                                          backgroundColor: u.color, 
                                          marginLeft: idx > 0 ? '-8px' : '0',
                                          zIndex: 10 - idx,
                                          border: '1px solid #fff',
                                          width: '20px',
                                          height: '20px',
                                          fontSize: '9px'
                                        }} 
                                        title={u.name}
                                      >
                                        {u.name.split(" ").pop().charAt(0)}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="task-card-assignee" style={{ backgroundColor: 'var(--neutral-muted)', width: '20px', height: '20px', fontSize: '9px' }} title="Chưa giao">
                                    ?
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="task-card-title">{taskItem.title}</div>
                            <p className="task-card-desc">{parsedTask.text || 'Không có mô tả.'}</p>
                            <div className="task-card-meta">
                              <span className={`task-card-due ${isOverdue ? 'overdue' : ''}`}>
                                <i className="fa-regular fa-clock"></i> {taskItem.due_date ? new Date(taskItem.due_date).toLocaleDateString('vi-VN') : 'Không hạn'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= TABS: GANTT ================= */}
        {activeSubTab === 'gantt' && (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{t('project.ganttTimelineTitle', 'Timeline Tiến độ')}</h3>
              <p className="text-muted" style={{ fontSize: '11.5px' }}>{t('project.ganttTimelineSubtitle', 'Phác họa thời hạn chót và trạng thái của từng đầu việc.')}</p>
            </div>
            <div className="gantt-chart-wrapper">
              {pTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--neutral-muted)' }}>{t('project.noTasksYet', 'Chưa có công việc nào.')}</div>
              ) : (
                pTasks
                  .sort((a,b) => new Date(a.due_date || '2030-01-01') - new Date(b.due_date || '2030-01-01'))
                  .map(taskItem => {
                    let left = 25, width = 40;
                    const pUpper = String(taskItem.priority || '').trim().toUpperCase();
                    if (pUpper === "CAO" || pUpper === "HIGH" || pUpper === "CRITICAL" || pUpper === "KHẨN CẤP") { left = 10; width = 25; }
                    else if (pUpper === "THẤP" || pUpper === "LOW") { left = 45; width = 30; }
                    if (taskItem.status === "Done" || taskItem.status === "Hoàn thành") { left = 5; width = 90; }

                    return (
                      <div className="gantt-row" key={taskItem.id}>
                        <div className="gantt-task-name" onClick={() => openTaskDetail(taskItem.id)} style={{ cursor: 'pointer' }}>{taskItem.title}</div>
                        <div className="gantt-timeline-container">
                          <div className={`gantt-bar ${(taskItem.status || '').toLowerCase()}`} style={{ left: `${left}%`, width: `${width}%` }}>
                            <span>{t('project.dueLabel', 'Hạn:')} {taskItem.due_date ? new Date(taskItem.due_date).toLocaleDateString(t('common.locale', 'vi-VN')) : t('project.noDueDate', 'Không có')} ({formatTaskStatus(taskItem.status, t)})</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}

        {/* ================= TABS: ISSUES ================= */}
        {activeSubTab === 'issues' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--neutral-dark)' }}>{t('project.issuesBoardTitle', 'Bảng Kanban Vấn đề (Issues Board)')}</h3>
              {canPostIssue && (
                <button className="btn btn-primary btn-sm" onClick={() => {
                  setIssueTitle('');
                  setIssueDesc('');
                  setIssueType('TASK');
                  setIssueStatus('TO_DO');
                  setIssuePriority('MEDIUM');
                  setIssueAssigneeId('');
                  setJiraCreateAssigneeIds([]);
                  setIssueAssigneesText('');
                  setProjectTasks([]);
                  setJiraCreateAssigneeSearchQuery('');
                  setJiraCreateAssigneeSelectedDept('');
                  setJiraCreateDeadline('');
                  setJiraCreateHienTrang('');
                  setJiraCreateNguyenNhan('');
                  setJiraCreateHuongGiaiQuyet('');
                  setJiraCreateKetQua('');
                  setIsIssueModalOpen(true);
                }}>
                  <i className="fa-solid fa-plus"></i> {t('project.createIssue', 'Tạo Issue mới')}
                </button>
              )}
            </div>

            {/* JIRA Filters Row */}
            <div className="doc-filters" style={{ marginBottom: '20px', padding: '12px', borderRadius: '6px', backgroundColor: 'var(--neutral-bg-card)', border: '1px solid var(--neutral-border)' }}>
              <div className="issue-filters-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '200px' }}>
                  <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--neutral-muted)' }}></i>
                  <input
                    type="text"
                    placeholder={t('project.searchIssuePlaceholder', 'Tìm kiếm theo tiêu đề/mô tả...')}
                    value={issueSearchQuery}
                    onChange={(e) => setIssueSearchQuery(e.target.value)}
                    className="doc-select-filter"
                    style={{ width: '100%', padding: '6px 10px', height: 'auto' }}
                  />
                </div>

                <div className="issue-filter-group" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: '500' }}>{t('project.assigneeLabel', 'Giao cho:')}</label>
                  <select
                    value={issueFilterAssignee}
                    onChange={(e) => setIssueFilterAssignee(e.target.value)}
                    className="doc-select-filter"
                    style={{ minWidth: '140px' }}
                  >
                    <option value="">{t('project.filterAll', '-- Tất cả --')}</option>
                    {pMembers.map(m => {
                      const u = users.find(usr => usr.id === m.user_id);
                      return u ? <option key={u.id} value={u.id}>{u.name}</option> : null;
                    })}
                  </select>
                </div>

                <div className="issue-filter-group" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: '500' }}>{t('project.priorityLabel', 'Độ ưu tiên:')}</label>
                  <select
                    value={issueFilterPriority}
                    onChange={(e) => setIssueFilterPriority(e.target.value)}
                    className="doc-select-filter"
                  >
                    <option value="">{t('project.filterAll', '-- Tất cả --')}</option>
                    <option value="LOW">LOW (Thấp)</option>
                    <option value="MEDIUM">MEDIUM (Trung bình)</option>
                    <option value="HIGH">HIGH (Cao)</option>
                    <option value="CRITICAL">CRITICAL (Khẩn cấp)</option>
                  </select>
                </div>

                <div className="issue-filter-group" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: '500' }}>{t('project.typeLabel', 'Loại:')}</label>
                  <select
                    value={issueFilterType}
                    onChange={(e) => setIssueFilterType(e.target.value)}
                    className="doc-select-filter"
                  >
                    <option value="">{t('project.filterAll', '-- Tất cả --')}</option>
                    <option value="STORY">STORY</option>
                    <option value="TASK">TASK</option>
                    <option value="BUG">BUG</option>
                    <option value="EPIC">EPIC</option>
                  </select>
                </div>
              </div>
            </div>

            {/* JIRA Kanban Board columns */}
            <div className="kanban-board" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '12px' }}>
              {[
                { id: "TO_DO", title: "TO DO", class: "todo" },
                { id: "IN_PROGRESS", title: "IN PROGRESS", class: "inprogress" },
                { id: "DONE", title: "DONE", class: "done" }
              ].map(col => {
                // Group issues for this column
                const colIssues = issues.filter(iss => {
                  if (col.id === "TO_DO") {
                    return iss.status === "TO_DO";
                  }
                  return iss.status === col.id;
                });

                return (
                  <div 
                    className="kanban-col" 
                    key={col.id} 
                    style={{ backgroundColor: 'var(--neutral-bg-main)', border: '1px solid var(--neutral-border)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', minHeight: '450px' }}
                  >
                    <div className="kanban-col-header" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="kanban-col-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '12.5px', color: 'var(--neutral-dark)' }}>
                        <span className={`badge badge-${col.class}`} style={{ width: '8px', height: '8px', borderRadius: '50%', padding: 0 }}></span>
                        <span>{col.title}</span>
                      </div>
                      <span className="kanban-col-count" style={{ backgroundColor: 'var(--neutral-bg-hover)', color: 'var(--neutral-dark)', fontSize: '11px', padding: '2px 6px', borderRadius: '10px', fontWeight: '600' }}>{colIssues.length}</span>
                    </div>

                    <div 
                      className="kanban-cards-container" 
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '380px' }}
                    >
                      {colIssues.length === 0 ? (
                        <div style={{ border: '2px dashed var(--neutral-border)', borderRadius: '6px', height: '100%', minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neutral-muted)', fontSize: '12px' }}>
                          {t('project.noIssuesYet', 'Chưa có vấn đề nào')}
                        </div>
                      ) : (
                        colIssues.map(iss => {
                          const assignee = users.find(u => u.id === iss.assignee_id);
                          
                          // Styling priorities
                          let priorityColor = '#64748b'; // LOW
                          if (iss.priority === 'HIGH') priorityColor = '#f59e0b';
                          else if (iss.priority === 'CRITICAL') priorityColor = '#ef4444';
                          else if (iss.priority === 'MEDIUM') priorityColor = '#3b82f6';

                          // Styling types
                          let typeIcon = 'fa-square-check';
                          let typeColor = '#3b82f6'; // TASK
                          if (iss.type === 'BUG') {
                            typeIcon = 'fa-circle-exclamation';
                            typeColor = '#ef4444';
                          } else if (iss.type === 'STORY') {
                            typeIcon = 'fa-bookmark';
                            typeColor = '#10b981';
                          } else if (iss.type === 'EPIC') {
                            typeIcon = 'fa-bolt';
                            typeColor = '#a855f7';
                          }

                          return (
                            <div 
                              className="task-card" 
                              onClick={() => handleOpenIssueDetail(iss.id)}
                              key={iss.id}
                              style={{ padding: '12px', cursor: 'pointer', borderLeft: `4px solid ${typeColor}`, borderTop: '1px solid var(--neutral-border)', borderRight: '1px solid var(--neutral-border)', borderBottom: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--neutral-muted)', backgroundColor: 'var(--neutral-bg-hover)', padding: '2px 6px', borderRadius: '4px' }}>
                                  {iss.issue_key}
                                </span>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  <i className={`fa-solid ${typeIcon}`} style={{ color: typeColor, fontSize: '12px' }} title={iss.type}></i>
                                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#fff', backgroundColor: priorityColor, padding: '1px 5px', borderRadius: '3px' }}>
                                    {formatPriorityLabel(iss.priority, t)}
                                  </span>
                                </div>
                              </div>
                              <div className="task-card-title" style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--neutral-dark)', marginBottom: '8px', lineHeight: '1.4' }}>{iss.summary}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--neutral-muted)' }}>
                                  {new Date(iss.created_at).toLocaleDateString('vi-VN')}
                                </span>
                                <div 
                                  className="task-card-assignee" 
                                  style={{ 
                                    width: '24px', 
                                    height: '24px', 
                                    borderRadius: '50%', 
                                    backgroundColor: assignee ? assignee.color : '#94a3b8', 
                                    color: '#fff', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    fontSize: '10px', 
                                    fontWeight: '700',
                                    lineHeight: '24px'
                                  }} 
                                  title={assignee ? assignee.name : 'Chưa giao'}
                                >
                                  {assignee ? assignee.name.split(" ").pop().charAt(0) : '?'}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= TABS: MEMBERS ================= */}
        {activeSubTab === 'members' && (
          <div>
            {(canManageProject || (project.visibility === 'Public' && isProjectMember)) && (
              <div className="doc-filters" style={{ marginBottom: '16px' }}>
                <form onSubmit={handleAddMember} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ position: 'relative', width: '450px' }}>
                    <input
                      type="text"
                      className="doc-select-filter"
                      style={{ width: '100%' }}
                      placeholder={t('project.searchMemberPlaceholder', 'Tìm theo tên/mã NV/phòng ban...')}
                      value={selectedMemberToAdd ? `${selectedMemberToAdd.name} (${selectedMemberToAdd.employee_id || 'N/A'})` : memberSearchQuery}
                      onChange={(e) => {
                        if (selectedMemberToAdd) {
                          setSelectedMemberToAdd(null);
                        }
                        setMemberSearchQuery(e.target.value);
                        setShowMemberDropdown(true);
                      }}
                      onFocus={() => setShowMemberDropdown(true)}
                    />
                    {showMemberDropdown && (
                      <div 
                        className="dropdown-menu show" 
                        style={{ 
                          position: 'absolute', 
                          top: '100%', 
                          left: 0, 
                          width: '100%', 
                          maxHeight: '200px', 
                          overflowY: 'auto', 
                          zIndex: 100, 
                          backgroundColor: 'var(--neutral-bg-card)', color: 'var(--neutral-dark)', 
                          border: '1px solid var(--neutral-border)', 
                          borderRadius: '6px', 
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          marginTop: '4px'
                        }}
                      >
                        {filteredEligible.length === 0 ? (
                          <div style={{ padding: '10px', fontSize: '13px', color: 'var(--neutral-muted)', textAlign: 'center' }}>Không tìm thấy nhân viên</div>
                        ) : (
                          filteredEligible.map(u => (
                            <div 
                              key={u.id}
                              onClick={() => {
                                setSelectedMemberToAdd(u);
                                setMemberSearchQuery('');
                                setShowMemberDropdown(false);
                              }}
                              style={{ 
                                padding: '8px 12px', 
                                cursor: 'pointer', 
                                fontSize: '13px', 
                                borderBottom: '1px solid #f1f5f9',
                                transition: 'background-color 0.2s',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <div style={{ fontWeight: '600', color: 'var(--neutral-dark)' }}>{u.name}</div>
                              <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--neutral-muted)' }}>
                                <span>Mã NV: <strong>{u.employee_id || 'N/A'}</strong></span>
                                <span>•</span>
                                <span>Bộ phận: <strong>{translateDepartmentName(u.department_name, t)}</strong></span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                    {showMemberDropdown && (
                      <div 
                        onClick={() => setShowMemberDropdown(false)} 
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} 
                      />
                    )}
                  </div>
                  <select name="role" className="doc-select-filter" style={{ minWidth: '100px' }} required>
                    <option value="Member">{t('project.roleMember', 'Thành viên')}</option>
                    <option value="PM">{t('project.rolePM', 'Quản lý')}</option>
                  </select>
                  <button type="submit" className="btn btn-primary btn-sm">
                    <i className="fa-solid fa-user-plus"></i> {project.visibility === 'Public' ? t('project.inviteMember', 'Mời tham gia') : t('common.add', 'Thêm')}
                  </button>
                </form>
              </div>
            )}
            
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('common.fullName', 'Họ và tên')}</th>
                    <th>{t('common.email', 'Email')}</th>
                    <th>{t('project.systemRole', 'Vai trò chung')}</th>
                    <th>{t('project.projectRole', 'Vai trò dự án')}</th>
                    <th>{t('common.status', 'Trạng thái')}</th>
                    {canManageProject && <th>{t('common.action', 'Hành động')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {pMembers.map(m => {
                    const u = users.find(usr => usr.id === m.user_id);
                    if (!u) return null;
                    return (
                      <tr key={m.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: u.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '600' }}>
                              {u.name.split(" ").pop().charAt(0)}
                            </div>
                            <span style={{ fontWeight: '500' }}>{u.name}</span>
                          </div>
                        </td>
                        <td>{u.email}</td>
                        <td>{formatSystemRole(u.system_role, t)}</td>
                        <td><span className={`badge ${m.project_role === 'PM' ? 'badge-info' : 'badge-success'}`}>{m.project_role}</span></td>
                        <td>
                          <span className={`badge ${m.status === 'PENDING' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '11px', padding: '3px 6px' }}>
                            {m.status === 'PENDING' ? 'PENDING' : 'JOINED'}
                          </span>
                        </td>
                        {canManageProject && (
                          <td>
                            {m.user_id !== currentUser.id ? (
                              <button className="btn btn-danger btn-sm" onClick={() => handleRemoveMember(m.user_id, u.name)}>
                                <i className="fa-solid fa-user-minus"></i> {t('common.delete', 'Xóa')}
                              </button>
                            ) : <span className="text-muted" style={{ fontSize: '11px' }}>{t('common.you', 'Bạn')}</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TABS: DOCUMENTS ================= */}
        {activeSubTab === 'documents' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600 }}>{t('project.projectDocuments', 'Tài liệu dự án')}</h3>
              <button className="btn btn-primary btn-sm" onClick={() => { setActiveDocId(null); setIsDocModalOpen(true); }}>
                <i className="fa-solid fa-upload"></i> {t('common.upload', 'Tải lên')}
              </button>
            </div>
            
            <div className="doc-main-panel" style={{ gap: '12px' }}>
              {documents.filter(d => d.project_id === projectId).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--neutral-muted)' }}>{t('project.noDocumentsYet', 'Chưa có tài liệu dự án nào.')}</div>
              ) : (
                documents
                  .filter(d => d.project_id === projectId)
                  .map(d => {
                    const u = users.find(usr => usr.id === d.uploaded_by);
                    const docVers = documentVersions.filter(v => v.document_id === d.id);
                    docVers.sort((a,b) => b.version_number - a.version_number);
                    const latest = docVers[0] || { version_number: 1, file_url: 'N/A', file_size: '0 KB' };
                    const date = new Date(d.created_at);
                    const dateStr = `${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`;

                    return (
                      <div className="document-item-card" key={d.id}>
                        <div className="doc-card-left">
                          <div className="doc-icon-box"><i className="fa-solid fa-file-pdf"></i></div>
                          <div className="doc-info-box">
                            <h3>{d.title}</h3>
                            <p>{t('project.uploadedBy', 'Tải lên bởi')}: <strong>{u ? u.name : 'N/A'}</strong> | {t('common.date', 'Ngày')}: {dateStr} | {t('project.phase', 'Giai đoạn')}: <strong>{d.project_phase || t('project.phaseGeneral', 'Chung')}</strong></p>
                            <div className="version-badge-container">
                              <span className="version-pill">{t('project.version', 'Phiên bản')} v{latest.version_number}</span>
                              <span className="text-muted">{latest.file_url} ({latest.file_size})</span>
                            </div>
                          </div>
                        </div>
                        <div className="doc-card-right">
                          <button className="btn btn-secondary btn-sm" onClick={() => handleDownloadDoc(latest)}><i className="fa-solid fa-download"></i> {t('common.download', 'Tải về')}</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => openDocVersion(d.id)}><i className="fa-solid fa-code-fork"></i> {t('project.newVersion', 'Bản mới')}</button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}

        {/* ================= TABS: CHAT ================= */}
        {activeSubTab === 'chat' && (
          <div className="card" style={{ height: '500px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="chat-main-area" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--neutral-bg-card)' }}>
              <div className="chat-area-header" style={{ borderTop: 'none', borderBottom: '1px solid var(--neutral-border)' }}>
                <div className="chat-header-info">
                  <h3>{t('project.generalDiscussion', 'Kênh thảo luận chung dự án')}</h3>
                </div>
                <div className="chat-header-actions">
                  <div className="chat-search-box">
                    <input type="text" value={chatSearchQuery} onChange={(e) => setChatSearchQuery(e.target.value)} placeholder={t('project.searchMessagePlaceholder', 'Tìm tin nhắn...')} />
                  </div>
                </div>
              </div>

              <div className="chat-messages-container" style={{ flex: 1, overflowY: 'auto', background: 'var(--neutral-bg-main)' }}>
                {chatMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--neutral-muted)' }}>{t('project.noMessagesYet', 'Chưa có tin nhắn thảo luận nào.')}</div>
                ) : (
                  chatMessages.map(m => {
                    const sender = users.find(usr => usr.id === m.sender_id) || { name: 'N/A', color: 'var(--neutral-muted)' };
                    const isSelf = m.sender_id === currentUser.id;
                    const date = new Date(m.created_at);
                    const timeStr = `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
                    return (
                      <div className={`chat-message-group ${isSelf ? 'self' : ''}`} key={m.id}>
                        <div className="chat-msg-avatar" style={{ backgroundColor: sender.color }}>
                          {sender.name.split(" ").pop().charAt(0)}
                        </div>
                        <div className="chat-msg-content-wrapper">
                          <div className="chat-msg-meta">
                            <span className="chat-msg-sender">{sender.name}</span>
                            <span className="chat-msg-time">{timeStr}</span>
                          </div>
                          <div className="chat-msg-bubble">
                            {m.content}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {typingUser && (
                  <div className="typing-indicator">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <span style={{ fontSize: '10px', color: 'var(--neutral-muted)', marginLeft: '6px' }}>{typingUser} {t('project.typingText', 'đang gõ...')}</span>
                  </div>
                )}
              </div>
              
              <form className="chat-input-area" onSubmit={handleSendMessage} style={{ borderTop: '1px solid var(--neutral-border)' }}>
                <div className="chat-input-wrapper">
                  <textarea 
                    ref={chatInputRef}
                    value={chatInput} 
                    onChange={handleChatInputChange} 
                    onKeyDown={handleKeyDown}
                    placeholder={t('project.inputMessagePlaceholder', 'Nhập tin nhắn... Gõ @ nhắc tên')} 
                    rows="1"
                  />
                  {mentionQuery !== null && (
                    <div className="mentions-popup" style={{ display: 'block' }}>
                      {mentionList.map(u => (
                        <div className="mention-user-option" onClick={() => selectMention(u)} key={u.id}>
                          <div className="men-avatar" style={{ backgroundColor: u.color }}>{u.name.split(" ").pop().charAt(0)}</div>
                          <span>{u.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="chat-input-actions">
                  <button type="submit" className="btn btn-primary btn-sm"><i className="fa-solid fa-paper-plane"></i> {t('common.send', 'Gửi')}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= TABS: REPORTS ================= */}
        {activeSubTab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>{t('project.projectReports', 'Báo cáo dự án')}</h3>
              <button type="button" onClick={() => setIsProjectReportModalOpen(true)} className="btn btn-primary btn-sm">
                <i className="fa-solid fa-plus"></i> {t('project.createProjectReport', 'Viết báo cáo mới')}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {isReportsLoading ? (
                <div className="flex-center" style={{ padding: '40px', flexDirection: 'column', backgroundColor: 'var(--neutral-bg-card)', borderRadius: '8px', border: '1px solid var(--neutral-border)' }}>
                  <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '24px', color: 'var(--primary-color)' }}></i>
                  <p style={{ marginTop: '10px', color: 'var(--neutral-muted)', fontSize: '13px' }}>{t('project.loadingReports', 'Đang tải báo cáo...')}</p>
                </div>
              ) : projectReports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'var(--neutral-bg-card)', borderRadius: '8px', border: '1px solid var(--neutral-border)', color: 'var(--neutral-muted)' }}>
                  <i className="fa-solid fa-folder-open" style={{ fontSize: '32px', marginBottom: '8px', display: 'block' }}></i>
                  {t('project.noReportsYet', 'Chưa có báo cáo nào liên kết với dự án này.')}
                </div>
              ) : (
                projectReports.map(report => {
                  const userColor = users.find(u => u.id === report.user_id)?.color || '#3b82f6';
                  return (
                    <div 
                      key={report.id} 
                      className="card" 
                      onClick={() => handleOpenProjectReportDetailModal(report)}
                      style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)', display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: userColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                            {report.user_name.split(' ').pop().charAt(0)}
                          </div>
                          <div>
                            <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--neutral-dark)', margin: 0 }}>
                              {report.user_name}
                            </h4>
                            <span style={{ fontSize: '11px', color: 'var(--neutral-muted)', fontWeight: '500' }}>
                              {report.user_role}
                            </span>
                          </div>
                        </div>
                        <span style={{ fontSize: '11.5px', color: 'var(--neutral-muted)' }}>
                          {new Date(report.created_at).toLocaleDateString('vi-VN')}
                        </span>
                      </div>

                      <div style={{ fontSize: '13.5px', color: 'var(--neutral-dark)', lineHeight: '1.6', backgroundColor: 'var(--neutral-bg-main)', padding: '12px', borderRadius: '6px', border: '1px solid var(--neutral-border)' }}>
                        {renderReportContentVisual(report.content, projects)}
                      </div>

                      {report.file_url && (
                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', display: 'flex', alignItems: 'center' }}>
                          <a 
                            href={report.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{ fontSize: '12px', color: 'var(--primary-color)', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', fontWeight: '500' }}
                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            <i className="fa-solid fa-paperclip"></i>
                            {t('project.viewAttachment', 'Xem tệp đính kèm')} tài liệu
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ================= MODAL: CREATE NEW PROJECT REPORT (75% Screen Width) ================= */}
      {isProjectReportModalOpen && (
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(15, 23, 42, 0.65)', 
            zIndex: 1250, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backdropFilter: 'blur(3px)',
            padding: '20px'
          }}
        >
          <div 
            style={{ 
              width: '75vw', 
              maxWidth: '1200px', 
              maxHeight: '90vh', 
              backgroundColor: 'var(--neutral-bg-card)', 
              borderRadius: '12px', 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', 
              display: 'flex', 
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--neutral-dark)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-file-circle-plus" style={{ color: 'var(--primary-color)' }}></i>
                {t('project.createProjectReportForProject', 'Viết báo cáo mới cho dự án')}
              </h3>
              <button
                type="button"
                onClick={() => setIsProjectReportModalOpen(false)}
                style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitProjectReport} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <label style={{ display: 'block', fontSize: '13.5px', fontWeight: '600', color: 'var(--neutral-dark)', marginBottom: '8px' }}>
                      {t('project.reporter', 'Người báo cáo:')}
                    </label>
                    <input
                      type="text"
                      disabled
                      value={`${currentUser?.full_name || currentUser?.name || 'Thành viên'} (${currentUser?.role || 'Thành viên'})`}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', fontWeight: '600', color: 'var(--neutral-muted)', fontSize: '13.5px' }}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <label style={{ display: 'block', fontSize: '13.5px', fontWeight: '600', color: 'var(--neutral-dark)', marginBottom: '8px' }}>
                      Dự án:
                    </label>
                    <input
                      type="text"
                      disabled
                      value={`[${project?.project_key || 'DỰ ÁN'}] ${project?.name || ''}`}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', fontWeight: '600', color: 'var(--neutral-muted)', fontSize: '13.5px' }}
                    />
                  </div>

                  <div style={{ width: '220px' }}>
                    <label style={{ display: 'block', fontSize: '13.5px', fontWeight: '600', color: 'var(--neutral-dark)', marginBottom: '8px' }}>
                      {t('project.reportDate', 'Ngày báo cáo:')}
                    </label>
                    <input
                      type="date"
                      value={projectReportDate}
                      onChange={(e) => setProjectReportDate(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--neutral-border)', outline: 'none', fontSize: '13.5px', fontWeight: '500' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--neutral-dark)', marginBottom: '8px' }}>
                    {t('project.reportDetailContent', 'Nội dung báo cáo chi tiết')} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    rows="9"
                    required
                    placeholder={t('project.reportContentPlaceholder', 'Nhập tiến độ công việc, các kết quả đạt được...')}
                    value={projectReportContent}
                    onChange={(e) => setProjectReportContent(e.target.value)}
                    style={{ width: '100%', padding: '14px', borderRadius: '6px', border: '1px solid var(--neutral-border)', outline: 'none', fontSize: '14px', lineHeight: '1.6', resize: 'vertical' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13.5px', fontWeight: '600', color: 'var(--neutral-dark)', marginBottom: '8px' }}>
                    {t('project.attachment', 'Tài liệu / Tệp đính kèm:')}
                  </label>
                  <input
                    type="file"
                    id="create-project-report-file-input"
                    style={{ display: 'none' }}
                    onChange={(e) => handleProjectReportFileUpload(e.target.files[0])}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => document.getElementById('create-project-report-file-input')?.click()}
                      style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '600' }}
                    >
                      <i className="fa-solid fa-paperclip" style={{ marginRight: '6px' }}></i> {t('project.selectAttachment', 'Chọn tệp đính kèm')}
                    </button>
                    {projectReportFileUrl && (
                      <a
                        href={projectReportFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '13px', color: 'var(--primary-color)', fontWeight: '600', backgroundColor: '#eff6ff', padding: '4px 12px', borderRadius: '16px', border: '1px solid #bfdbfe', textDecoration: 'none' }}
                      >
                        <i className="fa-solid fa-file" style={{ marginRight: '6px' }}></i> {projectReportFileName || 'Xem tệp đính kèm'}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', padding: '16px 24px', borderTop: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsProjectReportModalOpen(false)}
                  disabled={isSubmittingProjectReport}
                  style={{ padding: '10px 20px', fontSize: '13.5px', fontWeight: '600' }}
                >
                  {t('common.cancel', 'Hủy')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingProjectReport}
                  style={{ padding: '10px 24px', fontSize: '13.5px', fontWeight: '600' }}
                >
                  {isSubmittingProjectReport ? (
                    <><i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: '6px' }}></i> {t('common.submitting', 'Đang gửi...')}</>
                  ) : (
                    <><i className="fa-solid fa-paper-plane" style={{ marginRight: '6px' }}></i> {t('project.sendReport', 'Gửi báo cáo')}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DETAIL & EDIT PROJECT REPORT (75% Screen Width) ================= */}
      {isProjectReportDetailModalOpen && activeProjectReportDetail && (
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(15, 23, 42, 0.65)', 
            zIndex: 1250, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backdropFilter: 'blur(3px)',
            padding: '20px'
          }}
        >
          <div 
            style={{ 
              width: '75vw', 
              maxWidth: '1200px', 
              maxHeight: '90vh', 
              backgroundColor: 'var(--neutral-bg-card)', 
              borderRadius: '12px', 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', 
              display: 'flex', 
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--neutral-dark)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-file-lines" style={{ color: 'var(--primary-color)' }}></i>
                {t('project.projectReportDetailAndEdit', 'Chi tiết & Chỉnh sửa Báo cáo dự án')}
              </h3>
              <button
                type="button"
                onClick={() => setIsProjectReportDetailModalOpen(false)}
                style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveProjectReport} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <label style={{ display: 'block', fontSize: '13.5px', fontWeight: '600', color: 'var(--neutral-dark)', marginBottom: '8px' }}>
                      {t('project.reporter', 'Người báo cáo:')}
                    </label>
                    <input
                      type="text"
                      disabled
                      value={`${activeProjectReportDetail.user_name} (${activeProjectReportDetail.user_role || 'Thành viên'})`}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', fontWeight: '600', color: 'var(--neutral-muted)', fontSize: '13.5px' }}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <label style={{ display: 'block', fontSize: '13.5px', fontWeight: '600', color: 'var(--neutral-dark)', marginBottom: '8px' }}>
                      Dự án:
                    </label>
                    <input
                      type="text"
                      disabled
                      value={`[${project?.project_key || 'DỰ ÁN'}] ${project?.name || ''}`}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', fontWeight: '600', color: 'var(--neutral-muted)', fontSize: '13.5px' }}
                    />
                  </div>

                  <div style={{ width: '220px' }}>
                    <label style={{ display: 'block', fontSize: '13.5px', fontWeight: '600', color: 'var(--neutral-dark)', marginBottom: '8px' }}>
                      Ngày báo cáo:
                    </label>
                    <input
                      type="date"
                      value={editProjectReportDate}
                      onChange={(e) => setEditProjectReportDate(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--neutral-border)', outline: 'none', fontSize: '13.5px', fontWeight: '500' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--neutral-dark)', marginBottom: '8px' }}>
                    Nội dung báo cáo chi tiết <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    rows="9"
                    required
                    placeholder="Nhập tiến độ công việc, các kết quả đạt được..."
                    value={editProjectReportContent}
                    onChange={(e) => setEditProjectReportContent(e.target.value)}
                    style={{ width: '100%', padding: '14px', borderRadius: '6px', border: '1px solid var(--neutral-border)', outline: 'none', fontSize: '14px', lineHeight: '1.6', resize: 'vertical' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13.5px', fontWeight: '600', color: 'var(--neutral-dark)', marginBottom: '8px' }}>
                    Tài liệu / Tệp đính kèm:
                  </label>
                  <input
                    type="file"
                    id="edit-project-report-file-input"
                    style={{ display: 'none' }}
                    onChange={(e) => handleEditProjectReportFileUpload(e.target.files[0])}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => document.getElementById('edit-project-report-file-input')?.click()}
                      style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '600' }}
                    >
                      <i className="fa-solid fa-paperclip" style={{ marginRight: '6px' }}></i> {t('project.changeAttachment', 'Thay đổi tệp đính kèm')}
                    </button>
                    {editProjectReportFileUrl && (
                      <a
                        href={editProjectReportFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '13px', color: 'var(--primary-color)', fontWeight: '600', backgroundColor: '#eff6ff', padding: '4px 12px', borderRadius: '16px', border: '1px solid #bfdbfe', textDecoration: 'none' }}
                      >
                        <i className="fa-solid fa-file" style={{ marginRight: '6px' }}></i> {editProjectReportFileName || 'Xem tệp đính kèm'}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)' }}>
                <button
                  type="button"
                  onClick={handleDeleteProjectReport}
                  disabled={isDeletingProjectReport || isSavingProjectReport}
                  style={{ 
                    padding: '10px 20px', 
                    fontSize: '13.5px', 
                    fontWeight: '600',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isDeletingProjectReport ? (
                    <><i className="fa-solid fa-circle-notch fa-spin"></i> {t('common.deleting', 'Đang xóa...')}</>
                  ) : (
                    <><i className="fa-solid fa-trash-can"></i> {t('project.deleteReport', 'Xóa báo cáo này')}</>
                  )}
                </button>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsProjectReportDetailModalOpen(false)}
                    disabled={isSavingProjectReport || isDeletingProjectReport}
                    style={{ padding: '10px 20px', fontSize: '13.5px', fontWeight: '600' }}
                  >
                    {t('common.cancel', 'Hủy')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSavingProjectReport || isDeletingProjectReport}
                    style={{ padding: '10px 24px', fontSize: '13.5px', fontWeight: '600' }}
                  >
                    {isSavingProjectReport ? (
                      <><i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: '6px' }}></i> {t('common.saving', 'Đang lưu...')}</>
                    ) : (
                      <><i className="fa-solid fa-floppy-disk" style={{ marginRight: '6px' }}></i> {t('common.saveChanges', 'Lưu thay đổi')}</>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Issues Creation Modal */}
      {isIssueModalOpen && (
        <div className="modal show" style={{ display: 'flex' }}>
          <div className="modal-dialog create-issue-dialog" style={{ width: '75vw', maxWidth: '75vw', height: '75vh', maxHeight: '75vh' }}>
            <div className="modal-content" style={{ height: '100%' }}>
              <div className="modal-header">
                <h3>{t('issues.createIssueTitle', 'Báo cáo vấn đề mới (Tạo Issue)')}</h3>
                <button className="btn-close-modal" onClick={() => setIsIssueModalOpen(false)}><i className="fa-solid fa-xmark"></i></button>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!issueTitle.trim()) return;
                
                if (!jiraCreateDeadline) {
                  Swal.fire({ icon: 'warning', title: t('common.warning', 'Cảnh báo'), text: t('issues.deadlineRequiredAlert', 'Vui lòng gắn Hạn chót (Deadline) cho Issue!') });
                  return;
                }
                if (jiraCreateAssigneeIds.length === 0) {
                  Swal.fire({ icon: 'warning', title: t('common.warning', 'Cảnh báo'), text: t('issues.assigneeRequiredAlert', 'Vui lòng chọn Người chịu trách nhiệm cho Issue!') });
                  return;
                }
                // Validate subtasks
                const subTaskCheck = validateSubTasks(projectTasks);
                if (!subTaskCheck.valid) {
                  Swal.fire({ icon: 'warning', title: t('issues.incompleteInfo', 'Thông tin chưa đầy đủ'), text: subTaskCheck.message });
                  return;
                }

                if (issueStatus === 'DONE') {
                  if (!jiraCreateHienTrang.trim() || !jiraCreateNguyenNhan.trim() || !jiraCreateHuongGiaiQuyet.trim() || !jiraCreateKetQua.trim()) {
                    Swal.fire({ icon: 'warning', title: t('common.warning', 'Cảnh báo'), text: t('issues.doneCreateValidationMessage', 'Lỗi: Chỉ khi cả 4 mục (Hiện trạng, Nguyên nhân, Hướng giải quyết, Kết quả) đều có thông tin mới có thể tạo Issue ở trạng thái DONE!') });
                    return;
                  }
                }

                try {
                  const selectedUsers = users.filter(u => jiraCreateAssigneeIds.includes(u.id));
                  const calculatedAssigneesText = selectedUsers.map(u => `@${u.name}`).join(' ') + (selectedUsers.length > 0 ? ' ' : '');

                  const serializedDescription = JSON.stringify({
                    text: issueDesc,
                    hientrang: jiraCreateHienTrang,
                    nguyennhan: jiraCreateNguyenNhan,
                    huonggiaiquyet: jiraCreateHuongGiaiQuyet,
                    ketqua: jiraCreateKetQua,
                    deadline: jiraCreateDeadline,
                    issueTasks: projectTasks,
                    assigneesText: calculatedAssigneesText,
                    relatedUserIds: jiraCreateAssigneeIds
                  });

                  const newIssue = await db.createIssue({
                    project_id: projectId,
                    summary: issueTitle,
                    description: serializedDescription,
                    type: issueType,
                    status: issueStatus,
                    priority: issuePriority,
                    reporter_id: currentUser.id,
                    assignee_id: jiraCreateAssigneeIds[0] || null
                  });

                  await db.logActivity(currentUser.id, "CREATE_ISSUE", "Issue", `iss-${Date.now()}`, `đã báo cáo issue mới '${issueTitle}'`);

                  if (newIssue && newIssue.issue_key) {
                    await notifyMentionedUsers(calculatedAssigneesText, newIssue.issue_key, issueTitle, newIssue.id);
                    await notifyMentionedUsersInGrid(projectTasks, newIssue.issue_key, issueTitle, newIssue.id);
                  }
                  
                  loadIssues();
                  setIssueTitle('');
                  setIssueDesc('');
                  setProjectTasks([]);
                  setIssueAssigneesText('');
                  setIssueType('TASK');
                  setIssueStatus('TO_DO');
                  setIssuePriority('MEDIUM');
                  setIssueAssigneeId('');
                  setJiraCreateAssigneeIds([]);
                  setJiraCreateDeadline('');
                  setJiraCreateHienTrang('');
                  setJiraCreateNguyenNhan('');
                  setJiraCreateHuongGiaiQuyet('');
                  setJiraCreateKetQua('');
                  setIsIssueModalOpen(false);
                  Swal.fire({ icon: 'success', title: 'Thành công', text: "Đã tạo issue mới thành công!" });
                } catch (err) {
                  Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi tạo issue: " + err.message });
                }
              }}>
                <div className="modal-body create-issue-modal-body">
                  {/* Left Column: Fields */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="form-group">
                      <label>{t('issues.summaryLabel', 'Tiêu đề tóm tắt (Summary)')} <span className="required">*</span></label>
                      <input type="text" value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} required placeholder={t('issues.summaryPlaceholder', 'Ví dụ: Thiết kế giao diện thanh toán...')} style={{ width: '100%' }} />
                    </div>
                     <div className="form-group">
                       <label>{t('issues.deadlineLabel', 'Hạn chót (Deadline)')} <span className="required">*</span></label>
                       <input type="date" value={jiraCreateDeadline} onChange={(e) => setJiraCreateDeadline(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', outline: 'none' }} />
                     </div>

                     <div className="form-group">
                       <label>{t('issues.currentStatusLabel', 'Hiện trạng')}</label>
                       <textarea value={jiraCreateHienTrang} onChange={(e) => setJiraCreateHienTrang(e.target.value)} placeholder={t('issues.currentStatusPlaceholder', 'Nhập hiện trạng...')} rows="2" style={{ width: '100%', minHeight: '50px' }} />
                     </div>

                      <div className="form-group" style={{ marginTop: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setTempNguyenNhan(jiraCreateNguyenNhan);
                            setTempHuongGiaiQuyet(jiraCreateHuongGiaiQuyet);
                            setTempKetQua(jiraCreateKetQua);
                            setReportModalSource('create');
                            setIsReportPopupOpen(true);
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px', width: '100%', justifyContent: 'center' }}
                        >
                          <i className="fa-solid fa-file-invoice"></i> {t('issues.detailedReport', 'Báo cáo chi tiết')}
                        </button>
                      </div>

                    
                    <div className="form-group">
                      <label>{t('issues.priorityLabel', 'Độ ưu tiên (Priority)')}</label>
                      <select value={issuePriority} onChange={(e) => setIssuePriority(e.target.value)} className="doc-select-filter" style={{ width: '100%', height: '36px' }}>
                        <option value="LOW">{t('issues.priorityLow', 'LOW (Thấp)')}</option>
                        <option value="MEDIUM">{t('issues.priorityMedium', 'MEDIUM (Trung bình)')}</option>
                        <option value="HIGH">{t('issues.priorityHigh', 'HIGH (Cao)')}</option>
                        <option value="CRITICAL">{t('issues.priorityCritical', 'CRITICAL (Khẩn cấp)')}</option>
                      </select>
                    </div>



                    <div className="form-group">
                      <label>{t('issues.involvedMembers', 'Thành viên liên quan')}</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                        <select 
                          value={jiraCreateAssigneeSelectedDept} 
                          onChange={(e) => setJiraCreateAssigneeSelectedDept(e.target.value)} 
                          style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', fontSize: '12px', outline: 'none' }}
                        >
                          <option value="">{t('task.allDepartments', 'Tất cả phòng ban')}</option>
                          {departments.map(dept => (
                            <option key={dept.department_id} value={dept.department_id}>{dept.name}</option>
                          ))}
                        </select>
                        <input 
                          type="text" 
                          placeholder="Tìm kiếm thành viên..." 
                          value={jiraCreateAssigneeSearchQuery} 
                          onChange={(e) => setJiraCreateAssigneeSearchQuery(e.target.value)} 
                          style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', fontSize: '12px', outline: 'none' }}
                        />
                      </div>
                      <div className="project-members-selector-list" style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid var(--neutral-border)', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--neutral-bg-card)' }}>
                        {filteredCreateAssignees.length === 0 ? (
                          <div style={{ padding: '8px', color: 'var(--neutral-muted)', fontSize: '12px', textAlign: 'center' }}>{t('issues.noMembersFound', 'Không tìm thấy nhân viên phù hợp')}</div>
                        ) : (
                          filteredCreateAssignees.map(m => {
                            const isChecked = jiraCreateAssigneeIds.includes(m.id);
                            return (
                              <div className="member-select-row" key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
                                <div className="member-select-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <input 
                                    type="checkbox" 
                                    id={`jira-create-assignee-check-${m.id}`} 
                                    checked={isChecked} 
                                    onChange={() => {
                                      if (isChecked) {
                                        setJiraCreateAssigneeIds(prev => prev.filter(id => id !== m.id));
                                      } else {
                                        setJiraCreateAssigneeIds(prev => [...prev, m.id]);
                                      }
                                    }}
                                  />
                                  <label htmlFor={`jira-create-assignee-check-${m.id}`} style={{ cursor: 'pointer', margin: 0, fontSize: '13px' }}>
                                    {m.name} ({m.employee_id || 'N/A'}) - {translateDepartmentName(m.department_name, t)} ({m.project_role || 'Member'})
                                  </label>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Grid Table */}
                  <div className="create-issue-table-col" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ fontWeight: '600', fontSize: '13.5px', color: 'var(--neutral-muted)' }}>{t('issues.tasksTableTitle', 'Bảng chi tiết công việc')}</label>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--neutral-border)', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#135274', color: '#ffffff' }}>
                          <th style={{ padding: '10px', border: '1px solid var(--neutral-border)', textAlign: 'left', width: '35%', fontWeight: '700' }}>{t('issues.taskNameColumn', 'Tên công việc')}</th>
                          <th style={{ padding: '10px', border: '1px solid var(--neutral-border)', textAlign: 'left', width: '20%', fontWeight: '700' }}>{t('issues.deadlineColumn', 'Deadline')}</th>
                          <th style={{ padding: '10px', border: '1px solid var(--neutral-border)', textAlign: 'left', width: '25%', fontWeight: '700' }}>{t('issues.assigneeColumn', 'Người thực hiện')}</th>
                          <th style={{ padding: '10px', border: '1px solid var(--neutral-border)', textAlign: 'left', width: '20%', fontWeight: '700' }}>{t('issues.statusColumn', 'Trạng thái')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectTasks.map(row => (
                          <tr key={row.id}>
                            <td style={{ padding: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                  type="text"
                                  value={row.name}
                                  onChange={(e) => handleIssueTaskChange(row.id, 'name', e.target.value)}
                                  placeholder="Công việc..."
                                  style={{ flex: 1, border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', padding: '6px', borderRadius: '4px', outline: 'none', fontSize: '13px' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleOpenTaskPopup(row)}
                                  title={t('issues.viewSolutionTitle', 'Xem & sửa nội dung chi tiết/solution')}
                                  style={{ border: 'none', background: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '15px', padding: '2px' }}
                                >
                                  <i className="fa-solid fa-circle-info"></i>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveIssueTaskRow(row.id)}
                                  title={t('issues.deleteTaskTitle', 'Xóa công việc')}
                                  style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px', padding: '2px' }}
                                >
                                  <i className="fa-solid fa-trash"></i>
                                </button>
                              </div>
                            </td>
                            <td style={{ padding: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)' }}>
                              <input
                                type="date"
                                value={formatDateForInput(row.deadline) || ''}
                                onChange={(e) => handleIssueTaskChange(row.id, 'deadline', e.target.value)}
                                style={{ width: '100%', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', padding: '6px', borderRadius: '4px', outline: 'none', fontSize: '12.5px' }}
                              />
                            </td>
                            <td style={{ padding: '6px', border: '1px solid var(--neutral-border)', position: 'relative' }}>
                              <input
                                id={`grid-assignee-create-${row.id}`}
                                type="text"
                                value={getPerformerForTask(row)}
                                readOnly={true}
                                placeholder="Chưa gán..."
                                style={{ width: '100%', border: '1px solid var(--neutral-border)', padding: '6px', borderRadius: '4px', outline: 'none', fontSize: '13px', backgroundColor: 'var(--neutral-bg-main)', cursor: 'not-allowed' }}
                              />
                            </td>
                            <td style={{ padding: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)', textAlign: 'center', verticalAlign: 'middle' }}>
                              <span style={{ 
                                display: 'inline-block',
                                padding: '4px 8px', 
                                borderRadius: '4px', 
                                fontSize: '12px', 
                                fontWeight: '600', 
                                backgroundColor: row.status === 'Hoàn thành' ? 'var(--success-light)' : row.status === 'Đang thực hiện' ? 'var(--warning-light)' : 'var(--neutral-bg-hover)',
                                color: row.status === 'Hoàn thành' ? 'var(--success-color)' : row.status === 'Đang thực hiện' ? 'var(--warning-color)' : 'var(--neutral-dark)'
                              }}>
                                {row.status === 'Hoàn thành' ? t('issues.done', 'Hoàn thành') : row.status === 'Đang thực hiện' ? t('issues.inprogress', 'Đang thực hiện') : t('issues.todo', 'Chưa thực hiện')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ display: 'flex', marginTop: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleAddIssueTaskRow}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '50%', width: '32px', height: '32px', padding: 0, justifyContent: 'center', fontSize: '16px', fontWeight: 'bold' }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '15px 20px', borderTop: '1px solid var(--neutral-border)' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsIssueModalOpen(false)}>{t('common.cancel', 'Hủy')}</button>
                  <button type="submit" className="btn btn-primary">{t('common.create', 'Tạo mới')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* JIRA Issue Detail Modal */}
      {isDetailModalOpen && activeIssueDetail && (
        <div className="modal show" style={{ display: 'flex' }}>
          <div className="modal-dialog" style={{ maxWidth: 'none', width: '100vw', height: '100vh', maxHeight: '100vh', margin: 0, borderRadius: 0 }}>
            <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="modal-header" style={{ padding: '16px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', backgroundColor: '#e2e8f0', padding: '2px 8px', borderRadius: '4px' }}>
                    {activeIssueDetail.issue_key}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>{t('issues.issueDetail', 'Chi tiết Issue')}</h3>
                </div>
                <button className="btn-close-modal" onClick={handleCloseIssueDetail} style={{ fontSize: '24px', cursor: 'pointer' }}><i className="fa-solid fa-xmark"></i></button>
              </div>
              <div className="modal-body issue-detail-modal-body" style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '30px', flex: 1, maxHeight: 'none', overflowY: 'auto', padding: '24px 32px' }}>
                
                {isLockedByOther && (
                  <div style={{
                    gridColumn: 'span 2',
                    backgroundColor: 'var(--warning-light)',
                    border: '1px solid var(--warning-color)',
                    borderRadius: '6px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: 'var(--warning-color)',
                    fontSize: '13.5px',
                    fontWeight: '500'
                  }}>
                    <i className="fa-solid fa-lock" style={{ fontSize: '16px', color: 'var(--warning-color)' }}></i>
                    <span>
                      {lockOwnerName.startsWith('Chế độ')
                        ? t('issues.readOnlyAlert', 'Bạn không có quyền chỉnh sửa Issue này. Chế độ xem chỉ đọc (Read-only).')
                        : t('issues.lockedByOtherAlert', 'Thẻ này đang được chỉnh sửa bởi {lockOwnerName}. Chế độ xem chỉ đọc (Read-only).').replace('{lockOwnerName}', lockOwnerName)}
                    </span>
                  </div>
                )}

                {/* Left Column: Summary, Description, Comments */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--neutral-dark)', marginBottom: '8px' }}>{activeIssueDetail.summary}</h2>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="form-group">
                      <label style={{ fontWeight: '600', fontSize: '13px', display: 'block', marginBottom: '6px', color: 'var(--neutral-dark)' }}>{t('issues.currentStatusLabel', 'Hiện trạng')}</label>
                      <textarea
                        value={jiraDetailHienTrang}
                        onChange={(e) => setJiraDetailHienTrang(e.target.value)}
                        placeholder={t('issues.currentStatusPlaceholder', 'Nhập hiện trạng...')}
                        disabled={isLockedByOther}
                        rows="2"
                        style={{ width: '100%', minHeight: '60px', padding: '8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', outline: 'none', fontSize: '13.5px', resize: 'vertical' }}
                      />
                    </div>

                    <div className="form-group" style={{ marginTop: '4px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={isLockedByOther}
                        onClick={() => {
                          if (!isLockedByOther) {
                            setTempNguyenNhan(jiraDetailNguyenNhan);
                            setTempHuongGiaiQuyet(jiraDetailHuongGiaiQuyet);
                            setTempKetQua(jiraDetailKetQua);
                            setReportModalSource('detail');
                            setIsReportPopupOpen(true);
                          }
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px', width: '100%', justifyContent: 'center', opacity: isLockedByOther ? 0.6 : 1, cursor: isLockedByOther ? 'not-allowed' : 'pointer' }}
                      >
                        <i className="fa-solid fa-file-invoice"></i> {t('issues.detailedReport', 'Báo cáo chi tiết')}
                      </button>
                    </div>
                  </div>

                  {/* Grid Table in Details Modal */}
                  <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '16px' }}>
                    <label style={{ fontWeight: '600', fontSize: '13.5px', display: 'block', marginBottom: '10px', color: 'var(--neutral-dark)' }}>{t('issues.tasksTableTitle', 'Bảng chi tiết công việc')}</label>
                    <table className="mobile-stack-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--neutral-border)', fontSize: '13px', marginBottom: '10px', color: 'var(--neutral-dark)' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#135274', color: '#ffffff' }}>
                          <th style={{ padding: '10px', border: '1px solid var(--neutral-border)', textAlign: 'center', width: '35%', fontWeight: '700' }}>{t('issues.taskNameColumn', 'Tên công việc')}</th>
                          <th style={{ padding: '10px', border: '1px solid var(--neutral-border)', textAlign: 'center', width: '10%', fontWeight: '700' }}>{t('issues.deadlineColumn', 'Deadline')}</th>
                          <th style={{ padding: '10px', border: '1px solid var(--neutral-border)', textAlign: 'center', width: '25%', fontWeight: '700' }}>{t('issues.assignedColumn', 'Người được giao')}</th>
                          <th style={{ padding: '10px', border: '1px solid var(--neutral-border)', textAlign: 'center', width: '15%', fontWeight: '700' }}>{t('issues.executorColumn', 'Người thực hiện')}</th>
                          <th style={{ padding: '10px', border: '1px solid var(--neutral-border)', textAlign: 'center', width: '15%', fontWeight: '700' }}>{t('issues.statusColumn', 'Trạng thái')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectTasks.map(row => (
                          <tr key={row.id}>
                            <td data-label={t('issues.taskNameColumn', 'Tên công việc')} style={{ padding: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                  type="text"
                                  value={row.name}
                                  onChange={(e) => handleIssueTaskChange(row.id, 'name', e.target.value)}
                                  placeholder={t('issues.taskPlaceholder', 'Công việc...')}
                                  disabled={isLockedByOther}
                                  style={{ flex: 1, border: '1px solid var(--neutral-border)', padding: '6px', borderRadius: '4px', outline: 'none', fontSize: '13px' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleOpenTaskPopup(row)}
                                  title="Xem & sửa nội dung chi tiết/solution"
                                  style={{ border: 'none', background: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '15px', padding: '2px' }}
                                >
                                  <i className="fa-solid fa-circle-info"></i>
                                </button>
                                <button
                                  type="button"
                                  disabled={isLockedByOther}
                                  onClick={() => { if (!isLockedByOther) handleRemoveIssueTaskRow(row.id); }}
                                  title="Xóa công việc"
                                  style={{ border: 'none', background: 'none', color: '#ef4444', cursor: isLockedByOther ? 'not-allowed' : 'pointer', opacity: isLockedByOther ? 0.5 : 1, fontSize: '13px', padding: '2px' }}
                                >
                                  <i className="fa-solid fa-trash"></i>
                                </button>
                              </div>
                            </td>
                            <td data-label={t('issues.deadlineColumn', 'Deadline')} style={{ padding: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)' }}>
                              <input
                                type="date"
                                value={formatDateForInput(row.deadline) || ''}
                                onChange={(e) => handleIssueTaskChange(row.id, 'deadline', e.target.value)}
                                disabled={isLockedByOther}
                                style={{ width: '100%', border: '1px solid var(--neutral-border)', padding: '6px', borderRadius: '4px', outline: 'none', fontSize: '12.5px' }}
                              />
                            </td>
                            <td data-label={t('issues.assignedColumn', 'Người được giao')} style={{ padding: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)', position: 'relative', verticalAlign: 'top' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {(() => {
                                  const assignedNames = row.assignee ? row.assignee.split('@').map(s => s.trim()).filter(Boolean) : [];
                                  return (
                                    <>
                                      {assignedNames.map(name => (
                                        <div 
                                          key={name}
                                          className="assigned-member-tag"
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '3px 8px',
                                            borderRadius: '4px',
                                            backgroundColor: 'var(--neutral-bg-hover)',
                                            border: '1px solid var(--neutral-border)',
                                            fontSize: '12px',
                                            lineHeight: '1.4',
                                            color: 'var(--neutral-dark)'
                                          }}
                                        >
                                          <span>@{name}</span>
                                          {!isLockedByOther && (
                                            <button
                                              type="button"
                                              className="remove-tag-btn"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const currentTags = row.assignee ? row.assignee.split('@').map(s => s.trim()).filter(Boolean) : [];
                                                const newTags = currentTags.filter(t => t !== name);
                                                handleIssueTaskChange(row.id, 'assignee', newTags.map(t => `@${t}`).join(' '));
                                              }}
                                              style={{
                                                border: 'none',
                                                background: 'none',
                                                color: '#94a3b8',
                                                cursor: 'pointer',
                                                padding: '0 4px',
                                                fontSize: '13px',
                                                lineHeight: '1',
                                                display: 'none',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderRadius: '50%',
                                                marginLeft: '6px',
                                                width: '16px',
                                                height: '16px',
                                                transition: 'all 0.15s ease'
                                              }}
                                            >
                                              &times;
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                      
                                      <button
                                        type="button"
                                        disabled={isLockedByOther}
                                        onClick={() => {
                                          if (!isLockedByOther) {
                                            setOpenAssigneeDropdownId(openAssigneeDropdownId === row.id ? null : row.id);
                                          }
                                        }}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          border: '1px dashed var(--neutral-border)',
                                          padding: '3px 8px',
                                          borderRadius: '4px',
                                          background: 'var(--neutral-bg-card)',
                                          color: 'var(--neutral-dark)',
                                          fontSize: '11.5px',
                                          cursor: isLockedByOther ? 'not-allowed' : 'pointer',
                                          width: 'fit-content',
                                          marginTop: '2px',
                                          fontWeight: '500'
                                        }}
                                      >
                                        <i className="fa-solid fa-plus" style={{ fontSize: '9px' }}></i>
                                        {assignedNames.length === 0 ? t('issues.selectMember', 'Chọn thành viên') : t('issues.add', 'Thêm')}
                                      </button>
                                    </>
                                  );
                                })()}
                                
                                {openAssigneeDropdownId === row.id && (
                                  <>
                                    <div 
                                      onClick={() => setOpenAssigneeDropdownId(null)}
                                      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                                    />
                                    <div
                                      style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        backgroundColor: 'var(--neutral-bg-card)',
                                        border: '1px solid var(--neutral-border)',
                                        borderRadius: '4px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                        zIndex: 1000,
                                        maxHeight: '180px',
                                        overflowY: 'auto',
                                        padding: '4px 0',
                                        marginTop: '2px'
                                      }}
                                    >
                                      {users.filter(u => issueAssigneeIds.includes(u.id)).length === 0 ? (
                                        <div style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--neutral-muted)' }}>
                                          {t('issues.noRelatedMembersYet', 'Chưa có thành viên liên quan')}
                                        </div>
                                      ) : (
                                        users.filter(u => issueAssigneeIds.includes(u.id)).map(u => {
                                          const currentTags = row.assignee ? row.assignee.split('@').map(s => s.trim()).filter(Boolean) : [];
                                          const isChecked = currentTags.includes(u.name.trim());
                                          
                                          return (
                                            <div
                                              key={u.id}
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '6px 12px',
                                                cursor: 'pointer',
                                                fontSize: '12.5px',
                                                color: 'var(--neutral-dark)'
                                              }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                let newTags;
                                                if (isChecked) {
                                                  newTags = currentTags.filter(t => t !== u.name.trim());
                                                } else {
                                                  newTags = [...currentTags, u.name.trim()];
                                                }
                                                handleIssueTaskChange(row.id, 'assignee', newTags.map(t => `@${t}`).join(' '));
                                              }}
                                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--neutral-bg-hover)'}
                                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={isChecked}
                                                readOnly
                                                style={{ pointerEvents: 'none' }}
                                              />
                                              <span>{u.name}</span>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                            <td data-label={t('issues.executorColumn', 'Người thực hiện')} style={{ padding: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)', verticalAlign: 'top' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {(() => {
                                  const executors = row.solutions
                                    ? row.solutions
                                        .filter(s => s.action?.trim() && s.executor?.trim())
                                        .map(s => s.executor.trim())
                                    : [];
                                  const uniqueExecutors = Array.from(new Set(executors));
                                  if (uniqueExecutors.length === 0) {
                                    return <span style={{ color: 'var(--neutral-muted)', fontSize: '13px' }}>{t('issues.unassigned', 'Chưa gán...')}</span>;
                                  }
                                  return uniqueExecutors.map(name => (
                                    <div 
                                      key={name}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '3px 8px',
                                        borderRadius: '4px',
                                        backgroundColor: 'var(--neutral-bg-hover)',
                                        border: '1px solid var(--neutral-border)',
                                        fontSize: '12px',
                                        lineHeight: '1.4',
                                        color: 'var(--neutral-dark)'
                                      }}
                                    >
                                      @{name.startsWith('@') ? name.slice(1) : name}
                                    </div>
                                  ));
                                })()}
                              </div>
                            </td>
                            <td data-label={t('issues.statusColumn', 'Trạng thái')} style={{ padding: '6px', border: '1px solid var(--neutral-border)', textAlign: 'center', verticalAlign: 'middle' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: '600',
                                backgroundColor: row.status === 'Hoàn thành' ? '#e2fbe8' : row.status === 'Đang thực hiện' ? '#fff3cd' : '#f1f5f9',
                                color: row.status === 'Hoàn thành' ? '#0f5132' : row.status === 'Đang thực hiện' ? '#664d03' : '#475569'
                              }}>
                                {row.status === 'Hoàn thành' ? t('issues.done', 'Hoàn thành') : row.status === 'Đang thực hiện' ? t('issues.inprogress', 'Đang thực hiện') : t('issues.todo', 'Chưa thực hiện')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={isLockedByOther}
                        onClick={handleAddIssueTaskRow}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)', color: 'var(--neutral-dark)', borderRadius: '50%', width: '32px', height: '32px', padding: 0, justifyContent: 'center', fontSize: '16px', fontWeight: 'bold', cursor: isLockedByOther ? 'not-allowed' : 'pointer', opacity: isLockedByOther ? 0.6 : 1 }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Comments section */}
                  <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '16px' }}>
                    <h4 style={{ fontWeight: '600', fontSize: '14px', marginBottom: '12px' }}>{t('issues.commentsTitle', 'Bình luận')} ({issueComments.length})</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                      {issueComments.map(comm => (
                        <div key={comm.id} style={{ display: 'flex', gap: '10px', padding: '8px', backgroundColor: 'var(--neutral-bg-hover)', borderRadius: '6px', border: '1px solid var(--neutral-border)' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700', lineHeight: '24px' }}>
                            {comm.user_name ? comm.user_name.split(' ').pop().charAt(0) : '?'}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                              <span style={{ fontWeight: '600', fontSize: '12px' }}>{comm.user_name || 'Người dùng'}</span>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: 'var(--neutral-muted)' }}>
                                  {new Date(comm.created_at).toLocaleString('vi-VN')}
                                </span>
                                {(comm.user_id === currentUser.id || isAdmin) && (
                                  <button 
                                    onClick={() => handleDeleteComment(comm.id)}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px', padding: 0 }}
                                  >
                                    {t('common.delete', 'Xóa')}
                                  </button>
                                )}
                              </div>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--neutral-dark)', margin: 0 }}>{comm.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        placeholder={isLockedByOther ? t('issues.noCommentPermission', 'Bạn không có quyền bình luận...') : t('issues.writeComment', 'Viết bình luận...')} 
                        value={newCommentText} 
                        onChange={(e) => setNewCommentText(e.target.value)} 
                        disabled={isLockedByOther}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '13px', outline: 'none', backgroundColor: isLockedByOther ? 'var(--neutral-bg-hover)' : 'var(--neutral-bg-main)', color: 'var(--neutral-dark)' }}
                      />
                      <button type="submit" className="btn btn-primary btn-sm" disabled={isLockedByOther}>{t('common.send', 'Gửi')}</button>
                    </form>
                  </div>

                  {/* History Activity logs */}
                  <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '16px' }}>
                    <h4 style={{ fontWeight: '600', fontSize: '14px', marginBottom: '10px' }}>{t('issues.activityHistory', 'Lịch sử hoạt động')}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                      {issueHistory.map(hist => {
                        const renderAction = () => {
                          if (hist.field_changed === 'created') {
                            return <span>{t('issues.reportedBug', 'đã báo cáo lỗi')} ({hist.new_value || ''})</span>;
                          }
                          if (hist.field_changed === 'description') {
                            return <span>{t('issues.updatedReportDetails', 'đã cập nhật thông tin chi tiết/báo cáo')}</span>;
                          }
                          
                          let fieldLabel = hist.field_changed;
                          if (hist.field_changed === 'status') fieldLabel = 'trạng thái';
                          else if (hist.field_changed === 'priority') fieldLabel = 'độ ưu tiên';
                          else if (hist.field_changed === 'assignee_id') fieldLabel = 'người chịu trách nhiệm';
                          else if (hist.field_changed === 'summary') fieldLabel = 'tiêu đề';

                          let oldVal = hist.old_value;
                          let newVal = hist.new_value;
                          if (hist.field_changed === 'assignee_id') {
                            oldVal = users.find(u => u.id === hist.old_value)?.name || hist.old_value;
                            newVal = users.find(u => u.id === hist.new_value)?.name || hist.new_value;
                          }

                          return (
                            <span>{t('issues.changed', 'đổi')} <strong>{fieldLabel === 'status' ? t('common.status', 'trạng thái') : fieldLabel === 'priority' ? t('issues.priorityLabel', 'độ ưu tiên') : fieldLabel === 'assignee_id' ? t('issues.assigneeColumn', 'người chịu trách nhiệm') : fieldLabel}</strong> {t('issues.from', 'từ')} <code>{oldVal || t('issues.empty', 'rỗng')}</code> {t('issues.to', 'thành')} <code>{newVal || t('issues.empty', 'rỗng')}</code></span>
                          );
                        };

                        return (
                          <div key={hist.id} style={{ fontSize: '12.5px', color: 'var(--neutral-dark)', display: 'flex', gap: '4px', borderBottom: '1px dashed var(--neutral-border)', paddingBottom: '4px', paddingLeft: '4px' }}>
                            <span style={{ fontWeight: '600' }}>{hist.user_name || 'Hệ thống'}</span>
                            {renderAction()}
                            <span style={{ color: 'var(--neutral-muted)', fontSize: '11px', marginLeft: 'auto' }}>
                              {new Date(hist.changed_at).toLocaleString('vi-VN')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Inline properties update controls */}
                <div className="issue-detail-right-col" style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: '1px solid var(--neutral-border)', paddingLeft: '20px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--neutral-muted)', display: 'block', marginBottom: '6px' }}>{t('common.status', 'Trạng thái')}</label>
                    <span style={{
                      display: 'inline-block',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '13px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      backgroundColor: activeIssueDetail.status === 'DONE' ? '#dcfce7' : activeIssueDetail.status === 'IN_PROGRESS' ? '#dbeafe' : '#e2e8f0',
                      color: activeIssueDetail.status === 'DONE' ? '#15803d' : activeIssueDetail.status === 'IN_PROGRESS' ? '#1d4ed8' : '#475569',
                      border: `1px solid ${activeIssueDetail.status === 'DONE' ? '#bbf7d0' : activeIssueDetail.status === 'IN_PROGRESS' ? '#bfdbfe' : '#cbd5e1'}`
                    }}>
                      {activeIssueDetail.status === 'TO_DO' ? 'TO DO' : activeIssueDetail.status === 'IN_PROGRESS' ? 'IN PROGRESS' : 'DONE'}
                    </span>
                  </div>



                  <div className="form-group" style={{ position: 'relative' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--neutral-muted)' }}>{t('issues.involvedMembers', 'Thành viên liên quan')}</label>
                    {isEditingAssignee ? (
                      <div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                          <select 
                            value={jiraDetailAssigneeSelectedDept} 
                            onChange={(e) => setJiraDetailAssigneeSelectedDept(e.target.value)} 
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '12px', outline: 'none' }}
                          >
                            <option value="">{t('task.allDepartments', 'Tất cả phòng ban')}</option>
                            {departments.map(dept => (
                              <option key={dept.department_id} value={dept.department_id}>{dept.name}</option>
                            ))}
                          </select>
                          <input 
                            type="text" 
                            placeholder={t('task.searchMember', 'Tìm kiếm thành viên...')} 
                            value={jiraDetailAssigneeSearchQuery} 
                            onChange={(e) => setJiraDetailAssigneeSearchQuery(e.target.value)} 
                            style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '12px', outline: 'none' }}
                          />
                        </div>
                        <div className="project-members-selector-list" style={{ maxHeight: '130px', overflowY: 'auto', border: '1px solid var(--neutral-border)', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--neutral-bg-card)', marginBottom: '8px' }}>
                          {filteredDetailAssignees.length === 0 ? (
                            <div style={{ padding: '8px', color: 'var(--neutral-muted)', fontSize: '12px', textAlign: 'center' }}>{t('issues.noMembersFound', 'Không tìm thấy nhân viên phù hợp')}</div>
                          ) : (
                            filteredDetailAssignees.map(m => {
                              const isChecked = issueAssigneeIds.includes(m.id);
                              return (
                                <div className="member-select-row" key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
                                  <div className="member-select-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input 
                                      type="checkbox" 
                                      id={`jira-detail-assignee-check-${m.id}`} 
                                      checked={isChecked} 
                                      onChange={() => {
                                        setIssueAssigneeIds(prev => 
                                          prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                                        );
                                      }}
                                    />
                                    <label htmlFor={`jira-detail-assignee-check-${m.id}`} style={{ cursor: 'pointer', margin: 0, fontSize: '13px' }}>
                                      {m.name} ({m.employee_id || 'N/A'}) - {translateDepartmentName(m.department_name, t)} ({m.project_role || 'Member'})
                                    </label>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                          <button 
                            type="button" 
                            className="btn btn-primary btn-sm" 
                            disabled={isLockedByOther}
                            onClick={() => { if (!isLockedByOther) handleSaveAssigneeText(issueAssigneeIds); }}
                          >
                            {t('common.save', 'Lưu')}
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-secondary btn-sm" 
                            onClick={() => {
                              setIsEditingAssignee(false);
                            }}
                          >
                            {t('common.cancel', 'Hủy')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        onClick={() => {
                          if (!isLockedByOther) {
                            const currentAssignees = activeIssueDetail.description 
                              ? (parseDescription(activeIssueDetail.description).relatedUserIds || (activeIssueDetail.assignee_id ? [activeIssueDetail.assignee_id] : []))
                              : (activeIssueDetail.assignee_id ? [activeIssueDetail.assignee_id] : []);
                            setIssueAssigneeIds(currentAssignees);
                            setJiraDetailAssigneeSearchQuery('');
                            setJiraDetailAssigneeSelectedDept('');
                            setIsEditingAssignee(true);
                          }
                        }} 
                        style={{ padding: '8px 12px', border: '1px solid transparent', borderRadius: '4px', cursor: isLockedByOther ? 'not-allowed' : 'pointer', backgroundColor: 'var(--neutral-bg-hover)', transition: 'all 0.2s', minHeight: '34px', fontSize: '13px' }}
                        onMouseEnter={(e) => { if (!isLockedByOther) e.currentTarget.style.borderColor = 'var(--neutral-border)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
                      >
                        {issueAssigneeIds.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {users.filter(u => issueAssigneeIds.includes(u.id)).map(u => (
                              <span key={u.id} style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: 'var(--neutral-bg-card)', color: 'var(--neutral-dark)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', fontWeight: '500' }}>
                                {u.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--neutral-muted)', fontStyle: 'italic' }}>{t('issues.noInvolvedMembersSelected', 'Chưa chọn thành viên liên quan...')}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--neutral-muted)' }}>{t('issues.priorityLabel', 'Mức độ ưu tiên (Priority)')}</label>
                    <select 
                      value={activeIssueDetail.priority} 
                      onChange={(e) => handleUpdateIssueField('priority', e.target.value)}
                      disabled={isLockedByOther}
                      className="doc-select-filter"
                      style={{ width: '100%', height: '34px', fontSize: '13px' }}
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="CRITICAL">CRITICAL</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--neutral-muted)' }}>{t('issues.deadlineLabel', 'Hạn chót (Deadline)')} <span className="required">*</span></label>
                    <input
                      type="date"
                      value={jiraDetailDeadline || ''}
                      onChange={(e) => setJiraDetailDeadline(e.target.value)}
                      disabled={isLockedByOther}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', fontSize: '13px', outline: 'none' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--neutral-muted)' }}>{t('issues.issueType', 'Loại Issue (Type)')}</label>
                    <select 
                      value={activeIssueDetail.type} 
                      onChange={(e) => handleUpdateIssueField('type', e.target.value)}
                      disabled={isLockedByOther}
                      className="doc-select-filter"
                      style={{ width: '100%', height: '34px', fontSize: '13px' }}
                    >
                      <option value="STORY">STORY</option>
                      <option value="TASK">TASK</option>
                      <option value="BUG">BUG</option>
                      <option value="EPIC">EPIC</option>
                    </select>
                  </div>

                  <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '14px', marginTop: '10px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--neutral-muted)', marginBottom: '8px' }}>
                      {t('issues.reporterLabel', 'Người báo cáo:')} <strong>{users.find(u => u.id === activeIssueDetail.reporter_id)?.name || 'N/A'}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--neutral-muted)', marginBottom: '16px' }}>
                      {t('issues.createdAtLabel', 'Ngày tạo:')} <strong>{new Date(activeIssueDetail.created_at).toLocaleDateString('vi-VN')}</strong>
                    </div>
                    
                    {/* Delete Issue Button */}
                    <button 
                      type="button" 
                      className="btn btn-danger" 
                      disabled={isLockedByOther}
                      onClick={async () => {
                        if (isLockedByOther) return;
                        const confirmResult = await Swal.fire({
                          title: t('common.confirmDelete', 'Xác nhận xóa'),
                          text: t('issues.confirmDeleteText', 'Bạn có chắc chắn muốn xóa Issue {key}?').replace('{key}', activeIssueDetail.issue_key),
                          icon: 'warning',
                          showCancelButton: true,
                          confirmButtonColor: '#3085d6',
                          cancelButtonColor: '#d33',
                          confirmButtonText: t('common.confirm', 'Đồng ý'),
                          cancelButtonText: t('common.cancel', 'Hủy')
                        });
                        if (!confirmResult.isConfirmed) return;
                        try {
                          await db.deleteIssue(activeIssueDetail.id, currentUser.id);
                          setIsDetailModalOpen(false);
                          loadIssues();
                          Swal.fire({ icon: 'success', title: 'Thành công', text: "Đã xóa issue thành công!" });
                        } catch (err) {
                          Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi xóa issue: " + err.message });
                        }
                      }}
                      style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                    >
                      <i className="fa-solid fa-trash"></i> {t('issues.deleteIssue', 'Xóa Issue này')}
                    </button>

                    {activeIssueDetail.status !== 'DONE' && (
                      <button 
                        type="button" 
                        className="btn btn-success" 
                        disabled={isLockedByOther}
                        onClick={() => {
                          if (!isLockedByOther) {
                            setTempNguyenNhan(jiraDetailNguyenNhan);
                            setTempHuongGiaiQuyet(jiraDetailHuongGiaiQuyet);
                            setTempKetQua(jiraDetailKetQua);
                            setReportModalSource('detail-finish');
                            setIsReportPopupOpen(true);
                          }
                        }}
                        style={{ width: '100%', padding: '8px 12px', fontSize: '13px', marginTop: '10px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: isLockedByOther ? 'not-allowed' : 'pointer', fontWeight: '600', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: isLockedByOther ? 0.6 : 1 }}
                      >
                        <i className="fa-solid fa-circle-check"></i> {t('issues.finishIssue', 'Kết thúc issue')}
                      </button>
                    )}
                  </div>
                </div>

              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid var(--neutral-border)', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                {/* <button type="button" className="btn btn-secondary" onClick={() => setIsDetailModalOpen(false)}>Đóng</button> */}
                <button type="button" className="btn btn-primary" onClick={handleSaveAllIssueTasks} disabled={isLockedByOther}>{t('common.saveChanges', 'Lưu thay đổi')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JIRA Issue Task Detail Popup (75% of screen) */}
      {isSubTaskPopupOpen && activeSubTaskData && (
        <div className="modal show" style={{ display: 'flex', zIndex: 310 }}>
          <div className="modal-dialog" style={{ maxWidth: 'none', width: '75vw', height: '75vh', maxHeight: '75vh', margin: 'auto', borderRadius: '8px' }}>
            <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="modal-header" style={{ padding: '16px 20px', backgroundColor: 'var(--neutral-bg-card)', borderBottom: '1px solid var(--neutral-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>
                  {activeSubTaskData.name || t('task.taskDetail', 'Chi tiết công việc')}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto', marginRight: '16px' }}>
                  <label style={{ fontWeight: '600', fontSize: '13px', color: 'var(--neutral-muted)', margin: 0 }}>{t('common.status', 'Trạng thái:')}</label>
                  <select
                    value={activeSubTaskData.status || 'Chưa thực hiện'}
                    onChange={(e) => handleSubTaskFieldChange('status', e.target.value)}
                    disabled={isLockedByOther}
                    className="doc-select-filter"
                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '13px', outline: 'none' }}
                  >
                    <option value="Chưa thực hiện">TO DO</option>
                    <option value="Đang thực hiện">IN PROGRESS</option>
                    <option value="Hoàn thành">DONE</option>
                  </select>
                </div>
                <button className="btn-close-modal" onClick={() => setIsSubTaskPopupOpen(false)} style={{ fontSize: '20px', cursor: 'pointer' }}><i className="fa-solid fa-xmark"></i></button>
              </div>
              <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* 1. TextBox: Nội dung cần thực hiện */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontWeight: '600', fontSize: '13.5px', color: 'var(--neutral-muted)' }}>{t('issues.taskContent', 'Nội dung cần thực hiện')}</label>
                  <textarea
                    value={activeSubTaskData.contentNeeded || ''}
                    onChange={(e) => handleSubTaskFieldChange('contentNeeded', e.target.value)}
                    placeholder={t('issues.enterTaskContentPlaceholder', 'Nhập nội dung chi tiết cần thực hiện...')}
                    disabled={isLockedByOther}
                    rows="4"
                    style={{ width: '100%', border: '1px solid var(--neutral-border)', padding: '10px', borderRadius: '4px', outline: 'none', resize: 'vertical', fontSize: '13.5px', lineHeight: '1.6' }}
                  />
                </div>

                {/* 2. Solution Table: 3 columns (Nội dung thực hiện, Người thực hiện, Ngày thực hiện) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ fontWeight: '600', fontSize: '14px', margin: 0, color: '#1e293b' }}>Solution</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--neutral-border)', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#0f766e', color: '#ffffff' }}>
                        <th style={{ padding: '10px', border: '1px solid var(--neutral-border)', textAlign: 'left', width: '52%', fontWeight: '700' }}>{t('issues.solutionContentColumn', 'Nội dung thực hiện')}</th>
                        <th style={{ padding: '10px', border: '1px solid var(--neutral-border)', textAlign: 'left', width: '16%', fontWeight: '700' }}>{t('issues.executorColumn', 'Người thực hiện')}</th>
                        <th style={{ padding: '10px', border: '1px solid var(--neutral-border)', textAlign: 'left', width: '16%', fontWeight: '700' }}>{t('issues.dateColumn', 'Ngày thực hiện')}</th>
                        <th style={{ padding: '10px', border: '1px solid var(--neutral-border)', textAlign: 'left', width: '16%', fontWeight: '700' }}>{t('issues.updatedDateColumn', 'Cập nhật')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSubTaskData.solutions && activeSubTaskData.solutions.map(sol => (
                        <tr key={sol.id}>
                          <td style={{ padding: '6px', border: '1px solid var(--neutral-border)' }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <textarea
                                value={sol.action}
                                onChange={(e) => handleSolutionChange(sol.id, 'action', e.target.value)}
                                placeholder={t('issues.solutionContentPlaceholder', 'Nhập nội dung thực hiện (tự động ghi người & ngày)...')}
                                disabled={isLockedByOther}
                                rows="2"
                                style={{ flex: 1, border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', padding: '6px', borderRadius: '4px', outline: 'none', fontSize: '13px', resize: 'vertical' }}
                              />
                              <button
                                type="button"
                                onClick={() => { if (!isLockedByOther) handleRemoveSolutionRow(sol.id); }}
                                title={t('issues.deleteSolutionTitle', 'Xóa giải pháp')}
                                disabled={isLockedByOther}
                                style={{ border: 'none', background: 'none', color: '#ef4444', cursor: isLockedByOther ? 'not-allowed' : 'pointer', fontSize: '13px', padding: '2px', opacity: isLockedByOther ? 0.5 : 1 }}
                              >
                                <i className="fa-solid fa-trash"></i>
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: '10px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-hover)', color: 'var(--neutral-dark)', verticalAlign: 'middle' }}>
                            {sol.executor}
                          </td>
                          <td style={{ padding: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)', verticalAlign: 'middle' }}>
                            <input 
                              type="date"
                              value={sol.date || ''}
                              disabled={isLockedByOther}
                              onChange={(e) => handleSolutionChange(sol.id, 'date', e.target.value)}
                              style={{ width: '100%', padding: '6px', border: '1px solid var(--neutral-border)', borderRadius: '4px', outline: 'none', fontSize: '13px' }}
                            />
                          </td>
                           <td style={{ padding: '10px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-hover)', color: 'var(--neutral-dark)', verticalAlign: 'middle' }}>
                            {sol.date ? new Date(sol.date).toLocaleDateString('vi-VN') : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ display: 'flex', marginTop: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={isLockedByOther}
                      onClick={handleAddSolutionRow}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '50%', width: '32px', height: '32px', padding: 0, justifyContent: 'center', fontSize: '16px', fontWeight: 'bold', opacity: isLockedByOther ? 0.6 : 1, cursor: isLockedByOther ? 'not-allowed' : 'pointer' }}
                    >
                      +
                    </button>
                  </div>
                </div>

              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid var(--neutral-border)', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsSubTaskPopupOpen(false)}>{t('common.cancel', 'Hủy')}</button>
                <button type="button" className="btn btn-primary" onClick={handleSaveTaskPopup} disabled={isLockedByOther}>{t('common.confirm', 'Đồng ý')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <ProjectModal 
        isOpen={isProjModalOpen} 
        onClose={() => setIsProjModalOpen(false)} 
        projectId={projectId} 
        currentUser={currentUser} 
        onSaved={reloadAll} 
      />

      <TaskModal 
        isOpen={isTaskModalOpen} 
        onClose={() => setIsTaskModalOpen(false)} 
        taskId={activeTaskId} 
        projId={projectId} 
        currentUser={currentUser} 
        onSaved={reloadAll} 
      />

      <DocumentModal 
        isOpen={isDocModalOpen} 
        onClose={() => setIsDocModalOpen(false)} 
        docId={activeDocId} 
        projId={projectId} 
        currentUser={currentUser} 
        currentCategoryId="cat-lifecycle" 
        onSaved={reloadAll} 
      />

      {/* JIRA Detailed Report Popup */}
      {isReportPopupOpen && (
        <div className="modal show" style={{ display: 'flex', zIndex: 320 }}>
          <div className="modal-dialog" style={{ maxWidth: '600px', width: '90vw', margin: 'auto', borderRadius: '8px' }}>
            <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', padding: '24px', gap: '16px' }}>
              <div className="modal-header" style={{ padding: '0 0 12px 0', borderBottom: '1px solid var(--neutral-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>
                  Báo cáo chi tiết
                </h3>
                <button className="btn-close-modal" onClick={() => setIsReportPopupOpen(false)} style={{ fontSize: '20px', cursor: 'pointer' }}><i className="fa-solid fa-xmark"></i></button>
              </div>
              <div className="modal-body" style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontWeight: '600', fontSize: '13px', color: 'var(--neutral-muted)' }}>Nguyên nhân</label>
                  <textarea
                    value={tempNguyenNhan}
                    onChange={(e) => setTempNguyenNhan(e.target.value)}
                    placeholder="Nhập nguyên nhân..."
                    rows="3"
                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--neutral-border)', outline: 'none', fontSize: '13.5px', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontWeight: '600', fontSize: '13px', color: 'var(--neutral-muted)' }}>Hướng giải quyết</label>
                  <textarea
                    value={tempHuongGiaiQuyet}
                    onChange={(e) => setTempHuongGiaiQuyet(e.target.value)}
                    placeholder="Nhập hướng giải quyết..."
                    rows="3"
                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--neutral-border)', outline: 'none', fontSize: '13.5px', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontWeight: '600', fontSize: '13px', color: 'var(--neutral-muted)' }}>Kết quả</label>
                  <textarea
                    value={tempKetQua}
                    onChange={(e) => setTempKetQua(e.target.value)}
                    placeholder="Nhập kết quả..."
                    rows="3"
                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--neutral-border)', outline: 'none', fontSize: '13.5px', resize: 'vertical' }}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: 'none', padding: '8px 0 0 0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsReportPopupOpen(false)}
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                  Hủy
                </button>
                
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (reportModalSource === 'create') {
                      setJiraCreateNguyenNhan(tempNguyenNhan);
                      setJiraCreateHuongGiaiQuyet(tempHuongGiaiQuyet);
                      setJiraCreateKetQua(tempKetQua);
                    } else {
                      setJiraDetailNguyenNhan(tempNguyenNhan);
                      setJiraDetailHuongGiaiQuyet(tempHuongGiaiQuyet);
                      setJiraDetailKetQua(tempKetQua);
                    }
                    setIsReportPopupOpen(false);
                  }}
                  style={{ padding: '8px 24px', fontSize: '13px' }}
                >
                  Lưu
                </button>

                {activeIssueDetail && activeIssueDetail.status !== 'DONE' && (
                  <button
                    type="button"
                    className="btn btn-success"
                    disabled={reportModalSource !== 'detail-finish' || !jiraDetailHienTrang?.trim() || !tempNguyenNhan?.trim() || !tempHuongGiaiQuyet?.trim() || !tempKetQua?.trim() || !projectTasks.every(t => t.status === 'Hoàn thành')}
                    onClick={async () => {
                      try {
                        setJiraDetailNguyenNhan(tempNguyenNhan);
                        setJiraDetailHuongGiaiQuyet(tempHuongGiaiQuyet);
                        setJiraDetailKetQua(tempKetQua);

                        const newDescription = JSON.stringify({
                          text: editIssueDesc,
                          hientrang: jiraDetailHienTrang,
                          nguyennhan: tempNguyenNhan,
                          huonggiaiquyet: tempHuongGiaiQuyet,
                          ketqua: tempKetQua,
                          deadline: jiraDetailDeadline,
                          issueTasks: projectTasks,
                          assigneesText: detailAssigneesText
                        });
                        const updatedIssue = { 
                          ...activeIssueDetail, 
                          status: 'DONE',
                          description: newDescription
                        };
                        await db.updateIssue(updatedIssue, currentUser.id);
                        await notifyMentionedUsersInGrid(projectTasks, activeIssueDetail.issue_key, activeIssueDetail.summary, activeIssueDetail.id);
                        
                        await loadIssueDetail(activeIssueDetail.id);
                        loadIssues();
                        setIsReportPopupOpen(false);
                        setIsDetailModalOpen(false);
                        Swal.fire({ icon: 'success', title: 'Thành công', text: "Đã kết thúc issue thành công!" });
                      } catch (err) {
                        Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi kết thúc issue: " + err.message });
                      }
                    }}
                    style={{ 
                      padding: '8px 20px', 
                      fontSize: '13px', 
                      backgroundColor: '#10b981', 
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: '4px', 
                      cursor: (reportModalSource !== 'detail-finish' || !jiraDetailHienTrang?.trim() || !tempNguyenNhan?.trim() || !tempHuongGiaiQuyet?.trim() || !tempKetQua?.trim() || !projectTasks.every(t => t.status === 'Hoàn thành')) ? 'not-allowed' : 'pointer', 
                      opacity: (reportModalSource !== 'detail-finish' || !jiraDetailHienTrang?.trim() || !tempNguyenNhan?.trim() || !tempHuongGiaiQuyet?.trim() || !tempKetQua?.trim() || !projectTasks.every(t => t.status === 'Hoàn thành')) ? 0.6 : 1,
                      fontWeight: '600'
                    }}
                  >
                    Đóng Issue
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
