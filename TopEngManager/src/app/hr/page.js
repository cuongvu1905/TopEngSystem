"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
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

export default function HRManagement() {
  const { currentUser, users, projects, tasks, reloadAll } = useApp();
  const [activeTab, setActiveTab] = useState('users');
  const [roles, setRoles] = useState([]);
  
  // Create account states
  const [isOpen, setIsOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('all');

  // Permission states
  const [localRoles, setLocalRoles] = useState([]);
  const [localPermissions, setLocalPermissions] = useState([]);
  const [localRolePermissions, setLocalRolePermissions] = useState({});
  const [newRoleName, setNewRoleName] = useState('');
  const [savingPermissions, setSavingPermissions] = useState(false);

  const isAdmin = currentUser?.system_role?.includes("Admin");
  const isHR = currentUser?.system_role?.includes("Nhân sự");

  const loadRoles = async () => {
    try {
      const list = await db.getRoles();
      setRoles(list);
      if (list.length > 0 && !roleId) {
        setRoleId(list[0].id);
      }
    } catch (err) {
      console.error("Failed to load roles:", err);
    }
  };

  useEffect(() => {
    loadRoles();
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

  // Enforce access control: only Admin or HR can see this
  if (!isAdmin && !isHR) {
    return (
      <div className="scrollable-view" style={{ textAlign: 'center', padding: '40px' }}>
        <div className="card" style={{ maxWidth: '500px', margin: '40px auto', padding: '32px' }}>
          <i className="fa-solid fa-lock" style={{ fontSize: '48px', color: 'var(--danger-color)', marginBottom: '16px' }}></i>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Không có quyền truy cập</h2>
          <p className="text-muted" style={{ fontSize: '13px' }}>Chỉ bộ phận Nhân sự (HR) và Admin mới có quyền quản lý và cấp tài khoản nhân viên.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName || !email || !password || !roleId) return;

    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await db.createUser(email, password, fullName, roleId);
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
      setFullName('');
      setEmail('');
      setPassword('');
      setIsOpen(false);
      
      await reloadAll();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Lỗi cấp tài khoản.');
    } finally {
      setLoading(false);
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

  const results = getSearchResults();
  const totalResults = results.projects.length + results.tasks.length + results.users.length;

  return (
    <div className="scrollable-view">
      <div className="view-header" style={{ marginBottom: '12px' }}>
        <div className="view-title-group">
          <h2>Quản trị Hệ thống & Nhân sự</h2>
          <p>Cấp tài khoản mới, tra cứu thông tin dữ liệu chéo và quản trị ma trận phân quyền hệ thống.</p>
        </div>
        <div className="view-actions">
          {activeTab === 'users' && (
            <button className="btn btn-primary" onClick={() => { setIsOpen(true); setErrorMsg(''); setSuccessMsg(''); }}>
              <i className="fa-solid fa-user-plus"></i> Cấp tài khoản mới
            </button>
          )}
        </div>
      </div>

      <div className="project-tabs" style={{ marginTop: '16px', marginBottom: '16px' }}>
        <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
          <i className="fa-solid fa-users"></i> Nhân sự & Tài khoản
        </button>
        {isAdmin && (
          <button className={`tab-btn ${activeTab === 'permissions' ? 'active' : ''}`} onClick={() => setActiveTab('permissions')}>
            <i className="fa-solid fa-shield-halved"></i> Bảng Phân Quyền
          </button>
        )}
        <button className={`tab-btn ${activeTab === 'lookup' ? 'active' : ''}`} onClick={() => setActiveTab('lookup')}>
          <i className="fa-solid fa-magnifying-glass"></i> Tra cứu Dữ liệu
        </button>
      </div>

      {/* ================= TAB 1: USERS LIST ================= */}
      {activeTab === 'users' && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>Danh sách nhân viên ({users.length})</h3>
          
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Họ và tên</th>
                  <th>Địa chỉ Email</th>
                  <th>Vai trò hệ thống</th>
                  <th>Màu nhận diện</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: u.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600' }}>
                          {u.name.split(" ").pop().charAt(0)}
                        </div>
                        <span style={{ fontWeight: '500' }}>{u.name} {u.id === currentUser.id && <span className="text-muted" style={{ fontSize: '11px' }}>(Bạn)</span>}</span>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className="badge badge-info">{u.system_role || 'Nhân viên'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: u.color }}></span>
                        <code style={{ fontSize: '11.5px', color: 'var(--neutral-muted)' }}>{u.color}</code>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 2: SYSTEM PERMISSIONS MATRIX ================= */}
      {activeTab === 'permissions' && isAdmin && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>Ma trận Phân quyền Chức năng</h3>
              <p className="text-muted" style={{ fontSize: '12.5px', margin: 0 }}>Cấu hình bật/tắt quyền hạn chi tiết cho từng vai trò và thêm vai trò mới để mở rộng người dùng.</p>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newRoleName.trim()) return;

              const trimmed = newRoleName.trim();
              if (localRoles.some(r => r.name.toLowerCase() === trimmed.toLowerCase())) {
                Swal.fire({ icon: 'warning', title: 'Cảnh báo', text: "Vai trò này đã tồn tại!" });
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
                Swal.fire({ icon: 'success', title: 'Thành công', text: `Đã thêm vai trò '${trimmed}' thành công! Hãy cấu hình quyền hạn cho vai trò này.` });
              } catch (err) {
                Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi thêm vai trò: " + err.message });
              }
            }} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="Tên vai trò mới..." 
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '13px', outline: 'none', width: '180px' }}
                required
              />
              <button type="submit" className="btn btn-secondary btn-sm" style={{ padding: '7px 12px' }}>
                <i className="fa-solid fa-plus"></i> Thêm Vai Trò
              </button>
            </form>
          </div>
          
          <div className="data-table-wrapper" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <table className="data-table" style={{ fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{ minWidth: '150px' }}>Phân hệ</th>
                  <th style={{ minWidth: '220px' }}>Quyền hạn / Chức năng</th>
                  {localRoles.map(role => (
                    <th key={role.id} style={{ textAlign: 'center', minWidth: '100px' }}>
                      {role.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {localPermissions.map(perm => (
                  <tr key={perm.key}>
                    <td style={{ fontWeight: '600', color: '#475569' }}>{perm.module}</td>
                    <td>
                      <div style={{ fontWeight: '500' }}>{perm.name}</div>
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
                  Swal.fire({ icon: 'success', title: 'Thành công', text: "Đã lưu cấu hình phân quyền hệ thống thành công!" });
                } catch (err) {
                  Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi lưu phân quyền: " + err.message });
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
                <span><i className="fa-solid fa-cloud-arrow-up"></i> Lưu cấu hình phân quyền</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ================= TAB 3: DATA LOOKUP CENTER ================= */}
      {activeTab === 'lookup' && (
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
                            <p style={{ fontSize: '12px', color: 'var(--neutral-muted)', margin: '4px 0 0' }}>{t.description || 'Không có mô tả.'}</p>
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
      )}

      {/* Issuing Account Modal */}
      {isOpen && (
        <div className="modal show" style={{ display: 'flex' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Cấp tài khoản nhân viên mới</h3>
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
                    <label>Họ và tên nhân viên <span className="required">*</span></label>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Ví dụ: Nguyễn Văn A" />
                  </div>
                  
                  <div className="form-group">
                    <label>Email công việc <span className="required">*</span></label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@company.com" />
                  </div>

                  <div className="form-group">
                    <label>Mật khẩu khởi tạo <span className="required">*</span></label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Nhập mật khẩu..." />
                  </div>

                  <div className="form-group">
                    <label>Vai trò chức vụ hệ thống <span className="required">*</span></label>
                    <select value={roleId} onChange={(e) => setRoleId(e.target.value)} style={{ padding: '8px', width: '100%', borderRadius: '4px', border: '1px solid var(--neutral-border)', outline: 'none' }} required>
                      {roles.map(r => (
                        <option value={r.id} key={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setIsOpen(false)}>Hủy</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Đang tạo...' : 'Cấp tài khoản'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
