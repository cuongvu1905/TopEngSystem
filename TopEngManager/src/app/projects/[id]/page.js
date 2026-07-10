"use client";

import React, { useState, useEffect, useRef, use } from 'react';
import { useApp } from '@/context/AppContext';
import { db, MockDB } from '@/utils/db';
import { StreamChatAdapter } from '@/utils/streamChatClient';
import { ProjectModal, TaskModal, DocumentModal } from '@/components/Modals';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
        assigneesText: data.assigneesText || ''
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

export default function ProjectDetail({ params }) {
  const { id: projectId } = use(params);
  const searchParams = useSearchParams();
  const queryIssueId = searchParams.get('issueId');
  const { currentUser, projects, tasks, documents, documentVersions, documentCategories, projectMembers, users, chatRooms, chatRoomMembers, reloadAll, hasPermission } = useApp();

  const [activeSubTab, setActiveSubTab] = useState('kanban');

  useEffect(() => {
    if (queryIssueId) {
      setActiveSubTab('issues');
      handleOpenIssueDetail(queryIssueId);
    }
  }, [queryIssueId]);
  
  // Chat state inside project room
  const [chatRoomId, setChatRoomId] = useState(null);
  
  // Project reports states
  const [projectReports, setProjectReports] = useState([]);
  const [isReportsLoading, setIsReportsLoading] = useState(false);

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
          const matchedUser = users.find(u => part.toLowerCase().startsWith(u.name.toLowerCase()));
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
      const matchedUser = users.find(u => part.toLowerCase().startsWith(u.name.toLowerCase()));
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

  const handleSaveAssigneeText = async (targetId) => {
    if (!activeIssueDetail) return;
    const assigneeUser = users.find(u => u.id === targetId);
    const calculatedAssigneesText = assigneeUser ? `@${assigneeUser.name} ` : '';

    const newDescription = JSON.stringify({
      text: detailText,
      issueTasks: projectTasks,
      assigneesText: calculatedAssigneesText
    });

    try {
      const updatedIssue = { 
        ...activeIssueDetail, 
        assignee_id: targetId || null,
        description: newDescription
      };
      await db.updateIssue(updatedIssue, currentUser.id);
      
      // Send notifications
      await notifyMentionedUsers(calculatedAssigneesText, activeIssueDetail.issue_key, activeIssueDetail.summary, activeIssueDetail.id);

      await loadIssueDetail(activeIssueDetail.id);
      loadIssues();
      setIsEditingAssignee(false);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi cập nhật người chịu trách nhiệm: " + err.message });
    }
  };

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

  // Modals state
  const [isProjModalOpen, setIsProjModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  const [draggedTaskId, setDraggedTaskId] = useState(null);

  const project = projects.find(p => p.id === projectId);

  const filteredCreateAssignees = projectMembers
    .filter(m => m.project_id === projectId)
    .map(m => {
      const u = users.find(usr => usr.id === m.user_id);
      return u ? { ...u, project_role: m.project_role } : null;
    })
    .filter(Boolean)
    .filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(jiraCreateAssigneeSearchQuery.toLowerCase()) ||
                            u.email.toLowerCase().includes(jiraCreateAssigneeSearchQuery.toLowerCase());
      const matchesDept = !jiraCreateAssigneeSelectedDept || u.department_id === jiraCreateAssigneeSelectedDept;
      return matchesSearch && matchesDept;
    });

  const filteredDetailAssignees = projectMembers
    .filter(m => m.project_id === projectId)
    .map(m => {
      const u = users.find(usr => usr.id === m.user_id);
      return u ? { ...u, project_role: m.project_role } : null;
    })
    .filter(Boolean)
    .filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(jiraDetailAssigneeSearchQuery.toLowerCase()) ||
                            u.email.toLowerCase().includes(jiraDetailAssigneeSearchQuery.toLowerCase());
      const matchesDept = !jiraDetailAssigneeSelectedDept || u.department_id === jiraDetailAssigneeSelectedDept;
      return matchesSearch && matchesDept;
    });

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
      const list = await db.getDailyReports(currentUser.id, currentUser.system_role);
      const filtered = list.filter(r => r.project_id === projectId);
      setProjectReports(filtered);
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

  // Issue Detail & Comments & History handlers
  const loadIssueDetail = async (issueId) => {
    try {
      const res = await db.getIssueDetail(issueId);
      setActiveIssueDetail(res.issue);
      setIssueComments(res.comments);
      setIssueHistory(res.history);
      
      const parsed = parseDescription(res.issue.description);
      
      setDetailText(parsed.text || '');
      setEditIssueDesc(parsed.text || '');
      setJiraDetailDeadline(parsed.deadline || '');
      setJiraDetailHienTrang(parsed.hientrang || '');
      setJiraDetailNguyenNhan(parsed.nguyennhan || '');
      setJiraDetailHuongGiaiQuyet(parsed.huonggiaiquyet || '');
      setJiraDetailKetQua(parsed.ketqua || '');
      setDetailAssigneesText(parsed.assigneesText || (res.issue.assignee_id ? `@${users.find(u => u.id === res.issue.assignee_id)?.name || ''} ` : ''));
      
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
    } catch (e) {
      console.error("Failed to load issue detail:", e);
    }
  };

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
            executor: '',
            date: ''
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

  const handleSaveAllIssueTasks = async () => {
    if (!activeIssueDetail) return;
    if (activeIssueDetail.status === 'DONE') {
      if (!jiraDetailHienTrang.trim() || !jiraDetailNguyenNhan.trim() || !jiraDetailHuongGiaiQuyet.trim() || !jiraDetailKetQua.trim()) {
        Swal.fire({ icon: 'warning', title: 'Cảnh báo', text: "Lỗi: Trạng thái Issue hiện tại là DONE. Chỉ khi cả 4 mục (Hiện trạng, Nguyên nhân, Hướng giải quyết, Kết quả) đều có thông tin mới có thể lưu!" });
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
        assigneesText: detailAssigneesText
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
  };

  const handleOpenIssueDetail = (issueId) => {
    loadIssueDetail(issueId);
    setIsDetailModalOpen(true);
    setIsEditingIssue(false);
  };

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
    let activeChannel = null;
    const initStreamChannel = async () => {
      if (StreamChatAdapter.isEnabled() && chatRoomId && project) {
        const channel = await StreamChatAdapter.joinChannel(chatRoomId, `📂 Dự án: ${project.name}`);
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

  // Check access permission
  const isProjectMember = projectMembers.some(m => m.project_id === projectId && m.user_id === currentUser.id);
  const hasAccess = hasPermission('view_all_projects') || isProjectMember;

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
    const userId = e.target.elements.userId.value;
    const role = e.target.elements.role.value;
    if (!userId || !role) return;

    await db.addProjectMember(projectId, userId, role);
    const u = users.find(usr => usr.id === userId);
    await db.logActivity(currentUser.id, "ADD_MEMBER", "Project", projectId, `đã thêm thành viên '${u ? u.name : userId}' với vai trò ${role}`);
    
    e.target.reset();
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

  return (
    <div className="scrollable-view">
      <div className="view-header" style={{ marginBottom: '12px' }}>
        <div className="view-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link href="/projects" style={{ fontSize: '18px', color: 'var(--neutral-muted)' }}>
              <i className="fa-solid fa-arrow-left"></i>
            </Link>
            <h2>Dự án: {project.name}</h2>
          </div>
          <p>{project.description || 'Không có mô tả.'}</p>
        </div>
        <div className="view-actions" style={{ display: 'flex', gap: '8px' }}>
          {project.is_public && (
            <Link href={`/public-projects/${projectId}`} target="_blank" className="btn btn-secondary">
              <i className="fa-solid fa-globe"></i> Xem trang công khai
            </Link>
          )}
          {canManageProject && (
            <button className="btn btn-secondary" onClick={() => setIsProjModalOpen(true)}>
              <i className="fa-solid fa-pen"></i> Chỉnh sửa
            </button>
          )}
        </div>
      </div>

      <div className="project-meta-strip">
        <div className="project-meta-item">
          <label>Trạng thái</label>
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
              <option value="Khởi tạo">Khởi tạo</option>
              <option value="Lập kế hoạch">Lập kế hoạch</option>
              <option value="Thực thi">Thực thi</option>
              <option value="Giám sát">Giám sát</option>
              <option value="Kết thúc">Kết thúc</option>
            </select>
          ) : (
            <span><span className="badge badge-info">{project.status}</span></span>
          )}
        </div>
        <div className="project-meta-item">
          <label>Thời gian</label>
          {canManageProject ? (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input
                type="date"
                value={project.start_date || ''}
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
                value={project.end_date || ''}
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
            <span>{project.start_date} ~ {project.end_date}</span>
          )}
        </div>
        <div className="project-meta-item">
          <label>Số lượng việc</label>
          <span>{pTasks.length} công việc</span>
        </div>
        <div className="project-meta-item" style={{ flex: 1, maxWidth: '250px' }}>
          <label>Tiến độ dự án</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="progress-bar-outer" style={{ flex: 1, height: '6px' }}>
              <div className="progress-bar-inner" style={{ width: `${progress}%` }}></div>
            </div>
            <span style={{ fontWeight: 600, fontSize: '12px' }}>{progress}%</span>
          </div>
        </div>
      </div>

      <div className="project-tabs" style={{ marginTop: '20px' }}>
        <button className={`tab-btn ${activeSubTab === 'kanban' ? 'active' : ''}`} onClick={() => setActiveSubTab('kanban')}><i className="fa-solid fa-cubes"></i> Bảng Kanban</button>
        <button className={`tab-btn ${activeSubTab === 'gantt' ? 'active' : ''}`} onClick={() => setActiveSubTab('gantt')}><i className="fa-solid fa-chart-gantt"></i> Biểu đồ Gantt</button>
        <button className={`tab-btn ${activeSubTab === 'issues' ? 'active' : ''}`} onClick={() => setActiveSubTab('issues')}><i className="fa-solid fa-triangle-exclamation"></i> Vấn đề (Issues)</button>
        <button className={`tab-btn ${activeSubTab === 'members' ? 'active' : ''}`} onClick={() => setActiveSubTab('members')}><i className="fa-solid fa-users"></i> Thành viên</button>
        <button className={`tab-btn ${activeSubTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveSubTab('documents')}><i className="fa-solid fa-file-invoice"></i> Tài liệu</button>
        <button className={`tab-btn ${activeSubTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveSubTab('reports')}><i className="fa-solid fa-file-signature"></i> Báo cáo</button>
        <button className={`tab-btn ${activeSubTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveSubTab('chat')}><i className="fa-solid fa-comments"></i> Kênh Thảo luận</button>
      </div>

      <div className="project-tab-content">
        {/* ================= TABS: KANBAN ================= */}
        {activeSubTab === 'kanban' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Phân công công việc</h3>
              {canManageTasks && (
                <button className="btn btn-primary btn-sm" onClick={() => { setActiveTaskId(null); setIsTaskModalOpen(true); }}>
                  <i className="fa-solid fa-plus"></i> Giao việc mới
                </button>
              )}
            </div>
            
            <div className="kanban-board">
              {[
                { id: "Todo", title: "Cần làm", class: "todo" },
                { id: "InProgress", title: "Đang làm", class: "inprogress" },
                { id: "Review", title: "Đang duyệt", class: "review" },
                { id: "Done", title: "Hoàn thành", class: "done" }
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
                      {colTasks.map(t => {
                        const u = users.find(usr => usr.id === t.assignee_id);
                        const isOverdue = new Date(t.due_date) < new Date() && t.status !== "Done";
                        let pClass = "badge-info";
                        if (t.priority === "Cao") pClass = "badge-danger";
                        else if (t.priority === "Trung bình") pClass = "badge-warning";
                        else pClass = "badge-success";

                        return (
                          <div 
                            className="task-card" 
                            draggable 
                            onDragStart={() => setDraggedTaskId(t.id)} 
                            onClick={() => openTaskDetail(t.id)}
                            key={t.id}
                          >
                            <div className="task-card-header">
                              <span className={`badge ${pClass}`}>{t.priority}</span>
                              <div className="task-card-assignee" style={{ backgroundColor: u ? u.color : 'var(--neutral-muted)' }} title={u ? u.name : 'Chưa giao'}>
                                {u ? u.name.split(" ").pop().charAt(0) : '?'}
                              </div>
                            </div>
                            <div className="task-card-title">{t.title}</div>
                            <p className="task-card-desc">{t.description || 'Không có mô tả.'}</p>
                            <div className="task-card-meta">
                              <span className={`task-card-due ${isOverdue ? 'overdue' : ''}`}>
                                <i className="fa-regular fa-clock"></i> {t.due_date || 'Không hạn'}
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
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Timeline Timeline Tiến độ</h3>
              <p className="text-muted" style={{ fontSize: '11.5px' }}>Phác họa thời hạn chót và trạng thái của từng đầu việc.</p>
            </div>
            <div className="gantt-chart-wrapper">
              {pTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--neutral-muted)' }}>Chưa có công việc nào.</div>
              ) : (
                pTasks
                  .sort((a,b) => new Date(a.due_date || '2030-01-01') - new Date(b.due_date || '2030-01-01'))
                  .map(t => {
                    let left = 25, width = 40;
                    if (t.priority === "Cao") { left = 10; width = 25; }
                    else if (t.priority === "Thấp") { left = 45; width = 30; }
                    if (t.status === "Done") { left = 5; width = 90; }

                    return (
                      <div className="gantt-row" key={t.id}>
                        <div className="gantt-task-name" onClick={() => openTaskDetail(t.id)} style={{ cursor: 'pointer' }}>{t.title}</div>
                        <div className="gantt-timeline-container">
                          <div className={`gantt-bar ${t.status.toLowerCase()}`} style={{ left: `${left}%`, width: `${width}%` }}>
                            <span>Hạn: {t.due_date || 'Không có'} ({t.status})</span>
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
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--neutral-dark)' }}>Bảng Kanban Vấn đề (Issues Board)</h3>
              {canPostIssue && (
                <button className="btn btn-primary btn-sm" onClick={() => {
                  setIssueTitle('');
                  setIssueDesc('');
                  setIssueType('TASK');
                  setIssueStatus('TO_DO');
                  setIssuePriority('MEDIUM');
                  setIssueAssigneeId('');
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
                  <i className="fa-solid fa-plus"></i> Tạo Issue mới
                </button>
              )}
            </div>

            {/* JIRA Filters Row */}
            <div className="doc-filters" style={{ marginBottom: '20px', padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid var(--neutral-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '200px' }}>
                  <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--neutral-muted)' }}></i>
                  <input 
                    type="text" 
                    placeholder="Tìm kiếm theo tiêu đề/mô tả..." 
                    value={issueSearchQuery} 
                    onChange={(e) => setIssueSearchQuery(e.target.value)} 
                    className="doc-select-filter"
                    style={{ width: '100%', padding: '6px 10px', height: 'auto' }}
                  />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: '500' }}>Giao cho:</label>
                  <select 
                    value={issueFilterAssignee} 
                    onChange={(e) => setIssueFilterAssignee(e.target.value)} 
                    className="doc-select-filter"
                    style={{ minWidth: '140px' }}
                  >
                    <option value="">-- Tất cả --</option>
                    {pMembers.map(m => {
                      const u = users.find(usr => usr.id === m.user_id);
                      return u ? <option key={u.id} value={u.id}>{u.name}</option> : null;
                    })}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: '500' }}>Độ ưu tiên:</label>
                  <select 
                    value={issueFilterPriority} 
                    onChange={(e) => setIssueFilterPriority(e.target.value)} 
                    className="doc-select-filter"
                  >
                    <option value="">-- Tất cả --</option>
                    <option value="LOW">LOW (Thấp)</option>
                    <option value="MEDIUM">MEDIUM (Trung bình)</option>
                    <option value="HIGH">HIGH (Cao)</option>
                    <option value="CRITICAL">CRITICAL (Khẩn cấp)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: '500' }}>Loại:</label>
                  <select 
                    value={issueFilterType} 
                    onChange={(e) => setIssueFilterType(e.target.value)} 
                    className="doc-select-filter"
                  >
                    <option value="">-- Tất cả --</option>
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
                { id: "TO_DO", title: "CẦN LÀM (TO DO)", class: "todo" },
                { id: "IN_PROGRESS", title: "ĐANG LÀM (IN PROGRESS)", class: "inprogress" },
                { id: "DONE", title: "HOÀN THÀNH (DONE)", class: "done" }
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
                    style={{ backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', minHeight: '450px' }}
                  >
                    <div className="kanban-col-header" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="kanban-col-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '12.5px', color: '#475569' }}>
                        <span className={`badge badge-${col.class}`} style={{ width: '8px', height: '8px', borderRadius: '50%', padding: 0 }}></span>
                        <span>{col.title}</span>
                      </div>
                      <span className="kanban-col-count" style={{ backgroundColor: '#cbd5e1', color: '#1e293b', fontSize: '11px', padding: '2px 6px', borderRadius: '10px', fontWeight: '600' }}>{colIssues.length}</span>
                    </div>

                    <div 
                      className="kanban-cards-container" 
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '380px' }}
                    >
                      {colIssues.length === 0 ? (
                        <div style={{ border: '2px dashed #cbd5e1', borderRadius: '6px', height: '100%', minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>
                          Chưa có vấn đề nào
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
                              style={{ padding: '12px', cursor: 'pointer', borderLeft: `4px solid ${typeColor}`, backgroundColor: '#fff', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                                  {iss.issue_key}
                                </span>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  <i className={`fa-solid ${typeIcon}`} style={{ color: typeColor, fontSize: '12px' }} title={iss.type}></i>
                                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#fff', backgroundColor: priorityColor, padding: '1px 5px', borderRadius: '3px' }}>
                                    {iss.priority}
                                  </span>
                                </div>
                              </div>
                              <div className="task-card-title" style={{ fontSize: '13.5px', fontWeight: '600', color: '#1e293b', marginBottom: '8px', lineHeight: '1.4' }}>{iss.summary}</div>
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
            {canManageProject && (
              <div className="doc-filters" style={{ marginBottom: '16px' }}>
                <form onSubmit={handleAddMember} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select name="userId" className="doc-select-filter" required>
                    <option value="">-- Chọn thành viên mới --</option>
                    {users
                      .filter(u => !pMembers.some(m => m.user_id === u.id))
                      .map(u => (
                        <option value={u.id} key={u.id}>{u.name} ({u.system_role})</option>
                      ))}
                  </select>
                  <select name="role" className="doc-select-filter" style={{ minWidth: '100px' }} required>
                    <option value="Member">Thành viên</option>
                    <option value="PM">Quản lý</option>
                  </select>
                  <button type="submit" className="btn btn-primary btn-sm"><i className="fa-solid fa-user-plus"></i> Thêm</button>
                </form>
              </div>
            )}
            
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Họ và tên</th>
                    <th>Email</th>
                    <th>Vai trò chung</th>
                    <th>Vai trò dự án</th>
                    <th>Ngày tham gia</th>
                    {canManageProject && <th>Hành động</th>}
                  </tr>
                </thead>
                <tbody>
                  {pMembers.map(m => {
                    const u = users.find(usr => usr.id === m.user_id);
                    if (!u) return null;
                    const date = new Date(m.joined_at);
                    const dateStr = `${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`;
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
                        <td>{u.system_role}</td>
                        <td><span className={`badge ${m.project_role === 'PM' ? 'badge-info' : 'badge-success'}`}>{m.project_role}</span></td>
                        <td>{dateStr}</td>
                        {canManageProject && (
                          <td>
                            {m.user_id !== currentUser.id ? (
                              <button className="btn btn-danger btn-sm" onClick={() => handleRemoveMember(m.user_id, u.name)}>
                                <i className="fa-solid fa-user-minus"></i> Xóa
                              </button>
                            ) : <span className="text-muted" style={{ fontSize: '11px' }}>Bạn</span>}
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
              <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Tài liệu dự án</h3>
              <button className="btn btn-primary btn-sm" onClick={() => { setActiveDocId(null); setIsDocModalOpen(true); }}>
                <i className="fa-solid fa-upload"></i> Tải lên
              </button>
            </div>
            
            <div className="doc-main-panel" style={{ gap: '12px' }}>
              {documents.filter(d => d.project_id === projectId).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--neutral-muted)' }}>Chưa có tài liệu dự án nào.</div>
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
                            <p>Tải lên bởi: <strong>{u ? u.name : 'N/A'}</strong> | Ngày: {dateStr} | Giai đoạn: <strong>{d.project_phase || 'Chung'}</strong></p>
                            <div className="version-badge-container">
                              <span className="version-pill">Phiên bản v{latest.version_number}</span>
                              <span className="text-muted">{latest.file_url} ({latest.file_size})</span>
                            </div>
                          </div>
                        </div>
                        <div className="doc-card-right">
                          <button className="btn btn-secondary btn-sm" onClick={() => handleDownloadDoc(latest)}><i className="fa-solid fa-download"></i> Tải về</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => openDocVersion(d.id)}><i className="fa-solid fa-code-fork"></i> Bản mới</button>
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
            <div className="chat-main-area" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
              <div className="chat-area-header" style={{ borderTop: 'none', borderBottom: '1px solid var(--neutral-border)' }}>
                <div className="chat-header-info">
                  <h3>Kênh thảo luận chung dự án</h3>
                </div>
                <div className="chat-header-actions">
                  <div className="chat-search-box">
                    <input type="text" value={chatSearchQuery} onChange={(e) => setChatSearchQuery(e.target.value)} placeholder="Tìm tin nhắn..." />
                  </div>
                </div>
              </div>

              <div className="chat-messages-container" style={{ flex: 1, overflowY: 'auto', background: '#fafbfc' }}>
                {chatMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--neutral-muted)' }}>Chưa có tin nhắn thảo luận nào.</div>
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
                    <span style={{ fontSize: '10px', color: 'var(--neutral-muted)', marginLeft: '6px' }}>{typingUser} đang gõ...</span>
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
                    placeholder="Nhập tin nhắn... Gõ @ nhắc tên" 
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
                  <button type="submit" className="btn btn-primary btn-sm"><i className="fa-solid fa-paper-plane"></i> Gửi</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= TABS: REPORTS ================= */}
        {activeSubTab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>Báo cáo hàng ngày thuộc dự án</h3>
              <Link href="/daily-reports" className="btn btn-primary btn-sm">
                <i className="fa-solid fa-plus"></i> Viết báo cáo mới
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {isReportsLoading ? (
                <div className="flex-center" style={{ padding: '40px', flexDirection: 'column', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid var(--neutral-border)' }}>
                  <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '24px', color: 'var(--primary-color)' }}></i>
                  <p style={{ marginTop: '10px', color: 'var(--neutral-muted)', fontSize: '13px' }}>Đang tải báo cáo...</p>
                </div>
              ) : projectReports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid var(--neutral-border)', color: 'var(--neutral-muted)' }}>
                  <i className="fa-solid fa-folder-open" style={{ fontSize: '32px', marginBottom: '8px', display: 'block' }}></i>
                  Chưa có báo cáo nào liên kết với dự án này.
                </div>
              ) : (
                projectReports.map(report => {
                  const userColor = users.find(u => u.id === report.user_id)?.color || '#3b82f6';
                  return (
                    <div 
                      key={report.id} 
                      className="card" 
                      style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--neutral-border)', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '12px' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: userColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                            {report.user_name.split(' ').pop().charAt(0)}
                          </div>
                          <div>
                            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
                              {report.user_name}
                            </h4>
                            <span style={{ fontSize: '11px', color: 'var(--neutral-muted)', fontWeight: '500' }}>
                              {report.user_role}
                            </span>
                          </div>
                        </div>
                        <span style={{ fontSize: '11.5px', color: 'var(--neutral-muted)' }}>
                          {new Date(report.created_at).toLocaleString('vi-VN')}
                        </span>
                      </div>

                      <div style={{ fontSize: '13.5px', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: '1.6', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                        {report.content}
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
                            Xem tệp đính kèm tài liệu
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

      {/* Issues Creation Modal */}
      {isIssueModalOpen && (
        <div className="modal show" style={{ display: 'flex' }}>
          <div className="modal-dialog" style={{ maxWidth: '950px', width: '95%' }}>
            <div className="modal-content">
              <div className="modal-header">
                <h3>Báo cáo vấn đề mới (Tạo Issue)</h3>
                <button className="btn-close-modal" onClick={() => setIsIssueModalOpen(false)}><i className="fa-solid fa-xmark"></i></button>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!issueTitle.trim()) return;
                
                if (!jiraCreateDeadline) {
                  Swal.fire({ icon: 'warning', title: 'Cảnh báo', text: "Vui lòng gắn Hạn chót (Deadline) cho Issue!" });
                  return;
                }
                if (!issueAssigneeId) {
                  Swal.fire({ icon: 'warning', title: 'Cảnh báo', text: "Vui lòng chọn Người chịu trách nhiệm cho Issue!" });
                  return;
                }
                if (issueStatus === 'DONE') {
                  if (!jiraCreateHienTrang.trim() || !jiraCreateNguyenNhan.trim() || !jiraCreateHuongGiaiQuyet.trim() || !jiraCreateKetQua.trim()) {
                    Swal.fire({ icon: 'warning', title: 'Cảnh báo', text: "Lỗi: Chỉ khi cả 4 mục (Hiện trạng, Nguyên nhân, Hướng giải quyết, Kết quả) đều có thông tin mới có thể tạo Issue ở trạng thái DONE!" });
                    return;
                  }
                }

                try {
                  const assigneeUser = users.find(u => u.id === issueAssigneeId);
                  const calculatedAssigneesText = assigneeUser ? `@${assigneeUser.name} ` : '';

                  const serializedDescription = JSON.stringify({
                    text: issueDesc,
                    hientrang: jiraCreateHienTrang,
                    nguyennhan: jiraCreateNguyenNhan,
                    huonggiaiquyet: jiraCreateHuongGiaiQuyet,
                    ketqua: jiraCreateKetQua,
                    deadline: jiraCreateDeadline,
                    issueTasks: projectTasks,
                    assigneesText: calculatedAssigneesText
                  });

                  const newIssue = await db.createIssue({
                    project_id: projectId,
                    summary: issueTitle,
                    description: serializedDescription,
                    type: issueType,
                    status: issueStatus,
                    priority: issuePriority,
                    reporter_id: currentUser.id,
                    assignee_id: issueAssigneeId || null
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
                  setIsIssueModalOpen(false);
                  Swal.fire({ icon: 'success', title: 'Thành công', text: "Đã tạo issue mới thành công!" });
                } catch (err) {
                  Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi tạo issue: " + err.message });
                }
              }}>
                <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px', padding: '20px' }}>
                  {/* Left Column: Fields */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="form-group">
                      <label>Tiêu đề tóm tắt (Summary) <span className="required">*</span></label>
                      <input type="text" value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} required placeholder="Ví dụ: Thiết kế giao diện thanh toán..." style={{ width: '100%' }} />
                    </div>
                     <div className="form-group">
                       <label>Hạn chót (Deadline) <span className="required">*</span></label>
                       <input type="date" value={jiraCreateDeadline} onChange={(e) => setJiraCreateDeadline(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', outline: 'none' }} />
                     </div>

                     <div className="form-group">
                       <label>Hiện trạng</label>
                       <textarea value={jiraCreateHienTrang} onChange={(e) => setJiraCreateHienTrang(e.target.value)} placeholder="Nhập hiện trạng..." rows="2" style={{ width: '100%', minHeight: '50px' }} />
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
                          <i className="fa-solid fa-file-invoice"></i> Báo cáo chi tiết
                        </button>
                      </div>

                    
                    <div className="form-group">
                      <label>Độ ưu tiên (Priority)</label>
                      <select value={issuePriority} onChange={(e) => setIssuePriority(e.target.value)} className="doc-select-filter" style={{ width: '100%', height: '36px' }}>
                        <option value="LOW">LOW (Thấp)</option>
                        <option value="MEDIUM">MEDIUM (Trung bình)</option>
                        <option value="HIGH">HIGH (Cao)</option>
                        <option value="CRITICAL">CRITICAL (Khẩn cấp)</option>
                      </select>
                    </div>



                    <div className="form-group">
                      <label>Thành viên liên quan</label>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input 
                          type="text" 
                          placeholder="Tìm kiếm thành viên..." 
                          value={jiraCreateAssigneeSearchQuery} 
                          onChange={(e) => setJiraCreateAssigneeSearchQuery(e.target.value)} 
                          style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '12px', outline: 'none' }}
                        />
                        <select 
                          value={jiraCreateAssigneeSelectedDept} 
                          onChange={(e) => setJiraCreateAssigneeSelectedDept(e.target.value)} 
                          style={{ width: '130px', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '12px', outline: 'none' }}
                        >
                          <option value="">Tất cả phòng ban</option>
                          {departments.map(dept => (
                            <option key={dept.department_id} value={dept.department_id}>{dept.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="project-members-selector-list" style={{ maxHeight: '130px', overflowY: 'auto', border: '1px solid var(--neutral-border)', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: '#fff' }}>
                        {filteredCreateAssignees.length === 0 ? (
                          <div style={{ padding: '8px', color: 'var(--neutral-muted)', fontSize: '12px', textAlign: 'center' }}>Không tìm thấy nhân viên phù hợp</div>
                        ) : (
                          filteredCreateAssignees.map(m => {
                            const isChecked = issueAssigneeId === m.id;
                            return (
                              <div className="member-select-row" key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
                                <div className="member-select-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <input 
                                    type="checkbox" 
                                    id={`jira-create-assignee-check-${m.id}`} 
                                    checked={isChecked} 
                                    onChange={() => setIssueAssigneeId(isChecked ? '' : m.id)}
                                  />
                                  <label htmlFor={`jira-create-assignee-check-${m.id}`} style={{ cursor: 'pointer', margin: 0, fontSize: '13px' }}>{m.name} ({m.project_role})</label>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Grid Table */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ fontWeight: '600', fontSize: '13.5px', color: '#475569' }}>Bảng chi tiết công việc</label>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#135274', color: '#ffffff' }}>
                          <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'left', width: '35%', fontWeight: '700' }}>Tên công việc</th>
                          <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'left', width: '20%', fontWeight: '700' }}>Deadline</th>
                          <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'left', width: '25%', fontWeight: '700' }}>Người thực hiện</th>
                          <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'left', width: '20%', fontWeight: '700' }}>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectTasks.map(row => (
                          <tr key={row.id}>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                  type="text"
                                  value={row.name}
                                  onChange={(e) => handleIssueTaskChange(row.id, 'name', e.target.value)}
                                  placeholder="Công việc..."
                                  style={{ flex: 1, border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', outline: 'none', fontSize: '13px' }}
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
                                  onClick={() => handleRemoveIssueTaskRow(row.id)}
                                  title="Xóa công việc"
                                  style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px', padding: '2px' }}
                                >
                                  <i className="fa-solid fa-trash"></i>
                                </button>
                              </div>
                            </td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>
                              <input
                                type="date"
                                value={row.deadline}
                                onChange={(e) => handleIssueTaskChange(row.id, 'deadline', e.target.value)}
                                style={{ width: '100%', border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', outline: 'none', fontSize: '12.5px' }}
                              />
                            </td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1', position: 'relative' }}>
                              <input
                                id={`grid-assignee-create-${row.id}`}
                                type="text"
                                value={row.assignee}
                                onChange={(e) => handleGridAssigneeChange(row.id, e.target.value, 'create')}
                                placeholder="Gán tên..."
                                style={{ width: '100%', border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', outline: 'none', fontSize: '13px' }}
                              />
                              {activeMentionInput?.modal === 'create-grid' && activeMentionInput?.rowId === row.id && mentionQuery !== null && (
                                <div className="mentions-popup" style={{ display: 'block', position: 'absolute', zIndex: 100, top: '100%', left: '0', right: '0' }}>
                                  {mentionList.map(u => (
                                    <div className="mention-user-option" onClick={() => selectGridMention(u)} key={u.id}>
                                      <div className="men-avatar" style={{ backgroundColor: u.color }}>{u.name.split(" ").pop().charAt(0)}</div>
                                      <span>{u.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center', verticalAlign: 'middle' }}>
                              <span style={{ 
                                display: 'inline-block',
                                padding: '4px 8px', 
                                borderRadius: '4px', 
                                fontSize: '12px', 
                                fontWeight: '600', 
                                backgroundColor: row.status === 'Hoàn thành' ? '#e2fbe8' : row.status === 'Đang thực hiện' ? '#fff3cd' : '#f1f5f9',
                                color: row.status === 'Hoàn thành' ? '#0f5132' : row.status === 'Đang thực hiện' ? '#664d03' : '#475569'
                              }}>
                                {row.status || 'Chưa thực hiện'}
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
                  <button type="button" className="btn btn-secondary" onClick={() => setIsIssueModalOpen(false)}>Hủy</button>
                  <button type="submit" className="btn btn-primary">Tạo mới</button>
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
                  <h3 style={{ margin: 0, fontSize: '18px' }}>Chi tiết Issue</h3>
                </div>
                <button className="btn-close-modal" onClick={() => setIsDetailModalOpen(false)} style={{ fontSize: '24px', cursor: 'pointer' }}><i className="fa-solid fa-xmark"></i></button>
              </div>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '30px', flex: 1, maxHeight: 'none', overflowY: 'auto', padding: '24px 32px' }}>
                
                {/* Left Column: Summary, Description, Comments */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>{activeIssueDetail.summary}</h2>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="form-group">
                      <label style={{ fontWeight: '600', fontSize: '13px', display: 'block', marginBottom: '6px', color: '#475569' }}>Hiện trạng</label>
                      <textarea
                        value={jiraDetailHienTrang}
                        onChange={(e) => setJiraDetailHienTrang(e.target.value)}
                        placeholder="Nhập hiện trạng..."
                        rows="2"
                        style={{ width: '100%', minHeight: '60px', padding: '8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', outline: 'none', fontSize: '13.5px', resize: 'vertical' }}
                      />
                    </div>

                    <div className="form-group" style={{ marginTop: '4px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setTempNguyenNhan(jiraDetailNguyenNhan);
                          setTempHuongGiaiQuyet(jiraDetailHuongGiaiQuyet);
                          setTempKetQua(jiraDetailKetQua);
                          setReportModalSource('detail');
                          setIsReportPopupOpen(true);
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px', width: '100%', justifyContent: 'center' }}
                      >
                        <i className="fa-solid fa-file-invoice"></i> Báo cáo chi tiết
                      </button>
                    </div>
                  </div>

                  {/* Grid Table in Details Modal */}
                  <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '16px' }}>
                    <label style={{ fontWeight: '600', fontSize: '13.5px', display: 'block', marginBottom: '10px', color: '#475569' }}>Bảng chi tiết công việc</label>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: '13px', marginBottom: '10px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#135274', color: '#ffffff' }}>
                          <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'left', width: '35%', fontWeight: '700' }}>Tên công việc</th>
                          <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'left', width: '20%', fontWeight: '700' }}>Deadline</th>
                          <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'left', width: '25%', fontWeight: '700' }}>Người thực hiện</th>
                          <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'left', width: '20%', fontWeight: '700' }}>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectTasks.map(row => (
                          <tr key={row.id}>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                  type="text"
                                  value={row.name}
                                  onChange={(e) => handleIssueTaskChange(row.id, 'name', e.target.value)}
                                  placeholder="Công việc..."
                                  style={{ flex: 1, border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', outline: 'none', fontSize: '13px' }}
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
                                  onClick={() => handleRemoveIssueTaskRow(row.id)}
                                  title="Xóa công việc"
                                  style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px', padding: '2px' }}
                                >
                                  <i className="fa-solid fa-trash"></i>
                                </button>
                              </div>
                            </td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>
                              <input
                                type="date"
                                value={row.deadline}
                                onChange={(e) => handleIssueTaskChange(row.id, 'deadline', e.target.value)}
                                style={{ width: '100%', border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', outline: 'none', fontSize: '12.5px' }}
                              />
                            </td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1', position: 'relative' }}>
                              <input
                                id={`grid-assignee-detail-${row.id}`}
                                type="text"
                                value={row.assignee}
                                onChange={(e) => handleGridAssigneeChange(row.id, e.target.value, 'detail')}
                                placeholder="Gán tên..."
                                style={{ width: '100%', border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', outline: 'none', fontSize: '13px' }}
                              />
                              {activeMentionInput?.modal === 'detail-grid' && activeMentionInput?.rowId === row.id && mentionQuery !== null && (
                                <div className="mentions-popup" style={{ display: 'block', position: 'absolute', zIndex: 100, top: '100%', left: '0', right: '0' }}>
                                  {mentionList.map(u => (
                                    <div className="mention-user-option" onClick={() => selectGridMention(u)} key={u.id}>
                                      <div className="men-avatar" style={{ backgroundColor: u.color }}>{u.name.split(" ").pop().charAt(0)}</div>
                                      <span>{u.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center', verticalAlign: 'middle' }}>
                              <span style={{ 
                                display: 'inline-block',
                                padding: '4px 8px', 
                                borderRadius: '4px', 
                                fontSize: '12px', 
                                fontWeight: '600', 
                                backgroundColor: row.status === 'Hoàn thành' ? '#e2fbe8' : row.status === 'Đang thực hiện' ? '#fff3cd' : '#f1f5f9',
                                color: row.status === 'Hoàn thành' ? '#0f5132' : row.status === 'Đang thực hiện' ? '#664d03' : '#475569'
                              }}>
                                {row.status || 'Chưa thực hiện'}
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
                        onClick={handleAddIssueTaskRow}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '50%', width: '32px', height: '32px', padding: 0, justifyContent: 'center', fontSize: '16px', fontWeight: 'bold' }}
                      >
                        +
                      </button>
                      {/* Save button removed from here, moved to the bottom of the modal */}
                    </div>
                  </div>

                  {/* Comments section */}
                  <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '16px' }}>
                    <h4 style={{ fontWeight: '600', fontSize: '14px', marginBottom: '12px' }}>Bình luận ({issueComments.length})</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                      {issueComments.map(comm => (
                        <div key={comm.id} style={{ display: 'flex', gap: '10px', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
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
                                    Xóa
                                  </button>
                                )}
                              </div>
                            </div>
                            <p style={{ fontSize: '13px', color: '#334155', margin: 0 }}>{comm.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        placeholder="Viết bình luận..." 
                        value={newCommentText} 
                        onChange={(e) => setNewCommentText(e.target.value)} 
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '13px', outline: 'none' }}
                      />
                      <button type="submit" className="btn btn-primary btn-sm">Gửi</button>
                    </form>
                  </div>

                  {/* History Activity logs */}
                  <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '16px' }}>
                    <h4 style={{ fontWeight: '600', fontSize: '14px', marginBottom: '10px' }}>Lịch sử hoạt động</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                      {issueHistory.map(hist => {
                        const renderAction = () => {
                          if (hist.field_changed === 'created') {
                            return <span>đã báo cáo lỗi ({hist.new_value || ''})</span>;
                          }
                          if (hist.field_changed === 'description') {
                            return <span>đã cập nhật thông tin chi tiết/báo cáo</span>;
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
                            <span>đổi <strong>{fieldLabel}</strong> từ <code>{oldVal || 'rỗng'}</code> thành <code>{newVal || 'rỗng'}</code></span>
                          );
                        };

                        return (
                          <div key={hist.id} style={{ fontSize: '12.5px', color: '#475569', display: 'flex', gap: '4px', borderBottom: '1px dashed #f1f5f9', paddingBottom: '4px', paddingLeft: '4px' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: '1px solid var(--neutral-border)', paddingLeft: '20px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Trạng thái</label>
                    <select 
                      value={activeIssueDetail.status} 
                      onChange={(e) => handleUpdateIssueField('status', e.target.value)}
                      className="doc-select-filter"
                      style={{ width: '100%', height: '34px', fontSize: '13px' }}
                    >
                      <option value="TO_DO">TO DO</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="DONE">DONE</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ position: 'relative' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Thành viên liên quan</label>
                    {isEditingAssignee ? (
                      <div>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <input 
                            type="text" 
                            placeholder="Tìm kiếm thành viên..." 
                            value={jiraDetailAssigneeSearchQuery} 
                            onChange={(e) => setJiraDetailAssigneeSearchQuery(e.target.value)} 
                            style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '12px', outline: 'none' }}
                          />
                          <select 
                            value={jiraDetailAssigneeSelectedDept} 
                            onChange={(e) => setJiraDetailAssigneeSelectedDept(e.target.value)} 
                            style={{ width: '130px', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '12px', outline: 'none' }}
                          >
                            <option value="">Tất cả phòng ban</option>
                            {departments.map(dept => (
                              <option key={dept.department_id} value={dept.department_id}>{dept.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="project-members-selector-list" style={{ maxHeight: '130px', overflowY: 'auto', border: '1px solid var(--neutral-border)', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: '#fff', marginBottom: '8px' }}>
                          {filteredDetailAssignees.length === 0 ? (
                            <div style={{ padding: '8px', color: 'var(--neutral-muted)', fontSize: '12px', textAlign: 'center' }}>Không tìm thấy nhân viên phù hợp</div>
                          ) : (
                            filteredDetailAssignees.map(m => {
                              const isChecked = issueAssigneeId === m.id;
                              return (
                                <div className="member-select-row" key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
                                  <div className="member-select-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input 
                                      type="checkbox" 
                                      id={`jira-detail-assignee-check-${m.id}`} 
                                      checked={isChecked} 
                                      onChange={() => setIssueAssigneeId(isChecked ? '' : m.id)}
                                    />
                                    <label htmlFor={`jira-detail-assignee-check-${m.id}`} style={{ cursor: 'pointer', margin: 0, fontSize: '13px' }}>{m.name} ({m.project_role})</label>
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
                            onClick={() => handleSaveAssigneeText(issueAssigneeId)}
                          >
                            Lưu
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-secondary btn-sm" 
                            onClick={() => {
                              setIsEditingAssignee(false);
                            }}
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        onClick={() => {
                          setIssueAssigneeId(activeIssueDetail.assignee_id || '');
                          setJiraDetailAssigneeSearchQuery('');
                          setJiraDetailAssigneeSelectedDept('');
                          setIsEditingAssignee(true);
                        }} 
                        style={{ padding: '8px 12px', border: '1px solid transparent', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#f8fafc', transition: 'all 0.2s', minHeight: '34px', fontSize: '13px' }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--neutral-border)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                      >
                        {detailAssigneesText ? (
                          <span style={{ color: '#334155', fontWeight: '500' }}>{detailAssigneesText}</span>
                        ) : (
                          <span style={{ color: 'var(--neutral-muted)', fontStyle: 'italic' }}>Chưa giao việc...</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Mức độ ưu tiên (Priority)</label>
                    <select 
                      value={activeIssueDetail.priority} 
                      onChange={(e) => handleUpdateIssueField('priority', e.target.value)}
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
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Hạn chót (Deadline) <span className="required">*</span></label>
                    <input
                      type="date"
                      value={jiraDetailDeadline || ''}
                      onChange={(e) => setJiraDetailDeadline(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '13px', outline: 'none' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Loại Issue (Type)</label>
                    <select 
                      value={activeIssueDetail.type} 
                      onChange={(e) => handleUpdateIssueField('type', e.target.value)}
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
                      Người báo cáo: <strong>{users.find(u => u.id === activeIssueDetail.reporter_id)?.name || 'N/A'}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--neutral-muted)', marginBottom: '16px' }}>
                      Ngày tạo: <strong>{new Date(activeIssueDetail.created_at).toLocaleDateString('vi-VN')}</strong>
                    </div>
                    
                    {/* Delete Issue Button */}
                    <button 
                      type="button" 
                      className="btn btn-danger" 
                      onClick={async () => {
                        const confirmResult = await Swal.fire({
                          title: 'Xác nhận xóa',
                          text: `Bạn có chắc chắn muốn xóa Issue ${activeIssueDetail.issue_key}?`,
                          icon: 'warning',
                          showCancelButton: true,
                          confirmButtonColor: '#3085d6',
                          cancelButtonColor: '#d33',
                          confirmButtonText: 'Đồng ý',
                          cancelButtonText: 'Hủy'
                        });
                        if (!confirmResult.isConfirmed) return;
                        try {
                          await db.deleteIssue(activeIssueDetail.id);
                          setIsDetailModalOpen(false);
                          loadIssues();
                          Swal.fire({ icon: 'success', title: 'Thành công', text: "Đã xóa issue thành công!" });
                        } catch (err) {
                          Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi xóa issue: " + err.message });
                        }
                      }}
                      style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                    >
                      <i className="fa-solid fa-trash"></i> Xóa Issue này
                    </button>

                    {activeIssueDetail.status !== 'DONE' && (
                      <button 
                        type="button" 
                        className="btn btn-success" 
                        onClick={() => {
                          setTempNguyenNhan(jiraDetailNguyenNhan);
                          setTempHuongGiaiQuyet(jiraDetailHuongGiaiQuyet);
                          setTempKetQua(jiraDetailKetQua);
                          setReportModalSource('detail-finish');
                          setIsReportPopupOpen(true);
                        }}
                        style={{ width: '100%', padding: '8px 12px', fontSize: '13px', marginTop: '10px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <i className="fa-solid fa-circle-check"></i> Kết thúc issue
                      </button>
                    )}
                  </div>
                </div>

              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid var(--neutral-border)', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                {/* <button type="button" className="btn btn-secondary" onClick={() => setIsDetailModalOpen(false)}>Đóng</button> */}
                <button type="button" className="btn btn-primary" onClick={handleSaveAllIssueTasks}>Lưu thay đổi</button>
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
              <div className="modal-header" style={{ padding: '16px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--neutral-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>
                  {activeSubTaskData.name || 'Chi tiết công việc'}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto', marginRight: '16px' }}>
                  <label style={{ fontWeight: '600', fontSize: '13px', color: '#475569', margin: 0 }}>Trạng thái:</label>
                  <select
                    value={activeSubTaskData.status || 'Chưa thực hiện'}
                    onChange={(e) => handleSubTaskFieldChange('status', e.target.value)}
                    className="doc-select-filter"
                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '13px', outline: 'none' }}
                  >
                    <option value="Chưa thực hiện">Chưa thực hiện</option>
                    <option value="Đang thực hiện">Đang thực hiện</option>
                    <option value="Hoàn thành">Hoàn thành</option>
                  </select>
                </div>
                <button className="btn-close-modal" onClick={() => setIsSubTaskPopupOpen(false)} style={{ fontSize: '20px', cursor: 'pointer' }}><i className="fa-solid fa-xmark"></i></button>
              </div>
              <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* 1. TextBox: Nội dung cần thực hiện */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontWeight: '600', fontSize: '13.5px', color: '#475569' }}>Nội dung cần thực hiện</label>
                  <textarea
                    value={activeSubTaskData.contentNeeded || ''}
                    onChange={(e) => handleSubTaskFieldChange('contentNeeded', e.target.value)}
                    placeholder="Nhập nội dung chi tiết cần thực hiện..."
                    rows="4"
                    style={{ width: '100%', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '4px', outline: 'none', resize: 'vertical', fontSize: '13.5px', lineHeight: '1.6' }}
                  />
                </div>

                {/* 2. Solution Table: 3 columns (Nội dung thực hiện, Người thực hiện, Ngày thực hiện) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ fontWeight: '600', fontSize: '14px', margin: 0, color: '#1e293b' }}>Solution</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#0f766e', color: '#ffffff' }}>
                        <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'left', width: '50%', fontWeight: '700' }}>Nội dung thực hiện</th>
                        <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'left', width: '25%', fontWeight: '700' }}>Người thực hiện</th>
                        <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'left', width: '25%', fontWeight: '700' }}>Ngày thực hiện</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSubTaskData.solutions && activeSubTaskData.solutions.map(sol => (
                        <tr key={sol.id}>
                          <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <textarea
                                value={sol.action}
                                onChange={(e) => handleSolutionChange(sol.id, 'action', e.target.value)}
                                placeholder="Nhập nội dung thực hiện (tự động ghi người & ngày)..."
                                rows="2"
                                style={{ flex: 1, border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', outline: 'none', fontSize: '13px', resize: 'vertical' }}
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveSolutionRow(sol.id)}
                                title="Xóa giải pháp"
                                style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px', padding: '2px' }}
                              >
                                <i className="fa-solid fa-trash"></i>
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: '10px', border: '1px solid #cbd5e1', backgroundColor: '#e2e8f0', color: '#334155', verticalAlign: 'middle' }}>
                            {sol.executor}
                          </td>
                          <td style={{ padding: '10px', border: '1px solid #cbd5e1', backgroundColor: '#e2e8f0', color: '#334155', verticalAlign: 'middle' }}>
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
                      onClick={handleAddSolutionRow}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '50%', width: '32px', height: '32px', padding: 0, justifyContent: 'center', fontSize: '16px', fontWeight: 'bold' }}
                    >
                      +
                    </button>
                  </div>
                </div>

              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid var(--neutral-border)', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsSubTaskPopupOpen(false)}>Hủy</button>
                <button type="button" className="btn btn-primary" onClick={handleSaveTaskPopup}>Đồng ý</button>
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
                  <label style={{ fontWeight: '600', fontSize: '13px', color: '#475569' }}>Nguyên nhân</label>
                  <textarea
                    value={tempNguyenNhan}
                    onChange={(e) => setTempNguyenNhan(e.target.value)}
                    placeholder="Nhập nguyên nhân..."
                    rows="3"
                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--neutral-border)', outline: 'none', fontSize: '13.5px', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontWeight: '600', fontSize: '13px', color: '#475569' }}>Hướng giải quyết</label>
                  <textarea
                    value={tempHuongGiaiQuyet}
                    onChange={(e) => setTempHuongGiaiQuyet(e.target.value)}
                    placeholder="Nhập hướng giải quyết..."
                    rows="3"
                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--neutral-border)', outline: 'none', fontSize: '13.5px', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontWeight: '600', fontSize: '13px', color: '#475569' }}>Kết quả</label>
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
