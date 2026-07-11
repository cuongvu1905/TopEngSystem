"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/utils/db';
import { TaskModal } from '@/components/Modals';
import { getSwal } from '@/utils/swal';

// Helper to check if a user is mentioned in an issue
const isMentionedInIssue = (issue, user, users) => {
  if (!user) return false;
  if (issue.assignee_id === user.id) return true;
  if (!issue.description) return false;
  try {
    const parsed = JSON.parse(issue.description);
    const assigneesText = parsed.assigneesText || '';
    const parts = assigneesText.split('@');
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const matchedUser = users.find(u => part.toLowerCase().startsWith(u.name.toLowerCase()));
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

// Helper to parse description from issue JSON
const parseIssueDescription = (desc) => {
  try {
    const data = JSON.parse(desc);
    if (data && typeof data === 'object') {
      return {
        text: data.text || '',
        issueTasks: data.issueTasks || [],
        assigneesText: data.assigneesText || ''
      };
    }
  } catch (e) {
    // ignore
  }
  return {
    text: desc || '',
    issueTasks: [],
    assigneesText: ''
  };
};

const getPerformerForTask = (task) => {
  if (!task.solutions || !Array.isArray(task.solutions)) return task.assignee || 'Chưa phân công';
  const executors = task.solutions
    .filter(s => s.action?.trim() && s.executor?.trim())
    .map(s => s.executor.trim());
  if (executors.length > 0) {
    const uniqueExecutors = Array.from(new Set(executors));
    return uniqueExecutors.map(name => name.startsWith('@') ? name : `@${name}`).join(' ');
  }
  return task.assignee || 'Chưa phân công';
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('vi-VN');
    }
  } catch (e) {}
  return dateStr;
};

export default function Dashboard() {
  const { currentUser, projects, tasks, subtasks, documents, notifications, projectMembers, users, reloadAll, hasPermission } = useApp();
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
  const [loadingIssueDetail, setLoadingIssueDetail] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  
  const [reportCommentText, setReportCommentText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Permissions helpers
  const isAdmin = currentUser?.system_role?.includes("Admin");
  const isHR = currentUser?.system_role?.includes("Nhân sự");
  
  const canAccessIssues = !isHR;
  const canAccessTasks = !isHR;
  const canAccessProjects = !isHR;
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
    .filter(issue => visibleProjectIds.has(issue.project_id) && isMentionedInIssue(issue, currentUser, users))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // 4. Resolve Daily Reports (Role-filtered and Padded)
  const getFilteredReports = () => {
    const systemRole = currentUser.system_role || '';
    const isAdminOrManagement = systemRole.includes("Admin") || systemRole.includes("BOD") || systemRole.includes("HR");

    // Projects where current user is PM
    const myPMProjects = projectMembers.filter(m => m.user_id === currentUser.id && m.project_role === 'PM').map(m => m.project_id);
    const isPM = myPMProjects.length > 0;

    if (isAdminOrManagement) {
      // Ban quản trị: Xem báo cáo của Leader
      const pmUserIds = new Set(projectMembers.filter(m => m.project_role === 'PM').map(m => m.user_id));
      const leaderUserIds = new Set(
        users.filter(u => u.system_role?.includes("Leader")).map(u => u.id)
      );
      pmUserIds.forEach(id => leaderUserIds.add(id));

      return allReports.filter(r => leaderUserIds.has(r.user_id));
    } else if (systemRole.includes("Leader") || isPM) {
      // Leader: Hiển thị báo cáo của thành viên dự án quản lý
      const memberUserIds = new Set(
        projectMembers.filter(m => myPMProjects.includes(m.project_id) && m.user_id !== currentUser.id).map(m => m.user_id)
      );
      if (memberUserIds.size > 0) {
        return allReports.filter(r => memberUserIds.has(r.user_id));
      } else {
        return allReports.filter(r => r.user_id === currentUser.id);
      }
    } else {
      // Staff: Hiển thị báo cáo bản thân
      return allReports.filter(r => r.user_id === currentUser.id);
    }
  };

  const padReports = (reportList) => {
    if (reportList.length >= 3) return reportList;
    const mockList = [...reportList];
    const sampleReports = [
      {
        id: 'mock-report-1',
        user_id: 'user-mock-1',
        user_name: 'Trần Thế An',
        user_role: 'Leader/Part Leader',
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        content: 'Báo cáo ngày: Đã hoàn thành thiết kế luồng API cho phân hệ Quản lý dự án. Hiện tại đang triển khai giao diện chi tiết JIRA board. Không gặp khó khăn gì.',
        project_id: null,
        status: 'Pending',
        comment: ''
      },
      {
        id: 'mock-report-2',
        user_id: 'user-mock-2',
        user_name: 'Lê Thị Bình',
        user_role: 'Nhân viên (Staff)',
        created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        content: 'Báo cáo tiến độ: Đã kiểm thử lại luồng chat trực tiếp 1-1 và sửa một số lỗi giao diện CSS bị lệch trên trình duyệt di động. Kế hoạch ngày mai kiểm thử tiếp phân hệ Tài liệu.',
        project_id: null,
        status: 'Pending',
        comment: ''
      },
      {
        id: 'mock-report-3',
        user_id: 'user-mock-3',
        user_name: 'Phạm Minh Cường',
        user_role: 'Nhân viên (Staff)',
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        content: 'Báo cáo ngày: Đã hoàn thiện đồng bộ dữ liệu MockDB với cơ sở dữ liệu MySQL cục bộ. Toàn bộ các API chính đã được chuyển đổi sang kết nối MySQL thành công.',
        project_id: null,
        status: 'Pending',
        comment: ''
      }
    ];

    for (let i = mockList.length; i < 3; i++) {
      mockList.push({
        ...sampleReports[i],
        created_at: new Date(Date.now() - (i + 1) * 3600000 * 4).toISOString()
      });
    }
    return mockList;
  };

  const reportsFiltered = getFilteredReports();
  const reportsPadded = padReports(reportsFiltered);

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
      const first = reportsPadded[0] || null;
      setSelectedReportForPopup(first);
      setReportCommentText(first?.comment || '');
    }
  };

  const loadIssueDetail = async (issueId) => {
    try {
      setLoadingIssueDetail(true);
      const res = await db.getIssueDetail(issueId);
      setSelectedIssueDetail(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingIssueDetail(false);
    }
  };

  // Fetch issue details on selectedIssueIdForPopup change
  useEffect(() => {
    if (selectedIssueIdForPopup) {
      loadIssueDetail(selectedIssueIdForPopup);
    } else {
      setSelectedIssueDetail(null);
    }
  }, [selectedIssueIdForPopup]);

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
    const isMock = String(selectedReportForPopup.id).startsWith('mock-');
    const Swal = await getSwal();
    if (isMock) {
      Swal.fire({ icon: 'warning', title: 'Cảnh báo', text: "Không thể duyệt hoặc từ chối báo cáo mẫu." });
      return;
    }
    try {
      setSubmittingReview(true);
      await db.updateDailyReportStatus(selectedReportForPopup.id, status, reportCommentText);
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
      return reportsPadded.filter(item => {
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
    return (currentUser.id !== rep.user_id) && 
      (isAdmin || isHR || currentUser.system_role.includes("BOD") || currentUser.system_role.includes("Leader") || isPM);
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
          width: 50vw;
          flex: 0 0 50vw;
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
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--neutral-dark)' }}>Giao diện Tổng quan</h1>
          <p style={{ fontSize: '13px', color: 'var(--neutral-muted)', marginTop: '2px' }}>
            Xin chào, <strong>{currentUser.name}</strong> ({currentUser.system_role}). Dưới đây là hoạt động hôm nay của bạn.
          </p>
        </div>
        <div style={{ position: 'relative' }}>
          <button className="config-btn" onClick={() => setShowConfigDropdown(!showConfigDropdown)}>
            <i className="fa-solid fa-sliders"></i>
            Tùy chỉnh Dashboard
          </button>
          {showConfigDropdown && (
            <div className="config-dropdown">
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--neutral-muted)', paddingBottom: '4px', borderBottom: '1px solid #f1f5f9', marginBottom: '4px' }}>
                Chọn thẻ hiển thị
              </span>
              <label className="config-dropdown-item" style={{ opacity: canAccessIssues ? 1 : 0.5 }}>
                <input 
                  type="checkbox" 
                  checked={visibleSections.issues} 
                  disabled={!canAccessIssues}
                  onChange={() => handleToggleSection('issues')} 
                />
                Vướng mắc (Issues)
              </label>
              <label className="config-dropdown-item" style={{ opacity: canAccessTasks ? 1 : 0.5 }}>
                <input 
                  type="checkbox" 
                  checked={visibleSections.tasks} 
                  disabled={!canAccessTasks}
                  onChange={() => handleToggleSection('tasks')} 
                />
                Việc cần làm (Tasks)
              </label>
              <label className="config-dropdown-item" style={{ opacity: canAccessProjects ? 1 : 0.5 }}>
                <input 
                  type="checkbox" 
                  checked={visibleSections.projects} 
                  disabled={!canAccessProjects}
                  onChange={() => handleToggleSection('projects')} 
                />
                Dự án tham gia
              </label>
              <label className="config-dropdown-item" style={{ opacity: canAccessReports ? 1 : 0.5 }}>
                <input 
                  type="checkbox" 
                  checked={visibleSections.reports} 
                  disabled={!canAccessReports}
                  onChange={() => handleToggleSection('reports')} 
                />
                Báo cáo hàng ngày
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
              <p>Issue được Mention</p>
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
              <p>Công việc được giao</p>
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
              <p>Dự án tham gia</p>
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
              <p>Báo cáo ghi nhận</p>
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
                  Không có vướng mắc nào nhắc tên bạn.
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
              <h3 className="widget-box-title">Việc cần làm</h3>
            </div>
            <div className="widget-box-body">
              {loadingData ? (
                <div className="empty-widget-state"><i className="fa-solid fa-circle-notch fa-spin"></i> Đang tải dữ liệu...</div>
              ) : myTasksSorted.length === 0 ? (
                <div className="empty-widget-state">
                  <i className="fa-solid fa-calendar-check" style={{ fontSize: '28px', color: 'var(--success-color)' }}></i>
                  Tuyệt vời! Bạn không có việc nào chưa hoàn thành.
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
              <h3 className="widget-box-title">Dự án</h3>
            </div>
            <div className="widget-box-body">
              {loadingData ? (
                <div className="empty-widget-state"><i className="fa-solid fa-circle-notch fa-spin"></i> Đang tải dữ liệu...</div>
              ) : myProjectsSorted.length === 0 ? (
                <div className="empty-widget-state">
                  <i className="fa-solid fa-folder" style={{ fontSize: '28px' }}></i>
                  Bạn chưa được phân công vào dự án nào.
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
                        <span className="badge badge-info">{proj.status || 'Thực thi'}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--neutral-muted)', margin: '4px 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {proj.description || 'Không có mô tả dự án.'}
                      </p>
                      <div style={{ marginTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '11px', fontWeight: 'bold' }}>
                          <span>Tiến độ</span>
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
              <h3 className="widget-box-title">Báo cáo</h3>
            </div>
            <div className="widget-box-body">
              {loadingData ? (
                <div className="empty-widget-state"><i className="fa-solid fa-circle-notch fa-spin"></i> Đang tải dữ liệu...</div>
              ) : (
                <div className="reports-grid-dashboard">
                  {reportsPadded.slice(0, 3).map((report, idx) => {
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
                              {report.status === 'Approved' ? 'Đã duyệt' : report.status === 'Rejected' ? 'Từ chối' : 'Chờ duyệt'}
                            </span>
                          </div>
                        </div>

                        {report.project_id && (
                          <span style={{ display: 'inline-block', alignSelf: 'flex-start', fontSize: '9.5px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '8px', fontWeight: '600', marginTop: '2px' }}>
                            {proj?.name || 'Dự án'}
                          </span>
                        )}

                        <div className="report-snippet" style={{ marginTop: '2px' }}>
                          {report.content}
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
              width: '75vw', 
              height: '75vh', 
              backgroundColor: '#ffffff', 
              border: '1.5px solid #cbd5e1', 
              borderRadius: '12px', 
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
                {activeDetailPopup === 'issues' && "Chi tiết vướng mắc được Mention"}
                {activeDetailPopup === 'tasks' && "Chi tiết công việc được giao"}
                {activeDetailPopup === 'projects' && "Chi tiết dự án tham gia"}
                {activeDetailPopup === 'reports' && "Chi tiết báo cáo ngày"}
              </h3>
              <button className="btn-close-modal" style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '18px', color: '#64748b' }} onClick={() => setActiveDetailPopup(null)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Split Content Body */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              
              {/* Left Pane: Master List (25vw width) */}
              <div className="split-left-pane-25" style={{ padding: '16px', borderRight: '1.5px solid #cbd5e1', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Search Bar Oval shape */}
                <div>
                  <input 
                    type="text" 
                    placeholder="Search" 
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
                        <option value="">Độ ưu tiên (Tất cả)</option>
                        <option value="CRITICAL">CRITICAL</option>
                        <option value="HIGH">HIGH</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="LOW">LOW</option>
                      </select>
                      <select value={popupFilter2} onChange={(e) => setPopupFilter2(e.target.value)} className="rectangular-filter-select">
                        <option value="">Loại Issue (Tất cả)</option>
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
                        <option value="">Trạng thái (Tất cả)</option>
                        <option value="Todo">Todo</option>
                        <option value="InProgress">InProgress</option>
                        <option value="Review">Review</option>
                        <option value="Done">Done</option>
                      </select>
                    </>
                  )}

                  {activeDetailPopup === 'projects' && (
                    <select value={popupFilter1} onChange={(e) => setPopupFilter1(e.target.value)} className="rectangular-filter-select">
                      <option value="">Trạng thái dự án (Tất cả)</option>
                      <option value="Thực thi">Thực thi</option>
                      <option value="Giám sát">Giám sát</option>
                      <option value="Kết thúc">Kết thúc</option>
                    </select>
                  )}

                  {activeDetailPopup === 'reports' && (
                    <>
                      <select value={popupFilter1} onChange={(e) => setPopupFilter1(e.target.value)} className="rectangular-filter-select">
                        <option value="">Dự án liên kết (Tất cả)</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <select value={popupFilter2} onChange={(e) => setPopupFilter2(e.target.value)} className="rectangular-filter-select">
                        <option value="">Trạng thái duyệt (Tất cả)</option>
                        <option value="Pending">Chờ duyệt</option>
                        <option value="Approved">Đã duyệt</option>
                        <option value="Rejected">Từ chối</option>
                      </select>
                    </>
                  )}
                </div>

                {/* Items List (Scrollable) */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  {getFilteredItems().length === 0 ? (
                    <div style={{ color: 'var(--neutral-muted)', fontSize: '12.5px', textAlign: 'center', padding: '24px 0' }}>Không tìm thấy dữ liệu.</div>
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
                        cardBadgeText = item.status || 'Thực thi';
                        cardBadgeColor = 'var(--primary-color)';
                      } else if (activeDetailPopup === 'reports') {
                        isActive = item.id === selectedReportForPopup?.id;
                        cardTitle = item.user_name;
                        cardSubtext = new Date(item.created_at).toLocaleDateString('vi-VN');
                        cardBadgeText = item.status === 'Approved' ? 'Duyệt' : item.status === 'Rejected' ? 'Từ chối' : 'Chờ';
                        cardBadgeColor = item.status === 'Approved' ? 'var(--success-color)' : item.status === 'Rejected' ? 'var(--danger-color)' : 'var(--warning-color)';
                      }

                      return (
                        <div 
                          key={item.id} 
                          className={`split-card-item ${isActive ? 'active' : ''}`}
                          onClick={() => {
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', alignItems: 'center' }}>
                        <div>
                          <Link href={`/projects/${selectedIssueDetail.issue.project_id}?issueId=${selectedIssueDetail.issue.id}`} style={{ textDecoration: 'none' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--primary-color)', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="Xem chi tiết trong dự án">
                              {selectedIssueDetail.issue.issue_key} <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '9px' }}></i>
                            </span>
                          </Link>
                          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '6px 0 0 0' }}>
                            <Link href={`/projects/${selectedIssueDetail.issue.project_id}?issueId=${selectedIssueDetail.issue.id}`} style={{ color: '#0f172a', textDecoration: 'none' }} title="Xem chi tiết trong dự án">
                              {selectedIssueDetail.issue.summary}
                            </Link>
                          </h2>
                        </div>
                        <span className={`badge ${selectedIssueDetail.issue.status === 'Done' ? 'badge-success' : 'badge-warning'}`}>{selectedIssueDetail.issue.status}</span>
                      </div>

                      <div>
                        <label style={{ fontWeight: '700', fontSize: '12px', display: 'block', marginBottom: '4px', color: '#475569' }}>Mô tả chi tiết</label>
                        <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '13px', color: '#334155', minHeight: '60px', whiteSpace: 'pre-wrap' }}>
                          {parseIssueDescription(selectedIssueDetail.issue.description).text || <span style={{ color: 'var(--neutral-muted)', fontStyle: 'italic' }}>Không có mô tả chi tiết.</span>}
                        </div>
                      </div>

                      {parseIssueDescription(selectedIssueDetail.issue.description).issueTasks?.length > 0 && (
                        <div>
                          <label style={{ fontWeight: '700', fontSize: '12px', display: 'block', marginBottom: '6px', color: '#475569' }}>Bảng chi tiết công việc phụ & giải pháp</label>
                          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f1f5f9' }}>
                                <th style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'left', width: '40%' }}>Tên công việc phụ</th>
                                <th style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'left', width: '25%' }}>Người thực hiện</th>
                                <th style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'left', width: '20%' }}>Hạn chót</th>
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
                          Bình luận trao đổi ({selectedIssueDetail.comments?.length || 0})
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', marginBottom: '12px' }}>
                          {selectedIssueDetail.comments?.length === 0 ? (
                            <div style={{ color: 'var(--neutral-muted)', fontSize: '11px', fontStyle: 'italic', textAlign: 'center' }}>Chưa có trao đổi nào.</div>
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
                            placeholder="Nhập câu trả lời hoặc thảo luận..." 
                            value={newCommentText} 
                            onChange={(e) => setNewCommentText(e.target.value)} 
                            style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '12.5px', outline: 'none' }}
                            required
                          />
                          <button type="submit" className="btn btn-primary btn-sm">Gửi</button>
                        </form>
                      </div>

                      {/* Metadata */}
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                        <div>Độ ưu tiên: <strong>{selectedIssueDetail.issue.priority}</strong></div>
                        <div>Loại issue: <strong>{selectedIssueDetail.issue.type}</strong></div>
                        <div>Người báo cáo: <strong>{users.find(u => u.id === selectedIssueDetail.issue.reporter_id)?.name || 'N/A'}</strong></div>
                        <div>Ngày tạo: <strong>{new Date(selectedIssueDetail.issue.created_at).toLocaleDateString('vi-VN')}</strong></div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--neutral-muted)', padding: '24px 0' }}>Vui lòng chọn vướng mắc để xem chi tiết.</div>
                  )
                )}

                {/* 2. TASKS RIGHT PANE */}
                {activeDetailPopup === 'tasks' && (
                  (() => {
                    const task = myTasksSorted.find(t => t.id === selectedTaskIdForPopup);
                    if (!task) return <div style={{ textAlign: 'center', color: 'var(--neutral-muted)', padding: '24px 0' }}>Vui lòng chọn công việc để xem chi tiết.</div>;
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
                          <label style={{ fontWeight: '700', fontSize: '12px', display: 'block', marginBottom: '4px', color: '#475569' }}>Mô tả công việc</label>
                          <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '13px', color: '#334155', minHeight: '60px', whiteSpace: 'pre-wrap' }}>
                            {(() => {
                              try {
                                const parsed = JSON.parse(task.description);
                                if (parsed && typeof parsed === 'object' && 'text' in parsed) {
                                  return parsed.text || <span style={{ color: 'var(--neutral-muted)', fontStyle: 'italic' }}>Không có mô tả chi tiết công việc.</span>;
                                }
                              } catch (e) {}
                              return task.description || <span style={{ color: 'var(--neutral-muted)', fontStyle: 'italic' }}>Không có mô tả chi tiết công việc.</span>;
                            })()}
                          </div>
                        </div>

                        {taskSubtasks.length > 0 && (
                          <div>
                            <label style={{ fontWeight: '700', fontSize: '12px', display: 'block', marginBottom: '6px', color: '#475569' }}>
                              Checklist công việc phụ ({taskSubtasks.filter(st => st.status === 'Done').length}/{taskSubtasks.length})
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
                    if (!proj) return <div style={{ textAlign: 'center', color: 'var(--neutral-muted)', padding: '24px 0' }}>Vui lòng chọn dự án để xem chi tiết.</div>;
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
                          <span className="badge badge-warning">{proj.status || 'Thực thi'}</span>
                        </div>

                        <div>
                          <label style={{ fontWeight: '700', fontSize: '12px', display: 'block', marginBottom: '4px', color: '#475569' }}>Mô tả dự án</label>
                          <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '13px', color: '#334155', minHeight: '60px', whiteSpace: 'pre-wrap' }}>
                            {proj.description || <span style={{ color: 'var(--neutral-muted)', fontStyle: 'italic' }}>Không có mô tả chi tiết dự án.</span>}
                          </div>
                        </div>

                        <div>
                          <label style={{ fontWeight: '700', fontSize: '12px', display: 'block', marginBottom: '6px', color: '#475569' }}>
                            Thành viên tham gia ({members.length})
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
                            Hạn kết thúc: <strong>{proj.end_date ? new Date(proj.end_date).toLocaleDateString('vi-VN') : 'Chưa định hạn'}</strong>
                          </span>
                          <button className="btn btn-primary btn-sm" onClick={() => { setActiveDetailPopup(null); router.push(`/projects/${proj.id}`); }}>
                            <i className="fa-solid fa-arrow-up-right-from-square" style={{ marginRight: '6px' }}></i>
                            Chuyển hướng đến chi tiết dự án
                          </button>
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* 4. REPORTS RIGHT PANE */}
                {activeDetailPopup === 'reports' && (
                  selectedReportForPopup ? (
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
                          <span style={{ fontSize: '11px', color: 'var(--neutral-muted)', display: 'block' }}>Thời gian gửi:</span>
                          <strong style={{ fontSize: '12px', color: '#334155' }}>
                            {new Date(selectedReportForPopup.created_at).toLocaleString('vi-VN')}
                          </strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {selectedReportForPopup.project_id && (
                          <span style={{ fontSize: '11px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 10px', borderRadius: '12px', fontWeight: '600' }}>
                            <i className="fa-solid fa-folder" style={{ marginRight: '4px' }}></i>
                            Dự án liên kết: {projects.find(p => p.id === selectedReportForPopup.project_id)?.name || 'N/A'}
                          </span>
                        )}
                        <span style={{ 
                          fontSize: '11px', 
                          backgroundColor: selectedReportForPopup.status === 'Approved' ? 'var(--success-light)' : selectedReportForPopup.status === 'Rejected' ? 'var(--danger-light)' : 'var(--warning-light)', 
                          color: selectedReportForPopup.status === 'Approved' ? 'var(--success-color)' : selectedReportForPopup.status === 'Rejected' ? 'var(--danger-color)' : 'var(--warning-color)', 
                          padding: '3px 10px', 
                          borderRadius: '12px', 
                          fontWeight: '700' 
                        }}>
                          Trạng thái: {selectedReportForPopup.status === 'Approved' ? 'ĐÃ DUYỆT' : selectedReportForPopup.status === 'Rejected' ? 'TỪ CHỐI BÁO CÁO' : 'CHỜ PHÊ DUYỆT'}
                        </span>
                      </div>

                      <div style={{ flex: 1 }}>
                        <label style={{ fontWeight: '700', fontSize: '12.5px', display: 'block', marginBottom: '6px', color: '#475569' }}>Nội dung báo cáo:</label>
                        <div style={{ fontSize: '13px', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: '1.6', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '120px' }}>
                          {selectedReportForPopup.content}
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
                                Ý kiến nhận xét/phản hồi của quản lý (Comment):
                              </label>
                              <textarea 
                                value={reportCommentText}
                                onChange={(e) => setReportCommentText(e.target.value)}
                                placeholder="Nhập nhận xét chi tiết của bạn tại đây trước khi duyệt hoặc từ chối báo cáo..."
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
                                Ý kiến phản hồi từ quản lý:
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
                    <div style={{ textAlign: 'center', color: 'var(--neutral-muted)', padding: '24px 0' }}>Vui lòng chọn báo cáo để xem chi tiết.</div>
                  )
                )}

              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer" style={{ borderTop: '1.5px solid #e2e8f0', padding: '12px 24px', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
              <button className="btn btn-secondary" onClick={() => setActiveDetailPopup(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
