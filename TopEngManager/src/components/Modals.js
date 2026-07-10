import React, { useState, useEffect } from 'react';
import { db, MySQLAdapter, MockDB } from '@/utils/db';
import { useApp } from '@/context/AppContext';
import Swal from 'sweetalert2';

// Modal Backdrop Wrapper
const ModalWrapper = ({ isOpen, children, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="modal show" style={{ display: 'flex' }} onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

const ModalWrapperLg = ({ isOpen, children, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="modal show" style={{ display: 'flex' }} onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

// ================= 1. PROJECT MODAL =================
export const ProjectModal = ({ isOpen, onClose, projectId, currentUser, onSaved }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [status, setStatus] = useState('Thực thi');
  const [startDate, setStartDate] = useState('2026-06-01');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [customers, setCustomers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState({}); // userId -> role
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('');

  useEffect(() => {
    const loadProjectData = async () => {
      if (!isOpen) return;
      try {
        const users = await db.getUsers();
        setSystemUsers(users);

        // Fetch customers and departments from database
        const custs = await db.getCustomers();
        setCustomers(custs);
        const depts = await db.getDepartments();
        setDepartments(depts);

        if (projectId) {
          const projects = await db.getProjects();
          const p = projects.find(proj => proj.id === projectId);
          if (p) {
            setName(p.name);
            setDescription(p.description || '');
            setCustomerId(p.customer_id || '');
            setStatus(p.status || 'Thực thi');
            setStartDate(p.start_date || '2026-06-01');
            setEndDate(p.end_date || '2026-12-31');
            
            const pMembers = (await db.getProjectMembers()).filter(m => m.project_id === projectId);
            const membersMap = {};
            pMembers.forEach(m => {
              membersMap[m.user_id] = m.project_role;
            });
            setSelectedMembers(membersMap);
          }
        } else {
          setName('');
          setDescription('');
          setCustomerId('');
          setStatus('Thực thi');
          setStartDate('2026-06-01');
          setEndDate('2026-12-31');
          // Default: check the creator
          setSelectedMembers({ [currentUser.id]: 'PM' });
        }
      } catch (e) {
        console.error("Failed to load project details: ", e);
      }
    };
    loadProjectData();
  }, [isOpen, projectId]);

  const handleMemberToggle = (userId) => {
    setSelectedMembers(prev => {
      const copy = { ...prev };
      if (copy[userId]) {
        delete copy[userId];
      } else {
        copy[userId] = 'Member';
      }
      return copy;
    });
  };

  const handleMemberRoleChange = (userId, role) => {
    setSelectedMembers(prev => ({
      ...prev,
      [userId]: role
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) return;

    try {
      const projData = {
        id: projectId || null,
        name,
        description,
        customer_id: customerId || null,
        status,
        start_date: startDate,
        end_date: endDate,
        created_by: currentUser.id
      };

      const membersList = Object.keys(selectedMembers).map(userId => ({
        user_id: userId,
        project_role: selectedMembers[userId]
      }));

      const result = await db.saveProject(projData, membersList);
      
      // Log Activity
      if (projectId) {
        await db.logActivity(currentUser.id, "UPDATE", "Project", result.id, `đã cập nhật thông tin dự án '${name}'`);
      } else {
        await db.logActivity(currentUser.id, "CREATE", "Project", result.id, `đã tạo dự án mới '${name}'`);
      }

      onSaved();
      onClose();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi lưu dự án: " + e.message });
    }
  };

  const filteredUsers = systemUsers.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = !selectedDept || u.department_id === selectedDept;
    return matchesSearch && matchesDept;
  });

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>{projectId ? 'Chỉnh Sửa Dự Án' : 'Tạo Dự Án Mới'}</h3>
          <button className="btn-close-modal" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Tên dự án <span className="required">*</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Nhập tên dự án..." />
            </div>
            <div className="form-group">
              <label>Mô tả</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="3" placeholder="Nhập mô tả dự án..."></textarea>
            </div>
            <div className="form-group">
              <label>Khách hàng</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', width: '100%', outline: 'none' }}>
                <option value="">-- Chọn khách hàng --</option>
                {customers.map(c => (
                  <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>
                ))}
              </select>
            </div>
            
            <div className="form-row">
              <div className="form-group col-6" style={{ flex: 1 }}>
                <label>Trạng thái dự án</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', width: '100%', outline: 'none' }}>
                  <option value="Khởi tạo">Khởi tạo</option>
                  <option value="Lập kế hoạch">Lập kế hoạch</option>
                  <option value="Thực thi">Thực thi</option>
                  <option value="Giám sát">Giám sát</option>
                  <option value="Kết thúc">Kết thúc</option>
                </select>
              </div>
            </div>

            <div className="form-row" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Ngày bắt đầu</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', outline: 'none' }} />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Ngày kết thúc</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', outline: 'none' }} />
              </div>
            </div>
            
            <div className="form-group">
              <label>Thành viên dự án</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input 
                  type="text" 
                  placeholder="Tìm kiếm thành viên..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '13px', outline: 'none' }}
                />
                <select 
                  value={selectedDept} 
                  onChange={(e) => setSelectedDept(e.target.value)} 
                  style={{ width: '160px', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '13px', outline: 'none' }}
                >
                  <option value="">Tất cả phòng ban</option>
                  {departments.map(dept => (
                    <option key={dept.department_id} value={dept.department_id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div className="project-members-selector-list" style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--neutral-border)', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredUsers.length === 0 ? (
                  <div style={{ padding: '8px', color: 'var(--neutral-muted)', fontSize: '13px', textAlign: 'center' }}>Không tìm thấy nhân viên phù hợp</div>
                ) : (
                  filteredUsers.map(u => {
                    const isChecked = !!selectedMembers[u.id];
                    const role = selectedMembers[u.id] || 'Member';
                    return (
                      <div className="member-select-row" key={u.id}>
                        <div className="member-select-left">
                          <input 
                            type="checkbox" 
                            id={`modal-member-check-${u.id}`} 
                            checked={isChecked} 
                            onChange={() => handleMemberToggle(u.id)}
                          />
                          <label htmlFor={`modal-member-check-${u.id}`}>{u.name}</label>
                        </div>
                        <select 
                          value={role} 
                          onChange={(e) => handleMemberRoleChange(u.id, e.target.value)}
                          className="doc-select-filter" 
                          style={{ width: 'auto', padding: '2px 6px' }}
                        >
                          <option value="Member">Member</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn btn-primary">{projectId ? 'Lưu thay đổi' : 'Tạo dự án'}</button>
          </div>
        </form>
      </div>
    </ModalWrapper>
  );
};

// ================= 2. TASK MODAL (DETAIL & COLLAB) =================
export const TaskModal = ({ isOpen, onClose, taskId, projId, currentUser, onSaved }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('Trung bình');
  const [status, setStatus] = useState('Todo');

  const [projectMembers, setProjectMembers] = useState([]);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');
  const [assigneeSelectedDept, setAssigneeSelectedDept] = useState('');
  const [departments, setDepartments] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);

  const [newSubtask, setNewSubtask] = useState('');
  const [newComment, setNewComment] = useState('');

  const { hasPermission } = useApp();
  const isPM = hasPermission('edit_task'); // can edit/delete tasks
  const canUpdateStatus = hasPermission('update_task_status');
  const disableStatusSelect = !canUpdateStatus;

  const loadCollabData = async () => {
    if (!taskId) return;
    try {
      const allSubs = await db.getSubtasks(taskId);
      setSubtasks(allSubs);
      
      const allComments = await db.getComments(taskId);
      setComments(allComments);

      // Attachments inside task structure
      const allTasks = await db.getTasks();
      const currentTask = allTasks.find(t => t.id === taskId);
      if (currentTask && currentTask.attachments) {
        setAttachments(currentTask.attachments);
      } else {
        setAttachments([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const loadTaskDetails = async () => {
      if (!isOpen) return;
      try {
        setAssigneeSearchQuery('');
        setAssigneeSelectedDept('');
        const depts = await db.getDepartments();
        setDepartments(depts);

        // Load assignees based on project
        const membersList = (await db.getProjectMembers()).filter(m => m.project_id === projId);
        const users = await db.getUsers();
        const mappedMembers = [];
        membersList.forEach(m => {
          const u = users.find(usr => usr.id === m.user_id);
          if (u) {
            mappedMembers.push({ ...u, project_role: m.project_role });
          }
        });
        setProjectMembers(mappedMembers);

        if (taskId) {
          const tasks = await db.getTasks();
          const t = tasks.find(task => task.id === taskId);
          if (t) {
            setTitle(t.title);
            setDescription(t.description || '');
            setAssigneeId(t.assignee_id || '');
            setDueDate(t.due_date || '');
            setPriority(t.priority);
            setStatus(t.status);
            
            await loadCollabData();
          }
        } else {
          setTitle('');
          setDescription('');
          setAssigneeId('');
          setDueDate('');
          setPriority('Trung bình');
          setStatus('Todo');
          setSubtasks([]);
          setComments([]);
          setAttachments([]);
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadTaskDetails();
  }, [isOpen, taskId, projId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title) return;

    try {
      const taskData = {
        id: taskId || null,
        project_id: projId,
        title,
        description,
        assignee_id: assigneeId || null,
        priority,
        status,
        due_date: dueDate || null,
        attachments // Preserve attachments
      };

      const result = await db.saveTask(taskData);

      if (assigneeId && assigneeId !== (taskId ? (await db.getTasks()).find(t => t.id === taskId)?.assignee_id : null)) {
        await db.createNotification(assigneeId, "Công việc mới được giao", `Bạn được giao công việc '${title}'`, `#tasks`);
      }

      if (taskId) {
        await db.logActivity(currentUser.id, "UPDATE", "Task", result.id, `đã cập nhật công việc '${title}'`);
      } else {
        await db.logActivity(currentUser.id, "CREATE", "Task", result.id, `đã giao công việc mới '${title}'`);
      }

      onSaved();
      onClose();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi lưu task: " + e.message });
    }
  };

  // Subtasks mutations
  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;

    try {
      const sub = {
        task_id: taskId,
        title: newSubtask.trim()
      };
      await db.saveSubtask(sub);
      setNewSubtask('');
      await loadCollabData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleSubtask = async (sub) => {
    try {
      sub.is_done = !sub.is_done;
      await db.saveSubtask(sub);
      await loadCollabData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSubtask = async (subId) => {
    try {
      await db.deleteSubtask(subId);
      await loadCollabData();
    } catch (e) {
      console.error(e);
    }
  };

  // Comments mutations
  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      await db.addComment({
        task_id: taskId,
        user_id: currentUser.id,
        content: newComment.trim()
      });

      const tasks = await db.getTasks();
      const task = tasks.find(t => t.id === taskId);
      await db.logActivity(currentUser.id, "COMMENT", "Task", taskId, `đã bình luận trong công việc '${task ? task.title : taskId}'`);

      if (task && task.assignee_id && task.assignee_id !== currentUser.id) {
        await db.createNotification(task.assignee_id, "Bình luận mới trong công việc", `${currentUser.name} đã bình luận trong công việc '${task.title}'`, `#tasks`);
      }

      setNewComment('');
      await loadCollabData();
    } catch (e) {
      console.error(e);
    }
  };

  // Attachments
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const updatedAttachments = [...attachments, {
        file_url: file.name,
        file_size: `${(file.size / 1024).toFixed(1)} KB`,
        file_type: file.type
      }];

      const tasks = await db.getTasks();
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        task.attachments = updatedAttachments;
        await db.saveTask(task);
        setAttachments(updatedAttachments);
        await db.logActivity(currentUser.id, "UPLOAD", "Task", taskId, `đã đính kèm tệp tin '${file.name}' vào công việc '${task.title}'`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAttachment = async (idx) => {
    try {
      const updated = [...attachments];
      updated.splice(idx, 1);
      
      const tasks = await db.getTasks();
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        task.attachments = updated;
        await db.saveTask(task);
        setAttachments(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredMembers = projectMembers.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(assigneeSearchQuery.toLowerCase()) || 
                          m.email.toLowerCase().includes(assigneeSearchQuery.toLowerCase());
    const matchesDept = !assigneeSelectedDept || m.department_id === assigneeSelectedDept;
    return matchesSearch && matchesDept;
  });

  // Progress subtasks calculation
  const doneSubtasks = subtasks.filter(s => s.is_done).length;
  const progressPercent = subtasks.length > 0 ? Math.round((doneSubtasks / subtasks.length) * 100) : 0;

  return (
    <ModalWrapperLg isOpen={isOpen} onClose={onClose}>
      <div className="modal-content">
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--neutral-border)' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>
            {taskId ? 'Chi tiết công việc' : 'Giao việc mới'}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto', marginRight: '16px' }}>
            <label style={{ fontWeight: '600', fontSize: '13px', color: '#475569', margin: 0 }}>Trạng thái:</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={disableStatusSelect}
              className="doc-select-filter"
              style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '13px', outline: 'none' }}
            >
              <option value="Todo">To do</option>
              <option value="InProgress">In progress</option>
              <option value="Review">Review</option>
              <option value="Done">Done</option>
            </select>
          </div>
          <button className="btn-close-modal" onClick={onClose} style={{ fontSize: '20px', cursor: 'pointer' }}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="modal-body modal-body-split">
          <div className="modal-split-left">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Tiêu đề công việc <span className="required">*</span></label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!isPM} required placeholder="Nhập tiêu đề công việc..." />
              </div>
              <div className="form-group">
                <label>Mô tả công việc</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!isPM} rows="4" placeholder="Nhập mô tả chi tiết..."></textarea>
              </div>
              <div className="form-row" style={{ display: 'flex', gap: '16px' }}>
                <div className="form-group col-6" style={{ flex: 1 }}>
                  <label>Người thực hiện</label>
                  {isPM ? (
                    <div>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input 
                          type="text" 
                          placeholder="Tìm kiếm thành viên..." 
                          value={assigneeSearchQuery} 
                          onChange={(e) => setAssigneeSearchQuery(e.target.value)} 
                          style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '12px', outline: 'none' }}
                        />
                        <select 
                          value={assigneeSelectedDept} 
                          onChange={(e) => setAssigneeSelectedDept(e.target.value)} 
                          style={{ width: '130px', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '12px', outline: 'none' }}
                        >
                          <option value="">Tất cả phòng ban</option>
                          {departments.map(dept => (
                            <option key={dept.department_id} value={dept.department_id}>{dept.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="project-members-selector-list" style={{ maxHeight: '130px', overflowY: 'auto', border: '1px solid var(--neutral-border)', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: '#fff' }}>
                        {filteredMembers.length === 0 ? (
                          <div style={{ padding: '8px', color: 'var(--neutral-muted)', fontSize: '12px', textAlign: 'center' }}>Không tìm thấy nhân viên phù hợp</div>
                        ) : (
                          filteredMembers.map(m => {
                            const isChecked = assigneeId === m.id;
                            return (
                              <div className="member-select-row" key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
                                <div className="member-select-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <input 
                                    type="checkbox" 
                                    id={`task-assignee-check-${m.id}`} 
                                    checked={isChecked} 
                                    onChange={() => setAssigneeId(isChecked ? '' : m.id)}
                                  />
                                  <label htmlFor={`task-assignee-check-${m.id}`} style={{ cursor: 'pointer', margin: 0, fontSize: '13px' }}>{m.name} ({m.project_role})</label>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '8px 12px', border: '1px solid var(--neutral-border)', borderRadius: '4px', backgroundColor: '#f8fafc', fontSize: '13px' }}>
                      {projectMembers.find(m => m.id === assigneeId)?.name || 'Chưa giao việc cho ai.'}
                    </div>
                  )}
                </div>
                <div className="form-group col-6" style={{ width: '50%' }}>
                  <label>Hạn chót (Deadline)</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!isPM} style={{ width: '100%' }} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group col-12" style={{ width: '100%' }}>
                  <label>Độ ưu tiên</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)} disabled={!isPM} style={{ width: '100%' }}>
                    <option value="Thấp">Thấp</option>
                    <option value="Trung bình">Trung bình</option>
                    <option value="Cao">Cao</option>
                  </select>
                </div>
              </div>
              <div className="task-form-actions">
                {isPM && <button type="submit" className="btn btn-primary">Lưu thay đổi</button>}
              </div>
            </form>


          </div>

          {taskId && (
            <div className="modal-split-right">
              {/* Attachments */}
              <div className="task-section">
                <h4 className="section-title"><i className="fa-solid fa-paperclip"></i> Đính kèm</h4>
                <div className="attachment-list">
                  {attachments.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: '11.5px' }}>Chưa đính kèm tài liệu nào.</p>
                  ) : (
                    attachments.map((att, idx) => (
                      <div className="attachment-item" key={idx}>
                        <div className="attachment-item-left">
                          <i className="fa-solid fa-file-invoice" style={{ color: 'var(--primary-color)' }}></i>
                          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <span className="attachment-name" title={att.file_url}>{att.file_url}</span>
                            <span className="attachment-size">{att.file_size || 'N/A'}</span>
                          </div>
                        </div>
                        <button className="btn-delete-attachment" onClick={() => handleDeleteAttachment(idx)}><i className="fa-solid fa-trash"></i></button>
                      </div>
                    ))
                  )}
                </div>
                <div className="attachment-upload-box">
                  <label className="btn btn-secondary btn-sm btn-block" style={{ marginBottom: 0 }}>
                    <i className="fa-solid fa-cloud-arrow-up"></i> Tải file lên
                    <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              {/* Comments */}
              <div className="task-section comment-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h4 className="section-title"><i className="fa-solid fa-comments"></i> Chat với người giao task</h4>
                <div className="comments-list" style={{ maxHeight: '180px', overflowY: 'auto', padding: '4px' }}>
                  {comments.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: '11.5px', textAlign: 'center', padding: '12px' }}>Chưa có tin nhắn thảo luận nào.</p>
                  ) : (
                    comments.map(c => {
                      const u = projectMembers.find(m => m.id === c.user_id) || users.find(usr => usr.id === c.user_id) || { name: c.user_id, color: 'var(--neutral-muted)' };
                      const isSelf = c.user_id === currentUser.id;
                      const date = new Date(c.created_at);
                      const timeStr = `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
                      return (
                        <div key={c.id} style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexDirection: isSelf ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: u.color || '#1e293b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9.5px', fontWeight: '600', flexShrink: 0 }}>
                            {u.name?.split(" ").pop().charAt(0) || '?'}
                          </div>
                          <div style={{ backgroundColor: isSelf ? 'var(--primary-color)' : 'var(--neutral-light)', color: isSelf ? '#fff' : 'var(--neutral-dark)', padding: '8px 12px', borderRadius: '8px', maxWidth: '75%', fontSize: '12.5px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                            <div style={{ fontSize: '9.5px', color: isSelf ? 'rgba(255,255,255,0.7)' : 'var(--neutral-muted)', fontWeight: '500', marginBottom: '2px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                              <span>{u.name}</span>
                              <span>{timeStr}</span>
                            </div>
                            <div style={{ wordBreak: 'break-word', lineHeight: '1.4' }}>{c.content}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="comment-input-box" style={{ display: 'flex', gap: '6px', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--neutral-border)' }}>
                  <input 
                    type="text" 
                    value={newComment} 
                    onChange={(e) => setNewComment(e.target.value)} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                    placeholder="Nhập nội dung trao đổi..." 
                    style={{ flex: 1, padding: '8px 12px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid var(--neutral-border)', outline: 'none' }} 
                  />
                  <button type="button" className="btn btn-primary btn-sm" style={{ padding: '6px 12px' }} onClick={handleAddComment}>Gửi</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalWrapperLg>
  );
};

// ================= 3. DOCUMENT MODAL =================
export const DocumentModal = ({ isOpen, onClose, docId, projId, currentUser, currentCategoryId, onSaved }) => {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [phase, setPhase] = useState('Khởi tạo');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('1.5 MB');

  const [categories, setCategories] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    const loadSelectOptions = async () => {
      if (!isOpen) return;
      try {
        const cats = await db.getDocumentCategories();
        setCategories(cats);
        
        const projs = await db.getProjects();
        setProjects(projs);

        if (docId) {
          const docs = await db.getDocuments();
          const d = docs.find(doc => doc.id === docId);
          if (d) {
            setTitle(d.title);
            setCategoryId(d.category_id);
            setProjectId(d.project_id || '');
            setPhase(d.project_phase || 'Khởi tạo');
            setFileName('');
            setFileSize('');
          }
        } else {
          setTitle('');
          setCategoryId(currentCategoryId || cats[0]?.id || '');
          setProjectId(projId || '');
          setPhase('Khởi tạo');
          setFileName('');
          setFileSize('1.5 MB');
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadSelectOptions();
  }, [isOpen, docId, projId, currentCategoryId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !categoryId || !fileName) return;

    try {
      const selectedCat = categories.find(c => c.id === categoryId);
      const isLifecycle = selectedCat?.type === 'project_lifecycle';

      const docVersions = await db.getDocumentVersions();
      let nextVerNum = 1;
      if (docId) {
        const docVers = docVersions.filter(v => v.document_id === docId);
        nextVerNum = docVers.length > 0 ? Math.max(...docVers.map(v => v.version_number)) + 1 : 2;
      }

      const docData = {
        id: docId || null,
        title,
        category_id: categoryId,
        project_id: isLifecycle ? (projectId || null) : null,
        uploaded_by: currentUser.id,
        project_phase: isLifecycle ? phase : null
      };

      const verData = {
        version_number: nextVerNum,
        file_url: fileName,
        uploaded_by: currentUser.id
      };

      const result = await db.saveDocument(docData, verData);

      if (docId) {
        await db.logActivity(currentUser.id, "UPLOAD", "Document", result.id, `đã tải lên phiên bản v${nextVerNum} cho tài liệu '${title}'`);
      } else {
        await db.logActivity(currentUser.id, "UPLOAD", "Document", result.id, `đã tải lên tài liệu mới '${title}'`);
      }

      onSaved();
      onClose();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi tải lên tài liệu: " + e.message });
    }
  };

  const selectedCategoryObj = categories.find(c => c.id === categoryId);
  const showLifecycle = selectedCategoryObj?.type === 'project_lifecycle';

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>{docId ? 'Tải lên phiên bản mới' : 'Tải lên tài liệu mới'}</h3>
          <button className="btn-close-modal" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Tiêu đề tài liệu <span className="required">*</span></label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!!docId} required placeholder="Ví dụ: Hướng dẫn Onboarding..." />
            </div>
            
            <div className="form-group">
              <label>Danh mục tài liệu <span className="required">*</span></label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={!!docId} required>
                {categories.map(c => (
                  <option value={c.id} key={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            
            {showLifecycle && (
              <div id="lifecycle-fields">
                <div className="form-group">
                  <label>Dự án <span className="required">*</span></label>
                  <select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={!!docId} required={showLifecycle}>
                    <option value="">-- Chọn dự án liên kết --</option>
                    {projects.map(p => (
                      <option value={p.id} key={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Giai đoạn dự án <span className="required">*</span></label>
                  <select value={phase} onChange={(e) => setPhase(e.target.value)}>
                    <option value="Khởi tạo">Khởi tạo</option>
                    <option value="Lập kế hoạch">Lập kế hoạch</option>
                    <option value="Thực thi">Thực thi</option>
                    <option value="Giám sát">Giám sát</option>
                    <option value="Kết thúc">Kết thúc</option>
                  </select>
                </div>
              </div>
            )}
            
            <div className="form-group">
              <label>{docId ? 'Tên tệp phiên bản mới' : 'Tên tệp đính kèm'} <span className="required">*</span></label>
              <input type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} required placeholder="tailieu-onboarding-v2.pdf" />
              <small className="form-text text-muted">Mô phỏng tệp đính kèm bằng cách nhập tên tệp và định dạng tệp.</small>
            </div>
            
            <div className="form-group">
              <label>Dung lượng tệp</label>
              <input type="text" value={fileSize} onChange={(e) => setFileSize(e.target.value)} placeholder="Ví dụ: 1.5 MB" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn btn-primary">{docId ? 'Cập nhật bản mới' : 'Tải lên'}</button>
          </div>
        </form>
      </div>
    </ModalWrapper>
  );
};

// ================= 4. DATABASE CONFIG MODAL =================
export const DatabaseModal = ({ isOpen, onClose, onSaved }) => {
  const [dbType, setDbType] = useState('mysql');
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDbType(localStorage.getItem('ems_db_type') || 'mysql');
    }
  }, [isOpen]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const adapter = dbType === 'mysql' ? MySQLAdapter : MockDB;
      const result = await adapter.testConnection();
      if (result.success) {
        Swal.fire({ icon: 'success', title: 'Thành công', text: result.message });
      } else {
        Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi kết nối: " + (result.error || "Không rõ nguyên nhân") });
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Thất bại', text: "Kết nối thất bại: " + err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    localStorage.setItem('ems_db_type', dbType);
    if (dbType === 'mysql') {
      Swal.fire({ icon: 'success', title: 'Thành công', text: "Đã chuyển sang chế độ MySQL Database (Backend API)! Ứng dụng sẽ kết nối đến MySQL thông qua Route Handlers." });
    } else {
      Swal.fire({ icon: 'success', title: 'Thành công', text: "Đã chuyển sang chế độ Mock Database cục bộ!" });
    }
    onSaved();
    onClose();
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>Cấu hình Cơ sở dữ liệu</h3>
          <button className="btn-close-modal" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--neutral-muted)' }}>
              Hệ thống hỗ trợ chạy bằng Mock Database lưu trữ trên Browser hoặc MySQL thực tế trên Server.
            </p>
            <div className="form-group">
              <label>Phương thức lưu trữ</label>
              <select value={dbType} onChange={(e) => setDbType(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', width: '100%', outline: 'none' }}>
                <option value="mock">Mock Database (Lưu trữ LocalStorage - Phù hợp kiểm thử và Demo)</option>
                <option value="mysql">MySQL Database (Chạy qua Route Handlers API - Yêu cầu kết nối DB thực)</option>
              </select>
            </div>
            
            {dbType === 'mysql' && (
              <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--neutral-light)', borderRadius: '6px', border: '1px solid var(--neutral-border)' }}>
                <div style={{ fontSize: '12px', color: 'var(--neutral-dark)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-circle-info" style={{ color: 'var(--primary-color)' }}></i>
                  Cấu hình MySQL trong tệp <code>.env.local</code> trên máy chủ:
                </div>
                <pre style={{ fontSize: '11px', marginTop: '8px', backgroundColor: '#e2e8f0', padding: '8px', borderRadius: '4px', color: '#0f172a', overflowX: 'auto', fontFamily: 'monospace' }}>
{`MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=topsystemdb`}
                </pre>
              </div>
            )}
          </div>
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="btn" style={{ backgroundColor: '#2563EB', color: '#fff', fontSize: '13px', padding: '6px 12px', borderRadius: '4px' }} onClick={handleTestConnection} disabled={isTesting}>
              {isTesting ? 'Đang thử kết nối...' : 'Kiểm tra kết nối'}
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
              <button type="submit" className="btn btn-primary">Lưu cấu hình</button>
            </div>
          </div>
        </form>
      </div>
    </ModalWrapper>
  );
};
