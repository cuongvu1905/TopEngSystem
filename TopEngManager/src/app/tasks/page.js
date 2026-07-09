"use client";

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { db } from '@/utils/db';
import { TaskModal } from '@/components/Modals';

export default function Tasks() {
  const { currentUser, projects, tasks, projectMembers, users, reloadAll } = useApp();

  const [selectedProj, setSelectedProj] = useState('all');
  const [selectedAssignee, setSelectedAssignee] = useState('all');
  const [viewMode, setViewMode] = useState('kanban');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [draggedTaskId, setDraggedTaskId] = useState(null);

  const isAdmin = currentUser.system_role.includes("Admin");
  const isBOD = currentUser.system_role.includes("Ban điều hành");
  const canAssignTask = isAdmin || currentUser.system_role.includes("Leader");

  if (isBOD) {
    return (
      <div className="scrollable-view" style={{ textAlign: 'center', padding: '40px' }}>
        <div className="card" style={{ maxWidth: '500px', margin: '40px auto', padding: '32px' }}>
          <i className="fa-solid fa-eye-slash" style={{ fontSize: '48px', color: 'var(--danger-color)', marginBottom: '16px' }}></i>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Không có quyền xem danh sách</h2>
          <p className="text-muted" style={{ fontSize: '13px' }}>Ban điều hành (BOD) không có quyền xem danh sách công việc được giao. Bạn có thể xem và quản lý công việc trong chi tiết của từng dự án.</p>
        </div>
      </div>
    );
  }

  const isMemberOfProject = (projId) => {
    if (isAdmin || currentUser.system_role.includes("Leader") || currentUser.system_role.includes("Kinh doanh")) return true;
    return projectMembers.some(m => m.project_id === projId && m.user_id === currentUser.id);
  };

  const projectsList = projects.filter(p => isMemberOfProject(p.id));

  // Filters logic
  let filteredTasks = tasks;
  if (selectedProj !== 'all') {
    filteredTasks = filteredTasks.filter(t => t.project_id === selectedProj);
  } else {
    filteredTasks = filteredTasks.filter(t => projectsList.some(p => p.id === t.project_id));
  }

  if (selectedAssignee === 'me') {
    filteredTasks = filteredTasks.filter(t => t.assignee_id === currentUser.id);
  }

  // Drag and drop task status
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    if (!draggedTaskId) return;

    const task = tasks.find(t => t.id === draggedTaskId);
    if (!task) return;

    if (!isMemberOfProject(task.project_id)) {
      alert("Bạn không phải thành viên dự án này, không thể cập nhật công việc!");
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

  const openTaskDetail = (id) => {
    setActiveTaskId(id);
    setIsModalOpen(true);
  };

  return (
    <div className="scrollable-view">
      <div className="view-header">
        <div className="view-title-group">
          <h2>Bảng Quản lý Công việc</h2>
          <p>Lọc công việc theo dự án và cập nhật trạng thái trực quan.</p>
        </div>
      </div>
      
      <div className="doc-filters" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontWeight: 500 }}>Dự án:</label>
            <select value={selectedProj} onChange={(e) => setSelectedProj(e.target.value)} className="doc-select-filter" style={{ minWidth: '220px' }}>
              <option value="all">--- Tất cả dự án ---</option>
              {projectsList.map(p => (
                <option value={p.id} key={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontWeight: 500 }}>Người nhận:</label>
            <select value={selectedAssignee} onChange={(e) => setSelectedAssignee(e.target.value)} className="doc-select-filter">
              <option value="all">Tất cả mọi người</option>
              <option value="me">Chỉ mình tôi</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
            <button className={`btn btn-secondary btn-sm ${viewMode === 'kanban' ? 'active' : ''}`} onClick={() => setViewMode('kanban')}><i className="fa-solid fa-cubes"></i> Kanban</button>
            <button className={`btn btn-secondary btn-sm ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}><i className="fa-solid fa-list"></i> Danh sách</button>
          </div>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <div className="kanban-board">
          {[
            { id: "Todo", title: "Cần làm", class: "todo" },
            { id: "InProgress", title: "Đang làm", class: "inprogress" },
            { id: "Review", title: "Đang duyệt", class: "review" },
            { id: "Done", title: "Hoàn thành", class: "done" }
          ].map(col => {
            const colTasks = filteredTasks.filter(t => t.status === col.id);
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
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tiêu đề</th>
                <th>Độ ưu tiên</th>
                <th>Hạn chót</th>
                <th>Người phụ trách</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(t => {
                const u = users.find(usr => usr.id === t.assignee_id);
                const isOverdue = new Date(t.due_date) < new Date() && t.status !== "Done";
                let pClass = "badge-info";
                if (t.priority === "Cao") pClass = "badge-danger";
                else if (t.priority === "Trung bình") pClass = "badge-warning";
                else pClass = "badge-success";

                let statusBadgeClass = "badge-info";
                if (t.status === "Todo") statusBadgeClass = "badge-danger";
                else if (t.status === "InProgress") statusBadgeClass = "badge-warning";
                else if (t.status === "Review") statusBadgeClass = "badge-info";
                else if (t.status === "Done") statusBadgeClass = "badge-success";

                return (
                  <tr key={t.id}>
                    <td><a href="#" onClick={(e) => { e.preventDefault(); openTaskDetail(t.id); }} style={{ color: 'var(--neutral-dark)', fontWeight: '500' }}>{t.title}</a></td>
                    <td><span className={`badge ${pClass}`}>{t.priority}</span></td>
                    <td style={{ color: isOverdue ? 'var(--danger-color)' : 'inherit', fontWeight: isOverdue ? '600' : 'normal' }}>{t.due_date || 'N/A'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: u ? u.color : 'var(--neutral-muted)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9.5px', fontWeight: '600' }}>
                          {u ? u.name.split(" ").pop().charAt(0) : '?'}
                        </div>
                        <span>{u ? u.name : 'Chưa giao'}</span>
                      </div>
                    </td>
                    <td><span className={`badge ${statusBadgeClass}`}>{t.status}</span></td>
                    <td>
                      <button className="btn-icon-sm" onClick={() => openTaskDetail(t.id)}><i className="fa-solid fa-eye"></i></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <TaskModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        taskId={activeTaskId}
        projId={selectedProj === 'all' ? projectsList[0]?.id : selectedProj}
        currentUser={currentUser}
        onSaved={reloadAll}
      />
    </div>
  );
}
