"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { db } from '@/utils/db';
import Link from 'next/link';
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

const isDescendant = (childId, parentId, depts) => {
  if (!childId || !parentId) return false;
  let curr = depts.find(d => d.department_id === childId);
  while (curr && curr.parent_id) {
    if (curr.parent_id === parentId) return true;
    curr = depts.find(d => d.department_id === curr.parent_id);
  }
  return false;
};

export default function HRManagement() {
  const { currentUser, users, projects, tasks, reloadAll, hasPermission } = useApp();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('users');
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  
  // Create account states
  const [isOpen, setIsOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState('');

  // User list filtering, search & pagination states
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');
  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const isTeamLeader = currentUser?.system_role === 'Team Leader';
  const isAdmin = currentUser?.system_role?.includes("Admin");
  const isHR = currentUser?.system_role?.includes("Nhân sự");

  const currentUserDept = departments.find(d => d.department_id === currentUser?.department_id);
  const isCurrentUserInRootDept = currentUserDept && !currentUserDept.parent_id;

  // Department CRUD states
  const [isDeptOpen, setIsDeptOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState(null);
  const [inputDeptId, setInputDeptId] = useState('');
  const [inputDeptName, setInputDeptName] = useState('');
  const [inputDeptParentId, setInputDeptParentId] = useState('');
  const [deptErrorMsg, setDeptErrorMsg] = useState('');
  const [deptSuccessMsg, setDeptSuccessMsg] = useState('');
  const [deptLoading, setDeptLoading] = useState(false);

  const [selectedDeptId, setSelectedDeptId] = useState(null);

  // Add member modal states
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [addMemberDeptFilter, setAddMemberDeptFilter] = useState('all');
  const [addMemberSelectedIds, setAddMemberSelectedIds] = useState(new Set());
  const [addMemberLoading, setAddMemberLoading] = useState(false);

  // Collapse/expand state for departments tree
  const [collapsedDepts, setCollapsedDepts] = useState(new Set());
  const toggleDeptCollapsed = (deptId) => {
    setCollapsedDepts(prev => {
      const next = new Set(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
      } else {
        next.add(deptId);
      }
      return next;
    });
  };

  // Auto switch activeTab to departments for users without core view permissions
  useEffect(() => {
    if (currentUser) {
      const isPowerUser = hasPermission('view_hr_members') || hasPermission('manage_role_permissions');
      if (!isPowerUser) {
        setActiveTab('departments');
      }
    }
  }, [currentUser]);

  // Set default selectedDeptId in tree view
  useEffect(() => {
    if (departments.length > 0 && !selectedDeptId) {
      if ((isTeamLeader || isCurrentUserInRootDept) && currentUser.department_id) {
        setSelectedDeptId(currentUser.department_id);
      } else {
        const rootDept = departments.find(d => !d.parent_id || !departments.some(p => p.department_id === d.parent_id));
        if (rootDept) {
          setSelectedDeptId(rootDept.department_id);
        } else {
          setSelectedDeptId(departments[0].department_id);
        }
      }
    }
  }, [departments, currentUser]);

  const handleOpenDeptModal = (dept = null, parentId = null) => {
    setSelectedDept(dept);
    if (dept) {
      setInputDeptId(dept.department_id);
      setInputDeptName(dept.name);
      setInputDeptParentId(dept.parent_id || '');
    } else {
      setInputDeptId('');
      setInputDeptName('');
      if (parentId) {
        setInputDeptParentId(parentId);
      } else if (isTeamLeader && currentUser.department_id) {
        setInputDeptParentId(currentUser.department_id);
      } else {
        setInputDeptParentId('');
      }
    }
    setDeptErrorMsg('');
    setDeptSuccessMsg('');
    setIsDeptOpen(true);
  };

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('all');

  // Permission states
  const [localRoles, setLocalRoles] = useState([]);
  const [localPermissions, setLocalPermissions] = useState([]);
  const [localRolePermissions, setLocalRolePermissions] = useState({});
  const [newRoleName, setNewRoleName] = useState('');
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [selectedModuleFilter, setSelectedModuleFilter] = useState('all');

  // Role checks declared at the top of HRManagement

  const loadSelectOptions = async () => {
    try {
      const list = await db.getRoles();
      setRoles(list);
      if (list.length > 0 && !roleId) {
        setRoleId(list[0].id);
      }

      const depts = await db.getDepartments();
      setDepartments(depts);
      if (depts.length > 0 && !departmentId) {
        setDepartmentId(depts[0].department_id);
      }
    } catch (err) {
      console.error("Failed to load select options:", err);
    }
  };

  useEffect(() => {
    loadSelectOptions();
  }, [activeTab]);

  useEffect(() => {
    const loadPermissionsData = async () => {
      if (!isAdmin) return;
      try {
        const rp = await db.getRolesPermissions();
        setLocalRoles(rp.roles || []);
        setLocalPermissions(rp.permissions || []);
        setLocalRolePermissions(rp.role_permissions || {});
      } catch (err) {
        console.error("Failed to load permissions data:", err);
      }
    };
    loadPermissionsData();
  }, [activeTab, isOpen]);

  useEffect(() => {
    setUserCurrentPage(1);
  }, [userSearchQuery, selectedDeptFilter]);

  // Enforce access control: only Admin, HR, Team Leader, user with view_hr permission or Root Dept Member can see this
  const canAccessHR = isAdmin || isHR || isTeamLeader || hasPermission('view_hr') || isCurrentUserInRootDept;
  if (!canAccessHR) {
    return (
      <div className="scrollable-view" style={{ textAlign: 'center', padding: '40px' }}>
        <div className="card" style={{ maxWidth: '500px', margin: '40px auto', padding: '32px' }}>
          <i className="fa-solid fa-lock" style={{ fontSize: '48px', color: 'var(--danger-color)', marginBottom: '16px' }}></i>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Không có quyền truy cập</h2>
          <p className="text-muted" style={{ fontSize: '13px' }}>Chỉ bộ phận Nhân sự (HR), Admin, Team Leader, hoặc các tài khoản Ban điều hành mới có quyền quản lý cấu trúc.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeId || !fullName || !email || !password || !roleId || !departmentId) {
      setErrorMsg('Vui lòng điền đầy đủ thông tin bắt buộc, bao gồm cả mã nhân viên và phòng ban.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await db.createUser(email, password, fullName, roleId, departmentId, employeeId);
      setSuccessMsg('Đã cấp tài khoản thành công cho nhân viên mới!');
      
      // Log activity
      await db.logActivity(
        currentUser.id, 
        "CREATE", 
        "User", 
        email, 
        `đã cấp tài khoản mới cho nhân viên '${fullName}' (${email})`
      );

      // Reset form
      setEmployeeId('');
      setFullName('');
      setEmail('');
      setPassword('');
      setDepartmentId(departments.length > 0 ? departments[0].department_id : '');
      setIsOpen(false);
      
      await reloadAll();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Lỗi cấp tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeptSubmit = async (e) => {
    e.preventDefault();
    if (!inputDeptId.trim() || !inputDeptName.trim()) {
      setDeptErrorMsg('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }

    setDeptErrorMsg('');
    setDeptSuccessMsg('');
    setDeptLoading(true);

    try {
      const payload = {
        name: inputDeptName.trim(),
        department_id: inputDeptId.trim(),
        parent_id: inputDeptParentId || null
      };
      if (selectedDept) {
        payload.id = selectedDept.id;
      }

      await db.saveDepartment(payload);
      setDeptSuccessMsg(selectedDept ? 'Cập nhật phòng ban thành công!' : 'Thêm phòng ban mới thành công!');

      // Log activity
      await db.logActivity(
        currentUser.id, 
        selectedDept ? "UPDATE" : "CREATE", 
        "Department", 
        inputDeptId.trim(), 
        `đã ${selectedDept ? 'cập nhật' : 'tạo'} phòng ban '${inputDeptName.trim()}' (${inputDeptId.trim()})`
      );

      // Close modal & reload
      setTimeout(async () => {
        setIsDeptOpen(false);
        await reloadAll();
        await loadSelectOptions();
      }, 800);
    } catch (err) {
      console.error(err);
      setDeptErrorMsg(err.message || 'Lỗi lưu thông tin phòng ban.');
    } finally {
      setDeptLoading(false);
    }
  };

  const handleDeleteDept = async (dept) => {
    // Show SweetAlert confirmation
    const result = await Swal.fire({
      title: t('team.confirmDeleteDeptTitle', 'Xác nhận xóa?'),
      text: t('team.confirmDeleteDeptText', 'Bạn có chắc chắn muốn xóa phòng ban "{name}"? Tất cả nhân viên trực thuộc phòng này sẽ được chuyển thành "Chưa phân phòng".').replace('{name}', dept.name),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: t('team.confirmDeleteUserBtn', 'Đồng ý xóa'),
      cancelButtonText: t('common.cancel', 'Hủy')
    });

    if (result.isConfirmed) {
      try {
        await db.deleteDepartment(dept.id);
        
        // Log activity
        await db.logActivity(
          currentUser.id, 
          "DELETE", 
          "Department", 
          dept.department_id, 
          `đã xóa phòng ban '${dept.name}' (${dept.department_id})`
        );

        await reloadAll();
        await loadSelectOptions();

        Swal.fire(
          t('common.deleted', 'Đã xóa!'),
          t('team.deleteDeptSuccess', 'Phòng ban "{name}" đã được xóa thành công.').replace('{name}', dept.name),
          'success'
        );
      } catch (err) {
        console.error(err);
        Swal.fire(
          t('common.error', 'Lỗi!'),
          err.message || t('team.deleteDeptFailed', 'Không thể xóa phòng ban này.'),
          'error'
        );
      }
    }
  };

  const handleResetUserPassword = async (userObj) => {
    const Swal = await getSwal();
    const result = await Swal.fire({
      title: t('team.resetPasswordTitle', 'Đặt lại mật khẩu cho {name}').replace('{name}', userObj.name),
      input: 'password',
      inputLabel: t('team.enterNewPassword', 'Nhập mật khẩu mới'),
      inputPlaceholder: t('team.enterNewPasswordPlaceholder', 'Nhập mật khẩu mới cho nhân viên này...'),
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off'
      },
      showCancelButton: true,
      confirmButtonText: t('team.resetBtn', 'Đặt lại'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--primary-color)',
      inputValidator: (value) => {
        if (!value) {
          return t('team.passwordRequired', 'Bạn cần nhập mật khẩu!');
        }
        if (value.length < 6) {
          return t('team.passwordTooShort', 'Mật khẩu phải dài từ 6 ký tự trở lên!');
        }
      }
    });

    if (result.isConfirmed) {
      const newPassword = result.value;
      try {
        Swal.fire({
          title: t('common.processing', 'Đang thực hiện...'),
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });
        await db.resetUserPassword(userObj.id, newPassword);
        
        await db.logActivity(
          currentUser.id, 
          "RESET_PASSWORD", 
          "User", 
          userObj.id, 
          `đã đặt lại mật khẩu cho nhân viên '${userObj.name}' (${userObj.email})`
        );

        Swal.fire({
          icon: 'success',
          title: t('common.success', 'Thành công'),
          text: t('team.resetPasswordSuccess', 'Đã đặt lại mật khẩu cho nhân viên {name} thành công!').replace('{name}', userObj.name),
          confirmButtonColor: 'var(--primary-color)'
        });
      } catch (err) {
        console.error(err);
        Swal.fire({
          icon: 'error',
          title: t('common.failed', 'Thất bại'),
          text: err.message || t('team.resetPasswordFailed', 'Không thể đặt lại mật khẩu.'),
          confirmButtonColor: 'var(--primary-color)'
        });
      }
    }
  };

  const handleDeleteUser = async (userObj) => {
    const result = await Swal.fire({
      title: t('team.confirmDeleteUserTitle', 'Xác nhận xóa tài khoản?'),
      text: t('team.confirmDeleteUserText', 'Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản của nhân viên "{name}" ({email})? Hành động này không thể hoàn tác.').replace('{name}', userObj.name).replace('{email}', userObj.email),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: t('team.confirmDeleteUserBtn', 'Đồng ý xóa'),
      cancelButtonText: t('common.cancel', 'Hủy')
    });

    if (result.isConfirmed) {
      try {
        await db.deleteUser(userObj.id);
        
        await db.logActivity(
          currentUser.id, 
          "DELETE", 
          "User", 
          userObj.id, 
          `đã xóa tài khoản nhân viên '${userObj.name}' (${userObj.email})`
        );

        await reloadAll();

        Swal.fire(
          t('common.deleted', 'Đã xóa!'),
          t('team.deleteUserSuccess', 'Tài khoản của nhân viên "{name}" đã được xóa thành công.').replace('{name}', userObj.name),
          'success'
        );
      } catch (err) {
        console.error(err);
        Swal.fire(
          t('common.error', 'Lỗi!'),
          err.message || t('team.deleteUserFailed', 'Không thể xóa tài khoản này.'),
          'error'
        );
      }
    }
  };

  // Tra cứu dữ liệu (Search Logic)
  const getSearchResults = () => {
    if (!searchQuery.trim()) return { projects: [], tasks: [], users: [] };
    const queryLower = searchQuery.toLowerCase();

    const matchedProjects = projects.filter(p => 
      p.name.toLowerCase().includes(queryLower) || 
      (p.description && p.description.toLowerCase().includes(queryLower))
    );

    const matchedTasks = tasks.filter(t => 
      t.title.toLowerCase().includes(queryLower) || 
      (t.description && t.description.toLowerCase().includes(queryLower))
    );

    const matchedUsers = users.filter(u => 
      u.name.toLowerCase().includes(queryLower) || 
      u.email.toLowerCase().includes(queryLower) ||
      u.system_role.toLowerCase().includes(queryLower)
    );

    return {
      projects: searchScope === 'all' || searchScope === 'projects' ? matchedProjects : [],
      tasks: searchScope === 'all' || searchScope === 'tasks' ? matchedTasks : [],
      users: searchScope === 'all' || searchScope === 'users' ? matchedUsers : []
    };
  };

  const getFilteredUsersList = () => {
    let list = [...users];

    if (userSearchQuery.trim()) {
      const query = userSearchQuery.toLowerCase().trim();
      list = list.filter(u => 
        u.name.toLowerCase().includes(query) || 
        (u.id && u.id.toLowerCase().includes(query))
      );
    }

    if (selectedDeptFilter !== 'all') {
      list = list.filter(u => u.department_id === selectedDeptFilter);
    }

    return list;
  };

  // Get children of a department
  const getDeptChildren = (deptId) => {
    return departments.filter(d => d.parent_id === deptId);
  };

  // Render a node in the treeview
  const renderDeptNode = (dept, depth = 0) => {
    const children = getDeptChildren(dept.department_id);
    const isSelected = selectedDeptId === dept.department_id;
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedDepts.has(dept.department_id);
    
    return (
      <div key={dept.department_id} style={{ marginLeft: depth > 0 ? '16px' : '0px' }}>
        <div 
          onClick={() => {
            setSelectedDeptId(dept.department_id);
            if (hasChildren) {
              toggleDeptCollapsed(dept.department_id);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            backgroundColor: isSelected ? 'rgba(30, 64, 175, 0.08)' : 'transparent',
            borderLeft: isSelected ? '3px solid #1E40AF' : '3px solid transparent',
            color: isSelected ? '#1e40af' : 'var(--neutral-dark)',
            fontWeight: isSelected ? '600' : '500',
            fontSize: '13px',
            marginBottom: '4px',
            transition: 'all 0.2s',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {hasChildren && (
              <i 
                className={isCollapsed ? "fa-solid fa-chevron-right" : "fa-solid fa-chevron-down"} 
                style={{ marginRight: '6px', fontSize: '10px', color: 'var(--neutral-muted)', width: '12px' }}
              ></i>
            )}
            <i className={hasChildren ? (isCollapsed ? "fa-solid fa-folder" : "fa-solid fa-folder-open") : "fa-solid fa-folder"} 
               style={{ 
                 marginRight: '8px', 
                 color: isSelected ? '#1e40af' : 'var(--neutral-muted)',
                 fontSize: '14px' 
               }}
            ></i>
            <span>{translateDepartmentName(dept.name, t)} <small className="text-muted" style={{ fontSize: '11px', marginLeft: '4px' }}>({dept.department_id})</small></span>
          </div>
          {children.length > 0 && (
            <span className="badge badge-secondary" style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '10px' }}>
              {children.length}
            </span>
          )}
        </div>
        {hasChildren && !isCollapsed && (
          <div style={{ borderLeft: '1px dashed var(--neutral-border)', marginLeft: '9px', paddingLeft: '8px', marginTop: '2px', marginBottom: '4px' }}>
            {children.map(child => renderDeptNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const handleEditMember = async (memberObj) => {
    const Swal = await getSwal();
    
    // Filter available departments to transfer to
    // If Admin/HR: show all departments
    // If Team Leader: show only their own team and parts inside their team
    const availableDepts = (isTeamLeader || isCurrentUserInRootDept)
      ? departments.filter(d => d.department_id === currentUser.department_id || isDescendant(d.department_id, currentUser.department_id, departments))
      : departments;

    // Filter available roles
    // If Admin/HR: show all roles
    // If Team Leader: show only Staff and Part Leader
    const availableRoles = isTeamLeader
      ? [
          { id: 'Nhân viên (Staff)', name: 'Nhân viên (Staff)' },
          { id: 'Part Leader', name: 'Part Leader' }
        ]
      : roles.map(r => ({ id: r.name, name: r.name }));

    const deptOptionsHtml = availableDepts.map(d => 
      `<option value="${d.department_id}" ${d.department_id === memberObj.department_id ? 'selected' : ''}>${translateDepartmentName(d.name, t)} (${d.department_id})</option>`
    ).join('\n');

    const roleOptionsHtml = availableRoles.map(r => 
      `<option value="${r.id}" ${r.id === memberObj.system_role ? 'selected' : ''}>${r.name}</option>`
    ).join('\n');

    const canEditEmployeeId = isAdmin || isHR;

    const { value: formValues } = await Swal.fire({
      title: t('team.editEmployeeInfo', 'Thay đổi thông tin nhân viên'),
      html: `
        <div style="text-align: left; padding: 10px;">
          <div class="form-group" style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px;">${t('team.employeeId', 'Mã nhân viên')} <span style="color: red;">*</span></label>
            <input type="text" id="edit-employee-id" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box; font-size: 14px; ${!canEditEmployeeId ? 'background-color: #f1f5f9; cursor: not-allowed;' : ''}" value="${memberObj.employee_id || memberObj.id}" ${!canEditEmployeeId ? 'disabled readonly' : ''}>
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px;">${t('team.fullName', 'Họ và tên')} <span style="color: red;">*</span></label>
            <input type="text" id="edit-fullname" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box; font-size: 14px;" value="${memberObj.name}">
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px;">${t('team.email', 'Email')} <span style="color: red;">*</span></label>
            <input type="email" id="edit-email" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box; font-size: 14px;" value="${memberObj.email}">
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px;">${t('team.systemRole', 'Vai trò hệ thống')} <span style="color: red;">*</span></label>
            <select id="edit-role" class="swal2-select" style="width: 100%; margin: 0; box-sizing: border-box; font-size: 14px; padding: 8px; border-radius: 4px; border: 1px solid #ccc; height: 38px;">
              ${roleOptionsHtml}
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px;">${t('team.departmentPart', 'Phòng ban/Part')} <span style="color: red;">*</span></label>
            <select id="edit-dept" class="swal2-select" style="width: 100%; margin: 0; box-sizing: border-box; font-size: 14px; padding: 8px; border-radius: 4px; border: 1px solid #ccc; height: 38px;">
              <option value="">-- ${t('team.unassignedDept', 'Chưa phân phòng')} --</option>
              ${deptOptionsHtml}
            </select>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: t('team.saveBtn', 'Lưu lại'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--primary-color)',
      preConfirm: () => {
        const newEmployeeId = document.getElementById('edit-employee-id').value.trim();
        const fullName = document.getElementById('edit-fullname').value.trim();
        const email = document.getElementById('edit-email').value.trim();
        const role = document.getElementById('edit-role').value;
        const departmentId = document.getElementById('edit-dept').value;

        if (!newEmployeeId || !fullName || !email || !role) {
          Swal.showValidationMessage(t('team.requiredFieldsWarning', 'Vui lòng điền đầy đủ thông tin bắt buộc.'));
          return false;
        }
        return { newEmployeeId, fullName, email, role, departmentId };
      }
    });

    if (formValues) {
      try {
        Swal.fire({
          title: t('common.saving', 'Đang lưu...'),
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        await db.updateUserRoleAndDept(
          memberObj.id, 
          formValues.role, 
          formValues.departmentId, 
          formValues.fullName, 
          formValues.email,
          formValues.newEmployeeId
        );

        await db.logActivity(
          currentUser.id,
          "UPDATE",
          "User",
          memberObj.id,
          `đã cập nhật thông tin nhân viên '${formValues.fullName}' (${formValues.email})`
        );

        Swal.fire({
          icon: 'success',
          title: t('common.success', 'Thành công'),
          text: t('team.updateEmployeeSuccess', 'Cập nhật thông tin nhân viên thành công!'),
          confirmButtonColor: 'var(--primary-color)'
        });

        await reloadAll();
      } catch (err) {
        console.error(err);
        Swal.fire({
          icon: 'error',
          title: t('common.error', 'Lỗi'),
          text: err.message || t('team.updateEmployeeFailed', 'Không thể lưu thông tin nhân viên.'),
          confirmButtonColor: 'var(--primary-color)'
        });
      }
    }
  };

  const handleTogglePartLeader = async (userObj, promote) => {
    const targetRole = promote ? 'Part Leader' : 'Nhân viên (Staff)';
    const actionText = promote ? t('team.promoteAction', 'chỉ định làm Part Leader') : t('team.demoteAction', 'thu hồi quyền Part Leader');
    const result = await Swal.fire({
      title: promote ? t('team.promotePartLeaderTitle', 'Chỉ định Part Leader?') : t('team.demotePartLeaderTitle', 'Thu hồi quyền Part Leader?'),
      text: t('team.togglePartLeaderText', 'Bạn có chắc chắn muốn {action} cho nhân viên "{name}"?').replace('{action}', actionText).replace('{name}', userObj.name),
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: 'var(--primary-color)',
      cancelButtonColor: '#3085d6',
      confirmButtonText: t('common.confirm', 'Đồng ý'),
      cancelButtonText: 'Hủy'
    });

    if (result.isConfirmed) {
      try {
        Swal.fire({
          title: t('common.processing', 'Đang thực hiện...'),
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });
        
        await db.updateUserRoleAndDept(userObj.id, targetRole, userObj.department_id);
        
        await db.logActivity(
          currentUser.id,
          "UPDATE",
          "User",
          userObj.id,
          `đã ${actionText} cho nhân viên '${userObj.name}' (${userObj.email})`
        );

        Swal.fire({
          icon: 'success',
          title: t('common.success', 'Thành công'),
          text: t('team.togglePartLeaderSuccess', 'Đã {action} thành công!').replace('{action}', actionText),
          confirmButtonColor: 'var(--primary-color)'
        });
        
        await reloadAll();
      } catch (err) {
        console.error(err);
        Swal.fire({
          icon: 'error',
          title: t('common.error', 'Lỗi'),
          text: err.message || t('team.togglePartLeaderFailed', 'Không thể cập nhật phân quyền.'),
          confirmButtonColor: 'var(--primary-color)'
        });
      }
    }
  };

  const handleAddDeptMember = (currentSelectedDept) => {
    setAddMemberSearch('');
    setAddMemberDeptFilter('all');
    setAddMemberSelectedIds(new Set());
    setIsAddMemberOpen(true);
  };

  const handleConfirmAddMembers = async () => {
    const currentSelectedDept = departments.find(d => d.department_id === selectedDeptId);
    if (!currentSelectedDept || addMemberSelectedIds.size === 0) return;

    setAddMemberLoading(true);
    const Swal = await getSwal();

    try {
      const selectedIdsArray = Array.from(addMemberSelectedIds);
      const promises = selectedIdsArray.map(async (uId) => {
        const targetUser = users.find(u => u.id === uId);
        if (!targetUser) return;

        await db.updateUserRoleAndDept(
          targetUser.id,
          targetUser.system_role || 'Nhân viên (Staff)',
          currentSelectedDept.department_id,
          targetUser.name,
          targetUser.email
        );

        await db.logActivity(
          currentUser.id,
          "UPDATE",
          "User",
          targetUser.id,
          `đã thêm nhân viên '${targetUser.name}' vào phòng ban/part '${translateDepartmentName(currentSelectedDept.name, t)}' (${currentSelectedDept.department_id})`
        );
      });

      await Promise.all(promises);

      Swal.fire({
        icon: 'success',
        title: t('common.success', 'Thành công'),
        text: t('team.addUsersSuccess', 'Đã thêm {count} nhân viên vào phòng ban thành công!').replace('{count}', selectedIdsArray.length),
        confirmButtonColor: 'var(--primary-color)'
      });

      setIsAddMemberOpen(false);
      await reloadAll();
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: t('common.failed', 'Thất bại'),
        text: t('team.addUsersFailed', 'Lỗi thêm thành viên: ') + (err.message || err),
        confirmButtonColor: 'var(--primary-color)'
      });
    } finally {
      setAddMemberLoading(false);
    }
  };

  const getAddMemberEligibleUsers = () => {
    const currentSelectedDept = departments.find(d => d.department_id === selectedDeptId);
    if (!currentSelectedDept) return [];

    return users.filter(u => {
      if (u.department_id === currentSelectedDept.department_id) return false;

      if (addMemberDeptFilter !== 'all' && u.department_id !== addMemberDeptFilter) return false;

      if (addMemberSearch.trim()) {
        const query = addMemberSearch.toLowerCase();
        const nameMatch = u.name?.toLowerCase().includes(query);
        const emailMatch = u.email?.toLowerCase().includes(query);
        const codeMatch = u.employee_id?.toLowerCase().includes(query);
        if (!nameMatch && !emailMatch && !codeMatch) return false;
      }

      return true;
    });
  };

  const handleToggleAddMemberCheckbox = (userId) => {
    setAddMemberSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleToggleAddMemberSelectAll = (eligibleUsersList) => {
    setAddMemberSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = eligibleUsersList.length > 0 && eligibleUsersList.every(u => next.has(u.id));
      if (allSelected) {
        eligibleUsersList.forEach(u => next.delete(u.id));
      } else {
        eligibleUsersList.forEach(u => next.add(u.id));
      }
      return next;
    });
  };

  const filteredUsers = getFilteredUsersList();
  const itemsPerPage = 20;
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const startIndex = (userCurrentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  const results = getSearchResults();
  const totalResults = results.projects.length + results.tasks.length + results.users.length;

  return (
    <div className="scrollable-view">
      <div className="view-header" style={{ marginBottom: '12px' }}>
        <div className="view-title-group">
          <h2>{t('team.title', 'Quản trị Hệ thống & Nhân sự')}</h2>
          <p>{t('team.subtitle', 'Cấp tài khoản mới, tra cứu thông tin dữ liệu chéo và quản trị ma trận phân quyền hệ thống.')}</p>
        </div>
        <div className="view-actions">
          {activeTab === 'users' && hasPermission('create_employee_account') && (
            <button className="btn btn-primary" onClick={() => { setIsOpen(true); setErrorMsg(''); setSuccessMsg(''); }}>
              <i className="fa-solid fa-user-plus"></i> {t('team.addUser', 'Cấp tài khoản mới')}
            </button>
          )}
          {activeTab === 'departments' && hasPermission('manage_departments') && (
            <button className="btn btn-primary" onClick={() => { handleOpenDeptModal(null); }}>
              <i className="fa-solid fa-plus"></i> {t('team.addDept', 'Thêm phòng ban mới')}
            </button>
          )}
        </div>
      </div>

      {(hasPermission('view_hr_members') || hasPermission('manage_role_permissions') || hasPermission('manage_departments') || isTeamLeader || isCurrentUserInRootDept) && (
        <div className="project-tabs" style={{ marginTop: '16px', marginBottom: '16px' }}>
          {(hasPermission('view_hr_members') || isCurrentUserInRootDept) && (
            <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
              <i className="fa-solid fa-users"></i> {t('team.staffAndAccounts', 'Nhân sự & Tài khoản')}
            </button>
          )}
          {hasPermission('manage_role_permissions') && (
            <button className={`tab-btn ${activeTab === 'permissions' ? 'active' : ''}`} onClick={() => setActiveTab('permissions')}>
              <i className="fa-solid fa-shield-halved"></i> {t('team.permissionsTable', 'Bảng Phân Quyền')}
            </button>
          )}
          {(hasPermission('manage_departments') || isTeamLeader || isCurrentUserInRootDept) && (
            <button className={`tab-btn ${activeTab === 'departments' ? 'active' : ''}`} onClick={() => setActiveTab('departments')}>
              {t('team.tabDepartments', 'Quản lý phòng ban')}
            </button>
          )}
        </div>
      )}

      {/* ================= TAB 1: USERS LIST ================= */}
      {activeTab === 'users' && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>{t('team.staffList', 'Danh sách nhân viên')} ({filteredUsers.length})</h3>
          
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <input 
                type="text" 
                placeholder={t('team.searchStaffPlaceholder', 'Tìm theo tên hoặc mã nhân viên...')} 
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  borderRadius: '6px', 
                  border: '1px solid var(--neutral-border)', 
                  fontSize: '13px',
                  outline: 'none' 
                }}
              />
            </div>
            <div style={{ width: '200px' }}>
              <select 
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  borderRadius: '6px', 
                  border: '1px solid var(--neutral-border)', 
                  fontSize: '13px',
                  outline: 'none',
                  backgroundColor: 'var(--neutral-bg-card)'
                }}
              >
                <option value="all">{t('dept.allDepts', 'Tất cả phòng ban')}</option>
                {departments.map(d => (
                  <option value={d.department_id} key={d.department_id}>{translateDepartmentName(d.name, t)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('team.fullName', 'Họ và tên')}</th>
                  <th>{t('team.employeeCode', 'Mã nhân viên')}</th>
                  <th>{t('team.email', 'Địa chỉ Email')}</th>
                  <th>{t('team.systemRole', 'Vai trò hệ thống')}</th>
                  <th>{t('team.department', 'Phòng ban')}</th>
                  <th style={{ textAlign: 'center', width: '220px' }}>{t('common.actions', 'Thao tác')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map(u => {
                  const isMemberOfMyTeam = u.department_id === currentUser.department_id || 
                    isDescendant(u.department_id, currentUser.department_id, departments);
                  const canEditUser = hasPermission('edit_employee_info') && (
                    isAdmin || isHR || (isTeamLeader && isMemberOfMyTeam) || (isCurrentUserInRootDept && isMemberOfMyTeam)
                  );

                  return (
                    <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: u.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600' }}>
                          {u.name.split(" ").pop().charAt(0)}
                        </div>
                        <span style={{ fontWeight: '500' }}>{u.name} {u.id === currentUser.id && <span className="text-muted" style={{ fontSize: '11px' }}>{t('common.you', '(Bạn)')}</span>}</span>
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: '#475569', fontSize: '13px' }}>{u.employee_id || 'N/A'}</strong>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className="badge badge-info">{formatSystemRole(u.system_role, t)}</span>
                    </td>
                    <td>
                      {translateDepartmentName(u.department_name, t)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        {canEditUser && u.id !== currentUser.id && (
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            onClick={() => handleEditMember(u)}
                          >
                            <i className="fa-solid fa-user-pen"></i> Edit
                          </button>
                        )}
                        {canEditUser && (
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            onClick={() => handleResetUserPassword(u)}
                          >
                            <i className="fa-solid fa-key"></i> Reset
                          </button>
                        )}
                        {canEditUser && u.id !== currentUser.id && (
                          <button 
                            className="btn btn-danger btn-sm" 
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            onClick={() => handleDeleteUser(u)}
                          >
                            <i className="fa-solid fa-trash-can"></i> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedUsers.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--neutral-muted)', padding: '24px' }}>
                      {t('team.noStaffFound', 'Không tìm thấy nhân viên nào phù hợp.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
              <button 
                className="btn btn-secondary btn-sm"
                disabled={userCurrentPage === 1}
                onClick={() => setUserCurrentPage(prev => Math.max(prev - 1, 1))}
                style={{ padding: '6px 12px' }}
              >
                <i className="fa-solid fa-angle-left"></i> {t('common.previous', 'Trước')}
              </button>
              
              <span style={{ fontSize: '13px', color: 'var(--neutral-muted)' }}>
                Trang <strong>{userCurrentPage}</strong> / {totalPages}
              </span>

              <button 
                className="btn btn-secondary btn-sm"
                disabled={userCurrentPage === totalPages}
                onClick={() => setUserCurrentPage(prev => Math.min(prev + 1, totalPages))}
                style={{ padding: '6px 12px' }}
              >
                {t('common.next', 'Sau')} <i className="fa-solid fa-angle-right"></i>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB: DEPARTMENTS LIST (TREEVIEW) ================= */}
      {activeTab === 'departments' && (
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          {/* Left panel: Treeview */}
          <div className="card" style={{ flex: '0 0 35%', padding: '20px', minHeight: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600' }}>{t('team.orgStructure', 'Cơ cấu tổ chức')}</h3>
              {/* {(isAdmin || isHR) && (
                <button className="btn btn-primary btn-sm" onClick={() => handleOpenDeptModal(null)}>
                  <i className="fa-solid fa-plus"></i> Thêm phòng
                </button>
              )} */}
            </div>
            <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '4px' }}>
              {(() => {
                const visibleRootDepts = (isTeamLeader || isCurrentUserInRootDept)
                  ? departments.filter(d => d.department_id === currentUser.department_id)
                  : departments.filter(d => !d.parent_id || !departments.some(p => p.department_id === d.parent_id));
                
                if (visibleRootDepts.length === 0) {
                  return <div className="text-muted" style={{ fontSize: '13px', textAlign: 'center', padding: '20px' }}>{t('team.noDepartments', 'Chưa có phòng ban nào.')}</div>;
                }
                return visibleRootDepts.map(root => renderDeptNode(root));
              })()}
            </div>
          </div>

          {/* Right panel: Details & Members */}
          <div style={{ flex: '1' }}>
            {(() => {
              const currentSelectedDept = departments.find(d => d.department_id === selectedDeptId);
              if (!currentSelectedDept) {
                return (
                  <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--neutral-muted)' }}>
                    <i className="fa-solid fa-folder-open" style={{ fontSize: '48px', marginBottom: '12px' }}></i>
                    <p style={{ fontSize: '14px', fontWeight: '500' }}>{t('team.selectDeptPrompt', 'Chọn một phòng ban/part từ sơ đồ bên trái để xem thông tin chi tiết.')}</p>
                  </div>
                );
              }

              const parentDept = departments.find(d => d.department_id === currentSelectedDept.parent_id);
              const deptMembers = users.filter(u => u.department_id === currentSelectedDept.department_id);

              const isTargetDeptAllowed = currentSelectedDept.department_id === currentUser.department_id || 
                isDescendant(currentSelectedDept.department_id, currentUser.department_id, departments);
              const isParentDeptAllowed = isDescendant(currentSelectedDept.department_id, currentUser.department_id, departments);

              const canEditDept = hasPermission('manage_departments') && (
                isAdmin || isHR || (isTeamLeader && isParentDeptAllowed) || (isCurrentUserInRootDept && isParentDeptAllowed)
              );

              const canDeleteDept = hasPermission('manage_departments') && (
                isAdmin || isHR || (isTeamLeader && isParentDeptAllowed) || (isCurrentUserInRootDept && isParentDeptAllowed)
              );

              const canAddMember = hasPermission('edit_employee_info') && (
                isAdmin || isHR || (isTeamLeader && isTargetDeptAllowed) || (isCurrentUserInRootDept && isTargetDeptAllowed)
              );

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Department Details Card */}
                  <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--neutral-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ backgroundColor: 'rgba(30, 64, 175, 0.1)', color: '#1e40af', padding: '4px 8px', borderRadius: '4px', fontSize: '13px' }}>{currentSelectedDept.department_id}</span>
                          {currentSelectedDept.name}
                        </h2>
                        <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--neutral-muted)' }}>
                          <span>{t('team.belongsToDepartment', 'Thuộc bộ phận:')} </span>
                          <strong style={{ color: '#1e40af' }}>
                            {parentDept ? `${translateDepartmentName(parentDept.name, t)} (${parentDept.department_id})` : t('team.rootDept', 'Không (Là bộ phận gốc)')}
                          </strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        {canAddMember && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleAddDeptMember(currentSelectedDept)}>
                            <i className="fa-solid fa-user-plus"></i> {t('team.addMember', 'Thêm thành viên')}
                          </button>
                        )}
                        {canEditDept && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleOpenDeptModal(currentSelectedDept)}>
                            <i className="fa-solid fa-pen-to-square"></i> {t('common.edit', 'Sửa')}
                          </button>
                        )}
                        {canDeleteDept && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteDept(currentSelectedDept)}>
                            <i className="fa-solid fa-trash-can"></i> Xóa
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Members Card */}
                  <div className="card" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>{t('team.membersOfThisPart', 'Thành viên của part này')} ({deptMembers.length})</h3>
                    <div className="data-table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>{t('team.fullName', 'Họ và tên')}</th>
                            <th>Email</th>
                            <th>{t('team.systemRole', 'Vai trò hệ thống')}</th>
                            <th style={{ textAlign: 'center', width: '200px' }}>{t('common.actions', 'Thao tác')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deptMembers.map(member => {
                            const isMemberOfMyTeam = member.department_id === currentUser.department_id || 
                              isDescendant(member.department_id, currentUser.department_id, departments);
                             const canManageMemberRole = hasPermission('edit_employee_info') && (
                               isAdmin || isHR || (isTeamLeader && isMemberOfMyTeam) || (isCurrentUserInRootDept && isMemberOfMyTeam)
                             );

                            return (
                              <tr key={member.id}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: member.color || '#1e40af', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600' }}>
                                      {member.name.split(" ").pop().charAt(0)}
                                    </div>
                                    <span style={{ fontWeight: '500' }}>{member.name} {member.id === currentUser.id && <span className="text-muted" style={{ fontSize: '11px' }}>(Bạn)</span>}</span>
                                  </div>
                                </td>
                                <td>{member.email}</td>
                                <td>
                                  <span className={`badge ${member.system_role === 'Team Leader' ? 'badge-danger' : member.system_role === 'Part Leader' ? 'badge-warning' : 'badge-info'}`}>
                                    {formatSystemRole(member.system_role, t)}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {canManageMemberRole && member.id !== currentUser.id && (
                                     <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                       {member.system_role !== 'Part Leader' && member.system_role !== 'Team Leader' && (
                                        <button 
                                          className="btn btn-secondary btn-sm"
                                          style={{ padding: '4px 8px', fontSize: '11px' }}
                                          onClick={() => handleTogglePartLeader(member, true)}
                                        >
                                          <i className="fa-solid fa-user-shield"></i> {t('team.assignPartLeader', 'Chỉ định Part Leader')}
                                        </button>
                                      )}
                                      {member.system_role === 'Part Leader' && (
                                        <button 
                                          className="btn btn-danger btn-sm"
                                          style={{ padding: '4px 8px', fontSize: '11px' }}
                                          onClick={() => handleTogglePartLeader(member, false)}
                                        >
                                          <i className="fa-solid fa-user-minus"></i> {t('team.revokePartLeader', 'Thu hồi Part Leader')}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {deptMembers.length === 0 && (
                            <tr>
                              <td colSpan="4" style={{ textAlign: 'center', color: 'var(--neutral-muted)', padding: '24px' }}>
                                {t('team.noMembersInPart', 'Không có thành viên nào trong phòng/part này.')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ================= TAB 2: SYSTEM PERMISSIONS MATRIX ================= */}
      {activeTab === 'permissions' && isAdmin && (() => {
        const modules = Array.from(new Set(localPermissions.map(p => p.module))).filter(Boolean);
        const filteredPermissions = selectedModuleFilter === 'all'
          ? localPermissions
          : localPermissions.filter(p => p.module === selectedModuleFilter);

        return (
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>{t('team.permMatrixTitle', 'Ma trận Phân quyền Chức năng')}</h3>
                <p className="text-muted" style={{ fontSize: '12.5px', margin: 0 }}>{t('team.permMatrixSubtitle', 'Cấu hình bật/tắt quyền hạn chi tiết cho từng vai trò và thêm/bỏ vai trò mới để mở rộng người dùng.')}</p>
              </div>
              
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--neutral-muted)' }}>{t('team.filterModuleLabel', 'Lọc phân hệ:')}</span>
                  <select 
                    value={selectedModuleFilter} 
                    onChange={(e) => setSelectedModuleFilter(e.target.value)} 
                    style={{ 
                      padding: '6px 12px', 
                      borderRadius: '6px', 
                      border: '1px solid var(--neutral-border)', 
                      outline: 'none', 
                      fontSize: '13px', 
                      fontWeight: '500',
                      color: 'var(--neutral-dark)',
                      backgroundColor: 'var(--neutral-bg-card)'
                    }}
                  >
                    <option value="all">{t('team.allModules', 'Tất cả phân hệ')}</option>
                    {modules.map(mod => (
                      <option key={mod} value={mod}>{translateModule(mod, t)}</option>
                    ))}
                  </select>
                </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newRoleName.trim()) return;

              const trimmed = newRoleName.trim();
              if (localRoles.some(r => r.name.toLowerCase() === trimmed.toLowerCase())) {
                Swal.fire({ icon: 'warning', title: t('common.warning', 'Cảnh báo'), text: t('team.roleExists', 'Vai trò này đã tồn tại!') });
                return;
              }

              const newId = `role-${Date.now()}`;
              const updatedRoles = [...localRoles, { id: newId, name: trimmed }];
              const updatedRolePerms = {
                ...localRolePermissions,
                [trimmed]: ["view_dashboard"]
              };

              setLocalRoles(updatedRoles);
              setLocalRolePermissions(updatedRolePerms);
              setNewRoleName('');

              try {
                await db.saveRolesPermissions(updatedRoles, updatedRolePerms);
                await db.logActivity(
                  currentUser.id, 
                  "CREATE_ROLE", 
                  "Role", 
                  newId, 
                  `đã thêm vai trò người dùng mới '${trimmed}'`
                );
                await reloadAll();
                Swal.fire({ icon: 'success', title: t('common.success', 'Thành công'), text: t('team.addRoleSuccess', "Đã thêm vai trò '{name}' thành công! Hãy cấu hình quyền hạn cho vai trò này.").replace('{name}', trimmed) });
              } catch (err) {
                Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: t('team.addRoleFailed', "Lỗi thêm vai trò: ") + err.message });
              }
            }} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder={t('team.newRolePlaceholder', 'Tên vai trò mới...')} 
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)', color: 'var(--neutral-dark)', fontSize: '13px', outline: 'none', width: '180px' }}
                required
              />
              <button type="submit" className="btn btn-secondary btn-sm" style={{ padding: '7px 12px' }}>
                <i className="fa-solid fa-plus"></i> {t('team.addRole', 'Thêm Vai Trò')}
              </button>
            </form>
          </div>
        </div>
          
          <div className="data-table-wrapper" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <table className="data-table" style={{ fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--neutral-bg-hover)', color: 'var(--neutral-dark)', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{ minWidth: '150px' }}>{t('team.moduleCol', 'Phân hệ')}</th>
                  <th style={{ minWidth: '220px' }}>{t('team.permNameCol', 'Quyền hạn / Chức năng')}</th>
                  {localRoles.map(role => (
                    <th key={role.id} style={{ textAlign: 'center', minWidth: '110px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <span>{formatSystemRole(role.name, t)}</span>
                        {!['Quản trị viên (Admin)', 'Nhân sự (HR)', 'Nhân viên (Staff)', 'Team Leader', 'Part Leader', 'Kinh doanh (Sales)', 'Ban điều hành (BOD)'].includes(role.name) && (
                          <button 
                            type="button" 
                            className="btn btn-sm text-danger" 
                            style={{ 
                              padding: '2px 6px', 
                              fontSize: '10.5px', 
                              background: '#fff1f2', 
                              border: '1px solid #ffe4e6', 
                              borderRadius: '4px',
                              cursor: 'pointer' 
                            }}
                            onClick={async () => {
                              const result = await Swal.fire({
                                title: 'Xác nhận xóa',
                                text: `Bạn có chắc chắn muốn xóa vai trò "${role.name}"? Tất cả phân quyền của vai trò này sẽ bị xóa.`,
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonColor: '#d33',
                                cancelButtonColor: '#3085d6',
                                confirmButtonText: 'Xóa',
                                cancelButtonText: 'Hủy'
                              });
                              if (result.isConfirmed) {
                                const updatedRoles = localRoles.filter(r => r.id !== role.id);
                                const updatedRolePerms = { ...localRolePermissions };
                                delete updatedRolePerms[role.name];
                                
                                setLocalRoles(updatedRoles);
                                setLocalRolePermissions(updatedRolePerms);
                                
                                try {
                                  await db.saveRolesPermissions(updatedRoles, updatedRolePerms);
                                  await db.logActivity(
                                    currentUser.id,
                                    "DELETE_ROLE",
                                    "Role",
                                    role.id,
                                    `đã xóa vai trò người dùng '${role.name}'`
                                  );
                                  await reloadAll();
                                  Swal.fire(t('common.success', 'Thành công'), t('team.deleteRoleSuccess', 'Đã xóa vai trò "{name}"!').replace('{name}', role.name), 'success');
                                } catch (err) {
                                  Swal.fire(t('common.error', 'Lỗi'), t('team.deleteRoleFailed', 'Không thể xóa vai trò: {error}').replace('{error}', err.message), 'error');
                                }
                              }
                            }}
                          >
                            <i className="fa-solid fa-trash-can"></i> Xóa
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPermissions.map(perm => (
                  <tr key={perm.key}>
                    <td style={{ fontWeight: '600', color: 'var(--neutral-dark)' }}>{translateModule(perm.module, t)}</td>
                    <td>
                      <div style={{ fontWeight: '500', color: 'var(--neutral-dark)' }}>{translatePermissionName(perm.key, perm.name, t)}</div>
                      <code style={{ fontSize: '10px', color: 'var(--neutral-muted)' }}>{perm.key}</code>
                    </td>
                    {localRoles.map(role => {
                      const isChecked = (localRolePermissions[role.name] || []).includes(perm.key);
                      const isAdminRole = role.name.includes("Admin") || role.name.includes("Owner");
                      const isDisabled = isAdminRole && (perm.key === 'view_hr' || perm.key === 'view_activity_logs');
                      
                      return (
                        <td key={role.id} style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox"
                            checked={isChecked || isAdminRole}
                            disabled={isDisabled || isAdminRole}
                            onChange={() => {
                              setLocalRolePermissions(prev => {
                                const currentPerms = prev[role.name] || [];
                                let nextPerms;
                                if (currentPerms.includes(perm.key)) {
                                  nextPerms = currentPerms.filter(k => k !== perm.key);
                                } else {
                                  nextPerms = [...currentPerms, perm.key];
                                }
                                return {
                                  ...prev,
                                  [role.name]: nextPerms
                                };
                              });
                            }}
                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button 
              className="btn btn-primary" 
              onClick={async () => {
                try {
                  setSavingPermissions(true);
                  await db.saveRolesPermissions(localRoles, localRolePermissions);
                  await db.logActivity(
                    currentUser.id, 
                    "UPDATE_PERMISSIONS", 
                    "RolePermissions", 
                    "system", 
                    `đã cập nhật ma trận phân quyền hệ thống`
                  );
                  await reloadAll();
                  Swal.fire({ icon: 'success', title: t('common.success', 'Thành công'), text: t('team.savePermissionsSuccess', 'Đã lưu cấu hình phân quyền hệ thống thành công!') });
                } catch (err) {
                  Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: t('team.savePermissionsFailed', 'Lỗi lưu phân quyền: ') + err.message });
                } finally {
                  setSavingPermissions(false);
                }
              }}
              disabled={savingPermissions}
              style={{ padding: '8px 24px' }}
            >
              {savingPermissions ? (
                <span><i className="fa-solid fa-spinner fa-spin"></i> Đang lưu...</span>
              ) : (
                <span><i className="fa-solid fa-cloud-arrow-up"></i> {t('team.savePermMatrix', 'Lưu cấu hình phân quyền')}</span>
              )}
            </button>
          </div>
        </div>
      );
    })()}

      {/* ================= TAB 3: DATA LOOKUP CENTER ================= */}
      {/* {activeTab === 'lookup' && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>Tra cứu Dữ liệu Doanh nghiệp</h3>
          <p className="text-muted" style={{ fontSize: '12.5px', marginBottom: '16px' }}>Tra cứu nhanh chéo các thông tin của Dự án, Công việc và Thành viên trong doanh nghiệp.</p>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <select 
              value={searchScope} 
              onChange={(e) => setSearchScope(e.target.value)} 
              className="doc-select-filter"
              style={{ minWidth: '120px' }}
            >
              <option value="all">Tất cả mục</option>
              <option value="projects">Dự án</option>
              <option value="tasks">Công việc</option>
              <option value="users">Thành viên</option>
            </select>
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder="Nhập từ khóa tìm kiếm (Ví dụ: tên dự án, tên task, email...)" 
              style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--neutral-border)', outline: 'none' }}
            />
          </div>

          <div className="search-results-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!searchQuery.trim() ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--neutral-muted)', fontSize: '13px' }}>
                <i className="fa-solid fa-keyboard" style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}></i>
                Nhập từ khóa để tra cứu dữ liệu thời gian thực.
              </div>
            ) : totalResults === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--neutral-muted)', fontSize: '13px' }}>
                Không tìm thấy kết quả phù hợp với từ khóa "{searchQuery}".
              </div>
            ) : (
              <>
                {results.projects.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '13.5px', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: '#1e40af' }}>
                      <i className="fa-solid fa-folder-open"></i> Dự án tìm thấy ({results.projects.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {results.projects.map(p => (
                        <Link href={`/projects/${p.id}`} key={p.id} className="card" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', hover: { backgroundColor: '#f8fafc' } }}>
                          <div>
                            <span style={{ fontWeight: '600', fontSize: '13.5px' }}>{p.name}</span>
                            <p style={{ fontSize: '12px', color: 'var(--neutral-muted)', margin: '4px 0 0' }}>{p.description || 'Không có mô tả.'}</p>
                          </div>
                          <span className="badge badge-info">{p.status}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {results.tasks.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '13.5px', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: '#d97706' }}>
                      <i className="fa-solid fa-list-check"></i> Công việc tìm thấy ({results.tasks.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {results.tasks.map(t => (
                        <div key={t.id} className="card" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontWeight: '600', fontSize: '13.5px' }}>{t.title}</span>
                            <p style={{ fontSize: '12px', color: 'var(--neutral-muted)', margin: '4px 0 0' }}>
                              {(() => {
                                try {
                                  const parsed = JSON.parse(t.description);
                                  if (parsed && typeof parsed === 'object' && 'text' in parsed) {
                                    return parsed.text || 'Không có mô tả.';
                                  }
                                } catch (e) {}
                                return t.description || 'Không có mô tả.';
                              })()}
                            </p>
                          </div>
                          <span className={`badge ${t.status === 'Done' ? 'badge-success' : 'badge-warning'}`}>{t.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.users.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '13.5px', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: '#059669' }}>
                      <i className="fa-solid fa-users"></i> Nhân viên tìm thấy ({results.users.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {results.users.map(u => (
                        <div key={u.id} className="card" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: u.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '600' }}>
                            {u.name.split(" ").pop().charAt(0)}
                          </div>
                          <div>
                            <span style={{ fontWeight: '600', fontSize: '13.5px' }}>{u.name}</span>
                            <span className="text-muted" style={{ fontSize: '12px', marginLeft: '8px' }}>{u.email}</span>
                          </div>
                          <span className="badge badge-info" style={{ marginLeft: 'auto' }}>{u.system_role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )} */}

      {/* Issuing Account Modal */}
      {isOpen && (
        <div className="modal show" style={{ display: 'flex' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h3>{t('hr.createAccountTitle', 'Cấp tài khoản nhân viên mới')}</h3>
                <button className="btn-close-modal" onClick={() => setIsOpen(false)}><i className="fa-solid fa-xmark"></i></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  {errorMsg && (
                    <div className="login-alert danger" style={{ marginBottom: '12px', padding: '10px' }}>
                      <i className="fa-solid fa-circle-exclamation"></i>
                      <span>{errorMsg}</span>
                    </div>
                  )}
                  {successMsg && (
                    <div className="login-alert success" style={{ marginBottom: '12px', padding: '10px' }}>
                      <i className="fa-solid fa-circle-check"></i>
                      <span>{successMsg}</span>
                    </div>
                  )}

                  <div className="form-group">
                    <label>{t('hr.employeeId', 'Mã nhân viên')} <span className="required">*</span></label>
                    <input type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required placeholder={t('hr.employeeIdPlaceholder', 'Ví dụ: NV001, NV002, admin...')} />
                  </div>

                  <div className="form-group">
                    <label>{t('hr.employeeFullName', 'Họ và tên nhân viên')} <span className="required">*</span></label>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder={t('hr.employeeFullNamePlaceholder', 'Ví dụ: Nguyễn Văn A')} />
                  </div>
                  
                  <div className="form-group">
                    <label>{t('hr.workEmail', 'Email công việc')} <span className="required">*</span></label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@company.com" />
                  </div>

                  <div className="form-group">
                    <label>{t('hr.initialPassword', 'Mật khẩu khởi tạo')} <span className="required">*</span></label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder={t('hr.initialPasswordPlaceholder', 'Nhập mật khẩu...')} />
                  </div>

                  <div className="form-group">
                    <label>{t('hr.systemRole', 'Vai trò chức vụ hệ thống')} <span className="required">*</span></label>
                    <select value={roleId} onChange={(e) => setRoleId(e.target.value)} style={{ padding: '8px', width: '100%', borderRadius: '4px', border: '1px solid var(--neutral-border)', outline: 'none' }} required>
                      {roles.map(r => (
                        <option value={r.id} key={r.id}>{translateSystemRoleName(r.name, t)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>{t('hr.department', 'Phòng ban trực thuộc')} <span className="required">*</span></label>
                    <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} style={{ padding: '8px', width: '100%', borderRadius: '4px', border: '1px solid var(--neutral-border)', outline: 'none' }} required>
                      <option value="">{t('hr.selectDepartment', '-- Chọn phòng ban --')}</option>
                      {departments.map(d => (
                        <option value={d.department_id} key={d.department_id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setIsOpen(false)}>{t('common.cancel', 'Hủy')}</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? t('hr.creating', 'Đang tạo...') : t('hr.issueAccountBtn', 'Cấp tài khoản')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Department Modal */}
      {isDeptOpen && (
        <div className="modal show" style={{ display: 'flex' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h3>{selectedDept ? t('team.editDept', 'Chỉnh sửa phòng ban') : t('team.addDeptModal', 'Thêm phòng ban mới')}</h3>
                <button className="btn-close-modal" onClick={() => setIsDeptOpen(false)}><i className="fa-solid fa-xmark"></i></button>
              </div>
              <form onSubmit={handleDeptSubmit}>
                <div className="modal-body">
                  {deptErrorMsg && (
                    <div className="login-alert danger" style={{ marginBottom: '12px', padding: '10px' }}>
                      <i className="fa-solid fa-circle-exclamation"></i>
                      <span>{deptErrorMsg}</span>
                    </div>
                  )}
                  {deptSuccessMsg && (
                    <div className="login-alert success" style={{ marginBottom: '12px', padding: '10px' }}>
                      <i className="fa-solid fa-circle-check"></i>
                      <span>{deptSuccessMsg}</span>
                    </div>
                  )}

                  <div className="form-group">
                    <label>{t('team.deptCode', 'Mã phòng ban')} <span className="required">*</span></label>
                    <input 
                      type="text" 
                      value={inputDeptId} 
                      onChange={(e) => setInputDeptId(e.target.value)} 
                      required 
                      placeholder="Ví dụ: Dev, HR, Sales, MKT..." 
                    />
                    {selectedDept && <small className="text-muted" style={{ display: 'block', marginTop: '4px' }}>{t('team.deptCodeDesc', 'Thay đổi mã phòng ban sẽ tự động cập nhật cho tất cả nhân viên và phòng ban trực thuộc.')}</small>}
                  </div>
                  
                  <div className="form-group">
                    <label>{t('team.parentDeptLabel', 'Phòng ban cha (nếu có)')}</label>
                    <select
                      value={inputDeptParentId}
                      onChange={(e) => setInputDeptParentId(e.target.value)}
                      style={{ padding: '8px', width: '100%', borderRadius: '4px', border: '1px solid var(--neutral-border)', outline: 'none', backgroundColor: 'var(--neutral-bg-card)' }}
                    >
                      <option value="">{t('team.rootDeptSelect', 'Không (Phòng ban gốc)')}</option>
                      {departments
                        .filter(d => d.department_id !== inputDeptId)
                        .map(d => (
                          <option value={d.department_id} key={d.department_id}>{translateDepartmentName(d.name, t)} ({d.department_id})</option>
                        ))
                      }
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>{t('team.deptNameLabel', 'Tên phòng ban')} <span className="required">*</span></label>
                    <input 
                      type="text" 
                      value={inputDeptName} 
                      onChange={(e) => setInputDeptName(e.target.value)} 
                      required 
                      placeholder="Ví dụ: Phát triển phần mềm" 
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setIsDeptOpen(false)}>{t('common.cancel', 'Hủy')}</button>
                  <button type="submit" className="btn btn-primary" disabled={deptLoading}>
                    {deptLoading ? t('common.saving', 'Đang lưu...') : t('common.save', 'Lưu lại')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddMemberOpen && (() => {
        const currentSelectedDept = departments.find(d => d.department_id === selectedDeptId);
        if (!currentSelectedDept) return null;
        
        const eligibleUsers = getAddMemberEligibleUsers();
        const allSelected = eligibleUsers.length > 0 && eligibleUsers.every(u => addMemberSelectedIds.has(u.id));
        
        return (
          <div className="modal show" style={{ display: 'flex' }}>
            <div className="modal-dialog" style={{ maxWidth: '650px', width: '100%' }}>
              <div className="modal-content">
                <div className="modal-header">
                  <h3>{t('team.addMemberTo', 'Thêm thành viên vào')} {translateDepartmentName(currentSelectedDept.name, t)}</h3>
                  <button className="btn-close-modal" onClick={() => setIsAddMemberOpen(false)}><i className="fa-solid fa-xmark"></i></button>
                </div>
                <div className="modal-body" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ flex: '1', position: 'relative' }}>
                      <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--neutral-muted)', fontSize: '13px' }}></i>
                      <input 
                        type="text" 
                        placeholder={t('team.searchAddMemberPlaceholder', 'Tìm theo tên, email, mã nhân viên...')} 
                        value={addMemberSearch}
                        onChange={(e) => setAddMemberSearch(e.target.value)}
                        style={{ padding: '8px 12px 8px 30px', width: '100%', borderRadius: '6px', border: '1px solid var(--neutral-border)', fontSize: '13px', outline: 'none' }}
                      />
                    </div>
                    <div style={{ width: '200px' }}>
                      <select
                        value={addMemberDeptFilter}
                        onChange={(e) => setAddMemberDeptFilter(e.target.value)}
                        style={{ padding: '8px 12px', width: '100%', borderRadius: '6px', border: '1px solid var(--neutral-border)', fontSize: '13px', outline: 'none', backgroundColor: 'var(--neutral-bg-card)' }}
                      >
                        <option value="all">{t('dept.allDepts', 'Tất cả phòng ban')}</option>
                        {departments.map(d => (
                          <option value={d.department_id} key={d.department_id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="data-table-wrapper" style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--neutral-border)', borderRadius: '6px' }}>
                    <table className="data-table" style={{ fontSize: '12.5px', marginBottom: 0 }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1 }}>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={allSelected} 
                              disabled={eligibleUsers.length === 0}
                              onChange={() => handleToggleAddMemberSelectAll(eligibleUsers)}
                              style={{ transform: 'scale(1.15)', cursor: 'pointer' }}
                            />
                          </th>
                          <th>{t('team.fullName', 'Họ và tên')}</th>
                          <th>{t('team.employeeCodeOrEmail', 'Mã nhân viên / Email')}</th>
                          <th>{t('team.currentDept', 'Phòng ban hiện tại')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eligibleUsers.map(u => {
                          const isChecked = addMemberSelectedIds.has(u.id);
                          return (
                            <tr 
                              key={u.id} 
                              onClick={() => handleToggleAddMemberCheckbox(u.id)}
                              style={{ cursor: 'pointer', backgroundColor: isChecked ? 'rgba(30, 64, 175, 0.03)' : 'transparent' }}
                            >
                              <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                <input 
                                  type="checkbox" 
                                  checked={isChecked} 
                                  onChange={() => handleToggleAddMemberCheckbox(u.id)}
                                  style={{ transform: 'scale(1.15)', cursor: 'pointer' }}
                                />
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: u.color || '#1e40af', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '600' }}>
                                    {u.name.split(" ").pop().charAt(0)}
                                  </div>
                                  <span style={{ fontWeight: '500' }}>{u.name}</span>
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: '500' }}>{u.employee_id || 'N/A'}</div>
                                <div style={{ fontSize: '11px', color: 'var(--neutral-muted)' }}>{u.email}</div>
                              </td>
                              <td>{translateDepartmentName(u.department_name, t)}</td>
                            </tr>
                          );
                        })}
                        {eligibleUsers.length === 0 && (
                          <tr>
                            <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--neutral-muted)' }}>
                              {t('team.noStaffFound', 'Không tìm thấy nhân viên phù hợp.')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--neutral-border)' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsAddMemberOpen(false)}>{t('common.cancel', 'Hủy')}</button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    disabled={addMemberLoading || addMemberSelectedIds.size === 0}
                    onClick={handleConfirmAddMembers}
                  >
                    {addMemberLoading ? t('common.saving', 'Đang lưu...') : `${t('common.add', 'Thêm')} (${addMemberSelectedIds.size}) ${t('team.members', 'thành viên')}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
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

const translateSystemRoleName = (role, t) => {
  if (!role) return '';
  const str = String(role);
  if (str.includes('Admin') || str.includes('Quản trị viên')) return t('role.adminShort', 'Quản trị viên (Admin)');
  if (str.includes('HR') || str.includes('Nhân sự')) return t('role.hrShort', 'Nhân sự (HR)');
  if (str.includes('Staff') || str.includes('Nhân viên')) return t('role.staffShort', 'Nhân viên (Staff)');
  if (str.includes('Team Leader')) return t('role.teamLeaderShort', 'Team Leader');
  if (str.includes('Part Leader')) return t('role.partLeaderShort', 'Part Leader');
  if (str.includes('Sales') || str.includes('Kinh doanh')) return t('role.salesShort', 'Kinh doanh (Sales)');
  if (str.includes('BOD') || str.includes('Ban điều hành')) return t('role.bodShort', 'Ban điều hành (BOD)');
  if (str.toLowerCase().includes('intern') || str.includes('thực tập')) return t('role.internShort', 'Thực tập sinh (Intern)');
  return role;
};

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


const translateModule = (mod, t) => {
  if (!mod) return '';
  if (mod === 'Dashboard') return t('module.dashboard', 'Dashboard');
  if (mod === 'Dự án' || mod === 'Project Management' || mod === 'Projects') return t('module.projects', 'Dự án');
  if (mod === 'Công việc' || mod === 'Tasks') return t('module.tasks', 'Công việc');
  if (mod === 'Tài liệu' || mod === 'Documents') return t('module.documents', 'Tài liệu');
  if (mod === 'Quản trị hệ thống' || mod === 'System Administration') return t('module.systemAdmin', 'Quản trị hệ thống');
  if (mod === 'Báo cáo ngày' || mod === 'Daily Reports') return t('module.dailyReports', 'Báo cáo ngày');
  if (mod === 'Kênh Chat' || mod === 'Internal Chat') return t('module.chat', 'Kênh Chat');
  return mod;
};

const translatePermissionName = (permKey, permName, t) => {
  const map = {
    'view_dashboard': t('perm.viewDashboard', 'Xem Dashboard'),
    'view_all_projects': t('perm.viewAllProjects', 'Xem toàn bộ dự án'),
    'create_project': t('perm.createProject', 'Thêm dự án mới'),
    'edit_project': t('perm.editProject', 'Chỉnh sửa dự án (Sửa/Xóa/Thay đổi plan)'),
    'manage_project_members': t('perm.manageProjectMembers', 'Quản lý thành viên dự án'),
    'create_task': t('perm.createTask', 'Giao việc mới (Tạo Task)'),
    'edit_task': t('perm.editTask', 'Chỉnh sửa nội dung công việc'),
    'delete_task': t('perm.deleteTask', 'Xóa công việc'),
    'update_task_status': t('perm.updateTaskStatus', 'Cập nhật trạng thái việc (Task status)'),
    'create_issue': t('perm.createIssue', 'Báo cáo lỗi/vấn đề mới (Issues)'),
    'edit_issue': t('perm.editIssue', 'Cập nhật trạng thái Issue (Reporter/Tagged)'),
    'view_documents': t('perm.viewDocuments', 'Xem tài liệu chung và tài liệu dự án'),
    'upload_documents': t('perm.uploadDocuments', 'Tải lên/Cập nhật tài liệu mới'),
    'upload_document': t('perm.uploadDocuments', 'Tải lên/Cập nhật tài liệu mới'),
    'view_hr': t('perm.viewHr', 'Truy cập Quản trị nhân sự (Trang HR)'),
    'view_hr_members': t('perm.viewHrMembers', 'Xem danh sách tài khoản & nhân sự'),
    'manage_role_permissions': t('perm.manageRolePermissions', 'Quản lý ma trận phân quyền'),
    'manage_departments': t('perm.manageDepartments', 'Quản lý danh mục phòng ban (Thêm/Sửa/Xóa)'),
    'create_employee_account': t('perm.createEmployeeAccount', 'Cấp tài khoản nhân viên mới'),
    'edit_employee_info': t('perm.editEmployeeInfo', 'Chỉnh sửa thông tin nhân viên & Phân vai trò'),
    'view_activity_logs': t('perm.viewActivityLogs', 'Xem nhật ký hệ thống (Log)'),
    'view_daily_reports': t('perm.viewDailyReports', 'Xem danh sách báo cáo ngày'),
    'view_all_daily_reports': t('perm.viewDailyReports', 'Xem danh sách báo cáo ngày'),
    'create_daily_report': t('perm.createDailyReport', 'Viết/gửi báo cáo ngày mới'),
    'submit_daily_report': t('perm.createDailyReport', 'Viết/gửi báo cáo ngày mới'),
    'approve_daily_report': t('perm.approveDailyReport', 'Phê duyệt/phản hồi báo cáo ngày'),
    'chat_tag_all_global': t('perm.chatTagAllGlobal', 'Tự động tag @all phòng chat chung'),
    'chat_tag_all_project': t('perm.chatTagAllProject', 'Tự động tag @all phòng chat dự án'),
    'chat_confirm_send': t('perm.chatConfirmSend', 'Hỏi xác nhận trước khi gửi tin nhắn'),
    'chat_access': t('perm.chatAccess', 'Truy cập Kênh Chat nội bộ')
  };
  return map[permKey] || permName;
};


