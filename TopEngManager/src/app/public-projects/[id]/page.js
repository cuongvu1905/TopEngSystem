"use client";

import React, { useState, useEffect, use } from 'react';
import { db } from '@/utils/db';
import Link from 'next/link';

export default function PublicProjectDetail({ params }) {
  const { id: projectId } = use(params);
  
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        setLoading(true);
        // Load projects first
        const projectsList = await db.getProjects();
        const p = projectsList.find(proj => proj.id === projectId);
        
        if (!p) {
          setErrorMsg('Không tìm thấy dự án này.');
          setLoading(false);
          return;
        }

        if (!p.is_public) {
          setErrorMsg('Dự án này không được cấu hình hiển thị công khai.');
          setLoading(false);
          return;
        }

        setProject(p);

        // Load tasks and users
        const [taskList, userList] = await Promise.all([
          db.getTasks(projectId),
          db.getUsers()
        ]);

        setTasks(taskList);
        setUsers(userList);
      } catch (err) {
        console.error(err);
        setErrorMsg('Lỗi tải dữ liệu công khai.');
      } finally {
        setLoading(false);
      }
    };

    fetchPublicData();
  }, [projectId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', background: '#0f172a', color: '#cbd5e1' }}>
        <div className="loading-spinner"></div>
        <span style={{ marginLeft: '12px' }}>Đang tải thông tin công khai...</span>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', maxWidth: '600px', margin: '60px auto' }}>
        <div className="card" style={{ padding: '32px' }}>
          <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '48px', color: 'var(--danger-color)', marginBottom: '16px' }}></i>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Không khả dụng</h2>
          <p className="text-muted" style={{ fontSize: '13.5px' }}>{errorMsg}</p>
          <div style={{ marginTop: '20px' }}>
            <Link href="/" className="btn btn-secondary btn-sm">Quay lại Đăng nhập</Link>
          </div>
        </div>
      </div>
    );
  }

  const doneTasks = tasks.filter(t => t.status === 'Done').length;
  const progressPercent = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;

  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <div className="card" style={{ padding: '24px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'var(--primary-color)' }}></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <i className="fa-solid fa-globe"></i> Trang công khai
              </span>
              <span className="badge badge-info">{project.status}</span>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--neutral-dark)', margin: '4px 0' }}>{project.name}</h1>
            <p className="text-muted" style={{ fontSize: '14.5px', marginTop: '6px', maxWidth: '700px' }}>{project.description || 'Không có mô tả dự án.'}</p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--neutral-muted)' }}>
            <div>Thời gian chạy dự án</div>
            <div style={{ fontWeight: '600', color: 'var(--neutral-dark)', marginTop: '4px' }}>{project.start_date} ~ {project.end_date}</div>
          </div>
        </div>

        <div style={{ marginTop: '24px', padding: '16px', backgroundColor: 'var(--neutral-light)', borderRadius: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>
            <span>Tiến độ tổng thể</span>
            <span>{progressPercent}% ({doneTasks}/{tasks.length} công việc)</span>
          </div>
          <div className="progress-bar-outer" style={{ height: '8px' }}>
            <div className="progress-bar-inner" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', borderBottom: '1px solid var(--neutral-border)', paddingBottom: '8px' }}>Danh sách công việc dự án</h2>
        
        {tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--neutral-muted)' }}>Không có công việc nào trong dự án này.</div>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tiêu đề công việc</th>
                  <th>Độ ưu tiên</th>
                  <th>Hạn chót</th>
                  <th>Người phụ trách</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => {
                  const u = users.find(usr => usr.id === t.assignee_id);
                  let pClass = "badge-success";
                  if (t.priority === "Cao") pClass = "badge-danger";
                  else if (t.priority === "Trung bình") pClass = "badge-warning";

                  let sClass = "badge-info";
                  if (t.status === "Todo") sClass = "badge-danger";
                  else if (t.status === "InProgress") sClass = "badge-warning";
                  else if (t.status === "Done") sClass = "badge-success";

                  return (
                    <tr key={t.id}>
                      <td style={{ fontWeight: '500' }}>{t.title}</td>
                      <td><span className={`badge ${pClass}`}>{t.priority}</span></td>
                      <td>{t.due_date ? new Date(t.due_date).toLocaleDateString('vi-VN') : 'N/A'}</td>
                      <td>
                        {u ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: u.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '600' }}>
                              {u.name.split(" ").pop().charAt(0)}
                            </div>
                            <span>{u.name}</span>
                          </div>
                        ) : 'Chưa giao'}
                      </td>
                      <td><span className={`badge ${sClass}`}>{t.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
