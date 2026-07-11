"use client";

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { ProjectModal, CustomerModal } from '@/components/Modals';
import { getSwal } from '@/utils/swal';

export default function Projects() {
  const { currentUser, projects, tasks, projectMembers, users, reloadAll, hasPermission } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const router = useRouter();

  if (!currentUser) return null;

  const isAdmin = currentUser.system_role.includes("Admin");
  const isHR = currentUser.system_role.includes("Nhân sự");

  const isMemberOfProject = (projId) => {
    if (hasPermission('view_all_projects')) return true;
    return projectMembers.some(m => m.project_id === projId && m.user_id === currentUser.id);
  };

  const handleProjectClick = async (pId) => {
    if (!hasPermission('view_all_projects') && !projectMembers.some(m => m.project_id === pId && m.user_id === currentUser.id)) {
      const Swal = await getSwal();
      Swal.fire({ icon: 'error', title: 'Từ chối truy cập', text: "Bạn không có quyền truy cập vì không thuộc dự án này." });
      return;
    }
    router.push(`/projects/${pId}`);
  };

  const showCreateBtn = hasPermission('create_project');
  
  if (isHR) {
    return (
      <div className="scrollable-view" style={{ textAlign: 'center', padding: '40px' }}>
        <div className="card" style={{ maxWidth: '500px', margin: '40px auto', padding: '32px' }}>
          <i className="fa-solid fa-lock" style={{ fontSize: '48px', color: 'var(--danger-color)', marginBottom: '16px' }}></i>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Không có quyền truy cập</h2>
          <p className="text-muted" style={{ fontSize: '13px' }}>Bộ phận Nhân sự (HR) không có quyền xem thông tin và bảng điều khiển của dự án.</p>
        </div>
      </div>
    );
  }

  // Filter projects by permission
  const visibleProjects = projects.filter(p => {
    if (hasPermission('view_all_projects')) return true;
    return projectMembers.some(m => m.project_id === p.id && m.user_id === currentUser.id);
  });

  return (
    <div className="scrollable-view">
      <div className="view-header">
        <div className="view-title-group">
          <h2>Danh sách Dự án</h2>
          <p>Quản lý quy trình và theo dõi tiến độ của tất cả các dự án trong doanh nghiệp.</p>
        </div>
        <div className="view-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setIsCustomerModalOpen(true)}
            style={{ 
              backgroundColor: '#fff', 
              color: '#334155', 
              border: '1px solid #cbd5e1',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <i className="fa-solid fa-user-tie"></i> Quản lý khách hàng
          </button>
          {showCreateBtn && (
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600' }}>
              <i className="fa-solid fa-plus"></i> Tạo Dự Án
            </button>
          )}
        </div>
      </div>
      
      <div className="project-list-grid">
        {visibleProjects.map(p => {
          const isMember = isMemberOfProject(p.id);
          const pTasks = tasks.filter(t => t.project_id === p.id);
          const done = pTasks.filter(t => t.status === "Done").length;
          const progress = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0;
          const pMembers = projectMembers.filter(m => m.project_id === p.id);
          
          let badgeClass = "badge-info";
          if (p.status === "Thực thi" || p.status === "Giám sát") badgeClass = "badge-warning";
          if (p.status === "Kết thúc") badgeClass = "badge-success";

          return (
            <div 
              className="project-card" 
              style={{ opacity: isMember ? 1 : 0.6, cursor: isMember ? 'pointer' : 'not-allowed' }} 
              key={p.id} 
              onClick={() => handleProjectClick(p.id)}
            >
              <div className="project-card-header">
                <div className="project-title">{p.name}</div>
                <span className={`badge ${badgeClass}`}>{p.status}</span>
              </div>
              <div className="project-card-body">
                <p className="project-desc">{p.description || 'Không có mô tả.'}</p>
                
                <div className="project-progress-container">
                  <div className="progress-bar-wrapper">
                    <span>Tiến độ</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="progress-bar-outer">
                    <div className="progress-bar-inner" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
                
                <div className="project-card-footer">
                  <div className="project-dates">
                    <span><i className="fa-regular fa-calendar"></i> {p.start_date}</span>
                  </div>
                  <div className="project-members-avatars">
                    {pMembers.slice(0, 4).map(m => {
                      const u = users.find(usr => usr.id === m.user_id);
                      return u ? (
                        <div className="member-avatar-stacked" style={{ backgroundColor: u.color }} key={m.id} title={`${u.name} (${m.project_role})`}>
                          {u.name.split(" ").pop().charAt(0)}
                        </div>
                      ) : null;
                    })}
                    {pMembers.length > 4 && <div className="member-avatar-stacked" style={{ backgroundColor: 'var(--neutral-muted)' }}>+{pMembers.length - 4}</div>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ProjectModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projectId={null}
        currentUser={currentUser}
        onSaved={reloadAll}
      />

      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        currentUser={currentUser}
        onSaved={reloadAll}
      />
    </div>
  );
}
