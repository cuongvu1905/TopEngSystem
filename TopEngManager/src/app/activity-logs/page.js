"use client";

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';

export default function ActivityLogs() {
  const { currentUser, activityLogs, users, projects, tasks, documents, projectMembers } = useApp();
  
  const [logUserFilter, setLogUserFilter] = useState('all');
  const [logActionFilter, setLogActionFilter] = useState('all');
  const [logProjectFilter, setLogProjectFilter] = useState('all');

  if (!currentUser) return null;

  const isAdmin = currentUser.system_role.includes("Admin");
  
  if (!isAdmin) {
    return (
      <div className="scrollable-view" style={{ textAlign: 'center', padding: '40px' }}>
        <div className="card" style={{ maxWidth: '500px', margin: '40px auto', padding: '32px' }}>
          <i className="fa-solid fa-lock" style={{ fontSize: '48px', color: 'var(--danger-color)', marginBottom: '16px' }}></i>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Không có quyền truy cập</h2>
          <p className="text-muted" style={{ fontSize: '13px' }}>Chỉ Quản trị viên (Admin) mới có quyền truy cập xem Nhật ký hệ thống.</p>
        </div>
      </div>
    );
  }

  const isMemberOfProject = (projId) => {
    return projectMembers.some(m => m.project_id === projId && m.user_id === currentUser.id);
  };

  // Projects list the current user participates in
  const myProjects = projects.filter(p => isMemberOfProject(p.id));
  const myProjectIds = myProjects.map(p => p.id);

  // Resolve project ID and project name for each log
  const resolvedLogs = activityLogs.map(l => {
    let projId = null;
    if (l.entity_type === 'Project') {
      projId = l.entity_id;
    } else if (l.metadata?.project_id) {
      projId = l.metadata.project_id;
    } else if (l.entity_type === 'Task') {
      const t = tasks.find(item => item.id === l.entity_id);
      if (t) projId = t.project_id;
    } else if (l.entity_type === 'Document') {
      const d = documents.find(item => item.id === l.entity_id);
      if (d) projId = d.project_id;
    }
    
    const proj = projects.find(p => p.id === projId);
    return {
      ...l,
      project_id: projId,
      project_name: proj ? proj.name : 'Hệ thống (Chung)'
    };
  });

  // Filter logs visibility: members only see logs belonging to their projects
  const visibleLogs = resolvedLogs.filter(l => {
    if (isAdmin) return true;
    // For members, only show logs belonging to projects they participate in
    return l.project_id && myProjectIds.includes(l.project_id);
  });

  // Apply filters
  const filteredLogs = visibleLogs.filter(l => {
    const matchUser = logUserFilter === 'all' || l.user_id === logUserFilter;
    const matchAction = logActionFilter === 'all' || l.action_type === logActionFilter;
    const matchProject = logProjectFilter === 'all' || l.project_id === logProjectFilter;
    return matchUser && matchAction && matchProject;
  });

  return (
    <div className="scrollable-view">
      <div className="view-header">
        <div className="view-title-group">
          <h2>Nhật ký Hoạt động</h2>
          <p>Ghi nhận mọi thay đổi, phục vụ mục đích kiểm soát bảo mật và tính toán tiến độ làm việc.</p>
        </div>
      </div>

      <div className="doc-filters" style={{ marginBottom: '20px' }}>
        <div className="log-filters-bar" style={{ width: '100%' }}>
          <div className="log-filter-item">
            <label>Dự án:</label>
            <select value={logProjectFilter} onChange={(e) => setLogProjectFilter(e.target.value)} className="doc-select-filter">
              <option value="all">Tất cả dự án</option>
              {myProjects.map(p => (
                <option value={p.id} key={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          
          <div className="log-filter-item">
            <label>Thành viên:</label>
            <select value={logUserFilter} onChange={(e) => setLogUserFilter(e.target.value)} className="doc-select-filter">
              <option value="all">Tất cả thành viên</option>
              {users.map(u => (
                <option value={u.id} key={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          
          <div className="log-filter-item">
            <label>Hành động:</label>
            <select value={logActionFilter} onChange={(e) => setLogActionFilter(e.target.value)} className="doc-select-filter">
              <option value="all">Tất cả hành động</option>
              <option value="CREATE">CREATE (Tạo mới)</option>
              <option value="UPDATE">UPDATE (Cập nhật)</option>
              <option value="UPDATE_STATUS">UPDATE_STATUS (Đổi trạng thái)</option>
              <option value="UPLOAD">UPLOAD (Tải tài liệu)</option>
              <option value="COMMENT">COMMENT (Bình luận)</option>
              <option value="SWITCH_USER">SWITCH_USER (Đổi tài khoản)</option>
              <option value="ADD_MEMBER">ADD_MEMBER (Thêm thành viên)</option>
              <option value="REMOVE_MEMBER">REMOVE_MEMBER (Xóa thành viên)</option>
              <option value="LOGIN_SUCCESS">LOGIN_SUCCESS (Đăng nhập thành công)</option>
              <option value="LOGIN_FAILURE">LOGIN_FAILURE (Đăng nhập thất bại)</option>
              <option value="SECURITY_ALERT">SECURITY_ALERT (Cảnh báo bảo mật)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Thành viên</th>
              <th>Hành động</th>
              <th>Dự án</th>
              <th>Mô tả hoạt động</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--neutral-muted)' }}>
                  Không tìm thấy nhật ký hoạt động nào phù hợp.
                </td>
              </tr>
            ) : (
              filteredLogs.map(l => {
                const u = users.find(usr => usr.id === l.user_id) || { name: 'Hệ thống', color: '#6b7280' };
                const date = new Date(l.created_at);
                const timeStr = `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')} - ${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`;
                
                let badgeClass = "badge-info";
                if (l.action_type === "CREATE") badgeClass = "badge-success";
                else if (l.action_type === "UPDATE_STATUS" || l.action_type === "UPDATE") badgeClass = "badge-warning";
                else if (l.action_type === "SWITCH_USER" || l.action_type === "REMOVE_MEMBER" || l.action_type === "SECURITY_ALERT" || l.action_type === "LOGIN_FAILURE") badgeClass = "badge-danger";

                return (
                  <tr key={l.id}>
                    <td>{timeStr}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: u.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '600' }}>
                          {u.name.split(" ").pop().charAt(0)}
                        </div>
                        <span>{u.name}</span>
                      </div>
                    </td>
                    <td><span className={`badge ${badgeClass}`}>{l.action_type}</span></td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.project_name}>
                      <strong>{l.project_name}</strong>
                    </td>
                    <td style={l.action_type === "SECURITY_ALERT" ? { color: 'var(--danger-color)', fontWeight: '600' } : {}}>
                      {l.action_type === "SECURITY_ALERT" && <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }}></i>}
                      {l.description}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
