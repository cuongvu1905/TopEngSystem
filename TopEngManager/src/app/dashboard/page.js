"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/utils/db';
import { TaskModal } from '@/components/Modals';
import { getSwal } from '@/utils/swal';

// Helper to check if a user is mentioned in an issue
const isMentionedInIssue = (issue, user, users) => {
  if (!user || !user.name) return false;
  if (issue.assignee_id === user.id) return true;
  if (!issue.description) return false;
  try {
    const parsed = JSON.parse(issue.description);
    const assigneesText = parsed.assigneesText || '';
    const parts = assigneesText.split('@');
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const matchedUser = (users || []).find(u => u && u.name && part.toLowerCase().startsWith(u.name.toLowerCase()));
      if (matchedUser && matchedUser.id === user.id) {
        return true;
      }
    }
    const text = parsed.text || '';
    if (text.toLowerCase().includes(`@${user.name.toLowerCase()}`)) return true;
  } catch (e) {
    const lowercaseDesc = issue.description.toLowerCase();
    if (lowercaseDesc.includes(`@${user.name.toLowerCase()}`)) return true;
  }
  return false;
};
// Helper to get performer for task
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

// Helper to format date
const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('vi-VN');
  } catch (e) {
    return String(dateVal);
  }
};


// Helper to get text snippet from report content
const getReportSnippet = (content) => {
  if (!content) return 'Không có nội dung';
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object') {
      const text = parsed.text || parsed.hientrang || parsed.workDone || parsed.content || '';
      return text.length > 80 ? text.slice(0, 80) + '...' : text || 'Không có nội dung';
    }
  } catch (e) {}
  return content.length > 80 ? content.slice(0, 80) + '...' : content;
};

// Helper to render report content visually with cards/time/project/attachment info
const renderReportContentVisual = (content, projects) => {
  if (!content) return null;
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
                  border: '1px solid #cbd5e1', 
                  borderRadius: '6px', 
                  padding: '10px 12px', 
                  backgroundColor: '#f8fafc',
                  marginBottom: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', borderBottom: '1px dashed #e2e8f0', paddingBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#0f766e', backgroundColor: '#ccfbf1', padding: '1px 5px', borderRadius: '4px' }}>
                    <i className="fa-regular fa-clock"></i> {card.startTime} - {card.endTime}
                  </span>
                  <span style={{ fontSize: '10.5px', fontWeight: '600', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '4px' }}>
                    {projName}
                  </span>
                </div>
                <div style={{ fontSize: '12.5px', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
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
  
  return <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: '1.5', color: '#334155' }}>{content}</div>;
};



// Helper to parse issue description JSON
const parseIssueDescription = (desc) => {
  if (!desc) {
    return {
      text: '',
      hientrang: '',
      nguyennhan: '',
      huonggiaiquyet: '',
      ketqua: '',
      deadline: '',
      issueTasks: [],
      assigneesText: ''
    };
  }
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
  } catch (e) {}
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
};

export default function Dashboard() {
  const { currentUser, projects, tasks, subtasks, documents, notifications, projectMembers, users, reloadAll, hasPermission } = useApp();
  const { t } = useLanguage();
  const router = useRouter();

  // Customization state
  const [visibleSections, setVisibleSections] = useState({
    issues: true,
    tasks: true,
    projects: true,
    reports: true
  });
  const [showConfigDropdown, setShowConfigDropdown] = useState(false);

  // Data states
  const [allIssues, setAllIssues] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Unified Split-Screen Popup
  const [activeDetailPopup, setActiveDetailPopup] = useState(null); // 'issues' | 'tasks' | 'projects' | 'reports' | null

  // Daily reports status checker calendar states
  const [isCheckingStatusMode, setIsCheckingStatusMode] = useState(false);
  const [checkerDate, setCheckerDate] = useState(new Date());
  const [selectedCheckerDay, setSelectedCheckerDay] = useState(null);
  const [selectedMissingUsers, setSelectedMissingUsers] = useState([]);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const list = await db.getDepartments();
        setDepartments(list || []);
      } catch (err) {
        console.error("Failed to load departments", err);
      }
    };
    fetchDepts();
  }, []);

  useEffect(() => {
    if (!activeDetailPopup) {
      setIsCheckingStatusMode(false);
      setSelectedCheckerDay(null);
      setSelectedMissingUsers([]);
    }
  }, [activeDetailPopup]);

  useEffect(() => {
    setSelectedMissingUsers([]);
  }, [checkerDate, selectedCheckerDay]);

  const [popupSearch, setPopupSearch] = useState('');
  const [popupFilter1, setPopupFilter1] = useState(''); // Priority or Status or Project
  const [popupFilter2, setPopupFilter2] = useState(''); // Type or Status

  // Selected item states inside the active split-screen popup
  const [selectedIssueIdForPopup, setSelectedIssueIdForPopup] = useState(null);
  const [selectedTaskIdForPopup, setSelectedTaskIdForPopup] = useState(null);
  const [selectedProjectIdForPopup, setSelectedProjectIdForPopup] = useState(null);
  const [selectedReportForPopup, setSelectedReportForPopup] = useState(null);

  // Loading details & Review comments
  const [selectedIssueDetail, setSelectedIssueDetail] = useState(null);
  const issueProj = (selectedIssueDetail && selectedIssueDetail.issue) ? projects.find(p => p.id === selectedIssueDetail.issue.project_id) : null;
  const [loadingIssueDetail, setLoadingIssueDetail] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  
  const [reportCommentText, setReportCommentText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Permissions helpers
  const isAdmin = currentUser?.system_role?.includes("Admin");
  const isHR = currentUser?.system_role?.includes("Nhân sự");
  
  const canAccessIssues = true;
  const canAccessTasks = true;
  const canAccessProjects = true;
  const canAccessReports = true;

  // Load configuration from localstorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboard_visible_sections');
      if (saved) {
        try {
          setVisibleSections(JSON.parse(saved));
        } catch (e) {
          // ignore
        }
      }
    }
  }, []);

  // Fetch Issues and Reports from Database
  const loadDashboardData = async () => {
    if (!currentUser) return;
    try {
      setLoadingData(true);
      const [issues, reports] = await Promise.all([
        db.getIssues(null).catch(() => []),
        db.getDailyReports(currentUser.id, currentUser.system_role).catch(() => [])
      ]);
      setAllIssues(issues);
      setAllReports(reports);
    } catch (e) {
      console.error("Failed to load dashboard data: ", e);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadDashboardData();
    }
  }, [currentUser, projects]);

  const loadIssueDetail = useCallback(async (issueId) => {
    try {
      setLoadingIssueDetail(true);
      const res = await db.getIssueDetail(issueId);
      setSelectedIssueDetail(res);
    } catch (err) {
      console.warn("Failed to load issue detail:", err.message || err);
      setSelectedIssueDetail(null);
      if (typeof setSelectedIssueIdForPopup === 'function') {
        setSelectedIssueIdForPopup(null);
      }
      import('sweetalert2').then((Swal) => {
        Swal.default.fire({
          icon: 'error',
          title: 'Không tìm thấy Issue',
          text: 'Issue không tồn tại hoặc đã bị xóa khỏi hệ thống.',
          confirmButtonColor: 'var(--primary-color)'
        });
      });
    } finally {
      setLoadingIssueDetail(false);
    }
  }, [setSelectedIssueDetail, setLoadingIssueDetail]);

  // Fetch issue details on selectedIssueIdForPopup change
  useEffect(() => {
    if (selectedIssueIdForPopup) {
      loadIssueDetail(selectedIssueIdForPopup);
    } else {
      setSelectedIssueDetail(null);
    }
  }, [selectedIssueIdForPopup, loadIssueDetail]);

  // Handle redirect from daily report notifications
  useEffect(() => {
    if (typeof window !== 'undefined' && allReports.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const reportIdParam = params.get('reportId');
      if (reportIdParam) {
        const report = allReports.find(r => r.id === parseInt(reportIdParam));
        if (report) {
          setSelectedReportForPopup(report);
          setReportCommentText(report.comment || '');
          setActiveDetailPopup('reports');
          // Clear query params to keep URL clean
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        }
      }
    }
  }, [allReports]);

  if (!currentUser) return null;

  // Resolve which sections should actually show
  const showIssues = canAccessIssues && visibleSections.issues;
  const showTasks = canAccessTasks && visibleSections.tasks;
  const showProjects = canAccessProjects && visibleSections.projects;
  const showReports = canAccessReports && visibleSections.reports;

  // 1. Resolve My Projects (Join-order sorted)
  const visibleProjectsList = projects.filter(p => {
    if (hasPermission('view_all_projects')) return true;
    return projectMembers.some(m => m.project_id === p.id && m.user_id === currentUser.id);
  });
  
  const userMemberEntries = projectMembers.filter(m => m.user_id === currentUser.id);
  const myProjectsSorted = [...visibleProjectsList].sort((a, b) => {
    const memberA = userMemberEntries.find(m => m.project_id === a.id);
    const memberB = userMemberEntries.find(m => m.project_id === b.id);
    return (memberB?.id || 0) - (memberA?.id || 0); // new join first
  });

  // 2. Resolve My Tasks (Created-date sorted)
  const myTasksSorted = tasks
    .filter(t => {
      const isAssignedToMe = t.assignee_id === currentUser.id;
      let isCollab = false;
      try {
        const parsed = JSON.parse(t.description);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.assignee_ids)) {
          isCollab = parsed.assignee_ids.includes(currentUser.id);
        }
      } catch (e) {}
      return isAssignedToMe || isCollab;
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // 3. Resolve My Mentioned Issues (Created-date sorted)
  const visibleProjectIds = new Set(visibleProjectsList.map(p => p.id));
  const myIssuesSorted = allIssues
    .filter(issue => visibleProjectIds.has(issue.project_id) && isMentionedInIssue(issue, currentUser, users) && issue.status !== 'DONE')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // 4. Resolve Daily Reports (Role-filtered)
  const getFilteredReports = () => {
    // The backend API `getDailyReports` already returns exactly the reports the user is allowed to see.
    // On the dashboard, we only show reports that are in "Chờ duyệt" (Pending) status.
    return allReports.filter(r => r.status !== 'Approved' && r.status !== 'Rejected');
  };

  const reportsFiltered = getFilteredReports();

  // Toggle Visibility Configuration
  const handleToggleSection = (sec) => {
    const updated = { ...visibleSections, [sec]: !visibleSections[sec] };
    setVisibleSections(updated);
    localStorage.setItem('dashboard_visible_sections', JSON.stringify(updated));
  };

  // Open Stat Card / Header click -> Opens Split Screen Popup (75% size)
  const handleOpenDetailPopup = (type) => {
    setActiveDetailPopup(type);
    setPopupSearch('');
    setPopupFilter1('');
    setPopupFilter2('');

    if (type === 'issues') {
      const first = myIssuesSorted[0]?.id || null;
      setSelectedIssueIdForPopup(first);
    } else if (type === 'tasks') {
      const first = myTasksSorted[0]?.id || null;
      setSelectedTaskIdForPopup(first);
    } else if (type === 'projects') {
      const first = myProjectsSorted[0]?.id || null;
      setSelectedProjectIdForPopup(first);
    } else if (type === 'reports') {
      const first = allReports[0] || null;
      setSelectedReportForPopup(first);
      setReportCommentText(first?.comment || '');
    }
  };


  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim() || !selectedIssueIdForPopup) return;
    try {
      await db.addComment(selectedIssueIdForPopup, currentUser.id, newCommentText);
      setNewCommentText('');
      await loadIssueDetail(selectedIssueIdForPopup);
    } catch (err) {
      const Swal = await getSwal();
      Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi thêm bình luận: " + err.message });
    }
  };

  // Update Report Approval/Rejection status in MySQL/MockDB
  const handleUpdateReportStatus = async (status) => {
    if (!selectedReportForPopup) return;
    const Swal = await getSwal();

    if (status === 'Rejected') {
      if (!reportCommentText || !reportCommentText.trim()) {
        Swal.fire({
          icon: 'error',
          title: 'Thiếu ý kiến nhận xét',
          text: 'Vui lòng nhập ý kiến nhận xét/phản hồi của quản lý trước khi từ chối báo cáo ngày!'
        });
        return;
      }

      const confirmResult = await Swal.fire({
        title: 'Xác nhận từ chối?',
        text: 'Bạn có chắc chắn muốn từ chối (Reject) báo cáo ngày này không?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Xác nhận',
        cancelButtonText: 'Hủy'
      });

      if (!confirmResult.isConfirmed) {
        return;
      }
    }

    try {
      setSubmittingReview(true);
      await db.updateDailyReportStatus(selectedReportForPopup.id, status, reportCommentText, currentUser.system_role);
      Swal.fire({ icon: 'success', title: 'Thành công', text: `Đã ${status === 'Approved' ? 'Duyệt' : 'Từ chối'} báo cáo thành công!` });
      
      // Reload reports and find the updated report
      await loadDashboardData();
      const freshReports = await db.getDailyReports(currentUser.id, currentUser.system_role).catch(() => []);
      const updatedReport = freshReports.find(r => r.id === selectedReportForPopup.id);
      if (updatedReport) {
        setSelectedReportForPopup(updatedReport);
        setReportCommentText(updatedReport.comment || '');
      } else {
        setSelectedReportForPopup(null);
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi cập nhật trạng thái báo cáo: " + err.message });
    } finally {
      setSubmittingReview(false);
    }
  };

  // Get active items to show in the left pane (25vw) of the active popup
  const getFilteredItems = () => {
    const q = popupSearch.toLowerCase();
    if (activeDetailPopup === 'issues') {
      return myIssuesSorted.filter(item => {
        const matchSearch = item.summary.toLowerCase().includes(q) || item.issue_key.toLowerCase().includes(q);
        const matchPriority = !popupFilter1 || item.priority === popupFilter1;
        const matchType = !popupFilter2 || item.type === popupFilter2;
        return matchSearch && matchPriority && matchType;
      });
    }
    if (activeDetailPopup === 'tasks') {
      return myTasksSorted.filter(item => {
        const matchSearch = item.title.toLowerCase().includes(q);
        const matchPriority = !popupFilter1 || item.priority === popupFilter1;
        const matchStatus = !popupFilter2 || item.status === popupFilter2;
        return matchSearch && matchPriority && matchStatus;
      });
    }
    if (activeDetailPopup === 'projects') {
      return myProjectsSorted.filter(item => {
        const matchSearch = item.name.toLowerCase().includes(q) || (item.project_key && item.project_key.toLowerCase().includes(q));
        const matchStatus = !popupFilter1 || item.status === popupFilter1;
        return matchSearch && matchStatus;
      });
    }
    if (activeDetailPopup === 'reports') {
      // In the detail popup, search and filter through all available real reports (including Approved and Rejected)
      return allReports.filter(item => {
        const matchSearch = item.content.toLowerCase().includes(q) || item.user_name.toLowerCase().includes(q);
        const matchProject = !popupFilter1 || item.project_id === popupFilter1;
        const matchStatus = !popupFilter2 || item.status === popupFilter2;
        return matchSearch && matchProject && matchStatus;
      });
    }
    return [];
  };

  // Split-pane report review permission check
  const myPMProjects = projectMembers.filter(m => m.user_id === currentUser.id && m.project_role === 'PM').map(m => m.project_id);
  const isPM = myPMProjects.length > 0;
  
  const getCanReviewReport = (rep) => {
    if (!rep) return false;
    const isPending = rep.status !== 'Approved' && rep.status !== 'Rejected';
    return isPending && (currentUser.id !== rep.user_id) && 
      hasPermission('approve_daily_report');
  };

  // Helper to format date string to YYYY-MM-DD
  const formatDateString = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getCalendarDays = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    let startDay = firstDayOfMonth.getDay(); 
    // Convert Sunday (0) to 6, Monday (1) to 0, Tuesday (2) to 1...
    startDay = startDay === 0 ? 6 : startDay - 1;
    
    const totalDays = new Date(year, month + 1, 0).getDate();
    const days = [];
    
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    
    for (let d = 1; d <= totalDays; d++) {
      days.push(new Date(year, month, d));
    }
    
    // Pad to complete the 7-column grid up to 5 or 6 rows (35 or 42 cells)
    const totalCells = days.length <= 35 ? 35 : 42;
    while (days.length < totalCells) {
      days.push(null);
    }
    
    return days;
  };

  const getTeamMembers = () => {
    if (!currentUser) return [];
    
    const isTL = currentUser.system_role === 'Team Leader';
    const isPL = currentUser.system_role === 'Part Leader';
    const isRootDeptMember = (() => {
      const myDept = departments.find(d => d.department_id === currentUser.department_id);
      return myDept && !myDept.parent_id;
    })();

    const isBOD = currentUser.system_role?.includes('Ban điều hành') || 
                  currentUser.system_role?.includes('BOD');

    const isAdminUser = currentUser.system_role?.includes('Admin') || 
                      currentUser.system_role?.includes('Nhân sự') || 
                      currentUser.system_role?.includes('HR');

    if (isBOD) {
      // BOD only tracks Team Leaders
      return users.filter(u => u.system_role === 'Team Leader');
    }

    if (isAdminUser) {
      // Admin/HR sees everyone whose role is check-worthy (Staff, TL, PL, Sales), excluding Admins/BOD themselves
      return users.filter(u => 
        !u.system_role?.includes('Admin') && 
        !u.system_role?.includes('BOD') && 
        !u.system_role?.includes('HR') && 
        !u.system_role?.includes('Nhân sự') && 
        !u.system_role?.includes('Ban điều hành')
      );
    }

    const isDescendant = (childId, parentId) => {
      if (!childId || !parentId) return false;
      let curr = departments.find(d => d.department_id === childId);
      while (curr && curr.parent_id) {
        if (curr.parent_id === parentId) return true;
        curr = departments.find(d => d.department_id === curr.parent_id);
      }
      return false;
    };

    if (isTL || isPL || isRootDeptMember || hasPermission?.('view_daily_reports')) {
      return users.filter(u => {
        return u.department_id === currentUser.department_id || 
          isDescendant(u.department_id, currentUser.department_id);
      });
    }
    return [];
  };

  const getMissingUsersForDay = (dayObj) => {
    if (!dayObj) return [];
    const dateStr = formatDateString(dayObj);
    const team = getTeamMembers();
    
    // Filter team members created before or on this day
    const teamForDay = team.filter(u => {
      // Seed users (starting with 'usr-') are always active
      if (u.id && u.id.startsWith('usr-')) return true;
      if (!u.create_at) return true;
      
      const createdDate = new Date(u.create_at);
      createdDate.setHours(0, 0, 0, 0);
      
      const checkDate = new Date(dayObj);
      checkDate.setHours(23, 59, 59, 999);
      
      return createdDate <= checkDate;
    });

    // Get reports submitted on this date that are NOT Rejected
    const reportedUserIds = new Set(
      allReports
        .filter(r => formatDateString(new Date(r.created_at)) === dateStr && r.status !== 'Rejected')
        .map(r => r.user_id)
    );

    return teamForDay.filter(u => !reportedUserIds.has(u.id));
  };

  const handleRemoveFromMissing = async (userIds) => {
    if (!selectedCheckerDay) return;
    const Swal = await getSwal();
    const dateStr = formatDateString(selectedCheckerDay);
    
    Swal.fire({
      title: 'Xác nhận xóa?',
      text: `Bạn có chắc chắn muốn xóa ${userIds.length} nhân viên khỏi danh sách chưa báo cáo ngày ${selectedCheckerDay.toLocaleDateString('vi-VN')}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--danger-color)',
      cancelButtonColor: '#cbd5e1',
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          Swal.fire({
            title: 'Đang xử lý...',
            allowOutsideClick: false,
            didOpen: () => {
              Swal.showLoading();
            }
          });
          
          await Promise.all(userIds.map(async (uId) => {
            const createRes = await fetch('/api/db', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'createDailyReport',
                payload: {
                  userId: uId,
                  content: 'Được quản lý xác nhận miễn báo cáo ngày',
                  projectId: null,
                  fileUrl: null,
                  createdAt: dateStr
                }
              })
            });
            const createData = await createRes.json();
            if (createData.success && createData.report) {
              await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'updateDailyReportStatus',
                  payload: {
                    reportId: createData.report.id,
                    status: 'Approved',
                    comment: 'Phê duyệt tự động khi miễn báo cáo',
                    userRole: currentUser.system_role
                  }
                })
              });
            }
          }));
          
          await loadDashboardData();
          setSelectedMissingUsers([]);
          
          Swal.fire({
            icon: 'success',
            title: 'Thành công',
            text: 'Đã xóa thành viên khỏi danh sách chưa báo cáo.',
            timer: 1500,
            showConfirmButton: false
          });
        } catch (err) {
          console.error(err);
          Swal.fire({
            icon: 'error',
            title: 'Lỗi',
            text: 'Đã xảy ra lỗi khi thực hiện thao tác.'
          });
        }
      }
    });
  };

  const renderCalendarChecker = () => {
    const days = getCalendarDays(checkerDate);
    const team = getTeamMembers();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const prevMonth = () => {
      setCheckerDate(new Date(checkerDate.getFullYear(), checkerDate.getMonth() - 1, 1));
      setSelectedCheckerDay(null);
      setSelectedMissingUsers([]);
    };

    const nextMonth = () => {
      setCheckerDate(new Date(checkerDate.getFullYear(), checkerDate.getMonth() + 1, 1));
      setSelectedCheckerDay(null);
      setSelectedMissingUsers([]);
    };

    const missingForSelectedDay = selectedCheckerDay ? getMissingUsersForDay(selectedCheckerDay) : [];

    const handleToggleUserSelect = (userId) => {
      if (selectedMissingUsers.includes(userId)) {
        setSelectedMissingUsers(selectedMissingUsers.filter(id => id !== userId));
      } else {
        setSelectedMissingUsers([...selectedMissingUsers, userId]);
      }
    };

    const handleToggleSelectAll = (missingList) => {
      if (selectedMissingUsers.length === missingList.length) {
        setSelectedMissingUsers([]);
      } else {
        setSelectedMissingUsers(missingList.map(u => u.id));
      }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
        
        {/* Calendar Wrapper (Centered, Max Width 400px to keep cells compact) */}
        <div style={{ maxWidth: '400px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {/* Calendar Header with Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
            <button 
              type="button"
              onClick={prevMonth}
              style={{
                padding: '6px 12px',
                border: '1.5px solid #cbd5e1',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                color: '#334155'
              }}
            >
              &laquo;
            </button>
            <span style={{ fontSize: '16px', fontWeight: '750', color: '#1e293b' }}>
              {t('calendar.monthHeader', 'Tháng {month} {year}').replace('{month}', checkerDate.getMonth() + 1).replace('{year}', checkerDate.getFullYear())}
            </span>
            <button 
              type="button"
              onClick={nextMonth}
              style={{
                padding: '6px 12px',
                border: '1.5px solid #cbd5e1',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                color: '#334155'
              }}
            >
              &raquo;
            </button>
          </div>

          {/* Days of Week Headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            borderTop: '4px solid #94a3b8',
            borderLeft: '4px solid #94a3b8',
            borderRight: '4px solid #94a3b8',
            borderRadius: '8px 8px 0 0',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {[t('calendar.mon', 'Thứ 2'), t('calendar.tue', 'Thứ 3'), t('calendar.wed', 'Thứ 4'), t('calendar.thu', 'Thứ 5'), t('calendar.fri', 'Thứ 6'), t('calendar.sat', 'Thứ 7'), t('calendar.sun', 'CN')].map((w, idx) => (
              <div key={idx} style={{
                padding: '10px 4px',
                backgroundColor: '#f1f5f9',
                textAlign: 'center',
                fontWeight: '700',
                fontSize: '12.5px',
                color: '#475569',
                borderRight: idx === 6 ? 'none' : '4px solid #94a3b8'
              }}>
                {w}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: '4px solid #94a3b8',
            borderLeft: '4px solid #94a3b8',
            borderRight: '4px solid #94a3b8',
            borderRadius: '0 0 8px 8px',
            overflow: 'hidden',
            backgroundColor: '#ffffff',
            flexShrink: 0
          }}>
            {days.map((d, idx) => {
              if (d === null) {
                return (
                  <div key={`empty-${idx}`} style={{
                    aspectRatio: '1',
                    backgroundColor: '#f8fafc',
                    borderBottom: idx + 7 < days.length ? '4px solid #cbd5e1' : 'none',
                    borderRight: (idx + 1) % 7 === 0 ? 'none' : '4px solid #cbd5e1'
                  }} />
                );
              }

              const isSunday = d.getDay() === 0;
              const isFuture = d > today;
              const dateStr = formatDateString(d);

              const missing = getMissingUsersForDay(d);
              const hasMissing = missing.length > 0;

              let bgColor = 'transparent';
              let textColor = '#1e293b';
              let cursorStyle = 'default';
              
              if (!isSunday && !isFuture) {
                cursorStyle = 'pointer';
                if (hasMissing) {
                  bgColor = '#ef4444'; // Red
                  textColor = '#ffffff';
                } else {
                  bgColor = '#10b981'; // Green
                  textColor = '#ffffff';
                }
              } else if (isSunday) {
                bgColor = '#f1f5f9';
                textColor = '#94a3b8';
              }

              const isSelected = selectedCheckerDay && formatDateString(selectedCheckerDay) === dateStr;

              return (
                <div 
                  key={dateStr}
                  onClick={() => {
                    if (!isSunday && !isFuture) {
                      setSelectedCheckerDay(d);
                    }
                  }}
                  style={{
                    aspectRatio: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: idx + 7 < days.length ? '4px solid #cbd5e1' : 'none',
                    borderRight: (idx + 1) % 7 === 0 ? 'none' : '4px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    cursor: cursorStyle,
                    transition: 'all 0.2s',
                    padding: '4px',
                    boxSizing: 'border-box'
                  }}
                >
                  <div style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '8px',
                    backgroundColor: bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isSelected ? '0 0 0 4px #2563eb' : 'none',
                    fontWeight: '700',
                    color: textColor,
                    fontSize: '14px',
                    userSelect: 'none'
                  }}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Missing Reports Details Section */}
        <div style={{ marginTop: '12px', flex: 1, minHeight: '120px' }}>
          {selectedCheckerDay ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '750', color: '#1e293b' }}>
                  {t('report.missingReportsListHeader', 'Danh sách chưa báo cáo ngày {date}:').replace('{date}', selectedCheckerDay.toLocaleDateString(currentLang === 'vi' ? 'vi-VN' : 'en-US'))}
                </h4>
                {selectedMissingUsers.length > 0 && (
                  <button
                    type="button"
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: 'var(--danger-color)',
                      color: '#ffffff',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                    onClick={() => handleRemoveFromMissing(selectedMissingUsers)}
                  >
                    <i className="fa-solid fa-trash-can"></i> Xóa {selectedMissingUsers.length} đã chọn
                  </button>
                )}
              </div>
              {missingForSelectedDay.length > 0 ? (
                <div style={{ border: '2px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '8px 12px', width: '40px', textAlign: 'center', borderRight: '1px solid #cbd5e1' }}>
                          <input 
                            type="checkbox" 
                            checked={missingForSelectedDay.length > 0 && selectedMissingUsers.length === missingForSelectedDay.length}
                            onChange={() => handleToggleSelectAll(missingForSelectedDay)}
                            style={{ cursor: 'pointer' }}
                          />
                        </th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '700', color: '#475569', borderRight: '1px solid #cbd5e1' }}>{t('report.employeeIdCol', 'Mã NV')}</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '700', color: '#475569', borderRight: '1px solid #cbd5e1' }}>{t('team.fullName', 'Họ và tên')}</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '700', color: '#475569' }}>{t('team.departmentPart', 'Bộ phận')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {missingForSelectedDay.map(u => (
                        <tr key={u.id} style={{ borderBottom: '1px solid #cbd5e1' }}>
                          <td style={{ padding: '8px 12px', textAlign: 'center', borderRight: '1px solid #cbd5e1' }}>
                            <input 
                              type="checkbox"
                              checked={selectedMissingUsers.includes(u.id)}
                              onChange={() => handleToggleUserSelect(u.id)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: '600', color: '#334155', borderRight: '1px solid #cbd5e1' }}>{u.employee_id || u.id}</td>
                          <td style={{ padding: '8px 12px', fontWeight: '500', color: '#0f172a', borderRight: '1px solid #cbd5e1' }}>{u.name}</td>
                          <td style={{ padding: '8px 12px', color: '#475569' }}>{u.department_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '16px', backgroundColor: '#f0fdf4', border: '2px solid #b7ebc6', borderRadius: '6px', color: '#15803d', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-circle-check"></i> {t('report.allReportsSubmitted', 'Đầy đủ báo cáo.')}
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px', backgroundColor: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '8px', color: '#64748b', fontSize: '13px' }}>
              {t('report.calendarInstruction', 'Chọn một ngày màu đỏ trên lịch để xem danh sách nhân viên chưa nộp báo cáo.')}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="scrollable-view" style={{ padding: '24px' }}>
      <style>{`
        /* Premium Dashboard CSS Grid and glassmorphism styling */
        .dashboard-header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .config-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #ffffff;
          border: 1.5px solid var(--neutral-border);
          border-radius: 8px;
          font-weight: 600;
          color: var(--neutral-dark);
          box-shadow: var(--shadow-sm);
          cursor: pointer;
          position: relative;
          transition: var(--transition-fast);
        }
        .config-btn:hover {
          background: var(--neutral-bg-hover);
          border-color: #cbd5e1;
        }
        .config-dropdown {
          position: absolute;
          top: 45px;
          right: 0;
          background: #ffffff;
          border: 1.5px solid var(--neutral-border);
          border-radius: 8px;
          box-shadow: var(--shadow-lg);
          padding: 12px;
          width: 220px;
          z-index: 100;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .config-dropdown-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px;
          font-size: 13px;
          cursor: pointer;
          font-weight: 500;
        }
        .config-dropdown-item input {
          cursor: pointer;
        }
        
        .stat-card-clickable {
          background: #ffffff;
          border: 1.5px solid #cbd5e1;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: var(--shadow-sm);
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .stat-card-clickable:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
          border-color: var(--primary-color);
        }
        
        /* 2x2 High Contrast Box Layout */
        .dashboard-widgets-grid-2x2 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
        }
        .widget-box {
          border: 1.5px solid #cbd5e1;
          border-radius: 12px;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          height: 400px;
          overflow: hidden;
          box-shadow: var(--shadow-sm);
          transition: box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .widget-box:hover {
          box-shadow: var(--shadow-md);
          border-color: var(--primary-color);
        }
        .widget-box-header {
          padding: 12px 20px;
          border-bottom: 1.5px solid #cbd5e1;
          background: #f8fafc;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .widget-box-header:hover {
          background: #f1f5f9;
        }
        .widget-box-title {
          font-size: 15px;
          font-weight: 750;
          color: #0f172a;
          text-align: center;
          text-decoration: underline;
          text-underline-offset: 4px;
          margin: 0;
          letter-spacing: 0.05em;
          user-select: none;
        }
        .widget-box-body {
          padding: 16px 20px;
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .empty-widget-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 200px;
          color: var(--neutral-muted);
          text-align: center;
          gap: 8px;
        }
        
        /* Item Card Layouts */
        .item-row-card {
          padding: 14px;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          background: #ffffff;
          cursor: pointer;
          transition: var(--transition-fast);
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.01);
        }
        .item-row-card:hover {
          background: #f8fafc;
          border-color: var(--primary-color);
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm);
        }
        
        /* Report Grid layout on Dashboard */
        .reports-grid-dashboard {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .report-grid-card {
          height: 100px;
          max-height: 100px;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 12px;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          gap: 4px;
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .report-grid-card:hover {
          background: #f8fafc;
          border-color: var(--primary-color);
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm);
        }
        .report-snippet {
          font-size: 12px;
          color: #475569;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          line-height: 1.4;
        }

        /* 75% Viewport Modal Overlay Styling */
        .modal-backdrop-centered {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          background-color: rgba(15, 23, 42, 0.6) !important;
          backdrop-filter: blur(6px);
          z-index: 1050 !important;
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
        }
        
        /* Split-screen pane layout */
        .split-left-pane-25 {
          width: 25vw;
          flex: 0 0 25vw;
          border-right: 1.5px solid #cbd5e1;
          background-color: #f8fafc;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .split-right-pane-50 {
          flex: 1;
          background-color: #ffffff;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }
        
        .split-card-item {
          padding: 12px;
          border-radius: 8px;
          border: 1.5px solid #e2e8f0;
          background: #ffffff;
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .split-card-item.active {
          border-color: var(--primary-color);
          background: var(--primary-light);
          box-shadow: var(--shadow-sm);
        }
        .split-card-item:hover:not(.active) {
          background: var(--neutral-bg-hover);
          border-color: #cbd5e1;
        }
        
        /* Search pill in popup */
        .pill-search-input {
          width: 100%;
          padding: 8px 16px 8px 36px;
          border-radius: 24px;
          border: 1.5px solid #cbd5e1;
          font-size: 13px;
          outline: none;
          background: #ffffff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'/%3E%3C/svg%3E") no-repeat 12px center;
          background-size: 16px 16px;
          transition: border-color 0.15s ease;
        }
        .pill-search-input:focus {
          border-color: var(--primary-color);
        }
        .rectangular-filter-select {
          width: 100%;
          padding: 6px 10px;
          border-radius: 6px;
          border: 1.5px solid #cbd5e1;
          font-size: 12.5px;
          outline: none;
          background: #ffffff;
          cursor: pointer;
        }
        .rectangular-filter-select:focus {
          border-color: var(--primary-color);
        }
        
        /* Action buttons styling in report details */
        .btn-action-reject {
          background-color: #ef4444;
          color: white;
          border: none;
          padding: 8px 20px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .btn-action-reject:hover {
          background-color: #dc2626;
        }
        .btn-action-approve {
          background-color: #10b981;
          color: white;
          border: none;
          padding: 8px 20px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .btn-action-approve:hover {
          background-color: #059669;
        }
      `}</style>

      {/* Top Header bar with personalization toggle */}
      <div className="dashboard-header-bar">
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--neutral-dark)' }}>{t('dashboard.overview', 'Giao diện Tổng quan')}</h1>
          <p style={{ fontSize: '13px', color: 'var(--neutral-muted)', marginTop: '2px' }}>
            {t('dashboard.welcomePrefix', 'Xin chào, ')}<strong>{currentUser.name}</strong> ({currentUser.system_role}){t('dashboard.welcomeSuffix', '. Dưới đây là hoạt động hôm nay của bạn.')}
          </p>
        </div>
        <div style={{ position: 'relative' }}>
          <button className="config-btn" onClick={() => setShowConfigDropdown(!showConfigDropdown)}>
            <i className="fa-solid fa-sliders"></i>
            {t('dashboard.customize', 'Tùy chỉnh Dashboard')}
          </button>
          {showConfigDropdown && (
            <div className="config-dropdown">
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--neutral-muted)', paddingBottom: '4px', borderBottom: '1px solid #f1f5f9', marginBottom: '4px' }}>
                {t('dashboard.selectCards', 'Chọn thẻ hiển thị')}
              </span>
              <label className="config-dropdown-item" style={{ opacity: canAccessIssues ? 1 : 0.5 }}>
                <input 
                  type="checkbox" 
                  checked={visibleSections.issues} 
                  disabled={!canAccessIssues}
                  onChange={() => handleToggleSection('issues')} 
                />
                {t('dashboard.issuesOption', 'Vướng mắc (Issues)')}
              </label>
              <label className="config-dropdown-item" style={{ opacity: canAccessTasks ? 1 : 0.5 }}>
                <input 
                  type="checkbox" 
                  checked={visibleSections.tasks} 
                  disabled={!canAccessTasks}
                  onChange={() => handleToggleSection('tasks')} 
                />
                {t('dashboard.tasksOption', 'Việc cần làm (Tasks)')}
              </label>
              <label className="config-dropdown-item" style={{ opacity: canAccessProjects ? 1 : 0.5 }}>
                <input 
                  type="checkbox" 
                  checked={visibleSections.projects} 
                  disabled={!canAccessProjects}
                  onChange={() => handleToggleSection('projects')} 
                />
                {t('dashboard.projectsOption', 'Dự án tham gia')}
              </label>
              <label className="config-dropdown-item" style={{ opacity: canAccessReports ? 1 : 0.5 }}>
                <input 
                  type="checkbox" 
                  checked={visibleSections.reports} 
                  disabled={!canAccessReports}
                  onChange={() => handleToggleSection('reports')} 
                />
                {t('dashboard.reportsOption', 'Báo cáo hàng ngày')}
              </label>
            </div>
          )}
        </div>
      </div>

      {/* 4 Stat Cards Row */}
      <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
        {showIssues && (
          <div className="stat-card-clickable" onClick={() => handleOpenDetailPopup('issues')}>
            <div className="stat-info">
              <h3>{myIssuesSorted.length}</h3>
              <p>{t('dashboard.mentionedIssues', 'Issue được Mention')}</p>
            </div>
            <div className="stat-icon warning" style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning-color)' }}>
              <i className="fa-solid fa-circle-exclamation"></i>
            </div>
          </div>
        )}
        {showTasks && (
          <div className="stat-card-clickable" onClick={() => handleOpenDetailPopup('tasks')}>
            <div className="stat-info">
              <h3>{myTasksSorted.length}</h3>
              <p>{t('dashboard.assignedTasks', 'Công việc được giao')}</p>
            </div>
            <div className="stat-icon danger" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger-color)' }}>
              <i className="fa-solid fa-list-check"></i>
            </div>
          </div>
        )}
        {showProjects && (
          <div className="stat-card-clickable" onClick={() => handleOpenDetailPopup('projects')}>
            <div className="stat-info">
              <h3>{myProjectsSorted.length}</h3>
              <p>{t('dashboard.joinedProjects', 'Dự án tham gia')}</p>
            </div>
            <div className="stat-icon primary" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)' }}>
              <i className="fa-solid fa-folder-open"></i>
            </div>
          </div>
        )}
        {showReports && (
          <div className="stat-card-clickable" onClick={() => handleOpenDetailPopup('reports')}>
            <div className="stat-info">
              <h3>{reportsFiltered.length}</h3>
              <p>{t('dashboard.recordedReports', 'Báo cáo ghi nhận')}</p>
            </div>
            <div className="stat-icon success" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success-color)' }}>
              <i className="fa-solid fa-file-invoice"></i>
            </div>
          </div>
        )}
      </div>

      {/* Main Widgets 2x2 Grid Area */}
      <div className="dashboard-widgets-grid-2x2">
        
        {/* Widget 1: Issues */}
        {showIssues && (
          <div className="widget-box">
            <div className="widget-box-header" onClick={() => handleOpenDetailPopup('issues')} title="Xem chi tiết vướng mắc">
              <h3 className="widget-box-title">ISSUE</h3>
            </div>
            <div className="widget-box-body">
              {loadingData ? (
                <div className="empty-widget-state"><i className="fa-solid fa-circle-notch fa-spin"></i> Đang tải dữ liệu...</div>
              ) : myIssuesSorted.length === 0 ? (
                <div className="empty-widget-state">
                  <i className="fa-solid fa-circle-check" style={{ fontSize: '28px', color: 'var(--success-color)' }}></i>
                  {t('dashboard.noMentionedIssues', 'Không có vướng mắc nào nhắc tên bạn.')}
                </div>
              ) : (
                myIssuesSorted.slice(0, 4).map(issue => {
                  let badgeColor = 'var(--neutral-muted)';
                  if (issue.priority === 'CRITICAL') badgeColor = 'var(--danger-color)';
                  if (issue.priority === 'HIGH') badgeColor = '#ea580c';
                  if (issue.priority === 'MEDIUM') badgeColor = 'var(--primary-color)';

                  return (
                    <div 
                      key={issue.id} 
                      className="item-row-card" 
                      onClick={() => {
                        setActiveDetailPopup('issues');
                        setSelectedIssueIdForPopup(issue.id);
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', backgroundColor: '#eff6ff', color: 'var(--primary-color)', padding: '2px 8px', borderRadius: '4px' }}>
                          {issue.issue_key}
                        </span>
                        <span style={{ fontSize: '11px', color: badgeColor, fontWeight: 'bold', backgroundColor: '#f8fafc', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                          {issue.priority}
                        </span>
                      </div>
                      <div className="item-title-text" style={{ margin: '4px 0', fontSize: '13.5px' }}>{issue.summary}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--neutral-muted)' }}>
                          <i className="fa-solid fa-calendar-days" style={{ marginRight: '4px' }}></i>
                          {new Date(issue.created_at).toLocaleDateString('vi-VN')}
                        </span>
                        {issue.assignee_id && (
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '10px' }} title={`Người xử lý: ${users.find(u => u.id === issue.assignee_id)?.name || ''}`}>
                            {(users.find(u => u.id === issue.assignee_id)?.name || 'U').split(' ').pop().charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Widget 2: Việc cần làm */}
        {showTasks && (
          <div className="widget-box">
            <div className="widget-box-header" onClick={() => handleOpenDetailPopup('tasks')} title="Xem chi tiết việc cần làm">
              <h3 className="widget-box-title">{t('dashboard.toDoTasks', 'Việc cần làm')}</h3>
            </div>
            <div className="widget-box-body">
              {loadingData ? (
                <div className="empty-widget-state"><i className="fa-solid fa-circle-notch fa-spin"></i> Đang tải dữ liệu...</div>
              ) : myTasksSorted.length === 0 ? (
                <div className="empty-widget-state">
                  <i className="fa-solid fa-calendar-check" style={{ fontSize: '28px', color: 'var(--success-color)' }}></i>
                  {t('dashboard.noPendingTasks', 'Tuyệt vời! Bạn không có việc nào chưa hoàn thành.')}
                </div>
              ) : (
                myTasksSorted.slice(0, 4).map(task => {
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Done';
                  let priorityLabel = task.priority.toUpperCase();

                  return (
                    <div 
                      key={task.id} 
                      className="item-row-card" 
                      onClick={() => {
                        setActiveDetailPopup('tasks');
                        setSelectedTaskIdForPopup(task.id);
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: task.priority === 'Khẩn cấp' || task.priority === 'Cao' ? 'var(--danger-color)' : 'var(--warning-color)' }}>
                          {priorityLabel}
                        </span>
                        {task.assignee_id && (
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '10px' }} title={`Người nhận việc: ${users.find(u => u.id === task.assignee_id)?.name || ''}`}>
                            {(users.find(u => u.id === task.assignee_id)?.name || 'U').split(' ').pop().charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="item-title-text" style={{ margin: '4px 0', fontSize: '13.5px' }}>{task.title}</div>
                      {task.description && (
                        <div style={{ fontSize: '12px', color: 'var(--neutral-muted)', marginBottom: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {(() => {
                            try {
                              const parsed = JSON.parse(task.description);
                              if (parsed && typeof parsed === 'object' && 'text' in parsed) {
                                return parsed.text || 'Không có mô tả.';
                              }
                            } catch (e) {}
                            return task.description;
                          })()}
                        </div>
                      )}
                      <div style={{ fontSize: '11px', color: isOverdue ? 'var(--danger-color)' : 'var(--neutral-muted)', fontWeight: isOverdue ? 'bold' : 'normal' }}>
                        <i className="fa-solid fa-clock" style={{ marginRight: '4px' }}></i>
                        {task.due_date ? new Date(task.due_date).toLocaleDateString('vi-VN') : 'N/A'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Widget 3: Dự án */}
        {showProjects && (
          <div className="widget-box">
            <div className="widget-box-header" onClick={() => handleOpenDetailPopup('projects')} title="Xem chi tiết dự án">
              <h3 className="widget-box-title">{t('sidebar.projects', 'Dự án')}</h3>
            </div>
            <div className="widget-box-body">
              {loadingData ? (
                <div className="empty-widget-state"><i className="fa-solid fa-circle-notch fa-spin"></i> Đang tải dữ liệu...</div>
              ) : myProjectsSorted.length === 0 ? (
                <div className="empty-widget-state">
                  <i className="fa-solid fa-folder" style={{ fontSize: '28px' }}></i>
                  {t('dashboard.noAssignedProjects', 'Bạn chưa được phân công vào dự án nào.')}
                </div>
              ) : (
                myProjectsSorted.slice(0, 4).map(proj => {
                  const pTasks = tasks.filter(t => t.project_id === proj.id);
                  const done = pTasks.filter(t => t.status === "Done").length;
                  const progress = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0;
                  
                  return (
                    <div key={proj.id} className="item-row-card" onClick={() => router.push(`/projects/${proj.id}`)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="item-title-text" style={{ fontSize: '13.5px' }}>{proj.name}</span>
                        <span className="badge badge-info">{(proj.status === 'Thực thi' || proj.status === 'Ongoing') ? 'ONGOING' : (proj.status === 'Giám sát' || proj.status === 'Monitoring') ? 'MONITORING' : (proj.status === 'Kết thúc' || proj.status === 'Finished') ? 'FINISHED' : (proj.status ? proj.status.toUpperCase() : 'ONGOING')}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--neutral-muted)', margin: '4px 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {proj.description || t('projects.noDescription', 'Không có mô tả dự án.')}
                      </p>
                      <div style={{ marginTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '11px', fontWeight: 'bold' }}>
                          <span>{t('project.progress', 'Tiến độ')}</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="progress-bar-outer" style={{ height: '5px', borderRadius: '4px', backgroundColor: '#e2e8f0' }}>
                          <div className="progress-bar-inner" style={{ width: `${progress}%`, height: '100%', borderRadius: '4px', backgroundColor: 'var(--primary-color)' }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Widget 4: Báo cáo */}
        {showReports && (
          <div className="widget-box">
            <div className="widget-box-header" onClick={() => handleOpenDetailPopup('reports')} title="Xem chi tiết báo cáo">
              <h3 className="widget-box-title">{t('sidebar.dailyReports', 'Báo cáo')}</h3>
            </div>
            <div className="widget-box-body">
              {loadingData ? (
                <div className="empty-widget-state"><i className="fa-solid fa-circle-notch fa-spin"></i> Đang tải dữ liệu...</div>
              ) : reportsFiltered.length === 0 ? (
                <div className="empty-widget-state" style={{ color: 'var(--neutral-muted)', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '24px' }}>
                  <i className="fa-solid fa-circle-check" style={{ color: 'var(--success-color)', fontSize: '24px' }}></i>
                  {t('dashboard.noPendingReports', 'Không có báo cáo nào chờ duyệt.')}
                </div>
              ) : (
                <div className="reports-grid-dashboard">
                  {reportsFiltered.slice(0, 3).map((report, idx) => {
                    const userColor = users.find(u => u.id === report.user_id)?.color || '#3b82f6';
                    const proj = projects.find(p => p.id === report.project_id);

                    return (
                      <div 
                        key={report.id || idx} 
                        className="report-grid-card" 
                        onClick={() => {
                          // Click report card opens split-screen reports popup with 25vw / 50vw and selects report
                          setActiveDetailPopup('reports');
                          setSelectedReportForPopup(report);
                          setReportCommentText(report.comment || '');
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: userColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px' }}>
                              {report.user_name.split(' ').pop().charAt(0)}
                            </div>
                            <div>
                              <h4 style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b', margin: 0 }}>{report.user_name}</h4>
                              <span style={{ fontSize: '9px', color: 'var(--neutral-muted)', display: 'block', marginTop: '-2px' }}>{report.user_role}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                            <span style={{ fontSize: '9.5px', color: 'var(--neutral-muted)' }}>
                              {new Date(report.created_at).toLocaleDateString('vi-VN')}
                            </span>
                            <span style={{ fontSize: '9px', color: report.status === 'Approved' ? 'var(--success-color)' : report.status === 'Rejected' ? 'var(--danger-color)' : 'var(--warning-color)', fontWeight: 'bold' }}>
                              {report.status === 'Approved' ? 'APPROVED' : report.status === 'Rejected' ? 'REJECTED' : 'PENDING'}
                            </span>
                          </div>
                        </div>

                        {report.project_id && (
                          <span style={{ display: 'inline-block', alignSelf: 'flex-start', fontSize: '9.5px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '8px', fontWeight: '600', marginTop: '2px' }}>
                            {proj?.name || 'Dự án'}
                          </span>
                        )}

                        <div className="report-snippet" style={{ marginTop: '2px' }}>
                          {getReportSnippet(report.content)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ================= UNIFIED SPLIT-SCREEN POPUP (75vw Width, 75vh Height, 25% Left List & 50% Right Content) ================= */}
      {activeDetailPopup && (
        <div className="modal show modal-backdrop-centered" onClick={() => setActiveDetailPopup(null)}>
          <div 
            style={{ 
              width: activeDetailPopup === 'reports' ? '100vw' : '75vw', 
              height: activeDetailPopup === 'reports' ? '100vh' : '75vh', 
              backgroundColor: '#ffffff', 
              border: activeDetailPopup === 'reports' ? 'none' : '1.5px solid #cbd5e1', 
              borderRadius: activeDetailPopup === 'reports' ? '0px' : '12px', 
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden', 
              boxShadow: 'var(--shadow-xl)' 
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-header" style={{ borderBottom: '1.5px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                {activeDetailPopup === 'issues' && t('dashboard.mentionedIssueDetail', 'Chi tiết vướng mắc được Mention')}
                {activeDetailPopup === 'tasks' && t('dashboard.assignedTaskDetail', 'Chi tiết công việc được giao')}
                {activeDetailPopup === 'projects' && t('dashboard.joinedProjectDetail', 'Chi tiết dự án tham gia')}
                {activeDetailPopup === 'reports' && t('dashboard.dailyReportDetail', 'Chi tiết báo cáo ngày')}
              </h3>
              <button className="btn-close-modal" style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '18px', color: '#64748b' }} onClick={() => setActiveDetailPopup(null)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Split Content Body */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              
              {/* Left Pane: Master List (25vw width) */}
              <div className="split-left-pane-25" style={{ padding: '16px', borderRight: '1.5px solid #cbd5e1', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* Daily reports checker activation button */}
                {activeDetailPopup === 'reports' && (currentUser?.system_role === 'Team Leader' || currentUser?.system_role?.includes('Admin') || currentUser?.system_role?.includes('BOD') || currentUser?.system_role?.includes('HR') || currentUser?.system_role?.includes('Nhân sự') || currentUser?.system_role?.includes('Ban điều hành')) && (
                  <button 
                    type="button"
                    className="btn"
                    style={{ 
                      width: '100%', 
                      padding: '10px 16px', 
                      fontSize: '13px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '8px',
                      borderRadius: '8px',
                      fontWeight: '600',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: isCheckingStatusMode ? '#64748b' : 'var(--primary-color)',
                      color: '#ffffff',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'background-color 0.2s'
                    }}
                    onClick={() => setIsCheckingStatusMode(!isCheckingStatusMode)}
                  >
                    <i className={isCheckingStatusMode ? "fa-solid fa-list" : "fa-solid fa-calendar-check"}></i>
                    {isCheckingStatusMode ? t('reports.viewReportList', 'Xem danh sách báo cáo') : t('reports.checkStatusMode', 'Kiểm tra tình trạng báo cáo')}
                  </button>
                )}

                {/* Search Bar Oval shape */}
                <div>
                  <input 
                    type="text" 
                    placeholder={t('common.search', 'Tìm kiếm...')} 
                    value={popupSearch}
                    onChange={(e) => setPopupSearch(e.target.value)}
                    className="pill-search-input"
                  />
                </div>
                
                {/* Rectangular Dropdown Filters */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeDetailPopup === 'issues' && (
                    <>
                      <select value={popupFilter1} onChange={(e) => setPopupFilter1(e.target.value)} className="rectangular-filter-select">
                        <option value="">{t('issues.priorityAll', 'Độ ưu tiên (Tất cả)')}</option>
                        <option value="CRITICAL">CRITICAL</option>
                        <option value="HIGH">HIGH</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="LOW">LOW</option>
                      </select>
                      <select value={popupFilter2} onChange={(e) => setPopupFilter2(e.target.value)} className="rectangular-filter-select">
                        <option value="">{t('issues.typeAll', 'Loại Issue (Tất cả)')}</option>
                        <option value="STORY">STORY</option>
                        <option value="TASK">TASK</option>
                        <option value="BUG">BUG</option>
                        <option value="EPIC">EPIC</option>
                      </select>
                    </>
                  )}

                  {activeDetailPopup === 'tasks' && (
                    <>
                      <select value={popupFilter1} onChange={(e) => setPopupFilter1(e.target.value)} className="rectangular-filter-select">
                        <option value="">Độ ưu tiên (Tất cả)</option>
                        <option value="Khẩn cấp">Khẩn cấp</option>
                        <option value="Cao">Cao</option>
                        <option value="Trung bình">Trung bình</option>
                        <option value="Thấp">Thấp</option>
                      </select>
                      <select value={popupFilter2} onChange={(e) => setPopupFilter2(e.target.value)} className="rectangular-filter-select">
                        <option value="">{t('common.statusAll', 'Trạng thái (Tất cả)')}</option>
                        <option value="Todo">Todo</option>
                        <option value="InProgress">InProgress</option>
                        <option value="Review">Review</option>
                        <option value="Done">Done</option>
                      </select>
                    </>
                  )}

                  {activeDetailPopup === 'projects' && (
                    <select value={popupFilter1} onChange={(e) => setPopupFilter1(e.target.value)} className="rectangular-filter-select">
                      <option value="">{t('projects.statusAll', 'Trạng thái dự án (Tất cả)')}</option>
                      <option value="Thực thi">{t('project.status.executing', 'Thực thi')}</option>
                      <option value="Giám sát">{t('project.status.monitoring', 'Giám sát')}</option>
                      <option value="Kết thúc">{t('project.status.closed', 'Kết thúc')}</option>
                    </select>
                  )}

                  {activeDetailPopup === 'reports' && (
                    <>
                      <select value={popupFilter1} onChange={(e) => setPopupFilter1(e.target.value)} className="rectangular-filter-select">
                        <option value="">{t('reports.linkedProjectAll', 'Dự án liên kết (Tất cả)')}</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <select value={popupFilter2} onChange={(e) => setPopupFilter2(e.target.value)} className="rectangular-filter-select">
                        <option value="">{t('reports.statusAll', 'Trạng thái duyệt (Tất cả)')}</option>
                        <option value="Pending">PENDING</option>
                        <option value="Approved">APPROVED</option>
                        <option value="Rejected">REJECTED</option>
                      </select>
                    </>
                  )}
                </div>

                {/* Items List (Scrollable) */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  {getFilteredItems().length === 0 ? (
                    <div style={{ color: 'var(--neutral-muted)', fontSize: '12.5px', textAlign: 'center', padding: '24px 0' }}>{t('common.noDataFound', 'Không tìm thấy dữ liệu.')}</div>
                  ) : (
                    getFilteredItems().map(item => {
                      let isActive = false;
                      let cardTitle = '';
                      let cardSubtext = '';
                      let cardBadgeText = '';
                      let cardBadgeColor = 'var(--neutral-muted)';

                      if (activeDetailPopup === 'issues') {
                        isActive = item.id === selectedIssueIdForPopup;
                        cardTitle = item.summary;
                        cardSubtext = item.issue_key;
                        cardBadgeText = item.priority;
                        if (item.priority === 'CRITICAL') cardBadgeColor = 'var(--danger-color)';
                        if (item.priority === 'HIGH') cardBadgeColor = '#ea580c';
                        if (item.priority === 'MEDIUM') cardBadgeColor = 'var(--primary-color)';
                      } else if (activeDetailPopup === 'tasks') {
                        isActive = item.id === selectedTaskIdForPopup;
                        cardTitle = item.title;
                        cardSubtext = item.status;
                        cardBadgeText = item.priority.toUpperCase();
                        cardBadgeColor = item.priority === 'Khẩn cấp' || item.priority === 'Cao' ? 'var(--danger-color)' : 'var(--warning-color)';
                      } else if (activeDetailPopup === 'projects') {
                        isActive = item.id === selectedProjectIdForPopup;
                        cardTitle = item.name;
                        cardSubtext = item.project_key;
                        cardBadgeText = (item.status === 'Thực thi' || item.status === 'Ongoing') ? 'Ongoing' : (item.status === 'Giám sát' || item.status === 'Monitoring') ? 'Monitoring' : (item.status === 'Kết thúc' || item.status === 'Finished') ? 'Finished' : (item.status || 'Ongoing');
                        cardBadgeColor = 'var(--primary-color)';
                      } else if (activeDetailPopup === 'reports') {
                        isActive = item.id === selectedReportForPopup?.id;
                        cardTitle = item.user_name;
                        cardSubtext = new Date(item.created_at).toLocaleDateString('vi-VN');
                        cardBadgeText = item.status === 'Approved' ? 'APPROVED' : item.status === 'Rejected' ? 'REJECTED' : 'PENDING';
                        cardBadgeColor = item.status === 'Approved' ? 'var(--success-color)' : item.status === 'Rejected' ? 'var(--danger-color)' : 'var(--warning-color)';
                      }

                      return (
                        <div 
                          key={item.id} 
                          className={`split-card-item ${isActive && !isCheckingStatusMode ? 'active' : ''}`}
                          style={{
                            opacity: (activeDetailPopup === 'reports' && isCheckingStatusMode) ? 0.6 : 1,
                            cursor: (activeDetailPopup === 'reports' && isCheckingStatusMode) ? 'not-allowed' : 'pointer'
                          }}
                          onClick={() => {
                            if (activeDetailPopup === 'reports' && isCheckingStatusMode) return;
                            if (activeDetailPopup === 'issues') {
                              setSelectedIssueIdForPopup(item.id);
                            } else if (activeDetailPopup === 'tasks') {
                              setSelectedTaskIdForPopup(item.id);
                            } else if (activeDetailPopup === 'projects') {
                              setSelectedProjectIdForPopup(item.id);
                            } else if (activeDetailPopup === 'reports') {
                              setSelectedReportForPopup(item);
                              setReportCommentText(item.comment || '');
                            }
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                              {cardTitle}
                            </span>
                            <span style={{ fontSize: '9.5px', color: cardBadgeColor, fontWeight: 'bold' }}>
                              {cardBadgeText}
                            </span>
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--neutral-muted)' }}>
                            {cardSubtext}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Pane: Content (50vw width) */}
              <div className="split-right-pane-50" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* 1. ISSUES RIGHT PANE */}
                {activeDetailPopup === 'issues' && (
                  loadingIssueDetail ? (
                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}><i className="fa-solid fa-circle-notch fa-spin fa-2x"></i></div>
                  ) : selectedIssueDetail ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--primary-color)', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>
                                {t('common.projectLabel', 'DỰ ÁN:')} {issueProj?.name || 'Chung'}
                              </span>
                              {issueProj && (
                                <Link 
                                  href={`/projects/${issueProj.id}?issueId=${selectedIssueDetail.issue.id}`}
                                  style={{ 
                                    fontSize: '11px', 
                                    color: 'var(--primary-color)', 
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontWeight: '500',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    border: '1.5px solid var(--primary-color)',
                                    cursor: 'pointer'
                                  }}
                                  title="Đi tới chi tiết vướng mắc trong dự án"
                                >
                                  {t('issues.viewInProject', 'Xem trong dự án')} <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '9px' }}></i>
                                </Link>
                              )}
                            </div>
                            <span 
                              className={`badge ${
                                selectedIssueDetail.issue.status === 'DONE' ? 'badge-success' : 
                                selectedIssueDetail.issue.status === 'IN_PROGRESS' ? 'badge-warning' : 
                                'badge-info'
                              }`}
                            >
                              {selectedIssueDetail.issue.status === 'TO_DO' ? 'TO DO' : 
                               selectedIssueDetail.issue.status === 'IN_PROGRESS' ? 'IN PROGRESS' : 
                               selectedIssueDetail.issue.status}
                            </span>
                          </div>
                          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '4px 0 0 0' }}>
                            <Link href={`/projects/${selectedIssueDetail.issue.project_id}?issueId=${selectedIssueDetail.issue.id}`} style={{ color: '#0f172a', textDecoration: 'none' }} title="Xem chi tiết trong dự án">
                              {selectedIssueDetail.issue.summary}
                            </Link>
                          </h2>
                        </div>
                      </div>

                      <div>
                        <label style={{ fontWeight: '700', fontSize: '12px', display: 'block', marginBottom: '4px', color: '#475569' }}>{t('issues.detailedDescription', 'Mô tả chi tiết')}</label>
                        <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '13px', color: '#334155', minHeight: '60px', whiteSpace: 'pre-wrap' }}>
                          {(() => {
                            const parsed = parseIssueDescription(selectedIssueDetail.issue.description);
                            if (parsed.hientrang || parsed.nguyennhan || parsed.huonggiaiquyet || parsed.ketqua) {
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {parsed.hientrang && (
                                    <div>
                                      <strong style={{ color: '#0f172a', fontSize: '12px' }}>[{t('issues.currentStatus', 'Hiện trạng')}]:</strong>
                                      <p style={{ margin: '2px 0 6px 0', fontSize: '13px', color: '#334155' }}>{parsed.hientrang}</p>
                                    </div>
                                  )}
                                  {parsed.nguyennhan && (
                                    <div>
                                      <strong style={{ color: '#0f172a', fontSize: '12px' }}>[{t('issues.cause', 'Nguyên nhân')}]:</strong>
                                      <p style={{ margin: '2px 0 6px 0', fontSize: '13px', color: '#334155' }}>{parsed.nguyennhan}</p>
                                    </div>
                                  )}
                                  {parsed.huonggiaiquyet && (
                                    <div>
                                      <strong style={{ color: '#0f172a', fontSize: '12px' }}>[{t('issues.solution', 'Hướng giải quyết')}]:</strong>
                                      <p style={{ margin: '2px 0 6px 0', fontSize: '13px', color: '#334155' }}>{parsed.huonggiaiquyet}</p>
                                    </div>
                                  )}
                                  {parsed.ketqua && (
                                    <div>
                                      <strong style={{ color: '#0f172a', fontSize: '12px' }}>[{t('issues.result', 'Kết quả')}]:</strong>
                                      <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#334155' }}>{parsed.ketqua}</p>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return parsed.text || <span style={{ color: 'var(--neutral-muted)', fontStyle: 'italic' }}>{t('issues.noDescription', 'Không có mô tả chi tiết.')}</span>;
                          })()}
                        </div>
                      </div>

                      {parseIssueDescription(selectedIssueDetail.issue.description).issueTasks?.length > 0 && (
                        <div>
                          <label style={{ fontWeight: '700', fontSize: '12px', display: 'block', marginBottom: '6px', color: '#475569' }}>{t('issues.subtasksTableTitle', 'Bảng chi tiết công việc phụ & giải pháp')}</label>
                          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f1f5f9' }}>
                                <th style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'left', width: '40%' }}>{t('issues.subtaskName', 'Tên công việc phụ')}</th>
                                <th style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'left', width: '25%' }}>{t('issues.subtaskAssignee', 'Người thực hiện')}</th>
                                <th style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'left', width: '20%' }}>{t('issues.subtaskDeadline', 'Hạn chót')}</th>
                                <th style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'left', width: '15%' }}>Trạng thái</th>
                              </tr>
                            </thead>
                            <tbody>
                              {parseIssueDescription(selectedIssueDetail.issue.description).issueTasks.map((t, idx) => {
                                const status = t.status || 'Chưa thực hiện';
                                let bgColor = '#f1f5f9';
                                let textColor = '#475569';
                                let borderColor = '#cbd5e1';

                                if (status === 'Hoàn thành') {
                                  bgColor = '#dcfce7';
                                  textColor = '#16a34a';
                                  borderColor = '#bbf7d0';
                                } else if (status === 'Đang thực hiện') {
                                  bgColor = '#eff6ff';
                                  textColor = '#2563eb';
                                  borderColor = '#bfdbfe';
                                }

                                return (
                                  <tr key={idx}>
                                    <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', fontWeight: '500' }}>{t.name || t.title || ''}</td>
                                    <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1' }}>{getPerformerForTask(t)}</td>
                                    <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1' }}>{formatDate(t.deadline || t.dueDate)}</td>
                                    <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                                      <span style={{ 
                                        display: 'inline-block',
                                        padding: '2px 8px', 
                                        borderRadius: '4px', 
                                        backgroundColor: bgColor, 
                                        color: textColor, 
                                        border: `1px solid ${borderColor}`,
                                        fontSize: '11px',
                                        fontWeight: '600'
                                      }}>
                                        {status}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Comments inside Issue */}
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                        <label style={{ fontWeight: '700', fontSize: '12px', display: 'block', marginBottom: '8px', color: '#475569' }}>
                          {t('issues.discussionComments', 'Bình luận trao đổi')} ({selectedIssueDetail.comments?.length || 0})
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', marginBottom: '12px' }}>
                          {selectedIssueDetail.comments?.length === 0 ? (
                            <div style={{ color: 'var(--neutral-muted)', fontSize: '11px', fontStyle: 'italic', textAlign: 'center' }}>{t('issues.noComments', 'Chưa có trao đổi nào.')}</div>
                          ) : (
                            selectedIssueDetail.comments.map(c => {
                              const cColor = users.find(u => u.id === c.user_id)?.color || '#3b82f6';
                              return (
                                <div key={c.id} style={{ display: 'flex', gap: '8px', backgroundColor: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: cColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '10px', flexShrink: 0 }}>
                                    {c.user_name?.split(' ').pop().charAt(0)}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '11px' }}>
                                      <strong style={{ color: '#0f172a' }}>{c.user_name}</strong>
                                      <span style={{ color: 'var(--neutral-muted)' }}>{new Date(c.created_at).toLocaleTimeString('vi-VN')}</span>
                                    </div>
                                    <p style={{ fontSize: '12.5px', color: '#475569', margin: 0 }}>{c.content}</p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                        <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px' }}>
                          <input 
                            type="text" 
                            placeholder={t('issues.commentPlaceholder', 'Nhập câu trả lời hoặc thảo luận...')} 
                            value={newCommentText} 
                            onChange={(e) => setNewCommentText(e.target.value)} 
                            style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '12.5px', outline: 'none' }}
                            required
                          />
                          <button type="submit" className="btn btn-primary btn-sm">{t('common.send', 'Gửi')}</button>
                        </form>
                      </div>

                      {/* Metadata */}
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                        <div>{t('issues.priority', 'Độ ưu tiên:')} <strong>{selectedIssueDetail.issue.priority}</strong></div>
                        <div>{t('issues.type', 'Loại issue:')} <strong>{selectedIssueDetail.issue.type}</strong></div>
                        <div>{t('issues.creator', 'Người báo cáo:')} <strong>{users.find(u => u.id === selectedIssueDetail.issue.reporter_id)?.name || 'N/A'}</strong></div>
                        <div>{t('issues.createdDate', 'Ngày tạo:')} <strong>{new Date(selectedIssueDetail.issue.created_at).toLocaleDateString('vi-VN')}</strong></div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--neutral-muted)', padding: '24px 0' }}>{t('issues.selectIssuePrompt', 'Vui lòng chọn vướng mắc để xem chi tiết.')}</div>
                  )
                )}

                {/* 2. TASKS RIGHT PANE */}
                {activeDetailPopup === 'tasks' && (
                  (() => {
                    const task = myTasksSorted.find(t => t.id === selectedTaskIdForPopup);
                    if (!task) return <div style={{ textAlign: 'center', color: 'var(--neutral-muted)', padding: '24px 0' }}>{t('tasks.selectTaskPrompt', 'Vui lòng chọn công việc để xem chi tiết.')}</div>;
                    const taskProj = projects.find(p => p.id === task.project_id);
                    const taskSubtasks = (subtasks || []).filter(st => st.task_id === task.id);
                    
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--primary-color)', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>
                                DỰ ÁN: {taskProj?.name || 'Chung'}
                              </span>
                              {taskProj && (
                                <Link 
                                  href={`/projects/${taskProj.id}?taskId=${task.id}`}
                                  style={{ 
                                    fontSize: '11px', 
                                    color: 'var(--primary-color)', 
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontWeight: '500',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    border: '1.5px solid var(--primary-color)',
                                    cursor: 'pointer'
                                  }}
                                  title="Đi tới chi tiết công việc trong dự án"
                                >
                                  Xem trong dự án <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '9px' }}></i>
                                </Link>
                              )}
                            </div>
                            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '6px 0 0 0' }}>
                              {taskProj ? (
                                <Link href={`/projects/${taskProj.id}?taskId=${task.id}`} style={{ color: '#0f172a', textDecoration: 'none' }} title="Xem trong dự án">
                                  {task.title}
                                </Link>
                              ) : (
                                task.title
                              )}
                            </h2>
                          </div>
                          <span className={`badge ${task.status === 'Done' ? 'badge-success' : 'badge-warning'}`}>{task.status}</span>
                        </div>

                        <div>
                          <label style={{ fontWeight: '700', fontSize: '12px', display: 'block', marginBottom: '4px', color: '#475569' }}>{t('tasks.description', 'Mô tả công việc')}</label>
                          <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '13px', color: '#334155', minHeight: '60px', whiteSpace: 'pre-wrap' }}>
                            {(() => {
                              try {
                                const parsed = JSON.parse(task.description);
                                if (parsed && typeof parsed === 'object' && 'text' in parsed) {
                                  return parsed.text || <span style={{ color: 'var(--neutral-muted)', fontStyle: 'italic' }}>{t('tasks.noDescription', 'Không có mô tả chi tiết công việc.')}</span>;
                                }
                              } catch (e) {}
                              return task.description || <span style={{ color: 'var(--neutral-muted)', fontStyle: 'italic' }}>Không có mô tả chi tiết công việc.</span>;
                            })()}
                          </div>
                        </div>

                        {taskSubtasks.length > 0 && (
                          <div>
                            <label style={{ fontWeight: '700', fontSize: '12px', display: 'block', marginBottom: '6px', color: '#475569' }}>
                              {t('tasks.subtaskChecklist', 'Checklist công việc phụ')} ({taskSubtasks.filter(st => st.status === 'Done').length}/{taskSubtasks.length})
                            </label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {taskSubtasks.map(st => (
                                <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', padding: '6px 8px', border: '1px solid #f1f5f9', borderRadius: '4px' }}>
                                  <input type="checkbox" checked={st.status === 'Done'} readOnly style={{ cursor: 'default' }} />
                                  <span style={{ textDecoration: st.status === 'Done' ? 'line-through' : 'none', color: st.status === 'Done' ? 'var(--neutral-muted)' : '#334155' }}>
                                    {st.title}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                          <div>Độ ưu tiên: <strong>{task.priority}</strong></div>
                          <div>Hạn chót: <strong>{task.due_date ? new Date(task.due_date).toLocaleDateString('vi-VN') : 'N/A'}</strong></div>
                          <div>Người nhận việc: <strong>{users.find(u => u.id === task.assignee_id)?.name || 'Chưa gán'}</strong></div>
                          <div>Người giao việc: <strong>{users.find(u => u.id === task.creator_id)?.name || 'N/A'}</strong></div>
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* 3. PROJECTS RIGHT PANE */}
                {activeDetailPopup === 'projects' && (
                  (() => {
                    const proj = myProjectsSorted.find(p => p.id === selectedProjectIdForPopup);
                    if (!proj) return <div style={{ textAlign: 'center', color: 'var(--neutral-muted)', padding: '24px 0' }}>{t('projects.selectProjectPrompt', 'Vui lòng chọn dự án để xem chi tiết.')}</div>;
                    const members = projectMembers.filter(m => m.project_id === proj.id).map(m => {
                      const u = users.find(usr => usr.id === m.user_id);
                      return { name: u?.name || 'Unknown', role: m.project_role };
                    });

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--primary-color)', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>
                              KEY: {proj.project_key}
                            </span>
                            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '6px 0 0 0' }}>{proj.name}</h2>
                          </div>
                          <span className="badge badge-warning">{(proj.status === 'Thực thi' || proj.status === 'Ongoing') ? 'ONGOING' : (proj.status === 'Giám sát' || proj.status === 'Monitoring') ? 'MONITORING' : (proj.status === 'Kết thúc' || proj.status === 'Finished') ? 'FINISHED' : (proj.status ? proj.status.toUpperCase() : 'ONGOING')}</span>
                        </div>

                        <div>
                          <label style={{ fontWeight: '700', fontSize: '12px', display: 'block', marginBottom: '4px', color: '#475569' }}>{t('projects.description', 'Mô tả dự án')}</label>
                          <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '13px', color: '#334155', minHeight: '60px', whiteSpace: 'pre-wrap' }}>
                            {proj.description || <span style={{ color: 'var(--neutral-muted)', fontStyle: 'italic' }}>{t('projects.noDescription', 'Không có mô tả chi tiết dự án.')}</span>}
                          </div>
                        </div>

                        <div>
                          <label style={{ fontWeight: '700', fontSize: '12px', display: 'block', marginBottom: '6px', color: '#475569' }}>
                            {t('projects.joinedMembers', 'Thành viên tham gia')} ({members.length})
                          </label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {members.map((m, idx) => (
                              <span key={idx} style={{ fontSize: '12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '16px', color: '#334155' }}>
                                {m.name} <em>({m.role})</em>
                              </span>
                            ))}
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: 'var(--neutral-muted)' }}>
                            {t('projects.endDate', 'Hạn kết thúc:')} <strong>{proj.end_date ? new Date(proj.end_date).toLocaleDateString('vi-VN') : t('projects.noEndDate', 'Chưa định hạn')}</strong>
                          </span>
                          <button className="btn btn-primary btn-sm" onClick={() => { setActiveDetailPopup(null); router.push(`/projects/${proj.id}`); }}>
                            <i className="fa-solid fa-arrow-up-right-from-square" style={{ marginRight: '6px' }}></i>
                            {t('projects.goToDetail', 'Chuyển hướng đến chi tiết dự án')}
                          </button>
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* 4. REPORTS RIGHT PANE */}
                {activeDetailPopup === 'reports' && (
                  isCheckingStatusMode ? (
                    renderCalendarChecker()
                  ) : selectedReportForPopup ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--neutral-border)', paddingBottom: '16px' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: users.find(u => u.id === selectedReportForPopup.user_id)?.color || '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px' }}>
                            {selectedReportForPopup.user_name.split(' ').pop().charAt(0)}
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>{selectedReportForPopup.user_name}</h3>
                            <span style={{ fontSize: '11px', color: 'var(--neutral-muted)', fontWeight: '600' }}>{selectedReportForPopup.user_role}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '11px', color: 'var(--neutral-muted)', display: 'block' }}>{t('reports.reportDateLabel', 'Báo cáo ngày:')}</span>
                          <strong style={{ fontSize: '12px', color: '#334155' }}>
                            {new Date(selectedReportForPopup.created_at).toLocaleDateString('vi-VN')}
                          </strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ 
                          fontSize: '11px', 
                          backgroundColor: selectedReportForPopup.status === 'Approved' ? 'var(--success-light)' : selectedReportForPopup.status === 'Rejected' ? 'var(--danger-light)' : 'var(--warning-light)', 
                          color: selectedReportForPopup.status === 'Approved' ? 'var(--success-color)' : selectedReportForPopup.status === 'Rejected' ? 'var(--danger-color)' : 'var(--warning-color)', 
                          padding: '3px 10px', 
                          borderRadius: '12px', 
                          fontWeight: '700' 
                        }}>
                          {t('reports.statusLabel', 'Trạng thái:')} {selectedReportForPopup.status === 'Approved' ? 'APPROVED' : selectedReportForPopup.status === 'Rejected' ? 'REJECTED' : 'PENDING'}
                        </span>
                      </div>

                      <div style={{ flex: 1 }}>
                        <label style={{ fontWeight: '700', fontSize: '12.5px', display: 'block', marginBottom: '6px', color: '#475569' }}>{t('reports.reportContentLabel', 'Nội dung báo cáo:')}</label>
                        <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.6', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '120px' }}>
                          {renderReportContentVisual(selectedReportForPopup.content, projects)}
                        </div>
                      </div>

                      {selectedReportForPopup.file_url && (
                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', display: 'flex', alignItems: 'center' }}>
                          <a 
                            href={selectedReportForPopup.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{ fontSize: '12.5px', color: 'var(--primary-color)', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', fontWeight: '600' }}
                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            <i className="fa-solid fa-paperclip"></i>
                            Tệp tài liệu đính kèm (Click để xem)
                          </a>
                        </div>
                      )}

                      {/* Approval comment and controls */}
                      <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {getCanReviewReport(selectedReportForPopup) ? (
                          <>
                            <div>
                              <label style={{ fontWeight: '750', fontSize: '12.5px', display: 'block', marginBottom: '6px', color: '#475569' }}>
                                {t('reports.managerCommentLabel', 'Ý kiến nhận xét/phản hồi của quản lý (Comment):')}
                              </label>
                              <textarea 
                                value={reportCommentText}
                                onChange={(e) => setReportCommentText(e.target.value)}
                                placeholder={t('reports.commentPlaceholder', 'Nhập nhận xét chi tiết của bạn tại đây trước khi duyệt hoặc từ chối báo cáo...')}
                                rows="3"
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1.5px solid #cbd5e1', outline: 'none', fontSize: '13px', resize: 'vertical' }}
                              />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
                              <button 
                                type="button" 
                                className="btn-action-reject"
                                disabled={submittingReview}
                                onClick={() => handleUpdateReportStatus('Rejected')}
                              >
                                <i className="fa-solid fa-circle-xmark" style={{ marginRight: '6px' }}></i>
                                Reject
                              </button>
                              <button 
                                type="button" 
                                className="btn-action-approve"
                                disabled={submittingReview}
                                onClick={() => handleUpdateReportStatus('Approved')}
                              >
                                <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }}></i>
                                Approval
                              </button>
                            </div>
                          </>
                        ) : (
                          selectedReportForPopup.comment && (
                            <div style={{ backgroundColor: '#f0fdf4', border: '1.5px dashed #b7ebc6', borderRadius: '6px', padding: '12px' }}>
                              <strong style={{ fontSize: '12.5px', color: '#1e4620', display: 'block', marginBottom: '4px' }}>
                                {t('reports.managerFeedbackLabel', 'Ý kiến phản hồi từ quản lý:')}
                              </strong>
                              <p style={{ fontSize: '13px', color: '#2b5a2e', margin: 0, whiteSpace: 'pre-wrap' }}>
                                {selectedReportForPopup.comment}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--neutral-muted)', padding: '24px 0' }}>{t('reports.selectReportPrompt', 'Vui lòng chọn báo cáo để xem chi tiết.')}</div>
                  )
                )}

              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer" style={{ borderTop: '1.5px solid #e2e8f0', padding: '12px 24px', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
              <button className="btn btn-secondary" onClick={() => setActiveDetailPopup(null)}>{t('common.close', 'Đóng')}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
