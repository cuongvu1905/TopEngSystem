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
  
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [reports, setReports] = useState([]);
  const [reportContent, setReportContent] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [reportDate, setReportDate] = useState(getTodayDateString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // History modal & filters state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  
  // File upload state
  const fileInputRef = useRef(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachedFileName, setAttachedFileName] = useState('');

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
    if (!reportContent.trim() || !selectedProjectId || !currentUser) return;

    try {
      setIsSubmitting(true);
      await db.createDailyReport({
        userId: currentUser.id,
        content: reportContent,
        fileUrl: fileUrl || null,
        projectId: selectedProjectId || null,
        createdAt: reportDate
      });

      setReportContent('');
      setSelectedProjectId('');
      setReportDate(getTodayDateString());
      handleClearAttachment();
      await loadReports();
      Swal.fire({ icon: 'success', title: 'Thành công', text: "Đã gửi báo cáo ngày thành công!" });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi gửi báo cáo: " + err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter reports to only show current user's reports
  const myReports = reports.filter(r => r.user_id === currentUser?.id);

  // Apply Date filters
  const reportsFilteredByDate = myReports.filter(report => {
    const reportDate = new Date(report.created_at);
    reportDate.setHours(0, 0, 0, 0);
    
    if (startDateFilter) {
      const start = new Date(startDateFilter);
      start.setHours(0, 0, 0, 0);
      if (reportDate < start) return false;
    }
    if (endDateFilter) {
      const end = new Date(endDateFilter);
      end.setHours(0, 0, 0, 0);
      if (reportDate > end) return false;
    }
    return true;
  });

  if (!currentUser) {
    return (
      <div className="flex-center" style={{ height: '70vh', flexDirection: 'column' }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '32px', color: 'var(--primary-color)' }}></i>
        <p style={{ marginTop: '12px', color: 'var(--neutral-muted)' }}>Vui lòng đăng nhập...</p>
      </div>
    );
  }

  return (
    <div className="scrollable-view">
      {/* Header section with Trigger Button */}
      <div className="page-header" style={{ marginBottom: '24px', borderBottom: '1px solid var(--neutral-border)', paddingBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--neutral-dark)' }}>
            <i className="fa-solid fa-file-invoice" style={{ marginRight: '10px', color: 'var(--primary-color)' }}></i>
            Báo Cáo Hàng Ngày
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--neutral-muted)', marginTop: '4px' }}>
            Gửi báo cáo tiến độ công việc hàng ngày và quản lý danh sách báo cáo của cá nhân.
          </p>
        </div>
        <div>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={() => setIsHistoryOpen(true)}
            style={{ 
              backgroundColor: '#fff', 
              color: '#334155', 
              border: '1px solid #cbd5e1', 
              padding: '10px 18px', 
              borderRadius: '6px', 
              fontSize: '13.5px', 
              fontWeight: '600', 
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <i className="fa-solid fa-clock-rotate-left"></i> Lịch sử báo cáo đã gửi
          </button>
        </div>
      </div>

      {/* Main write daily report form centered */}
      <div style={{ width: '100%', maxWidth: '100%', margin: '0 auto' }}>
        <div className="card" style={{ padding: '24px', borderRadius: '8px', border: '1px solid var(--neutral-border)', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-pen-nib" style={{ color: 'var(--primary-color)' }}></i>
              Viết báo cáo
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--neutral-muted)' }}>Ngày báo cáo:</span>
              <input 
                type="date" 
                value={reportDate} 
                onChange={(e) => setReportDate(e.target.value)} 
                style={{ 
                  padding: '6px 12px', 
                  borderRadius: '6px', 
                  border: '1px solid var(--neutral-border)', 
                  outline: 'none', 
                  fontSize: '13px', 
                  fontWeight: '500',
                  color: '#334155'
                }} 
              />
            </div>
          </div>
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
                rows="12"
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--neutral-border)', outline: 'none', resize: 'vertical', fontSize: '14px', lineHeight: '1.6' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#475569' }}>
                Dự án liên kết <span style={{ color: 'red' }}>*</span>
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                required
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--neutral-border)', outline: 'none', fontSize: '13.5px', color: '#334155' }}
              >
                <option value="">-- Chọn dự án liên kết --</option>
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
                    <span style={{ color: '#475569', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
      </div>

      {/* History Modal Popup (75% Width, 75% Height) */}
      {isHistoryOpen && (
        <div 
          className="modal show" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            backgroundColor: 'rgba(15, 23, 42, 0.6)', 
            backdropFilter: 'blur(4px)', 
            zIndex: 1000,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
          }} 
          onClick={() => setIsHistoryOpen(false)}
        >
          <div 
            style={{ 
              width: '75vw', 
              height: '75vh', 
              backgroundColor: '#ffffff', 
              border: '1.5px solid #cbd5e1', 
              borderRadius: '12px', 
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden' 
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--primary-color)' }}></i> Lịch sử báo cáo đã gửi
              </h3>
              <button 
                type="button" 
                onClick={() => setIsHistoryOpen(false)} 
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Date Filters Row */}
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Từ ngày:</label>
                <input 
                  type="date" 
                  value={startDateFilter} 
                  onChange={(e) => setStartDateFilter(e.target.value)} 
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} 
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Đến ngày:</label>
                <input 
                  type="date" 
                  value={endDateFilter} 
                  onChange={(e) => setEndDateFilter(e.target.value)} 
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} 
                />
              </div>
              {(startDateFilter || endDateFilter) && (
                <button 
                  type="button" 
                  onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }}
                  style={{ 
                    padding: '6px 12px', 
                    borderRadius: '6px', 
                    border: 'none', 
                    backgroundColor: '#fee2e2', 
                    color: '#ef4444', 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <i className="fa-solid fa-trash-can"></i> Xóa bộ lọc
                </button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>
                Tìm thấy <strong>{reportsFilteredByDate.length}</strong> báo cáo của bạn
              </span>
            </div>

            {/* Modal Body (Scrollable Grid of Cards) */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', backgroundColor: '#f1f5f9' }}>
              {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                  <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '32px', marginBottom: '12px', color: 'var(--primary-color)' }}></i>
                  <p style={{ fontSize: '14px', margin: 0 }}>Đang tải dữ liệu...</p>
                </div>
              ) : reportsFilteredByDate.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                  <i className="fa-solid fa-folder-open" style={{ fontSize: '48px', marginBottom: '12px', color: '#94a3b8' }}></i>
                  <p style={{ fontSize: '14px', margin: 0 }}>Không tìm thấy báo cáo nào trong khoảng thời gian này.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {reportsFilteredByDate.map(report => {
                    const userColor = users.find(u => u.id === report.user_id)?.color || '#3b82f6';
                    const proj = projects.find(p => p.id === report.project_id);
                    
                    return (
                      <div 
                        key={report.id} 
                        style={{ 
                          border: '1.5px solid #e2e8f0', 
                          borderRadius: '8px', 
                          padding: '16px', 
                          background: '#ffffff', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '12px', 
                          cursor: 'pointer', 
                          transition: 'all 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}
                        onClick={async () => {
                          const SwalInstance = await getSwal();
                          const isPending = report.status === 'Pending' || report.status === 'pending' || (report.status !== 'Approved' && report.status !== 'Rejected');
                          
                          const result = await SwalInstance.fire({
                            title: 'Chi tiết báo cáo ngày',
                            html: `
                              <div style="text-align: left; font-size: 14px; line-height: 1.6; color: #334155;">
                                <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
                                  <span>Thời gian: <strong>${new Date(report.created_at).toLocaleString('vi-VN')}</strong></span>
                                  <span>Trạng thái: <strong>${report.status === 'Approved' ? 'Đã duyệt' : report.status === 'Rejected' ? 'Từ chối' : 'Chờ duyệt'}</strong></span>
                                </div>
                                ${report.project_id ? `<div style="margin-bottom: 12px;"><span style="background-color: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">Dự án: ${proj?.name || 'Liên kết'}</span></div>` : ''}
                                <textarea id="swal-report-content" style="width: 100%; min-height: 250px; background-color: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-family: inherit; font-size: 13.5px; line-height: 1.6; outline: none; resize: vertical; box-sizing: border-box;" ${isPending ? '' : 'readonly'}>${report.content}</textarea>
                                ${report.file_url ? `<div style="margin-top: 12px;"><a href="${report.file_url}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 600;"><i class="fa-solid fa-paperclip"></i> Tệp đính kèm tài liệu</a></div>` : ''}
                              </div>
                            `,
                            width: '600px',
                            showConfirmButton: isPending,
                            confirmButtonText: 'Lưu thay đổi',
                            confirmButtonColor: '#94a3b8', // Default grey/inactive
                            showDenyButton: true,
                            denyButtonText: 'Đóng',
                            denyButtonColor: 'var(--primary-color)',
                            didOpen: () => {
                              const textarea = document.getElementById('swal-report-content');
                              const confirmBtn = SwalInstance.getConfirmButton();
                              
                              if (isPending && textarea && confirmBtn) {
                                // Initialize Save button as disabled
                                confirmBtn.disabled = true;
                                confirmBtn.style.opacity = '0.5';
                                confirmBtn.style.cursor = 'not-allowed';
                                confirmBtn.style.backgroundColor = '#94a3b8';
                                
                                const originalValue = report.content;
                                
                                const checkChange = () => {
                                  const currentValue = textarea.value;
                                  if (currentValue !== originalValue && currentValue.trim().length > 0) {
                                    confirmBtn.disabled = false;
                                    confirmBtn.style.opacity = '1';
                                    confirmBtn.style.cursor = 'pointer';
                                    confirmBtn.style.backgroundColor = '#10b981'; // Active Green color
                                  } else {
                                    confirmBtn.disabled = true;
                                    confirmBtn.style.opacity = '0.5';
                                    confirmBtn.style.cursor = 'not-allowed';
                                    confirmBtn.style.backgroundColor = '#94a3b8';
                                  }
                                };
                                
                                textarea.addEventListener('input', checkChange);
                              }
                            }
                          });

                          if (result.isConfirmed && isPending) {
                            const newContent = document.getElementById('swal-report-content')?.value;
                            if (newContent && newContent.trim()) {
                              try {
                                await db.updateDailyReport(report.id, newContent, report.file_url, report.project_id);
                                await loadReports();
                                SwalInstance.fire({
                                  icon: 'success',
                                  title: 'Thành công',
                                  text: 'Đã cập nhật nội dung báo cáo!'
                                });
                              } catch (err) {
                                SwalInstance.fire({
                                  icon: 'error',
                                  title: 'Thất bại',
                                  text: 'Lỗi cập nhật: ' + err.message
                                });
                              }
                            }
                          }
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                          e.currentTarget.style.borderColor = 'var(--primary-color)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                          e.currentTarget.style.borderColor = '#e2e8f0';
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: userColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px' }}>
                              {report.user_name.split(' ').pop().charAt(0)}
                            </div>
                            <div>
                              <h4 style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b', margin: 0 }}>{report.user_name}</h4>
                              <span style={{ fontSize: '9px', color: 'var(--neutral-muted)', display: 'block', marginTop: '-2px' }}>{report.user_role}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                            <span style={{ fontSize: '9.5px', color: 'var(--neutral-muted)' }}>
                              {new Date(report.created_at).toLocaleDateString('vi-VN')}
                            </span>
                            <span style={{ 
                              fontSize: '9px', 
                              color: report.status === 'Approved' ? 'var(--success-color)' : report.status === 'Rejected' ? 'var(--danger-color)' : 'var(--warning-color)', 
                              fontWeight: 'bold' 
                            }}>
                              {report.status === 'Approved' ? 'Đã duyệt' : report.status === 'Rejected' ? 'Từ chối' : 'Chờ duyệt'}
                            </span>
                          </div>
                        </div>

                        {report.project_id && (
                          <span style={{ display: 'inline-block', alignSelf: 'flex-start', fontSize: '9.5px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '8px', fontWeight: '600', marginTop: '2px' }}>
                            {proj?.name || 'Dự án'}
                          </span>
                        )}

                        <div 
                          style={{ 
                            fontSize: '12px', 
                            color: '#475569', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            display: '-webkit-box', 
                            WebkitLineClamp: 3, 
                            WebkitBoxOrient: 'vertical', 
                            lineHeight: '1.5',
                            marginTop: '4px' 
                          }}
                        >
                          {report.content}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {report.file_url ? <><i className="fa-solid fa-paperclip"></i> Có đính kèm</> : 'Không có đính kèm'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
