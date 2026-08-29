import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/utils/db';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { getSwal } from '@/utils/swal';
import { matchesRequiredPrefix } from '@/utils/filePrefixMatch';

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

// Modal Backdrop Wrapper
const ModalWrapper = ({ isOpen, children, onClose, style }) => {
  if (!isOpen) return null;
  return (
    <div className="modal show" style={{ display: 'flex' }} onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="modal-dialog" style={style} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

const ModalWrapperLg = ({ isOpen, children, onClose, style, className }) => {
  if (!isOpen) return null;
  return (
    <div className="modal show" style={{ display: 'flex' }} onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className={`modal-dialog modal-lg ${className || ''}`} style={style} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

// ================= 1. PROJECT MODAL =================
export const ProjectModal = ({ isOpen, onClose, projectId, currentUser, onSaved }) => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [description, setDescription] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [status, setStatus] = useState('Thực thi');
  const [startDate, setStartDate] = useState('2026-06-01');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [visibility, setVisibility] = useState('Private');
  // The <Tên_Xưởng>/<Tên_Máy>/* folders the Admin designed, and which of them this project wants.
  const [templateFolderOptions, setTemplateFolderOptions] = useState([]);
  const [selectedTemplateFolders, setSelectedTemplateFolders] = useState(() => new Set());
  const [customers, setCustomers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState({}); // userId -> role
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadProjectData = async () => {
      if (!isOpen) return;
      try {
        const users = await db.getUsers(currentUser?.id);
        setSystemUsers(users);

        // Fetch customers and departments from database
        const custs = await db.getCustomers();
        setCustomers(custs);
        const depts = await db.getDepartments(currentUser?.id);
        setDepartments(depts);

        if (projectId) {
          const projects = await db.getProjects();
          const p = projects.find(proj => proj.id === projectId);
          if (p) {
            let cleanName = p.name || '';
            if (cleanName.startsWith('[')) {
              const closeBracketIndex = cleanName.indexOf(']');
              if (closeBracketIndex !== -1) {
                cleanName = cleanName.slice(closeBracketIndex + 1).trim();
              }
            }
            setName(cleanName);
            setProjectKey(p.project_key || '');
            setDescription(p.description || '');
            setCustomerId(p.customer_id || '');
            setStatus(p.status || 'Thực thi');
            setStartDate(formatDateForInput(p.start_date) || '2026-06-01');
            setEndDate(formatDateForInput(p.end_date) || '2026-12-31');
            setVisibility(p.visibility || 'Private');
            
            const pMembers = (await db.getProjectMembers()).filter(m => m.project_id === projectId);
            const membersMap = {};
            pMembers.forEach(m => {
              membersMap[m.user_id] = m.project_role;
            });
            setSelectedMembers(membersMap);
          }
        } else {
          setName('');
          setProjectKey('');
          setDescription('');
          setCustomerId('');
          setStatus('Thực thi');
          setStartDate('2026-06-01');
          setEndDate('2026-12-31');
          setVisibility('Private');
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

  // Everything is ticked by default, so leaving this section alone provisions exactly the
  // complete tree that projects got before the choice existed.
  useEffect(() => {
    if (!isOpen || projectId) return undefined;
    let cancelled = false;
    db.getSelectableTemplateFolders()
      .then(list => {
        if (cancelled) return;
        const options = Array.isArray(list) ? list : [];
        setTemplateFolderOptions(options);
        setSelectedTemplateFolders(new Set(options.map(f => f.template_folder_id)));
      })
      .catch(() => {
        if (!cancelled) { setTemplateFolderOptions([]); setSelectedTemplateFolders(new Set()); }
      });
    return () => { cancelled = true; };
  }, [isOpen, projectId]);

  const toggleTemplateFolder = (id) => {
    setSelectedTemplateFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const projData = {
        id: projectId || null,
        name,
        project_key: projectKey,
        description,
        customer_id: customerId || null,
        status,
        start_date: startDate,
        end_date: endDate,
        visibility,
        create_by: currentUser.id,
        created_by: currentUser.id,
        // Only meaningful on create; an update must not re-provision folders.
        ...(projectId ? {} : { template_folder_ids: [...selectedTemplateFolders] })
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
      const Swal = await getSwal();
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: t('project.saveProjectError', 'Lỗi lưu dự án: ') + e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = systemUsers.filter(u => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
                          u.name.toLowerCase().includes(q) || 
                          u.email.toLowerCase().includes(q) ||
                          (u.employee_id && u.employee_id.toLowerCase().includes(q)) ||
                          (u.department_name && u.department_name.toLowerCase().includes(q));
    const matchesDept = !selectedDept || u.department_id === selectedDept;
    return matchesSearch && matchesDept;
  });

  const canEditProjectKey = !projectId || 
    currentUser?.system_role?.includes("Admin") || 
    currentUser?.system_role?.includes("Leader") || 
    currentUser?.system_role?.includes("Kinh doanh") || 
    currentUser?.system_role?.includes("Sales") || 
    selectedMembers[currentUser?.id] === 'PM';

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} style={{ maxWidth: '800px', width: '90%' }}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>{projectId ? t('project.editProjectTitle', 'Chỉnh Sửa Dự Án') : t('project.createProjectTitle', 'Tạo Dự Án Mới')}</h3>
          <button className="btn-close-modal" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>{t('project.projectName', 'Tên dự án')} <span className="required">*</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder={t('project.projectNamePlaceholder', 'Nhập tên dự án...')} />
            </div>
            <div className="form-group">
              <label>{t('project.projectKey', 'Mã dự án')} <span className="required">*</span></label>
              <input 
                type="text" 
                value={projectKey} 
                onChange={(e) => setProjectKey(e.target.value.toUpperCase())} 
                required 
                disabled={!canEditProjectKey}
                placeholder={t('project.projectKeyPlaceholder', 'Ví dụ: PS000000,PP00000...')} 
              />
            </div>
            <div className="form-group">
              <label>{t('project.projectDesc', 'Mô tả')}</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="3" placeholder={t('project.projectDescPlaceholder', 'Nhập mô tả dự án...')}></textarea>
            </div>
            <div className="form-group">
              <label>{t('project.customer', 'Khách hàng')}</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', width: '100%', outline: 'none' }}>
                <option value="">{t('project.selectCustomerDefault', '-- Chọn khách hàng --')}</option>
                {customers.map(c => (
                  <option key={c.customer_id} value={c.customer_id} title={c.customer_name}>
                    {c.customer_name && c.customer_name.length > 60 ? `${c.customer_name.slice(0, 60)}...` : c.customer_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>{t('project.projectClassification', 'Phân loại dự án')} <span className="required">*</span></label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', width: '100%', outline: 'none' }}>
                <option value="Private">{t('project.privateOption', 'Private (Dự án nội bộ - Giữ nguyên tính năng bảo mật)')}</option>
                <option value="Public">{t('project.publicOption', 'Public (Dự án công khai - Mở rộng mời/tham gia tự do)')}</option>
              </select>
            </div>

            <div className="form-row" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>{t('project.startDate', 'Ngày bắt đầu')}</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', outline: 'none' }} />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>{t('project.endDate', 'Ngày kết thúc')}</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', outline: 'none' }} />
              </div>
            </div>
            
          {/* Which of the Admin-designed <Tên_Xưởng>/<Tên_Máy>/* folders this project needs.
              Only offered when creating: an existing project's folders are edited in its
              Documents tab, and re-provisioning them here would duplicate what is there. */}
          {!projectId && templateFolderOptions.length > 0 && (
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label style={{ fontWeight: '600', fontSize: '13px', color: 'var(--neutral-dark)', marginBottom: '4px', display: 'block' }}>
                {t('project.templateFoldersLabel', 'Thư mục tài liệu cần tạo')}
              </label>
              <div style={{ fontSize: '11.5px', color: 'var(--neutral-muted)', marginBottom: '8px' }}>
                {t('project.templateFoldersHint', 'Chỉ những thư mục được tích sẽ xuất hiện trong tài liệu của dự án. Thư mục con và quy định tên tệp bên trong vẫn theo thiết kế của Admin.')}
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px',
                border: '1px solid var(--neutral-border)', borderRadius: '6px', padding: '10px',
                backgroundColor: 'var(--neutral-bg-main)'
              }}>
                {templateFolderOptions.map(folder => {
                  const checked = selectedTemplateFolders.has(folder.template_folder_id);
                  return (
                    <label
                      key={folder.template_folder_id}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--neutral-dark)', cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTemplateFolder(folder.template_folder_id)}
                        style={{ cursor: 'pointer', margin: 0, flexShrink: 0 }}
                      />
                      <i
                        className={folder.folder_type === 'file_slot_table' ? 'fa-solid fa-table-list' : 'fa-solid fa-folder'}
                        style={{ color: 'var(--neutral-muted)', fontSize: '12px' }}
                      ></i>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
                    </label>
                  );
                })}
              </div>
              {selectedTemplateFolders.size === 0 && (
                <div style={{ fontSize: '11.5px', color: '#f59e0b', marginTop: '6px' }}>
                  <i className="fa-solid fa-circle-info"></i>{' '}
                  {t('project.templateFoldersNoneHint', 'Không tích thư mục nào: dự án sẽ chỉ có thư mục gốc, không có thư mục con.')}
                </div>
              )}
            </div>
          )}

            <div className="form-group">
              <label>{t('project.projectMembers', 'Thành viên dự án')}</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input 
                  type="text" 
                  placeholder={t('task.searchMember', 'Tìm kiếm thành viên...')} 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '13px', outline: 'none' }}
                />
                <select 
                  value={selectedDept} 
                  onChange={(e) => setSelectedDept(e.target.value)} 
                  style={{ width: '160px', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '13px', outline: 'none' }}
                >
                  <option value="">{t('task.allDepartments', 'Tất cả phòng ban')}</option>
                  {departments.map(dept => (
                    <option key={dept.department_id} value={dept.department_id}>{translateDepartmentName(dept.name, t)}</option>
                  ))}
                </select>
              </div>
              <div className="project-members-selector-list" style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--neutral-border)', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredUsers.length === 0 ? (
                  <div style={{ padding: '8px', color: 'var(--neutral-muted)', fontSize: '13px', textAlign: 'center' }}>{t('project.noMatchingEmployees', 'Không tìm thấy nhân viên phù hợp')}</div>
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
                          <label htmlFor={`modal-member-check-${u.id}`}>
                            {u.name} ({u.employee_id || 'N/A'}) - {translateDepartmentName(u.department_name, t)}
                          </label>
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
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>{t('common.cancel', 'Hủy')}</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting
                ? t('common.processing', 'Đang xử lý...')
                : (projectId ? t('project.saveChanges', 'Lưu thay đổi') : t('project.createProjectBtn', 'Tạo dự án'))}
            </button>
          </div>
        </form>
      </div>
    </ModalWrapper>
  );
};

// ================= 2. TASK MODAL (DETAIL & COLLAB) =================
export const TaskModal = ({ isOpen, onClose, taskId, projId, currentUser, onSaved }) => {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [assigneeIds, setAssigneeIds] = useState([]);

  const [isLockedByOther, setIsLockedByOther] = useState(false);
  const [lockOwnerName, setLockOwnerName] = useState('');
  const lockIntervalRef = useRef(null);

  const parseTaskDesc = (desc) => {
    try {
      const data = JSON.parse(desc);
      if (data && typeof data === 'object') {
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
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [isProcessingAttachment, setIsProcessingAttachment] = useState(false);

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
        const depts = await db.getDepartments(currentUser?.id);
        setDepartments(depts);

        // Load assignees based on project
        const membersList = (await db.getProjectMembers()).filter(m => m.project_id === projId);
        const users = await db.getUsers(currentUser?.id);
        const mappedMembers = [];
        membersList.forEach(m => {
          const u = users.find(usr => usr.id === m.user_id);
          if (u) {
            mappedMembers.push({ ...u, project_role: m.project_role });
          }
        });
        setProjectMembers(mappedMembers);

        if (taskId) {
          // Attempt to lock task
          if (lockIntervalRef.current) {
            clearInterval(lockIntervalRef.current);
            lockIntervalRef.current = null;
          }

          try {
            const lockRes = await db.lockTask(taskId, currentUser.id);
            if (lockRes.success) {
              setIsLockedByOther(false);
              setLockOwnerName('');
              lockIntervalRef.current = setInterval(async () => {
                await db.lockTask(taskId, currentUser.id);
              }, 10000);
            } else {
              setIsLockedByOther(true);
              setLockOwnerName(lockRes.lockedBy || 'Người dùng khác');
            }
          } catch (lockErr) {
            console.error("Locking task failed:", lockErr);
          }

          const tasks = await db.getTasks();
          const t = tasks.find(task => task.id === taskId);
          if (t) {
            setTitle(t.title);
            
            const parsed = parseTaskDesc(t.description);
            setDescription(parsed.text);
            setAssigneeIds(parsed.assigneeIds.length > 0 ? parsed.assigneeIds : (t.assignee_id ? [t.assignee_id] : []));
            setAssigneeId(t.assignee_id || '');
            
            setDueDate(formatDateForInput(t.due_date) || '');
            setPriority(t.priority);
            setStatus(t.status);
            
            await loadCollabData();
          }
        } else {
          setIsLockedByOther(false);
          setLockOwnerName('');
          setTitle('');
          setDescription('');
          setAssigneeId('');
          setAssigneeIds([]);
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

    return () => {
      if (lockIntervalRef.current) {
        clearInterval(lockIntervalRef.current);
        lockIntervalRef.current = null;
      }
      if (taskId && currentUser) {
        db.unlockTask(taskId, currentUser.id).catch(err => console.error("Failed to unlock task:", err));
      }
    };
  }, [isOpen, taskId, projId, currentUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || isSubmittingTask) return;

    setIsSubmittingTask(true);
    try {
      const taskData = {
        id: taskId || null,
        project_id: projId,
        title,
        description: JSON.stringify({
          text: description,
          assignee_ids: assigneeIds
        }),
        assignee_id: assigneeIds[0] || null,
        priority,
        status,
        due_date: dueDate || null,
        attachments // Preserve attachments
      };

      const result = await db.saveTask(taskData);

      // Create notifications for newly assigned users
      const oldTask = taskId ? (await db.getTasks()).find(t => t.id === taskId) : null;
      let oldAssigneeIds = [];
      if (oldTask) {
        try {
          const parsed = JSON.parse(oldTask.description);
          if (parsed && typeof parsed === 'object') {
            oldAssigneeIds = parsed.assignee_ids || [];
          }
        } catch (e) {}
        if (oldAssigneeIds.length === 0 && oldTask.assignee_id) {
          oldAssigneeIds = [oldTask.assignee_id];
        }
      }

      for (const uid of assigneeIds) {
        if (!oldAssigneeIds.includes(uid)) {
          await db.createNotification(uid, "Công việc mới được giao", `Bạn được giao công việc '${title}'`, `#tasks`);
        }
      }

      if (taskId) {
        await db.logActivity(currentUser.id, "UPDATE", "Task", result.id, `đã cập nhật công việc '${title}'`);
      } else {
        await db.logActivity(currentUser.id, "CREATE", "Task", result.id, `đã giao công việc mới '${title}'`);
      }

      onSaved();
      onClose();
    } catch (e) {
      const Swal = await getSwal();
      Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi lưu task: " + e.message });
    } finally {
      setIsSubmittingTask(false);
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
    if (!newComment.trim() || isSendingComment) return;

    setIsSendingComment(true);
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
    } finally {
      setIsSendingComment(false);
    }
  };

  // Attachments
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || isProcessingAttachment) return;

    setIsProcessingAttachment(true);
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
    } finally {
      setIsProcessingAttachment(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (idx) => {
    if (isProcessingAttachment) return;
    setIsProcessingAttachment(true);
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
    } finally {
      setIsProcessingAttachment(false);
    }
  };

  const filteredMembers = projectMembers.filter(m => {
    const q = assigneeSearchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
                          m.name.toLowerCase().includes(q) || 
                          m.email.toLowerCase().includes(q) ||
                          (m.employee_id && m.employee_id.toLowerCase().includes(q)) ||
                          (m.department_name && m.department_name.toLowerCase().includes(q));
    const matchesDept = !assigneeSelectedDept || m.department_id === assigneeSelectedDept;
    return matchesSearch && matchesDept;
  });

  // Progress subtasks calculation
  const doneSubtasks = subtasks.filter(s => s.is_done).length;
  const progressPercent = subtasks.length > 0 ? Math.round((doneSubtasks / subtasks.length) * 100) : 0;

  return (
    <ModalWrapperLg isOpen={isOpen} onClose={onClose} style={{ maxWidth: '1100px', width: '95%' }}>
      <div className="modal-content">
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', backgroundColor: 'var(--neutral-bg-card)', borderBottom: '1px solid var(--neutral-border)' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--neutral-dark)' }}>
            {taskId ? t('task.taskDetail', 'Chi tiết công việc') : t('task.assignNewTask', 'Giao việc mới')}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto', marginRight: '16px' }}>
            <label style={{ fontWeight: '600', fontSize: '13px', color: 'var(--neutral-muted)', margin: 0 }}>{t('common.status', 'Trạng thái:')}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={disableStatusSelect || isLockedByOther}
              className="doc-select-filter"
              style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '13px', outline: 'none' }}
            >
              <option value="Todo">To do</option>
              <option value="InProgress">In progress</option>
              <option value="Review">Review</option>
              <option value="Done">Done</option>
            </select>
          </div>
          <button className="btn-close-modal" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        {isLockedByOther && (
          <div style={{
            backgroundColor: 'var(--warning-light)',
            borderBottom: '1px solid var(--neutral-border)',
            padding: '10px 20px',
            fontSize: '13px',
            color: 'var(--warning-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: '500'
          }}>
            <i className="fa-solid fa-lock" style={{ fontSize: '15px', color: 'var(--warning-color)' }}></i>
            <span>
              Công việc này đang được chỉnh sửa bởi <strong>{lockOwnerName}</strong>. Chế độ xem chỉ đọc (Read-only).
            </span>
          </div>
        )}
        <div className="modal-body modal-body-split">
          <div className="modal-split-left">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>{t('task.taskTitle', 'Tiêu đề công việc')} <span className="required">*</span></label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!isPM || isLockedByOther} required placeholder={t('task.enterTaskTitle', 'Nhập tiêu đề công việc...')} />
              </div>
              <div className="form-group">
                <label>{t('task.taskDescription', 'Mô tả công việc')}</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!isPM || isLockedByOther} rows="4" placeholder={t('task.enterDescription', 'Nhập mô tả chi tiết...')}></textarea>
              </div>
              <div className="form-row" style={{ display: 'flex', gap: '16px' }}>
                <div className="form-group col-6" style={{ flex: 1 }}>
                  <label>{t('project.assigneeLabel', 'Người thực hiện')}</label>
                  {isPM ? (
                    <div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                        <select 
                          value={assigneeSelectedDept} 
                          onChange={(e) => setAssigneeSelectedDept(e.target.value)} 
                          style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '12px', outline: 'none' }}
                        >
                          <option value="">{t('task.allDepartments', 'Tất cả phòng ban')}</option>
                          {departments.map(dept => (
                            <option key={dept.department_id} value={dept.department_id}>{translateDepartmentName(dept.name, t)}</option>
                          ))}
                        </select>
                        <input 
                          type="text" 
                          placeholder={t('task.searchMember', 'Tìm kiếm thành viên...')} 
                          value={assigneeSearchQuery} 
                          onChange={(e) => setAssigneeSearchQuery(e.target.value)} 
                          style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '12px', outline: 'none' }}
                        />
                      </div>
                      <div className="project-members-selector-list" style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--neutral-border)', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--neutral-bg-card)' }}>
                        {filteredMembers.length === 0 ? (
                          <div style={{ padding: '8px', color: 'var(--neutral-muted)', fontSize: '12px', textAlign: 'center' }}>Không tìm thấy nhân viên phù hợp</div>
                        ) : (
                          filteredMembers.map(m => {
                            const isChecked = assigneeIds.includes(m.id);
                            return (
                              <div className="member-select-row" key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
                                <div className="member-select-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <input 
                                    type="checkbox" 
                                    id={`task-assignee-check-${m.id}`} 
                                    checked={isChecked} 
                                    disabled={isLockedByOther}
                                    onChange={() => {
                                      if (isChecked) {
                                        setAssigneeIds(prev => prev.filter(id => id !== m.id));
                                      } else {
                                        setAssigneeIds(prev => [...prev, m.id]);
                                      }
                                    }}
                                  />
                                  <label htmlFor={`task-assignee-check-${m.id}`} style={{ cursor: 'pointer', margin: 0, fontSize: '13px' }}>
                                    {m.name} ({m.employee_id || 'N/A'}) - {translateDepartmentName(m.department_name, t)} ({m.project_role || 'Member'})
                                  </label>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '8px 12px', border: '1px solid var(--neutral-border)', borderRadius: '4px', backgroundColor: 'var(--neutral-bg-main)', fontSize: '13px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {assigneeIds.length > 0 ? (
                        projectMembers.filter(m => assigneeIds.includes(m.id)).map(m => (
                          <span key={m.id} style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--neutral-bg-hover)', color: 'var(--neutral-dark)', fontWeight: '500', fontSize: '12px' }}>
                            {m.name}
                          </span>
                        ))
                      ) : (
                        'Chưa giao việc cho ai.'
                      )}
                    </div>
                  )}
                </div>
               
              </div>
               <div className="form-group col-6" style={{ width: '100%' }}>
                  <label>{t('task.dueDate', 'Hạn chót (Deadline)')}</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!isPM || isLockedByOther} style={{ width: '100%' }} />
                </div>
              <div className="form-row">
                <div className="form-group col-12" style={{ width: '100%' }}>
                  <label>{t('task.priority', 'Độ ưu tiên')}</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)} disabled={!isPM || isLockedByOther} style={{ width: '100%' }}>
                    <option value="Thấp">{t('task.priorityLow', 'Thấp')}</option>
                    <option value="Trung bình">{t('task.priorityMedium', 'Trung bình')}</option>
                    <option value="Cao">{t('task.priorityHigh', 'Cao')}</option>
                  </select>
                </div>
              </div>
              <div className="task-form-actions">
                {isPM && !isLockedByOther && (
                  <button type="submit" className="btn btn-primary" disabled={isSubmittingTask}>
                    {isSubmittingTask ? t('common.processing', 'Đang xử lý...') : t('common.saveChanges', 'Lưu thay đổi')}
                  </button>
                )}
              </div>
            </form>


          </div>

          {taskId && (
            <div className="modal-split-right">
              {/* Attachments */}
              <div className="task-section">
                <h4 className="section-title"><i className="fa-solid fa-paperclip"></i> {t('task.attachments', 'Đính kèm')}</h4>
                <div className="attachment-list">
                  {attachments.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: '11.5px' }}>{t('task.noAttachmentsYet', 'Chưa đính kèm tài liệu nào.')}</p>
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
                        <button
                          className="btn-delete-attachment"
                          onClick={() => { if (!isLockedByOther && !isProcessingAttachment) handleDeleteAttachment(idx); }}
                          disabled={isLockedByOther || isProcessingAttachment}
                          style={{ opacity: (isLockedByOther || isProcessingAttachment) ? 0.5 : 1, cursor: (isLockedByOther || isProcessingAttachment) ? 'not-allowed' : 'pointer' }}
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="attachment-upload-box">
                  <label
                    className="btn btn-secondary btn-sm btn-block"
                    style={{ marginBottom: 0, opacity: (isLockedByOther || isProcessingAttachment) ? 0.6 : 1, pointerEvents: (isLockedByOther || isProcessingAttachment) ? 'none' : 'auto', cursor: (isLockedByOther || isProcessingAttachment) ? 'not-allowed' : 'pointer' }}
                  >
                    <i className="fa-solid fa-cloud-arrow-up"></i> {isProcessingAttachment ? t('common.processing', 'Đang xử lý...') : t('task.uploadFile', 'Tải file lên')}
                    <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} disabled={isLockedByOther || isProcessingAttachment} />
                  </label>
                </div>
              </div>

              {/* Comments */}
              <div className="task-section comment-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h4 className="section-title"><i className="fa-solid fa-comments"></i> {t('task.chatWithReporter', 'Chat với người giao task')}</h4>
                <div className="comments-list" style={{ maxHeight: '180px', overflowY: 'auto', padding: '4px' }}>
                  {comments.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: '11.5px', textAlign: 'center', padding: '12px' }}>{t('task.noDiscussionMessages', 'Chưa có tin nhắn thảo luận nào.')}</p>
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
                    disabled={isSendingComment}
                    placeholder={t('task.enterMessagePlaceholder', 'Nhập nội dung trao đổi...')}
                    style={{ flex: 1, padding: '8px 12px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid var(--neutral-border)', outline: 'none' }}
                  />
                  <button type="button" className="btn btn-primary btn-sm" style={{ padding: '6px 12px' }} onClick={handleAddComment} disabled={isSendingComment}>{t('common.send', 'Gửi')}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalWrapperLg>
  );
};


// ================= 4. CUSTOMER MODAL =================
export const CustomerModal = ({ isOpen, onClose, currentUser, onSaved }) => {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState([]);
  const [activeCustomerId, setActiveCustomerId] = useState('new');
  // Mobile-only: whether the customer form is expanded below the list
  const [mobileFormOpen, setMobileFormOpen] = useState(false);

  const [custName, setCustName] = useState('');
  const [custCode, setCustCode] = useState('');
  const [address, setAddress] = useState('');
  const [taxCode, setTaxCode] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadCustomers = async () => {
    try {
      const list = await db.getCustomers();
      setCustomers(list);
    } catch (e) {
      console.error("Failed to load customers:", e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCustomers();
      setActiveCustomerId('new');
      setMobileFormOpen(false);
      setCustName('');
      setCustCode('');
      setAddress('');
      setTaxCode('');
      setIsEditing(true);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeCustomerId === 'new') {
      setCustName('');
      setCustCode('');
      setAddress('');
      setTaxCode('');
      setIsEditing(true);
      setErrorMsg('');
      setSuccessMsg('');
    } else {
      const c = customers.find(item => item.id === parseInt(activeCustomerId));
      if (c) {
        setCustName(c.customer_name);
        setCustCode(c.customer_id);
        setAddress(c.address || '');
        setTaxCode(c.tax_code || '');
        setIsEditing(false);
        setErrorMsg('');
        setSuccessMsg('');
      }
    }
  }, [activeCustomerId, customers]);

  const handleCancelEdit = () => {
    if (activeCustomerId === 'new') {
      setCustName('');
      setCustCode('');
      setAddress('');
      setTaxCode('');
      setErrorMsg('');
    } else {
      const c = customers.find(item => item.id === parseInt(activeCustomerId));
      if (c) {
        setCustName(c.customer_name);
        setCustCode(c.customer_id);
        setAddress(c.address || '');
        setTaxCode(c.tax_code || '');
      }
      setIsEditing(false);
      setErrorMsg('');
    }
  };

  const handleStartEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!custName || !custCode) {
      setErrorMsg(t('customer.nameAndCodeRequired', 'Tên khách hàng và Mã khách hàng là bắt buộc.'));
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        id: activeCustomerId === 'new' ? null : parseInt(activeCustomerId),
        customer_id: custCode.trim(),
        customer_name: custName.trim(),
        address: address.trim(),
        tax_code: taxCode.trim()
      };

      const res = await db.saveCustomer(payload);
      if (res.success) {
        const message = activeCustomerId === 'new' ? t('customer.addCustomerSuccess', 'Đã thêm khách hàng thành công!') : t('customer.updateCustomerSuccess', 'Đã cập nhật thông tin khách hàng!');
        setSuccessMsg(message);
        
        await db.logActivity(
          currentUser.id,
          activeCustomerId === 'new' ? "CREATE" : "UPDATE",
          "Customer",
          custCode.trim(),
          `đã ${activeCustomerId === 'new' ? 'thêm' : 'cập nhật'} khách hàng '${custName.trim()}' (${custCode.trim()})`
        );

        const list = await db.getCustomers();
        setCustomers(list);
        
        const newCust = list.find(item => item.customer_id === custCode.trim());
        if (newCust) {
          setActiveCustomerId(newCust.id.toString());
        }
        setIsEditing(false);

        if (onSaved) onSaved();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || t('customer.saveCustomerError', 'Lỗi khi lưu khách hàng.'));
    } finally {
      setLoading(false);
    }
  };

  // Deleting a customer is Admin-only. The server enforces it too: hiding the button is
  // not a permission check, and this one removes a record other data can point at.
  const isAdmin = !!currentUser?.system_role?.includes('Admin');

  const handleDeleteCustomer = async () => {
    const target = customers.find(c => c.customer_id === activeCustomerId);
    if (!target) return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const Swal = await getSwal();
    const confirmed = await Swal.fire({
      title: t('customer.deleteTitle', 'Xóa khách hàng'),
      text: t('customer.deleteConfirm', 'Bạn có chắc chắn muốn xóa khách hàng "{name}"? Hành động này không thể hoàn tác.')
        .replace('{name}', target.customer_name),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: t('common.confirm', 'Đồng ý'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b'
    });
    if (!confirmed.isConfirmed) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await db.deleteCustomer(target.customer_id, currentUser.id);
      await db.logActivity(
        currentUser.id, 'DELETE', 'Customer', target.customer_id,
        `đã xóa khách hàng '${target.customer_name}'`
      ).catch(() => {});
      await loadCustomers();
      setActiveCustomerId('new');
      setCustName('');
      setCustCode('');
      setAddress('');
      setTaxCode('');
      setIsEditing(true);
      setSuccessMsg(t('customer.deleteSuccess', 'Đã xóa khách hàng.'));
      if (onSaved) onSaved();
    } catch (err) {
      // The server refuses while projects still point at the customer, and says which.
      setErrorMsg(err.message || t('customer.deleteError', 'Không thể xóa khách hàng.'));
    } finally {
      setLoading(false);
    }
  };

  const renderCustomerFormContent = () => (
    <>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '700', color: 'var(--neutral-dark)', borderBottom: '2px solid var(--primary-color)', paddingBottom: '8px', display: 'inline-block', width: 'fit-content' }}>
              {activeCustomerId === 'new' ? t('customer.addCustomer', 'Thêm khách hàng') : custName}
            </h4>
            
            {errorMsg && (
              <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '6px', color: '#ef4444', fontSize: '12.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-circle-exclamation"></i> {errorMsg}
              </div>
            )}
            
            {successMsg && (
              <div style={{ padding: '10px 14px', backgroundColor: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '6px', color: '#16a34a', fontSize: '12.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-circle-check"></i> {successMsg}
              </div>
            )}

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--neutral-border)', marginBottom: '20px' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '30%', backgroundColor: 'var(--neutral-bg-hover)', padding: '12px', border: '1px solid var(--neutral-border)', fontWeight: '600', fontSize: '13px', color: 'var(--neutral-dark)' }}>
                      {t('customer.customerName', 'Tên Khách Hàng')} <span className="required" style={{ color: '#ef4444' }}>*</span>
                    </td>
                    <td style={{ padding: '8px', border: '1px solid var(--neutral-border)' }}>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={custName} 
                          onChange={(e) => setCustName(e.target.value)} 
                          style={{ width: '100%', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', padding: '6px 10px', borderRadius: '4px', fontSize: '13.5px', outline: 'none' }}
                          placeholder={t('customer.enterCustomerName', 'Nhập tên khách hàng...')}
                          required
                        />
                      ) : (
                        <div style={{ padding: '6px 10px', fontSize: '13.5px', color: 'var(--neutral-dark)', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                          {custName}
                        </div>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ backgroundColor: 'var(--neutral-bg-hover)', padding: '12px', border: '1px solid var(--neutral-border)', fontWeight: '600', fontSize: '13px', color: 'var(--neutral-dark)' }}>
                      {t('customer.customerId', 'Mã Khách Hàng')} <span className="required" style={{ color: '#ef4444' }}>*</span>
                    </td>
                    <td style={{ padding: '8px', border: '1px solid var(--neutral-border)' }}>
                      {isEditing && activeCustomerId === 'new' ? (
                        <input 
                          type="text" 
                          value={custCode} 
                          onChange={(e) => setCustCode(e.target.value)} 
                          style={{ width: '100%', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', padding: '6px 10px', borderRadius: '4px', fontSize: '13.5px', outline: 'none' }}
                          placeholder={t('customer.enterCustomerId', 'Nhập mã khách hàng...')}
                          required
                        />
                      ) : (
                        <div style={{ padding: '6px 10px', fontSize: '13.5px', color: 'var(--neutral-dark)', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                          {custCode}
                        </div>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ backgroundColor: 'var(--neutral-bg-hover)', padding: '12px', border: '1px solid var(--neutral-border)', fontWeight: '600', fontSize: '13px', color: 'var(--neutral-dark)' }}>
                      {t('customer.address', 'Địa chỉ')}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid var(--neutral-border)' }}>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={address} 
                          onChange={(e) => setAddress(e.target.value)} 
                          style={{ width: '100%', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', padding: '6px 10px', borderRadius: '4px', fontSize: '13.5px', outline: 'none' }}
                          placeholder={t('customer.enterAddress', 'Nhập địa chỉ...')}
                        />
                      ) : (
                        <div style={{ padding: '6px 10px', fontSize: '13.5px', color: 'var(--neutral-dark)', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                          {address || <span style={{ color: 'var(--neutral-muted)', fontStyle: 'italic' }}>{t('customer.noInfo', 'Chưa có thông tin')}</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ backgroundColor: 'var(--neutral-bg-hover)', padding: '12px', border: '1px solid var(--neutral-border)', fontWeight: '600', fontSize: '13px', color: 'var(--neutral-dark)' }}>
                      {t('customer.taxCode', 'Mã số thuế')}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid var(--neutral-border)' }}>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={taxCode} 
                          onChange={(e) => setTaxCode(e.target.value)} 
                          style={{ width: '100%', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)', color: 'var(--neutral-dark)', padding: '6px 10px', borderRadius: '4px', fontSize: '13.5px', outline: 'none' }}
                          placeholder={t('customer.enterTaxCode', 'Nhập mã số thuế...')}
                        />
                      ) : (
                        <div style={{ padding: '6px 10px', fontSize: '13.5px', color: 'var(--neutral-dark)', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                          {taxCode || <span style={{ color: 'var(--neutral-muted)', fontStyle: 'italic' }}>Chưa có thông tin</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--neutral-border)', paddingTop: '16px' }}>
                {/* Sits apart from Save/Cancel so it cannot be hit by accident */}
                {isAdmin && activeCustomerId !== 'new' && (
                  <button
                    type="button"
                    className="btn"
                    onClick={handleDeleteCustomer}
                    disabled={loading}
                    style={{ marginRight: 'auto', backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#fff' }}
                  >
                    <i className="fa-solid fa-trash-can"></i> {t('customer.deleteBtn', 'Xóa khách hàng')}
                  </button>
                )}
                {isEditing ? (
                  <>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={handleCancelEdit}
                      disabled={loading}
                    >
                      {t('common.cancel', 'Hủy')}
                    </button>
                    <button 
                      type="submit" 
                      className="btn btn-primary" 
                      disabled={loading}
                    >
                      {loading ? t('common.saving', 'Đang lưu...') : t('common.save', 'Lưu')}
                    </button>
                  </>
                ) : (
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={handleStartEdit}
                  >
                    {t('common.edit', 'Sửa')}
                  </button>
                )}
              </div>
            </form>
    </>
  );

  return (
    <ModalWrapperLg isOpen={isOpen} onClose={onClose} className="customer-mgmt-dialog" style={{ width: '75vw', maxWidth: '75vw' }}>
      <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', height: '75vh', maxHeight: '75vh' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--neutral-border)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--neutral-dark)' }}>
            <i className="fa-solid fa-user-tie" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i> {t('customer.manageCustomers', 'Quản lý khách hàng')}
          </h3>
          <button className="btn-close-modal" onClick={onClose} style={{ fontSize: '20px', cursor: 'pointer' }}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="modal-body customer-mgmt-body" style={{ display: 'flex', flex: 1, padding: 0, overflow: 'hidden' }}>
          {/* Left panel - Customer List */}
          <div className="customer-mgmt-list-panel" style={{ width: '280px', borderRight: '1px solid var(--neutral-border)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--neutral-bg-card)', height: '100%' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--neutral-border)', fontWeight: '600', fontSize: '13px', color: 'var(--neutral-dark)', backgroundColor: 'var(--neutral-bg-hover)' }}>
              {t('customer.customerList', 'Danh sách khách hàng')}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  if (activeCustomerId === 'new' && mobileFormOpen) {
                    setMobileFormOpen(false);
                  } else {
                    setActiveCustomerId('new');
                    setMobileFormOpen(true);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: activeCustomerId === 'new' ? 'var(--primary-color)' : 'var(--neutral-dark)',
                  backgroundColor: activeCustomerId === 'new' ? 'var(--primary-light)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '6px',
                  transition: 'all 0.15s'
                }}
              >
                <i className="fa-solid fa-plus-circle" style={{ fontSize: '14px' }}></i> {t('customer.addCustomer', 'Thêm khách hàng')}
              </button>

              {mobileFormOpen && (
                <div className="inline-mobile-customer-form">
                  {renderCustomerFormContent()}
                </div>
              )}

              <div style={{ height: '1px', backgroundColor: 'var(--neutral-border)', margin: '8px 0' }} />

              {customers.length === 0 ? (
                <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--neutral-muted)' }}>
                  {t('customer.noCustomers', 'Chưa có khách hàng nào')}
                </div>
              ) : (
                customers.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      const idStr = c.id.toString();
                      if (activeCustomerId === idStr && mobileFormOpen) {
                        setMobileFormOpen(false);
                      } else {
                        setActiveCustomerId(idStr);
                        setMobileFormOpen(true);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: activeCustomerId === c.id.toString() ? '600' : '500',
                      color: activeCustomerId === c.id.toString() ? 'var(--primary-color)' : 'var(--neutral-dark)',
                      backgroundColor: activeCustomerId === c.id.toString() ? 'var(--primary-light)' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px',
                      transition: 'all 0.15s',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word'
                    }}
                  >
                    <i className="fa-solid fa-user-tie" style={{ fontSize: '13px', color: activeCustomerId === c.id.toString() ? 'var(--primary-color)' : 'var(--neutral-dark)', opacity: 0.9 }}></i>
                    {c.customer_name}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right panel - Customer Form */}
          <div className="customer-mgmt-form-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--neutral-bg-card)', overflowY: 'auto', padding: '24px' }}>
            {renderCustomerFormContent()}
          </div>
        </div>
      </div>
    </ModalWrapperLg>
  );
};

// ================= 4. FOLDER TEMPLATE MODAL (Admin-only) =================
// Lets an Admin design the default folder tree that gets cloned into every newly
// created project's "Tài liệu" tab (see createDefaultProjectFolderTree on the
// backend). Mirrors DocumentExplorer.js's tree + right-click rename/delete pattern,
// simplified (no collapse state, no ownership gating — the whole modal is Admin-only).
export const FolderTemplateModal = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [slots, setSlots] = useState([]);
  const [newPrefix, setNewPrefix] = useState('');
  const [folderContextMenu, setFolderContextMenu] = useState(null);
  const [defaultPrefixInput, setDefaultPrefixInput] = useState('');
  const [allowedExtensionsInput, setAllowedExtensionsInput] = useState('');

  const loadFolders = async () => {
    try {
      const list = await db.getFolderTemplates();
      setFolders(list || []);
    } catch (err) {
      console.error('Failed to load folder templates', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFolders();
      setSelectedFolderId(null);
    }
  }, [isOpen]);

  const selectedFolder = folders.find(f => f.template_folder_id === selectedFolderId);

  useEffect(() => {
    setDefaultPrefixInput(selectedFolder?.default_prefix || '');
    setAllowedExtensionsInput(selectedFolder?.allowed_extensions || '');
  }, [selectedFolderId, selectedFolder?.default_prefix, selectedFolder?.allowed_extensions]);

  const handleSaveDefaultPrefix = async () => {
    if (!selectedFolder) return;
    try {
      await db.setFolderTemplateDefaultPrefix(selectedFolder.template_folder_id, defaultPrefixInput);
      await loadFolders();
    } catch (err) {
      const Swal = await getSwal();
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    }
  };

  const handleSaveAllowedExtensions = async () => {
    if (!selectedFolder) return;
    try {
      await db.setFolderTemplateAllowedExtensions(selectedFolder.template_folder_id, allowedExtensionsInput);
      await loadFolders();
    } catch (err) {
      const Swal = await getSwal();
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    }
  };

  const loadSlots = async (templateFolderId) => {
    try {
      const list = await db.getFolderTemplateSlots({ templateFolderId });
      setSlots(list || []);
    } catch (err) {
      console.error('Failed to load folder template slots', err);
    }
  };

  useEffect(() => {
    if (selectedFolder?.folder_type === 'file_slot_table') {
      loadSlots(selectedFolder.template_folder_id);
    } else {
      setSlots([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolderId, selectedFolder?.folder_type]);

  useEffect(() => {
    if (!folderContextMenu) return;
    const closeMenu = () => setFolderContextMenu(null);
    const handleKeyDown = (e) => { if (e.key === 'Escape') closeMenu(); };
    window.addEventListener('click', closeMenu);
    window.addEventListener('contextmenu', closeMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('contextmenu', closeMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [folderContextMenu]);

  const getChildren = (parentId) => folders.filter(f => (f.parent_template_folder_id || null) === parentId);
  const rootFolders = getChildren(null);

  const handleAddFolder = async (parentTemplateFolderId) => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const Swal = await getSwal();
    const { value: name } = await Swal.fire({
      title: t('documents.newFolderTitle', 'Thư mục mới'),
      input: 'text',
      inputPlaceholder: t('documents.folderNamePlaceholder', 'Nhập tên thư mục...'),
      showCancelButton: true,
      confirmButtonText: t('common.create', 'Tạo mới'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--primary-color)',
      inputValidator: (value) => (!value || !value.trim()) ? t('documents.folderNameRequired', 'Vui lòng nhập tên thư mục') : undefined
    });
    if (!name) return;
    try {
      await db.createFolderTemplateFolder({ name: name.trim(), parentTemplateFolderId });
      await loadFolders();
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    }
  };

  const handleRenameFolder = async (folder) => {
    const Swal = await getSwal();
    const { value: name } = await Swal.fire({
      title: t('documents.renameFolderTitle', 'Đổi tên thư mục'),
      input: 'text',
      inputValue: folder.name,
      showCancelButton: true,
      confirmButtonText: t('common.save', 'Lưu thay đổi'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--primary-color)',
      inputValidator: (value) => (!value || !value.trim()) ? t('documents.folderNameRequired', 'Vui lòng nhập tên thư mục') : undefined
    });
    if (!name || name.trim() === folder.name) return;
    try {
      await db.renameFolderTemplateFolder(folder.template_folder_id, name.trim());
      await loadFolders();
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    }
  };

  const handleDeleteFolder = async (folder) => {
    const Swal = await getSwal();
    const result = await Swal.fire({
      icon: 'warning',
      title: t('documents.deleteFolderConfirmTitle', 'Xóa thư mục?'),
      text: t('documents.deleteFolderConfirmText', 'Toàn bộ thư mục con và tài liệu bên trong sẽ bị xóa vĩnh viễn.'),
      showCancelButton: true,
      confirmButtonText: t('common.delete', 'Xóa'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--danger-color)'
    });
    if (!result.isConfirmed) return;
    try {
      await db.deleteFolderTemplateFolder(folder.template_folder_id);
      if (selectedFolderId === folder.template_folder_id) setSelectedFolderId(null);
      await loadFolders();
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    }
  };

  const handleToggleSlotType = async (checked) => {
    if (!selectedFolder) return;
    try {
      await db.setFolderTemplateType(selectedFolder.template_folder_id, checked ? 'file_slot_table' : null);
      await loadFolders();
    } catch (err) {
      const Swal = await getSwal();
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    }
  };

  const handleAddPrefix = async () => {
    if (!selectedFolder || !newPrefix.trim()) return;
    if (selectedFolder.default_prefix && !matchesRequiredPrefix(newPrefix.trim(), selectedFolder.default_prefix)) {
      const Swal = await getSwal();
      Swal.fire({ icon: 'warning', title: t('common.warning', 'Cảnh báo'), text: t('documents.slotPrefixMustMatchFolder', 'Tiền tố hàng phải chứa tiền tố mặc định của thư mục ("{prefix}"), có thể có tối đa 6 ký tự bất kỳ phía trước').replace('{prefix}', selectedFolder.default_prefix) });
      return;
    }
    try {
      await db.createFolderTemplateSlot({ templateFolderId: selectedFolder.template_folder_id, prefix: newPrefix.trim() });
      setNewPrefix('');
      await loadSlots(selectedFolder.template_folder_id);
    } catch (err) {
      const Swal = await getSwal();
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    }
  };

  const handleDeletePrefix = async (slotId) => {
    try {
      await db.deleteFolderTemplateSlot(slotId);
      await loadSlots(selectedFolder.template_folder_id);
    } catch (err) {
      const Swal = await getSwal();
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    }
  };

  const handleEditPrefix = async (slot) => {
    const Swal = await getSwal();
    const { value: prefix } = await Swal.fire({
      title: t('documents.editPrefixTitle', 'Sửa tiền tố'),
      input: 'text',
      inputValue: slot.prefix,
      showCancelButton: true,
      confirmButtonText: t('common.save', 'Lưu thay đổi'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--primary-color)',
      inputValidator: (value) => {
        if (!value || !value.trim()) return t('documents.slotPrefixRequired', 'Vui lòng nhập tiền tố tên tệp');
        if (selectedFolder?.default_prefix && !matchesRequiredPrefix(value.trim(), selectedFolder.default_prefix)) {
          return t('documents.slotPrefixMustMatchFolder', 'Tiền tố hàng phải chứa tiền tố mặc định của thư mục ("{prefix}"), có thể có tối đa 6 ký tự bất kỳ phía trước').replace('{prefix}', selectedFolder.default_prefix);
        }
        return undefined;
      }
    });
    if (!prefix || prefix.trim() === slot.prefix) return;
    try {
      await db.updateFolderTemplateSlot(slot.id, prefix.trim());
      await loadSlots(selectedFolder.template_folder_id);
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    }
  };

  const renderNode = (folder, depth = 0) => {
    const children = getChildren(folder.template_folder_id);
    const isSelected = selectedFolderId === folder.template_folder_id;
    return (
      <div key={folder.template_folder_id} style={{ marginLeft: depth > 0 ? '16px' : '0px' }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
            padding: '6px 8px', borderRadius: '4px', cursor: 'pointer',
            backgroundColor: isSelected ? 'var(--primary-color)' : 'transparent',
            color: isSelected ? '#fff' : 'var(--neutral-dark)'
          }}
          onClick={() => setSelectedFolderId(folder.template_folder_id)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setFolderContextMenu({ x: e.clientX, y: e.clientY, folder });
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <i className={folder.folder_type === 'file_slot_table' ? 'fa-solid fa-table-list' : 'fa-solid fa-folder'}></i>
            {folder.name}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
            <button
              type="button"
              title={t('documents.newSubfolder', 'Thư mục con mới')}
              onClick={(e) => { e.stopPropagation(); handleAddFolder(folder.template_folder_id); }}
              style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.8, padding: '4px' }}
            >
              <i className="fa-solid fa-plus"></i>
            </button>
            <button
              type="button"
              title={t('documents.renameFolderAction', 'Đổi tên thư mục')}
              onClick={(e) => { e.stopPropagation(); handleRenameFolder(folder); }}
              style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.8, padding: '4px' }}
            >
              <i className="fa-solid fa-pen"></i>
            </button>
            <button
              type="button"
              title={t('documents.deleteFolderAction', 'Xóa thư mục')}
              onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}
              style={{ border: 'none', background: 'none', color: isSelected ? '#fff' : 'var(--danger-color)', cursor: 'pointer', opacity: 0.9, padding: '4px' }}
            >
              <i className="fa-solid fa-trash-can"></i>
            </button>
          </span>
        </div>
        {children.length > 0 && (
          <div>{children.map(child => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <ModalWrapperLg isOpen={isOpen} onClose={onClose} style={{ width: '75vw', maxWidth: '1600px', height: '85vh', maxHeight: '85vh' }}>
      <div className="modal-content">
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--neutral-dark)' }}>
            {t('projects.designFolderTemplate', 'Thiết kế cây thư mục mặc định')}
          </h3>
          <button className="btn-close-modal" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="modal-body modal-body-split">
          <div className="modal-split-left" style={{ minWidth: '260px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{ fontSize: '13px', color: 'var(--neutral-muted)' }}>{t('documents.folders', 'Thư mục')}</strong>
              <button
                type="button"
                title={t('documents.newFolder', 'Thư mục mới')}
                onClick={() => handleAddFolder(null)}
                style={{ border: 'none', borderRadius: '4px', width: '26px', height: '26px', backgroundColor: 'var(--primary-color)', color: '#fff', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-folder-plus"></i>
              </button>
            </div>
            {rootFolders.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--neutral-muted)' }}>{t('documents.noFoldersYet', 'Chưa có thư mục nào')}</div>
            ) : rootFolders.map(f => renderNode(f, 0))}
          </div>
          <div className="modal-split-right">
            {!selectedFolder ? (
              <div style={{ color: 'var(--neutral-muted)', fontSize: '13.5px', padding: '20px 0' }}>
                {t('documents.selectFolderToConfigure', 'Chọn một thư mục bên trái để cấu hình.')}
              </div>
            ) : (
              <div>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--neutral-dark)' }}>{selectedFolder.name}</h4>

                <div style={{ marginBottom: '20px' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--neutral-muted)', display: 'block', marginBottom: '8px' }}>
                    {t('documents.folderAllowedExtensionsLabel', 'Đuôi file được phép tải lên thư mục này')}
                  </strong>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={allowedExtensionsInput}
                      onChange={(e) => setAllowedExtensionsInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveAllowedExtensions(); } }}
                      placeholder={t('documents.folderAllowedExtensionsPlaceholder', 'Ví dụ: pdf;xlsx;pptx (để trống nếu không giới hạn)')}
                      autoComplete="off"
                      style={{ flex: 1, padding: '8px 10px', borderRadius: '4px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)', color: 'var(--neutral-dark)', fontSize: '13.5px' }}
                    />
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveAllowedExtensions}>
                      {t('common.save', 'Lưu')}
                    </button>
                  </div>
                  {selectedFolder.allowed_extensions && (
                    <p style={{ fontSize: '12px', color: 'var(--neutral-muted)', marginTop: '6px' }}>
                      {t('documents.folderAllowedExtensionsHint', 'Chỉ những file có đuôi nằm trong danh sách này mới được tải lên thư mục này.')}
                    </p>
                  )}
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--neutral-muted)', display: 'block', marginBottom: '8px' }}>
                    {t('documents.folderDefaultPrefixLabel', 'Tiền tố mặc định cho file tải lên thư mục này')}
                  </strong>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={defaultPrefixInput}
                      onChange={(e) => setDefaultPrefixInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveDefaultPrefix(); } }}
                      placeholder={t('documents.folderDefaultPrefixPlaceholder', 'Ví dụ: [CONCEPT] (để trống nếu không giới hạn)')}
                      autoComplete="off"
                      style={{ flex: 1, padding: '8px 10px', borderRadius: '4px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)', color: 'var(--neutral-dark)', fontSize: '13.5px' }}
                    />
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveDefaultPrefix}>
                      {t('common.save', 'Lưu')}
                    </button>
                  </div>
                  {selectedFolder.default_prefix && (
                    <p style={{ fontSize: '12px', color: 'var(--neutral-muted)', marginTop: '6px' }}>
                      {t('documents.folderDefaultPrefixHint', 'Chỉ những file có tên chứa tiền tố này (có thể có tối đa 6 ký tự bất kỳ phía trước, ví dụ số thứ tự) mới được tải lên thư mục này.')}
                    </p>
                  )}
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: 'var(--neutral-dark)', cursor: 'pointer', marginBottom: '16px' }}>
                  <input
                    type="checkbox"
                    checked={selectedFolder.folder_type === 'file_slot_table'}
                    onChange={(e) => handleToggleSlotType(e.target.checked)}
                  />
                  {t('documents.slotTableToggle', 'Bảng quản lý file cố định (yêu cầu đúng tiền tố tên tệp)')}
                </label>
                {selectedFolder.folder_type === 'file_slot_table' && (
                  <div>
                    <strong style={{ fontSize: '13px', color: 'var(--neutral-muted)' }}>{t('documents.slotPrefixListLabel', 'Danh sách tiền tố bắt buộc')}</strong>
                    <div style={{ marginTop: '8px', marginBottom: '12px' }}>
                      {slots.length === 0 ? (
                        <div style={{ fontSize: '13px', color: 'var(--neutral-muted)' }}>{t('documents.noPrefixesYet', 'Chưa có tiền tố nào.')}</div>
                      ) : slots.map((slot, idx) => (
                        <div key={slot.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid var(--neutral-border)', fontSize: '13.5px' }}>
                          <span>{idx + 1}. {slot.prefix}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button type="button" onClick={() => handleEditPrefix(slot)} style={{ border: 'none', background: 'none', color: 'var(--neutral-dark)', cursor: 'pointer' }} title={t('common.edit', 'Sửa')}>
                              <i className="fa-solid fa-pen"></i>
                            </button>
                            <button type="button" onClick={() => handleDeletePrefix(slot.id)} style={{ border: 'none', background: 'none', color: 'var(--danger-color)', cursor: 'pointer' }} title={t('common.delete', 'Xóa')}>
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={newPrefix}
                        onChange={(e) => setNewPrefix(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPrefix(); } }}
                        placeholder={t('documents.slotPrefixPlaceholder', 'Ví dụ: 5.[Test Report]')}
                        autoComplete="off"
                        style={{ flex: 1, padding: '8px 10px', borderRadius: '4px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)', color: 'var(--neutral-dark)', fontSize: '13.5px' }}
                      />
                      <button type="button" className="btn btn-primary btn-sm" onClick={handleAddPrefix}>
                        {t('documents.addPrefixBtn', 'Thêm tiền tố')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {folderContextMenu && (
        <div
          style={{
            position: 'fixed',
            top: folderContextMenu.y,
            left: folderContextMenu.x,
            zIndex: 1100,
            backgroundColor: 'var(--neutral-bg-card)',
            border: '1px solid var(--neutral-border)',
            borderRadius: '6px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15)',
            minWidth: '160px',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={() => { handleRenameFolder(folderContextMenu.folder); setFolderContextMenu(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 14px', border: 'none', background: 'none', color: 'var(--neutral-dark)', fontSize: '13.5px', cursor: 'pointer', textAlign: 'left' }}
          >
            <i className="fa-solid fa-pen" style={{ width: '14px' }}></i> {t('documents.renameFolderAction', 'Đổi tên thư mục')}
          </button>
          <button
            type="button"
            onClick={() => { handleDeleteFolder(folderContextMenu.folder); setFolderContextMenu(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 14px', border: 'none', background: 'none', color: 'var(--danger-color)', fontSize: '13.5px', cursor: 'pointer', textAlign: 'left' }}
          >
            <i className="fa-solid fa-trash-can" style={{ width: '14px' }}></i> {t('documents.deleteFolderAction', 'Xóa thư mục')}
          </button>
        </div>
      )}
    </ModalWrapperLg>
  );
};


