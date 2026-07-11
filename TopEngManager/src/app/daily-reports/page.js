"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { db } from '@/utils/db';
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

export default function DailyReportsPage() {
  const { currentUser, users, projects } = useApp();
  
  const [reports, setReports] = useState([]);
  const [reportContent, setReportContent] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // No active filters needed
  
  // File upload state
  const fileInputRef = useRef(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachedFileName, setAttachedFileName] = useState('');

  const isManager = 
    currentUser?.system_role?.includes("Admin") || 
    currentUser?.system_role?.includes("HR") || 
    currentUser?.system_role?.includes("BOD") || 
    currentUser?.system_role?.includes("Leader");

  const loadReports = async () => {
    if (!currentUser) return;
    try {
      setIsLoading(true);
      const list = await db.getDailyReports(currentUser.id, currentUser.system_role);
      setReports(list);
    } catch (e) {
      console.error("Failed to load reports:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const projectIdParam = searchParams.get('projectId');
      if (projectIdParam) {
        setSelectedProjectId(projectIdParam);
      }
    }
  }, [currentUser]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploadingFile(true);
      const res = await db.uploadFile(file);
      setFileUrl(res.fileUrl);
      setAttachedFileName(file.name);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi tải tệp: " + err.message });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleClearAttachment = () => {
    setFileUrl('');
    setAttachedFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!reportContent.trim() || !currentUser) return;

    try {
      setIsSubmitting(true);
      await db.createDailyReport({
        userId: currentUser.id,
        content: reportContent,
        fileUrl: fileUrl || null,
        projectId: selectedProjectId || null
      });

      setReportContent('');
      setSelectedProjectId('');
      handleClearAttachment();
      await loadReports();
      Swal.fire({ icon: 'success', title: 'Thành công', text: "Đã gửi báo cáo ngày thành công!" });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi gửi báo cáo: " + err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter reports locally to only show current user's reports
  const filteredReports = reports.filter(r => r.user_id === currentUser.id);

  if (!currentUser) {
    return (
      <div className="flex-center" style={{ height: '70vh', flexDirection: 'column' }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '32px', color: 'var(--primary-color)' }}></i>
        <p style={{ marginTop: '12px', color: 'var(--neutral-muted)' }}>Vui lòng đăng nhập...</p>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ padding: '24px', width: '100%' }}>
      <div className="page-header" style={{ marginBottom: '24px', borderBottom: '1px solid var(--neutral-border)', paddingBottom: '16px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--neutral-dark)' }}>
          <i className="fa-solid fa-file-invoice" style={{ marginRight: '10px', color: 'var(--primary-color)' }}></i>
          Báo Cáo Hàng Ngày
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--neutral-muted)', marginTop: '4px' }}>
          Gửi báo cáo tiến độ công việc hàng ngày và theo dõi báo cáo của các thành viên.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column: Create Report Form */}
        <div className="card" style={{ padding: '24px', borderRadius: '8px', border: '1px solid var(--neutral-border)', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1e293b' }}>
            <i className="fa-solid fa-pen-nib" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>
            Viết báo cáo hôm nay
          </h3>
          <form onSubmit={handleSubmitReport}>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#475569' }}>
                Nội dung báo cáo <span style={{ color: 'red' }}>*</span>
              </label>
              <textarea
                value={reportContent}
                onChange={(e) => setReportContent(e.target.value)}
                required
                placeholder="Nhập nội dung báo cáo ngày...&#10;Gợi ý:&#10;- Hôm nay bạn đã làm được những gì?&#10;- Có gặp khó khăn hay vướng mắc gì không?&#10;- Kế hoạch công việc ngày mai là gì?"
                rows="15"
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--neutral-border)', outline: 'none', resize: 'vertical', fontSize: '14px', lineHeight: '1.6' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#475569' }}>
                Dự án liên kết (Tùy chọn)
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--neutral-border)', outline: 'none', fontSize: '13.5px', color: '#334155' }}
              >
                <option value="">-- Không liên kết dự án (Báo cáo chung) --</option>
                {projects?.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#475569' }}>
                Tệp đính kèm (Tùy chọn)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <i className="fa-solid fa-paperclip"></i>
                  {uploadingFile ? "Đang tải lên..." : "Chọn tệp"}
                </button>
                {attachedFileName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                    <span style={{ color: '#475569', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {attachedFileName}
                    </span>
                    <button
                      type="button"
                      onClick={handleClearAttachment}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || uploadingFile || !reportContent.trim()}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 16px' }}
            >
              <i className="fa-solid fa-paper-plane"></i>
              {isSubmitting ? "Đang gửi..." : "Gửi Báo Cáo"}
            </button>
          </form>
        </div>

        {/* Right Column: Reports List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: '0 0 4px 0' }}>
            <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>
            Báo cáo đã gửi của bạn
          </h3>

          {/* Reports Content List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isLoading ? (
              <div className="flex-center" style={{ padding: '40px', flexDirection: 'column', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid var(--neutral-border)' }}>
                <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '24px', color: 'var(--primary-color)' }}></i>
                <p style={{ marginTop: '10px', color: 'var(--neutral-muted)', fontSize: '13px' }}>Đang tải báo cáo...</p>
              </div>
            ) : filteredReports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid var(--neutral-border)', color: 'var(--neutral-muted)' }}>
                <i className="fa-solid fa-folder-open" style={{ fontSize: '32px', marginBottom: '8px', display: 'block' }}></i>
                Chưa có báo cáo nào được tìm thấy.
              </div>
            ) : (
              filteredReports.map(report => {
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

                    {report.project_id && (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                          <i className="fa-solid fa-folder" style={{ marginRight: '4px' }}></i>
                          {projects?.find(p => p.id === report.project_id)?.name || 'Dự án liên kết'}
                        </span>
                      </div>
                    )}

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

      </div>
    </div>
  );
}
