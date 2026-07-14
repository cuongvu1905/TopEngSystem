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

const getReportSnippet = (content) => {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.map(c => `[${c.startTime}-${c.endTime}] ${c.content}`).join(' | ');
    }
  } catch (e) {}
  return content;
};

const formatDateToYMD = (dateVal) => {
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatReportContentHtml = (content, projects) => {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      const cardsHtml = parsed.map((card, idx) => {
        const projName = projects?.find(p => p.id === card.projectId)?.name || 'Dự án';
        const fileHtml = card.fileUrl 
          ? `<div style="margin-top: 6px;"><a href="${card.fileUrl}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 600; font-size: 12px;"><i class="fa-solid fa-paperclip"></i> ${card.fileName || 'Tệp đính kèm'}</a></div>`
          : '';
        return `
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 12px; background-color: #f8fafc; text-align: left; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px;">
              <span style="font-size: 11.5px; font-weight: 700; color: #0f766e; background-color: #ccfbf1; padding: 2px 6px; border-radius: 4px;">
                <i class="fa-regular fa-clock"></i> ${card.startTime} - ${card.endTime}
              </span>
              <span style="font-size: 11px; font-weight: 600; background-color: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px;">
                ${projName}
              </span>
            </div>
            <div style="font-size: 13px; color: #334155; white-space: pre-wrap; line-height: 1.5;">${card.content}</div>
            ${fileHtml}
          </div>
        `;
      }).join('');
      return `<div style="max-height: 400px; overflow-y: auto;">${cardsHtml}</div>`;
    }
  } catch (e) {}

  return `<div style="text-align: left; background-color: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #cbd5e1; white-space: pre-wrap; font-size: 13.5px; line-height: 1.6;">${content}</div>`;
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
  const [reportCards, setReportCards] = useState([
    {
      id: 'card-1',
      content: '',
      startTime: '08:00',
      endTime: '12:00',
      projectId: '',
      fileUrl: '',
      fileName: ''
    }
  ]);
  const [editingReportId, setEditingReportId] = useState(null);
  const [reportDate, setReportDate] = useState(getTodayDateString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const updateCardField = (cardId, field, value) => {
    setReportCards(prev => prev.map(c => {
      if (c.id === cardId) {
        return { ...c, [field]: value };
      }
      return c;
    }));
  };

  const handleTimeBlur = (cardId, field, val) => {
    if (!val) return;
    let formatted = val.trim();
    
    // Remove spaces
    formatted = formatted.replace(/\s+/g, '');
    
    // Match H:MM or HH:MM
    const matchHm = formatted.match(/^(\d{1,2}):(\d{2})$/);
    if (matchHm) {
      const hours = String(Number(matchHm[1])).padStart(2, '0');
      const minutes = matchHm[2];
      if (Number(hours) < 24 && Number(minutes) < 60) {
        updateCardField(cardId, field, `${hours}:${minutes}`);
        return;
      }
    }
    
    // Match single hour like H or HH
    const matchH = formatted.match(/^(\d{1,2})$/);
    if (matchH) {
      const hours = String(Number(matchH[1])).padStart(2, '0');
      if (Number(hours) < 24) {
        updateCardField(cardId, field, `${hours}:00`);
        return;
      }
    }

    // Match 3 or 4 digits like 800 or 1430
    const matchDigits = formatted.match(/^(\d{3,4})$/);
    if (matchDigits) {
      const len = matchDigits[1].length;
      const hours = String(Number(matchDigits[1].substring(0, len - 2))).padStart(2, '0');
      const minutes = matchDigits[1].substring(len - 2);
      if (Number(hours) < 24 && Number(minutes) < 60) {
        updateCardField(cardId, field, `${hours}:${minutes}`);
        return;
      }
    }
  };

  const handleAddReportCard = () => {
    let nextStart = '08:00';
    let nextEnd = '12:00';
    if (reportCards.length > 0) {
      const lastCard = reportCards[reportCards.length - 1];
      nextStart = lastCard.endTime || '08:00';
      const [hours, minutes] = nextStart.split(':').map(Number);
      const endHours = Math.min(hours + 4, 23);
      nextEnd = `${String(endHours).padStart(2, '0')}:${String(minutes || 0).padStart(2, '0')}`;
    }
    setReportCards(prev => [
      ...prev,
      {
        id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        content: '',
        startTime: nextStart,
        endTime: nextEnd,
        projectId: '',
        fileUrl: '',
        fileName: ''
      }
    ]);
  };

  const handleCardFileUpload = async (cardId, file) => {
    if (!file) return;
    try {
      const res = await db.uploadFile(file);
      setReportCards(prev => prev.map(c => {
        if (c.id === cardId) {
          return { ...c, fileUrl: res.fileUrl, fileName: file.name };
        }
        return c;
      }));
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi tải tệp: " + err.message });
    }
  };

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
        setReportCards(prev => prev.map((c, i) => i === 0 ? { ...c, projectId: projectIdParam } : c));
      }
    }
  }, [currentUser]);

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    if (reportCards.some(c => !c.content.trim() || !c.projectId)) {
      Swal.fire({ icon: 'warning', title: 'Cảnh báo', text: 'Vui lòng điền đầy đủ nội dung và chọn dự án cho tất cả các thẻ báo cáo!' });
      return;
    }

    try {
      setIsSubmitting(true);
      const serializedContent = JSON.stringify(reportCards);
      const firstProjectId = reportCards[0]?.projectId || null;

      if (editingReportId) {
        await db.updateDailyReport(editingReportId, serializedContent, null, firstProjectId);
        Swal.fire({ icon: 'success', title: 'Thành công', text: "Đã cập nhật báo cáo ngày thành công!" });
        setEditingReportId(null);
      } else {
        await db.createDailyReport({
          userId: currentUser.id,
          content: serializedContent,
          fileUrl: null,
          projectId: firstProjectId,
          createdAt: reportDate
        });
        Swal.fire({ icon: 'success', title: 'Thành công', text: "Đã gửi báo cáo ngày thành công!" });
      }

      setReportCards([
        {
          id: 'card-1',
          content: '',
          startTime: '08:00',
          endTime: '12:00',
          projectId: '',
          fileUrl: '',
          fileName: ''
        }
      ]);
      setReportDate(getTodayDateString());
      await loadReports();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi lưu báo cáo: " + err.message });
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
              {reportCards.map((card, index) => (
                <div 
                  key={card.id} 
                  style={{ 
                    border: '1.5px solid #0f172a', 
                    borderRadius: '4px', 
                    padding: '20px', 
                    position: 'relative',
                    backgroundColor: '#fff',
                    display: 'flex',
                    gap: '24px'
                  }}
                >
                  {/* Remove Card button */}
                  {reportCards.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setReportCards(prev => prev.filter(c => c.id !== card.id))}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '8px',
                        border: 'none',
                        background: 'none',
                        color: '#ef4444',
                        fontSize: '20px',
                        cursor: 'pointer',
                        padding: '0 4px',
                        fontWeight: 'bold'
                      }}
                      title="Xóa thẻ báo cáo này"
                    >
                      &times;
                    </button>
                  )}

                  {/* Left Column: Content Textarea */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ display: 'block', fontSize: '14.5px', fontWeight: '600', color: '#1e293b' }}>
                      Nội dung <span style={{ color: 'red' }}>*</span>
                    </label>
                    <textarea
                      value={card.content}
                      onChange={(e) => updateCardField(card.id, 'content', e.target.value)}
                      required
                      placeholder="Nhập nội dung báo cáo trong khung giờ này..."
                      rows="6"
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        borderRadius: '4px', 
                        border: '1px solid #94a3b8', 
                        outline: 'none', 
                        resize: 'vertical', 
                        fontSize: '14px', 
                        lineHeight: '1.6' 
                      }}
                    />
                  </div>

                  {/* Right Column: Time, Project, File Attachment */}
                  <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Time fields */}
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>
                        Khung giờ:
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          border: '1px solid #0f172a', 
                          borderRadius: '4px', 
                          padding: '0 8px',
                          backgroundColor: '#fff',
                          flex: 1
                        }}>
                          <input
                            type="text"
                            list="time-options"
                            placeholder="08:00"
                            pattern="^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$"
                            title="Định dạng 24h (HH:mm), ví dụ: 08:30 hoặc 14:00"
                            value={card.startTime}
                            onChange={(e) => updateCardField(card.id, 'startTime', e.target.value)}
                            onBlur={(e) => handleTimeBlur(card.id, 'startTime', e.target.value)}
                            required
                            style={{ 
                              padding: '8px 4px', 
                              border: 'none', 
                              fontSize: '13.5px', 
                              outline: 'none',
                              textAlign: 'center',
                              width: '100%',
                              backgroundColor: 'transparent'
                            }}
                          />
                          <i className="fa-regular fa-clock" style={{ color: '#64748b', fontSize: '14px', pointerEvents: 'none' }}></i>
                        </div>
                        <span style={{ fontWeight: '600' }}>-</span>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          border: '1px solid #0f172a', 
                          borderRadius: '4px', 
                          padding: '0 8px',
                          backgroundColor: '#fff',
                          flex: 1
                        }}>
                          <input
                            type="text"
                            list="time-options"
                            placeholder="12:00"
                            pattern="^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$"
                            title="Định dạng 24h (HH:mm), ví dụ: 08:30 hoặc 14:00"
                            value={card.endTime}
                            onChange={(e) => updateCardField(card.id, 'endTime', e.target.value)}
                            onBlur={(e) => handleTimeBlur(card.id, 'endTime', e.target.value)}
                            required
                            style={{ 
                              padding: '8px 4px', 
                              border: 'none', 
                              fontSize: '13.5px', 
                              outline: 'none',
                              textAlign: 'center',
                              width: '100%',
                              backgroundColor: 'transparent'
                            }}
                          />
                          <i className="fa-regular fa-clock" style={{ color: '#64748b', fontSize: '14px', pointerEvents: 'none' }}></i>
                        </div>
                      </div>
                    </div>

                    {/* Project select */}
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>
                        Chọn dự án <span style={{ color: 'red' }}>*</span>
                      </label>
                      <select
                        value={card.projectId}
                        onChange={(e) => updateCardField(card.id, 'projectId', e.target.value)}
                        required
                        style={{ 
                          width: '100%', 
                          padding: '10px', 
                          borderRadius: '4px', 
                          border: '1px solid #0f172a', 
                          outline: 'none', 
                          fontSize: '13.5px', 
                          color: '#334155' 
                        }}
                      >
                        <option value="">-- Chọn dự án --</option>
                        {projects?.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* File Attachment */}
                    <div>
                      <input
                        type="file"
                        id={`card-file-input-${card.id}`}
                        style={{ display: 'none' }}
                        onChange={(e) => handleCardFileUpload(card.id, e.target.files[0])}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => document.getElementById(`card-file-input-${card.id}`).click()}
                          style={{ 
                            padding: '8px 16px', 
                            fontSize: '13px',
                            border: '1px solid #0f172a',
                            borderRadius: '4px',
                            backgroundColor: '#fff',
                            color: '#0f172a',
                            cursor: 'pointer',
                            fontWeight: '600'
                          }}
                        >
                          Chọn Tệp
                        </button>
                        {card.fileName && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                            <span style={{ color: '#475569', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {card.fileName}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setReportCards(prev => prev.map(c => {
                                  if (c.id === card.id) {
                                    return { ...c, fileUrl: '', fileName: '' };
                                  }
                                  return c;
                                }));
                              }}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: '14px', fontWeight: 'bold' }}
                            >
                              &times;
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>

            {/* Add Card Plus button */}
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '24px' }}>
              <button
                type="button"
                onClick={handleAddReportCard}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: '#0f766e',
                  color: '#fff',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
                title="Thêm thẻ báo cáo giờ mới"
              >
                +
              </button>
            </div>

            {/* Submit / Cancel Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              {editingReportId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingReportId(null);
                    setReportCards([
                      {
                        id: 'card-1',
                        content: '',
                        startTime: '08:00',
                        endTime: '12:00',
                        projectId: '',
                        fileUrl: '',
                        fileName: ''
                      }
                    ]);
                    setReportDate(getTodayDateString());
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '12px 16px' }}
                >
                  Hủy Sửa
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || reportCards.some(c => !c.content.trim() || !c.projectId)}
                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 16px', fontWeight: '700' }}
              >
                <i className="fa-solid fa-paper-plane"></i>
                {isSubmitting ? "Đang xử lý..." : editingReportId ? "Cập Nhật Báo Cáo" : "Gửi Báo Cáo"}
              </button>
            </div>
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
                          
                          const isJsonReport = (() => {
                            try {
                              return Array.isArray(JSON.parse(report.content));
                            } catch (e) { return false; }
                          })();

                          const htmlContent = isJsonReport
                            ? `<div style="text-align: left; font-size: 14px; line-height: 1.6; color: #334155;">
                                 <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
                                   <span>Thời gian: <strong>${new Date(report.created_at).toLocaleString('vi-VN')}</strong></span>
                                   <span>Trạng thái: <strong>${report.status === 'Approved' ? 'Đã duyệt' : report.status === 'Rejected' ? 'Từ chối' : 'Chờ duyệt'}</strong></span>
                                 </div>
                                 ${formatReportContentHtml(report.content, projects)}
                               </div>`
                            : `<div style="text-align: left; font-size: 14px; line-height: 1.6; color: #334155;">
                                 <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
                                   <span>Thời gian: <strong>${new Date(report.created_at).toLocaleString('vi-VN')}</strong></span>
                                   <span>Trạng thái: <strong>${report.status === 'Approved' ? 'Đã duyệt' : report.status === 'Rejected' ? 'Từ chối' : 'Chờ duyệt'}</strong></span>
                                 </div>
                                 ${report.project_id ? `<div style="margin-bottom: 12px;"><span style="background-color: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">Dự án: ${proj?.name || 'Liên kết'}</span></div>` : ''}
                                 <textarea id="swal-report-content" style="width: 100%; min-height: 250px; background-color: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-family: inherit; font-size: 13.5px; line-height: 1.6; outline: none; resize: vertical; box-sizing: border-box;" ${isPending ? '' : 'readonly'}>${report.content}</textarea>
                                 ${report.file_url ? `<div style="margin-top: 12px;"><a href="${report.file_url}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 600;"><i class="fa-solid fa-paperclip"></i> Tệp đính kèm tài liệu</a></div>` : ''}
                               </div>`;

                          const result = await SwalInstance.fire({
                            title: 'Chi tiết báo cáo ngày',
                            html: htmlContent,
                            width: '600px',
                            showConfirmButton: isPending,
                            confirmButtonText: isJsonReport ? 'Chỉnh sửa' : 'Lưu thay đổi',
                            showDenyButton: true,
                            denyButtonText: 'Đóng',
                            denyButtonColor: 'var(--primary-color)',
                            didOpen: () => {
                              if (!isJsonReport && isPending) {
                                const textarea = document.getElementById('swal-report-content');
                                const confirmBtn = SwalInstance.getConfirmButton();
                                if (textarea && confirmBtn) {
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
                                      confirmBtn.style.backgroundColor = '#10b981';
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
                            }
                          });

                          if (result.isConfirmed && isPending) {
                            if (isJsonReport) {
                              try {
                                const parsedCards = JSON.parse(report.content);
                                setReportCards(parsedCards);
                                setEditingReportId(report.id);
                                setReportDate(formatDateToYMD(report.created_at));
                                setIsHistoryOpen(false);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                SwalInstance.fire({
                                  icon: 'info',
                                  title: 'Chỉnh sửa báo cáo',
                                  text: 'Đã tải nội dung báo cáo vào khung soạn thảo trên trang chính. Sau khi chỉnh sửa xong, nhấn Cập Nhật Báo Cáo để lưu!',
                                  timer: 3000,
                                  showConfirmButton: false
                                });
                              } catch (e) {
                                SwalInstance.fire({ icon: 'error', title: 'Lỗi', text: 'Không thể tải báo cáo để sửa: ' + e.message });
                              }
                            } else {
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
                          {getReportSnippet(report.content)}
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
      <datalist id="time-options">
        {Array.from({ length: 24 }).map((_, h) => {
          const hh = String(h).padStart(2, '0');
          return (
            <React.Fragment key={h}>
              <option value={`${hh}:00`} />
              <option value={`${hh}:30`} />
            </React.Fragment>
          );
        })}
      </datalist>
    </div>
  );
}
