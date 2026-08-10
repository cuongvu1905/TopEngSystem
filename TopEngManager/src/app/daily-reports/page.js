"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { db } from '@/utils/db';
import { getSwal } from '@/utils/swal';

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

// Default Timeframe per card position: card 1 = morning, card 2 = afternoon,
// card 3 = late afternoon, card 4 = evening. Cards beyond this fall back to
// continuing 3 hours after the previous card's end time.
const DEFAULT_TIME_SLOTS = [
  { startTime: '08:00', endTime: '12:00' },
  { startTime: '13:00', endTime: '17:00' },
  { startTime: '17:00', endTime: '20:00' },
  { startTime: '20:00', endTime: '00:00' }
];

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
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 12px; background-color: var(--neutral-bg-card); text-align: left; box-shadow: 0 1px 2px rgba(0,0,0,0.02); color: var(--neutral-dark);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px dashed var(--neutral-border); padding-bottom: 4px;">
              <span style="font-size: 11.5px; font-weight: 700; color: #0f766e; background-color: #ccfbf1; padding: 2px 6px; border-radius: 4px;">
                <i class="fa-regular fa-clock"></i> ${card.startTime} - ${card.endTime}
              </span>
              <span style="font-size: 11px; font-weight: 600; background-color: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px;">
                ${projName}
              </span>
            </div>
            <div style="font-size: 13px; color: var(--neutral-dark); white-space: pre-wrap; line-height: 1.5;">${card.content}</div>
            ${fileHtml}
          </div>
        `;
      }).join('');
      return `<div style="max-height: 400px; overflow-y: auto;">${cardsHtml}</div>`;
    }
  } catch (e) {}

  return `<div style="text-align: left; background-color: var(--neutral-bg-card); padding: 12px; border-radius: 6px; border: 1px solid var(--neutral-border); white-space: pre-wrap; font-size: 13.5px; line-height: 1.6; color: var(--neutral-dark);">${content}</div>`;
};

export default function DailyReportsPage() {
  const { currentUser, users, projects, projectMembers } = useApp();
  const { t, currentLang } = useLanguage();
  
  const systemRole = currentUser?.system_role || '';
  const isAdminOrManagement = systemRole.includes("Admin") || systemRole.includes("BOD") || systemRole.includes("HR");

  const myProjects = isAdminOrManagement 
    ? projects 
    : projects.filter(p => projectMembers?.some(m => m.project_id === p.id && m.user_id === currentUser?.id));
  
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDefaultReportCards = () => [
    {
      id: 'card-1',
      content: '',
      startTime: DEFAULT_TIME_SLOTS[0].startTime,
      endTime: DEFAULT_TIME_SLOTS[0].endTime,
      projectId: '',
      fileUrl: '',
      fileName: ''
    }
  ];

  const [reports, setReports] = useState([]);
  const [reportCards, setReportCards] = useState(getDefaultReportCards());
  const [editingReportId, setEditingReportId] = useState(null);
  // Tracks the status of the report currently loaded into the composer (null = brand new).
  // Lets "Save Draft" stay hidden while resubmitting a Rejected report, so it can't
  // accidentally leave that report stuck at Draft instead of going back for approval.
  const [editingReportStatus, setEditingReportStatus] = useState(null);
  // No date is pre-selected: the composer starts locked until the user explicitly
  // picks a report date (see the Content textarea's readOnly guard below).
  const [reportDate, setReportDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const updateCardField = (cardId, field, value) => {
    setReportCards(prev => prev.map(c => {
      if (c.id === cardId) {
        return { ...c, [field]: value };
      }
      return c;
    }));
  };

  // The content textarea is readOnly until a report date is picked; focusing it while
  // locked (click or tab) blurs it right back out and nudges the user to pick a date first.
  const handleContentFocusGuard = (e) => {
    if (!reportDate) {
      e.target.blur();
      Swal.fire({ icon: 'warning', title: t('common.warning', 'Cảnh báo'), text: t('reports.selectDateFirstWarning', 'Vui lòng chọn ngày báo cáo trước khi nhập nội dung.') });
    }
  };

  // Which single time-dropdown (if any) is open, keyed as "<cardId>-startTime"/"<cardId>-endTime".
  const [openTimeDropdown, setOpenTimeDropdown] = useState(null);
  // In-progress manual hour/minute typed for the currently open time-dropdown, keyed the same way.
  const [manualTimeDraft, setManualTimeDraft] = useState({});

  useEffect(() => {
    const handleDocClick = (e) => {
      if (!e.target.closest('.time-dropdown-wrapper')) {
        setOpenTimeDropdown(null);
      }
    };
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  const renderTimeDropdown = (card, field) => {
    const key = `${card.id}-${field}`;
    const isOpen = openTimeDropdown === key;
    const [currentHour, currentMinute] = card[field].split(':');
    const draft = manualTimeDraft[key] || { hour: currentHour, minute: currentMinute };

    const applyManualTime = () => {
      const h = String(Math.min(23, Math.max(0, parseInt(draft.hour, 10) || 0))).padStart(2, '0');
      const m = String(Math.min(59, Math.max(0, parseInt(draft.minute, 10) || 0))).padStart(2, '0');
      updateCardField(card.id, field, `${h}:${m}`);
      setOpenTimeDropdown(null);
    };

    return (
      <div className="time-dropdown-wrapper" style={{ position: 'relative', flex: 1 }}>
        <button
          type="button"
          onClick={() => {
            if (!isOpen) {
              setManualTimeDraft(prev => ({ ...prev, [key]: { hour: currentHour, minute: currentMinute } }));
            }
            setOpenTimeDropdown(isOpen ? null : key);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            border: '1px solid var(--neutral-border)',
            borderRadius: '4px',
            padding: '8px',
            backgroundColor: 'var(--neutral-bg-card)',
            color: 'var(--neutral-dark)',
            fontSize: '13.5px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          <i className="fa-regular fa-clock" style={{ color: 'var(--primary-color)', fontSize: '18px' }}></i>
          {card[field]}
        </button>
        {isOpen && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            ...(field === 'endTime' ? { right: 0 } : { left: 0 }),
            minWidth: '220px',
            maxHeight: '280px',
            overflowY: 'auto',
            backgroundColor: 'var(--neutral-bg-card)',
            border: '1px solid var(--neutral-border)',
            borderRadius: '6px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15)',
            zIndex: 20
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderBottom: '1px solid var(--neutral-border)' }}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                value={draft.hour}
                onChange={(e) => setManualTimeDraft(prev => ({ ...prev, [key]: { ...draft, hour: e.target.value.replace(/\D/g, '') } }))}
                onKeyDown={(e) => { if (e.key === 'Enter') applyManualTime(); }}
                style={{ width: '48px', textAlign: 'center', border: '1px solid var(--neutral-border)', borderRadius: '4px', padding: '8px 4px', backgroundColor: 'var(--neutral-bg-card)', color: 'var(--neutral-dark)', fontSize: '17px', fontWeight: '600' }}
              />
              <span style={{ color: 'var(--neutral-dark)', fontWeight: '700', fontSize: '17px' }}>:</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                value={draft.minute}
                onChange={(e) => setManualTimeDraft(prev => ({ ...prev, [key]: { ...draft, minute: e.target.value.replace(/\D/g, '') } }))}
                onKeyDown={(e) => { if (e.key === 'Enter') applyManualTime(); }}
                style={{ width: '48px', textAlign: 'center', border: '1px solid var(--neutral-border)', borderRadius: '4px', padding: '8px 4px', backgroundColor: 'var(--neutral-bg-card)', color: 'var(--neutral-dark)', fontSize: '17px', fontWeight: '600' }}
              />
              <button
                type="button"
                onClick={applyManualTime}
                title={t('common.confirm', 'Xác nhận')}
                style={{ flex: 1, border: 'none', borderRadius: '4px', padding: '8px 10px', backgroundColor: 'var(--primary-color)', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
              >
                <i className="fa-solid fa-check"></i>
              </button>
            </div>
            {HOUR_OPTIONS.map(hour => (
              <button
                type="button"
                key={hour}
                onClick={() => { updateCardField(card.id, field, hour); setOpenTimeDropdown(null); }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'center',
                  padding: '8px',
                  border: 'none',
                  backgroundColor: card[field] === hour ? 'var(--primary-color)' : 'transparent',
                  color: card[field] === hour ? '#fff' : 'var(--neutral-dark)',
                  fontSize: '13px',
                  fontWeight: card[field] === hour ? '700' : '500',
                  cursor: 'pointer'
                }}
              >
                {hour}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleAddReportCard = () => {
    const nextIndex = reportCards.length;
    let nextStart;
    let nextEnd;
    if (nextIndex < DEFAULT_TIME_SLOTS.length) {
      nextStart = DEFAULT_TIME_SLOTS[nextIndex].startTime;
      nextEnd = DEFAULT_TIME_SLOTS[nextIndex].endTime;
    } else {
      const lastCard = reportCards[reportCards.length - 1];
      nextStart = lastCard.endTime || '08:00';
      const [hours, minutes] = nextStart.split(':').map(Number);
      const endHours = Math.min(hours + 3, 23);
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
    if (!currentUser) return [];
    try {
      setIsLoading(true);
      const list = await db.getDailyReports(currentUser.id, currentUser.system_role);
      setReports(list);
      return list;
    } catch (e) {
      console.error("Failed to load reports:", e);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const list = await loadReports();

      // A rejection notification/messagebox link takes priority: load that exact report
      // straight into the composer for editing instead of showing a blank/draft one.
      const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const reportIdParam = searchParams?.get('reportId');
      if (reportIdParam) {
        const target = list.find(r => r.id === parseInt(reportIdParam) && r.user_id === currentUser?.id);
        if (target) {
          try {
            const parsedCards = JSON.parse(target.content);
            setReportCards(parsedCards);
            setEditingReportId(target.id);
            setEditingReportStatus(target.status);
            setReportDate(formatDateToYMD(target.created_at));
            window.scrollTo({ top: 0, behavior: 'smooth' });
            Swal.fire({
              icon: 'info',
              title: t('reports.editReportAlertTitle', 'Chỉnh sửa báo cáo'),
              text: t('reports.editReportAlertText', 'Đã tải nội dung báo cáo vào khung soạn thảo trên trang chính. Sau khi chỉnh sửa xong, nhấn Cập Nhật Báo Cáo để lưu!'),
              timer: 3000,
              showConfirmButton: false
            });
          } catch (e) {
            console.error('Failed to load report into composer:', e);
          }
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
          return;
        }
      }

      // Resume today's in-progress draft, if one exists, instead of showing a blank composer.
      const todaysDraft = list.find(r => r.user_id === currentUser?.id && r.status === 'Draft' && formatDateToYMD(r.created_at) === getTodayDateString());
      if (todaysDraft) {
        try {
          const parsedCards = JSON.parse(todaysDraft.content);
          setReportCards(parsedCards);
          setEditingReportId(todaysDraft.id);
          setEditingReportStatus('Draft');
          setReportDate(formatDateToYMD(todaysDraft.created_at));
        } catch (e) {
          console.error('Failed to load draft into composer:', e);
        }
      }
    })();

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
    if (!reportDate) {
      Swal.fire({ icon: 'warning', title: t('common.warning', 'Cảnh báo'), text: t('reports.selectDateFirstWarning', 'Vui lòng chọn ngày báo cáo trước khi nhập nội dung.') });
      return;
    }
    if (reportCards.some(c => !c.content.trim())) {
      Swal.fire({ icon: 'warning', title: t('common.warning', 'Cảnh báo'), text: t('report.incompleteCardsWarning', 'Vui lòng điền đầy đủ nội dung và chọn dự án cho tất cả các thẻ báo cáo!') });
      return;
    }
    if (reportCards.some(c => !c.projectId)) {
      Swal.fire({ icon: 'warning', title: t('report.projectNotSelectedTitle', 'Chưa chọn dự án'), text: t('report.projectNotSelectedText', 'Vui lòng chọn dự án cho tất cả các thẻ báo cáo trước khi gửi.') });
      return;
    }

    try {
      setIsSubmitting(true);
      const serializedContent = JSON.stringify(reportCards);
      const firstProjectId = reportCards[0]?.projectId || null;

      if (editingReportId) {
        await db.updateDailyReport(editingReportId, serializedContent, null, firstProjectId, reportDate, 'Pending');
        Swal.fire({ icon: 'success', title: t('common.success', 'Thành công'), text: t('report.updateSuccessText', 'Đã cập nhật báo cáo ngày thành công!') });
        setEditingReportId(null);
        setEditingReportStatus(null);
      } else {
        await db.createDailyReport({
          userId: currentUser.id,
          content: serializedContent,
          fileUrl: null,
          projectId: firstProjectId,
          createdAt: reportDate
        });
        Swal.fire({ icon: 'success', title: t('common.success', 'Thành công'), text: t('report.submitSuccessText', 'Đã gửi báo cáo ngày thành công!') });
      }

      setReportCards(getDefaultReportCards());
      setReportDate('');
      await loadReports();
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: t('report.saveErrorText', 'Lỗi lưu báo cáo: ') + err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Saves the composer's current state without submitting it for approval, so the user
  // can come back and keep writing across multiple sessions during the day. Reuses
  // editingReportId as the pointer to the same Draft row across repeated saves.
  const handleSaveDraft = async () => {
    if (!currentUser) return;
    if (!reportDate) {
      Swal.fire({ icon: 'warning', title: t('common.warning', 'Cảnh báo'), text: t('reports.selectDateFirstWarning', 'Vui lòng chọn ngày báo cáo trước khi nhập nội dung.') });
      return;
    }
    if (reportCards.every(c => !c.content.trim())) {
      Swal.fire({ icon: 'warning', title: t('common.warning', 'Cảnh báo'), text: t('report.draftEmptyWarning', 'Vui lòng nhập ít nhất một nội dung trước khi lưu tạm thời.') });
      return;
    }

    try {
      setIsSavingDraft(true);
      const serializedContent = JSON.stringify(reportCards);
      const firstProjectId = reportCards[0]?.projectId || null;

      if (editingReportId) {
        await db.updateDailyReport(editingReportId, serializedContent, null, firstProjectId, reportDate);
      } else {
        const result = await db.createDailyReport({
          userId: currentUser.id,
          content: serializedContent,
          fileUrl: null,
          projectId: firstProjectId,
          createdAt: reportDate,
          status: 'Draft'
        });
        if (result?.report?.id) {
          setEditingReportId(result.report.id);
          setEditingReportStatus('Draft');
        }
      }

      Swal.fire({ icon: 'success', title: t('common.success', 'Thành công'), text: t('report.draftSaveSuccessText', 'Đã lưu tạm thời báo cáo!'), timer: 1500, showConfirmButton: false });
      await loadReports();
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: t('report.saveErrorText', 'Lỗi lưu báo cáo: ') + err.message });
    } finally {
      setIsSavingDraft(false);
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

  // Shared "report detail" popup: opened both from a History card click and from
  // clicking a green (already-reported) day in the Report Status calendar below.
  const showReportDetailPopup = async (report) => {
    const SwalInstance = await getSwal();
    const proj = projects.find(p => p.id === report.project_id);
    const isEditable = report.status === 'Pending' || report.status === 'pending' || report.status === 'Rejected' || (report.status !== 'Approved' && report.status !== 'Rejected');

    const isJsonReport = (() => {
      try {
        return Array.isArray(JSON.parse(report.content));
      } catch (e) { return false; }
    })();

    const formattedDate = new Date(report.created_at).toLocaleDateString(currentLang === 'vi' ? 'vi-VN' : 'en-US');
    const statusText = report.status === 'Approved'
      ? t('report.approvedStatus', 'Đã duyệt')
      : report.status === 'Rejected'
        ? t('report.rejectedStatus', 'Từ chối')
        : report.status === 'Draft'
          ? t('report.draftStatus', 'Nháp')
          : 'Pending'; // Always Pending in English

    const feedbackLabel = report.reviewer_name
      ? t('reports.managerFeedbackLabelNamed', 'Ý kiến phản hồi từ quản lý({name}):').replace('{name}', report.reviewer_name)
      : t('reports.managerFeedbackLabel', 'Ý kiến phản hồi từ quản lý:');

    const rejectionCommentHtml = (report.status === 'Rejected' && report.comment)
      ? `<div style="margin-bottom: 12px; padding: 10px 12px; background-color: #fef2f2; border: 1px dashed #fca5a5; border-radius: 6px;">
           <strong style="font-size: 12.5px; color: #b91c1c; display: block; margin-bottom: 4px;">${feedbackLabel}</strong>
           <span style="font-size: 13px; color: #7f1d1d; white-space: pre-wrap;">${report.comment}</span>
         </div>`
      : '';

    const htmlContent = isJsonReport
      ? `<div style="text-align: left; font-size: 14px; line-height: 1.6; color: var(--neutral-dark);">
           <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--neutral-border); display: flex; justify-content: space-between;">
             <span>${t('report.timeLabel', 'Thời gian:')} <strong>${formattedDate}</strong></span>
             <span>${t('report.statusLabel', 'Trạng thái:')} <strong>${statusText}</strong></span>
           </div>
           ${rejectionCommentHtml}
           ${formatReportContentHtml(report.content, projects)}
         </div>`
      : `<div style="text-align: left; font-size: 14px; line-height: 1.6; color: var(--neutral-dark);">
           <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--neutral-border); display: flex; justify-content: space-between;">
             <span>${t('report.timeLabel', 'Thời gian:')} <strong>${formattedDate}</strong></span>
             <span>${t('report.statusLabel', 'Trạng thái:')} <strong>${statusText}</strong></span>
           </div>
           ${rejectionCommentHtml}
           ${report.project_id ? `<div style="margin-bottom: 12px;"><span style="background-color: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">Dự án: ${proj?.name || 'Liên kết'}</span></div>` : ''}
           <textarea id="swal-report-content" style="width: 100%; min-height: 250px; background-color: var(--neutral-bg-main); color: var(--neutral-dark); padding: 12px; border-radius: 6px; border: 1px solid var(--neutral-border); font-family: inherit; font-size: 13.5px; line-height: 1.6; outline: none; resize: vertical; box-sizing: border-box;" ${isEditable ? '' : 'readonly'}>${report.content}</textarea>
           ${report.file_url ? `<div style="margin-top: 12px;"><a href="${report.file_url}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 600;"><i class="fa-solid fa-paperclip"></i> Tệp đính kèm tài liệu</a></div>` : ''}
         </div>`;

    const result = await SwalInstance.fire({
      title: t('dashboard.dailyReportDetail', 'Chi tiết báo cáo ngày'),
      html: htmlContent,
      width: '600px',
      showConfirmButton: isEditable,
      confirmButtonText: isJsonReport ? t('common.edit', 'Chỉnh sửa') : t('common.saveChanges', 'Lưu thay đổi'),
      showDenyButton: true,
      denyButtonText: t('common.close', 'Đóng'),
      denyButtonColor: 'var(--primary-color)',
      didOpen: () => {
        if (!isJsonReport && isEditable) {
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

    if (result.isConfirmed && isEditable) {
      if (isJsonReport) {
        try {
          const parsedCards = JSON.parse(report.content);
          setReportCards(parsedCards);
          setEditingReportId(report.id);
          setEditingReportStatus(report.status);
          setReportDate(formatDateToYMD(report.created_at));
          setIsHistoryOpen(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          SwalInstance.fire({
            icon: 'info',
            title: t('reports.editReportAlertTitle', 'Chỉnh sửa báo cáo'),
            text: t('reports.editReportAlertText', 'Đã tải nội dung báo cáo vào khung soạn thảo trên trang chính. Sau khi chỉnh sửa xong, nhấn Cập Nhật Báo Cáo để lưu!'),
            timer: 3000,
            showConfirmButton: false
          });
        } catch (e) {
          SwalInstance.fire({ icon: 'error', title: t('common.error', 'Lỗi'), text: t('report.loadErrorText', 'Không thể tải báo cáo để sửa: ') + e.message });
        }
      } else {
        const newContent = document.getElementById('swal-report-content')?.value;
        if (newContent && newContent.trim()) {
          try {
            await db.updateDailyReport(report.id, newContent, report.file_url, report.project_id);
            await loadReports();
            SwalInstance.fire({
              icon: 'success',
              title: t('common.success', 'Thành công'),
              text: t('report.updateSuccessText', 'Đã cập nhật nội dung báo cáo!')
            });
          } catch (err) {
            SwalInstance.fire({
              icon: 'error',
              title: t('common.failed', 'Thất bại'),
              text: t('report.updateFailedText', 'Lỗi cập nhật: ') + err.message
            });
          }
        }
      }
    }
  };

  // --- Report Status calendar (monthly view of missing/reported days) ---
  const [isStatusCalendarOpen, setIsStatusCalendarOpen] = useState(false);
  const [calendarMonthCursor, setCalendarMonthCursor] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() }; // month is 0-indexed
  });

  const findReportForDate = (dateStr) => myReports.find(r => formatDateToYMD(r.created_at) === dateStr);

  const handleSelectMissingDay = (dateStr) => {
    if (dateStr > getTodayDateString()) {
      Swal.fire({ icon: 'warning', title: t('common.warning', 'Cảnh báo'), text: t('reports.futureDateNotAllowedWarning', 'Không được chọn ngày trong tương lai. Chỉ có thể chọn ngày hôm nay hoặc trước đó.') });
      return;
    }
    setReportCards(getDefaultReportCards());
    setEditingReportId(null);
    setEditingReportStatus(null);
    setReportDate(dateStr);
    setIsStatusCalendarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectReportedDay = (report) => {
    setIsStatusCalendarOpen(false);
    showReportDetailPopup(report);
  };

  const changeCalendarMonth = (delta) => {
    setCalendarMonthCursor(prev => {
      let month = prev.month + delta;
      let year = prev.year;
      if (month < 0) { month = 11; year -= 1; }
      else if (month > 11) { month = 0; year += 1; }
      return { year, month };
    });
  };

  const buildCalendarWeeks = () => {
    const { year, month } = calendarMonthCursor;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // JS getDay(): Sun=0..Sat=6 → convert to Mon=0..Sun=6 to match the Mon-first header.
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

    const cells = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  };

  const todayDateStr = getTodayDateString();

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
            {t('reports.title', 'Báo Cáo Hàng Ngày')}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--neutral-muted)', marginTop: '4px' }}>
            {t('reports.subtitle', 'Gửi báo cáo tiến độ công việc hàng ngày và quản lý danh sách báo cáo của cá nhân.')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsStatusCalendarOpen(true)}
            style={{
              backgroundColor: 'var(--neutral-bg-card)',
              color: 'var(--neutral-dark)',
              border: '1px solid var(--neutral-border)',
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
            <i className="fa-solid fa-calendar-days"></i> {t('reports.statusCalendar', 'Trạng thái báo cáo')}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsHistoryOpen(true)}
            style={{
              backgroundColor: 'var(--neutral-bg-card)',
              color: 'var(--neutral-dark)',
              border: '1px solid var(--neutral-border)',
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
            <i className="fa-solid fa-clock-rotate-left"></i> {t('reports.history', 'Lịch sử báo cáo đã gửi')}
          </button>
        </div>
      </div>

      {/* Main write daily report form centered */}
      <div style={{ width: '100%', maxWidth: '100%', margin: '0 auto' }}>
        <div className="card" style={{ padding: '24px', borderRadius: '8px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--neutral-dark)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-pen-nib" style={{ color: 'var(--primary-color)' }}></i>
              {t('reports.createDailyReport', 'Viết báo cáo')}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--neutral-muted)' }}>{t('reports.reportDate', 'Ngày báo cáo:')}</span>
              <input
                type="date"
                value={reportDate}
                max={getTodayDateString()}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && val > getTodayDateString()) {
                    Swal.fire({ icon: 'warning', title: t('common.warning', 'Cảnh báo'), text: t('reports.futureDateNotAllowedWarning', 'Không được chọn ngày trong tương lai. Chỉ có thể chọn ngày hôm nay hoặc trước đó.') });
                    return;
                  }
                  setReportDate(val);
                }}
                style={{
                  padding: '6px 12px', 
                  borderRadius: '6px', 
                  border: '1px solid var(--neutral-border)', 
                  outline: 'none', 
                  fontSize: '13px', 
                  fontWeight: '500',
                  color: 'var(--neutral-dark)', backgroundColor: 'var(--neutral-bg-card)', border: '1px solid var(--neutral-border)'
                }} 
              />
            </div>
          </div>
          <form onSubmit={handleSubmitReport}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
              {reportCards.map((card, index) => (
                <div
                  key={card.id}
                  className="report-card-row"
                  style={{
                    border: '1.5px solid var(--neutral-border)',
                    borderRadius: '4px',
                    padding: '20px',
                    position: 'relative',
                    backgroundColor: 'var(--neutral-bg-card)',
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
                  <div className="report-card-content-col" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ display: 'block', fontSize: '14.5px', fontWeight: '600', color: 'var(--neutral-dark)' }}>
                      {t('reports.content', 'Nội dung')} <span style={{ color: 'red' }}>*</span>
                    </label>
                    <textarea
                      className="report-content-textarea"
                      value={card.content}
                      onChange={(e) => updateCardField(card.id, 'content', e.target.value)}
                      onFocus={handleContentFocusGuard}
                      onClick={handleContentFocusGuard}
                      readOnly={!reportDate}
                      required
                      placeholder={reportDate ? t('reports.placeholderContent', 'Nhập nội dung báo cáo trong khung giờ này...') : t('reports.selectDateFirstPlaceholder', 'Vui lòng chọn ngày báo cáo trước...')}
                      rows="6"
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '4px',
                        border: '1px solid var(--neutral-border)',
                        backgroundColor: reportDate ? 'var(--neutral-bg-card)' : 'var(--neutral-bg-hover)',
                        color: 'var(--neutral-dark)',
                        outline: 'none',
                        resize: 'vertical',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        cursor: reportDate ? 'text' : 'not-allowed'
                      }}
                    />
                  </div>

                  {/* Right Column: Time, Project, File Attachment */}
                  <div className="report-card-meta-col" style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Time fields */}
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--neutral-dark)' }}>
                        {t('reports.timeframe', 'Khung giờ:')}
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {renderTimeDropdown(card, 'startTime')}
                        <span style={{ fontWeight: '600' }}>-</span>
                        {renderTimeDropdown(card, 'endTime')}
                      </div>
                    </div>

                    {/* Project select */}
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--neutral-dark)' }}>
                        {t('reports.selectProject', 'Chọn dự án')}
                      </label>
                      <select
                        value={card.projectId}
                        onChange={(e) => updateCardField(card.id, 'projectId', e.target.value)}
                        style={{ 
                          width: '100%', 
                          padding: '10px', 
                          borderRadius: '4px', 
                          border: '1px solid var(--neutral-border)', 
                          backgroundColor: 'var(--neutral-bg-card)',
                          outline: 'none', 
                          fontSize: '13.5px', 
                          color: 'var(--neutral-dark)' 
                        }}
                      >
                        <option value="">{t('reports.selectProjectOptional', '-- Chọn dự án (Không bắt buộc) --')}</option>
                        {myProjects?.map(p => (
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
                            border: '1px solid var(--neutral-border)',
                            borderRadius: '4px',
                            backgroundColor: 'var(--neutral-bg-card)',
                            color: 'var(--neutral-dark)',
                            cursor: 'pointer',
                            fontWeight: '600'
                          }}
                        >
                          {t('common.selectAttachment', 'Chọn Tệp')}
                        </button>
                        {card.fileName && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--neutral-bg-hover)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                            <span style={{ color: 'var(--neutral-dark)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                    setEditingReportStatus(null);
                    setReportCards(getDefaultReportCards());
                    setReportDate('');
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '12px 16px' }}
                >
                  {t('reports.cancelEdit', 'Hủy Sửa')}
                </button>
              )}
              {(!editingReportId || editingReportStatus === 'Draft') && (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft || isSubmitting}
                  className="btn btn-secondary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 16px', fontWeight: '600' }}
                >
                  <i className="fa-regular fa-floppy-disk"></i>
                  {isSavingDraft ? t('common.saving', 'Đang lưu...') : t('report.saveDraftBtn', 'Lưu tạm thời')}
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || reportCards.some(c => !c.content.trim())}
                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 16px', fontWeight: '700' }}
              >
                <i className="fa-solid fa-paper-plane"></i>
                {isSubmitting ? t('common.submitting', 'Đang xử lý...') : editingReportId ? t('reports.updateReport', 'Cập Nhật Báo Cáo') : t('common.submit', 'Gửi Báo Cáo')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Report Status calendar: red days have no report yet (click to write one),
          green days already have a report (click to view its details). */}
      {isStatusCalendarOpen && (
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
          onClick={() => setIsStatusCalendarOpen(false)}
        >
          <div
            style={{
              width: '420px',
              maxWidth: '92vw',
              backgroundColor: 'var(--neutral-bg-card)',
              border: '1.5px solid #cbd5e1',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--neutral-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--neutral-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-calendar-days" style={{ color: 'var(--primary-color)' }}></i> {t('reports.statusCalendarTitle', 'Trạng thái báo cáo')}
              </h3>
              <button type="button" onClick={() => setIsStatusCalendarOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => changeCalendarMonth(-1)}
                  style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)', color: 'var(--neutral-dark)', cursor: 'pointer' }}
                >
                  <i className="fa-solid fa-chevron-left"></i>
                </button>
                <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--neutral-dark)' }}>
                  {t('reports.statusCalendarMonthTitle', 'Tháng {month}, {year}').replace('{month}', calendarMonthCursor.month + 1).replace('{year}', calendarMonthCursor.year)}
                </span>
                <button
                  type="button"
                  onClick={() => changeCalendarMonth(1)}
                  style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)', color: 'var(--neutral-dark)', cursor: 'pointer' }}
                >
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '8px' }}>
                {[
                  t('reports.calMon', 'Mon'), t('reports.calTue', 'Tue'), t('reports.calWed', 'Wed'), t('reports.calThu', 'Thu'),
                  t('reports.calFri', 'Fri'), t('reports.calSat', 'Sat'), t('reports.calSun', 'Sun')
                ].map((d, i) => (
                  <div key={i} style={{ textAlign: 'center', fontSize: '11.5px', fontWeight: 700, color: 'var(--neutral-muted)' }}>{d}</div>
                ))}
              </div>

              {buildCalendarWeeks().map((week, wi) => (
                <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '6px' }}>
                  {week.map((day, di) => {
                    if (day === null) return <div key={di} />;
                    const dateStr = `${calendarMonthCursor.year}-${String(calendarMonthCursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayReport = findReportForDate(dateStr);
                    const isSunday = di === 6;
                    const isPastOrToday = dateStr <= todayDateStr;
                    const isMissing = !dayReport && !isSunday && isPastOrToday;
                    const isFuture = !dayReport && dateStr > todayDateStr;

                    let bg = 'transparent';
                    let color = 'var(--neutral-dark)';
                    if (dayReport) { bg = 'var(--success-color, #16a34a)'; color = '#fff'; }
                    else if (isMissing) { bg = 'var(--danger-color, #ef4444)'; color = '#fff'; }
                    else if (isSunday) { color = 'var(--neutral-muted)'; }
                    if (isFuture) { color = 'var(--neutral-muted)'; }

                    return (
                      <button
                        key={di}
                        type="button"
                        onClick={() => { if (dayReport) handleSelectReportedDay(dayReport); else handleSelectMissingDay(dateStr); }}
                        style={{
                          aspectRatio: '1',
                          border: 'none',
                          borderRadius: '6px',
                          backgroundColor: bg,
                          color,
                          fontSize: '13px',
                          fontWeight: dayReport || isMissing ? 700 : 500,
                          cursor: isFuture ? 'not-allowed' : 'pointer',
                          opacity: isFuture ? 0.5 : 1
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              ))}

              <div style={{ display: 'flex', gap: '16px', marginTop: '14px', fontSize: '11.5px', color: 'var(--neutral-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: 'var(--danger-color, #ef4444)', display: 'inline-block' }}></span>
                  {t('reports.calMissingLegend', 'Chưa làm báo cáo')}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: 'var(--success-color, #16a34a)', display: 'inline-block' }}></span>
                  {t('reports.calReportedLegend', 'Đã làm báo cáo')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

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
              backgroundColor: 'var(--neutral-bg-card)', 
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
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--neutral-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--neutral-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--primary-color)' }}></i> {t('report.historyTitle', 'Lịch sử báo cáo đã gửi')}
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
            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--neutral-dark)' }}>{t('report.fromDate', 'Từ ngày:')}</label>
                <input 
                  type="date" 
                  value={startDateFilter} 
                  onChange={(e) => setStartDateFilter(e.target.value)} 
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)', color: 'var(--neutral-dark)', fontSize: '13px', outline: 'none' }} 
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--neutral-dark)' }}>{t('report.toDate', 'Đến ngày:')}</label>
                <input 
                  type="date" 
                  value={endDateFilter} 
                  onChange={(e) => setEndDateFilter(e.target.value)} 
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)', color: 'var(--neutral-dark)', fontSize: '13px', outline: 'none' }} 
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
                  <i className="fa-solid fa-trash-can"></i> {t('report.clearFilters', 'Xóa bộ lọc')}
                </button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>
                {t('report.foundReportsCountBefore', 'Tìm thấy')} <strong>{reportsFilteredByDate.length}</strong> {t('report.foundReportsCountAfter', 'báo cáo của bạn')}
              </span>
            </div>

            {/* Modal Body (Scrollable Grid of Cards) */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', backgroundColor: 'var(--neutral-bg-main)' }}>
              {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                  <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '32px', marginBottom: '12px', color: 'var(--primary-color)' }}></i>
                  <p style={{ fontSize: '14px', margin: 0 }}>Đang tải dữ liệu...</p>
                </div>
              ) : reportsFilteredByDate.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                  <i className="fa-solid fa-folder-open" style={{ fontSize: '48px', marginBottom: '12px', color: '#94a3b8' }}></i>
                  <p style={{ fontSize: '14px', margin: 0 }}>{t('report.noReportsFound', 'Không tìm thấy báo cáo nào trong khoảng thời gian này.')}</p>
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
                          border: '1.5px solid var(--neutral-border)', 
                          borderRadius: '8px', 
                          padding: '16px', 
                          background: 'var(--neutral-bg-card)', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '12px', 
                          cursor: 'pointer', 
                          transition: 'all 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}
                        onClick={() => showReportDetailPopup(report)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                          e.currentTarget.style.borderColor = 'var(--primary-color)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                          e.currentTarget.style.borderColor = 'var(--neutral-border)';
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: userColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px' }}>
                              {report.user_name.split(' ').pop().charAt(0)}
                            </div>
                            <div>
                              <h4 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--neutral-dark)', margin: 0 }}>{report.user_name}</h4>
                              <span style={{ fontSize: '9px', color: 'var(--neutral-muted)', display: 'block', marginTop: '-2px' }}>{report.user_role}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                            <span style={{ fontSize: '9.5px', color: 'var(--neutral-muted)' }}>
                              {new Date(report.created_at).toLocaleDateString(currentLang === 'vi' ? 'vi-VN' : 'en-US')}
                            </span>
                            <span style={{
                              fontSize: '9px',
                              color: report.status === 'Approved' ? 'var(--success-color)' : report.status === 'Rejected' ? 'var(--danger-color)' : report.status === 'Draft' ? 'var(--neutral-muted)' : 'var(--warning-color)',
                              fontWeight: 'bold'
                            }}>
                              {report.status === 'Approved' ? t('report.approvedStatus', 'Đã duyệt') : report.status === 'Rejected' ? t('report.rejectedStatus', 'Từ chối') : report.status === 'Draft' ? t('report.draftStatus', 'Nháp') : 'Pending'}
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
                            color: 'var(--neutral-muted)', 
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

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', borderTop: '1px solid var(--neutral-border)', paddingTop: '8px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {report.file_url ? <><i className="fa-solid fa-paperclip"></i> {t('report.hasAttachment', 'Có đính kèm')}</> : t('report.noAttachment', 'Không có đính kèm')}
                          </span>
                          {(report.status === 'Pending' || report.status === 'pending' || report.status === 'Chờ duyệt' || report.status === 'Draft') && report.user_id === currentUser?.id && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const SwalInstance = (await import('sweetalert2')).default;
                                const result = await SwalInstance.fire({
                                  icon: 'warning',
                                  title: t('common.confirmDelete', 'Xác nhận xóa'),
                                  text: t('report.confirmDeleteText', 'Bạn có chắc chắn muốn xóa báo cáo này? Hành động này không thể hoàn tác.'),
                                  showCancelButton: true,
                                  confirmButtonText: t('report.deleteReportBtn', 'Xóa báo cáo'),
                                  cancelButtonText: t('common.cancel', 'Hủy'),
                                  confirmButtonColor: '#ef4444',
                                  cancelButtonColor: '#64748b',
                                });
                                if (result.isConfirmed) {
                                  try {
                                    await db.deleteDailyReport(report.id);
                                    await loadReports();
                                    SwalInstance.fire({ icon: 'success', title: t('common.deleted', 'Đã xóa'), text: t('report.deleteSuccessText', 'Báo cáo đã được xóa thành công!'), timer: 2000, showConfirmButton: false });
                                  } catch (err) {
                                    SwalInstance.fire({ icon: 'error', title: t('common.error', 'Lỗi'), text: t('report.deleteErrorText', 'Không thể xóa báo cáo: ') + err.message });
                                  }
                                }
                              }}
                              style={{
                                background: 'none',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                color: '#ef4444',
                                fontSize: '11px',
                                padding: '3px 10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; e.currentTarget.style.borderColor = '#ef4444'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = '#fecaca'; }}
                            >
                              <i className="fa-solid fa-trash-can" style={{ fontSize: '10px' }}></i> {t('common.delete', 'Xóa')}
                            </button>
                          )}
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
