"use client";

import React from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const { currentUser, projects, tasks, documents, notifications, projectMembers } = useApp();
  const router = useRouter();

  if (!currentUser) return null;

  // Permissions helpers
  const isAdmin = currentUser.system_role.includes("Admin");
  const isMemberOfProject = (projId) => {
    if (isAdmin) return true;
    return projectMembers.some(m => m.project_id === projId && m.user_id === currentUser.id);
  };

  // Calculations
  const myProjects = projects.filter(p => isMemberOfProject(p.id));
  const activeProjectsCount = myProjects.filter(p => p.status !== "Kết thúc").length;
  const pendingTasks = tasks.filter(t => t.assignee_id === currentUser.id && t.status !== "Done");
  const unreadNotifsCount = notifications.filter(n => !n.is_read).length;
  const accessibleDocs = documents.filter(d => d.project_id === null || isMemberOfProject(d.project_id));

  // Upcoming tasks sorted by due date
  const upcomingTasks = tasks
    .filter(t => t.assignee_id === currentUser.id && t.status !== "Done" && t.due_date)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 5);

  return (
    <div className="scrollable-view">
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-info">
            <h3>{activeProjectsCount}</h3>
            <p>Dự án đang chạy</p>
          </div>
          <div className="stat-icon primary"><i className="fa-solid fa-folder-open"></i></div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h3>{pendingTasks.length}</h3>
            <p>Công việc chưa xong</p>
          </div>
          <div className="stat-icon warning"><i className="fa-solid fa-clock"></i></div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h3>{unreadNotifsCount}</h3>
            <p>Thông báo chưa đọc</p>
          </div>
          <div className="stat-icon danger"><i className="fa-solid fa-bell"></i></div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h3>{accessibleDocs.length}</h3>
            <p>Tài liệu lưu trữ</p>
          </div>
          <div className="stat-icon success"><i className="fa-solid fa-file-invoice"></i></div>
        </div>
      </div>
      
      <div className="dashboard-row-2">
        {/* Project progress section */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Tiến độ Dự án của tôi</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => router.push('/projects')}>Tất cả dự án</button>
          </div>
          <div className="card-body">
            {myProjects.length === 0 ? (
              <p className="text-muted">Bạn chưa tham gia dự án nào.</p>
            ) : (
              myProjects.map(p => {
                const pTasks = tasks.filter(t => t.project_id === p.id);
                const done = pTasks.filter(t => t.status === "Done").length;
                const progress = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0;
                return (
                  <div key={p.id} style={{ marginBottom: '16px', cursor: 'pointer' }} onClick={() => router.push(`/projects/${p.id}`)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontWeight: '500' }}>
                      <span>{p.name}</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="progress-bar-outer" style={{ height: '8px' }}>
                      <div className="progress-bar-inner" style={{ width: `${progress}%` }}></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--neutral-muted)', marginTop: '4px' }}>
                      <span>Trạng thái: <strong>{p.status}</strong></span>
                      <span>Hạn chót: {p.end_date}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        
        {/* Upcoming Deadlines section */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Hạn chót sắp tới</h3>
          </div>
          <div className="card-body">
            {upcomingTasks.length === 0 ? (
              <p className="text-muted">Bạn không có công việc nào sắp tới hạn.</p>
            ) : (
              upcomingTasks.map(t => {
                const proj = projects.find(p => p.id === t.project_id);
                const isOverdue = new Date(t.due_date) < new Date();
                return (
                  <div key={t.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--neutral-border)', cursor: 'pointer' }} onClick={() => router.push(`/projects/${t.project_id}`)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: 600, fontSize: '12.5px' }}>{t.title}</span>
                      <span className={`badge ${isOverdue ? 'badge-danger' : 'badge-warning'}`}>{t.due_date}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--neutral-muted)', marginTop: '2px' }}>
                      Dự án: {proj ? proj.name : 'N/A'} | Độ ưu tiên: {t.priority}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
