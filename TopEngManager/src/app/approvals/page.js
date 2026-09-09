"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { db } from '@/utils/db';
import TimeField, { normalizeTime } from '@/components/TimeField';

const getSwal = async () => (await import('sweetalert2')).default;

// The three shapes of leave the form offers, and the hours each one implies. Picking one
// fills the times in, but they stay editable: half a day is not the same length everywhere.
const LEAVE_KINDS = [
  { id: 'morning', start: '08:00', end: '12:00' },
  { id: 'afternoon', start: '13:00', end: '17:00' },
  { id: 'full', start: '08:00', end: '17:00' }
];

const WORK_LOCATIONS = ['Hà Nội', 'Vĩnh Phúc', 'Thái Nguyên'];

const todayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Stored as YYYY-MM-DD, shown as DD/MM/YYYY.
const displayDate = (value) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || '';
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
};

const emptyWorkRow = () => ({ key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, startTime: '', endTime: '', content: '' });

const blankForm = (type) => ({
  requestType: type,
  requestDate: todayString(),
  startTime: type === 'overtime' ? '17:00' : '08:00',
  endTime: type === 'overtime' ? '20:00' : '12:00',
  leaveKind: type === 'leave' ? 'morning' : '',
  projectName: '',
  workLocation: type === 'overtime' ? WORK_LOCATIONS[0] : '',
  reason: '',
  workDetails: type === 'overtime' ? [emptyWorkRow()] : []
});

// One label above its value. An empty value still renders, as a dash, so the two columns
// stay aligned instead of shuffling up when somebody leaves a field blank.
const detailLabelStyle = {
  fontSize: '12px', fontWeight: 600, color: 'var(--neutral-muted)',
  textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '4px'
};

const detailField = (label, value) => (
  <div key={label}>
    <div style={detailLabelStyle}>{label}</div>
    <div style={{ fontSize: '14px', color: 'var(--neutral-dark)', fontWeight: 500 }}>
      {value || '—'}
    </div>
  </div>
);

// Free text: line breaks the writer typed are kept, which is the whole reason the old
// single-paragraph dialog read so badly.
const detailBlock = (label, value, highlight = false) => (
  <div>
    <div style={detailLabelStyle}>{label}</div>
    <div
      style={{
        fontSize: '14px', color: 'var(--neutral-dark)', whiteSpace: 'pre-wrap',
        background: highlight ? 'var(--primary-light)' : 'var(--neutral-bg-main)',
        border: '1px solid var(--neutral-border)',
        borderRadius: 'var(--border-radius)', padding: '10px 12px', lineHeight: 1.55
      }}
    >
      {value || '—'}
    </div>
  </div>
);

export default function Approvals() {
  const { currentUser } = useApp();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState('overtime');
  const [permissions, setPermissions] = useState({ canManage: false, isAdmin: false });
  const [myRequests, setMyRequests] = useState([]);
  const [managed, setManaged] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamFilter, setTeamFilter] = useState('');
  const [managedType, setManagedType] = useState('overtime');
  const [loading, setLoading] = useState(false);

  const [detailRow, setDetailRow] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blankForm('overtime'));
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const isManageTab = activeTab === 'manage';
  const listType = isManageTab ? managedType : activeTab;

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const perms = await db.getApprovalPermissions(currentUser.id);
        if (cancelled) return;
        setPermissions(perms || { canManage: false, isAdmin: false });
        if (perms?.isAdmin) {
          const list = await db.getApprovalTeams(currentUser.id);
          if (!cancelled) setTeams(list || []);
        }
      } catch (err) {
        console.error('Failed to load approval permissions', err);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  const loadMine = useCallback(async () => {
    if (!currentUser || isManageTab) return;
    setLoading(true);
    try {
      const rows = await db.getMyApprovalRequests({ requesterId: currentUser.id, requestType: activeTab });
      setMyRequests(rows || []);
    } catch (err) {
      console.error('Failed to load approval requests', err);
      setMyRequests([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser, activeTab, isManageTab]);

  const loadManaged = useCallback(async () => {
    if (!currentUser || !isManageTab) return;
    setLoading(true);
    try {
      const rows = await db.getManagedApprovalRequests({
        requesterId: currentUser.id, requestType: managedType, teamId: teamFilter || null
      });
      setManaged(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('Failed to load managed approval requests', err);
      setManaged([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser, isManageTab, managedType, teamFilter]);

  useEffect(() => { loadMine(); }, [loadMine]);
  useEffect(() => { loadManaged(); }, [loadManaged]);

  if (!currentUser) return null;

  const openCreate = () => {
    setForm(blankForm(activeTab));
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setForm({
      requestType: row.request_type,
      requestDate: row.request_date,
      startTime: row.start_time,
      endTime: row.end_time,
      leaveKind: row.leave_kind || 'morning',
      projectName: row.project_name || '',
      workLocation: row.work_location || WORK_LOCATIONS[0],
      reason: row.reason || '',
      workDetails: (row.workDetails || []).length > 0
        ? row.workDetails.map((d, i) => ({ key: `row-${i}`, ...d }))
        : [emptyWorkRow()]
    });
    setEditingId(row.request_id);
    setFormOpen(true);
  };

  const setField = (name, value) => setForm(prev => ({ ...prev, [name]: value }));

  const pickLeaveKind = (kind) => {
    const preset = LEAVE_KINDS.find(k => k.id === kind);
    setForm(prev => ({ ...prev, leaveKind: kind, startTime: preset.start, endTime: preset.end }));
  };

  const setWorkRow = (key, field, value) => setForm(prev => ({
    ...prev,
    workDetails: prev.workDetails.map(row => (row.key === key ? { ...row, [field]: value } : row))
  }));
  const addWorkRow = () => setForm(prev => ({ ...prev, workDetails: [...prev.workDetails, emptyWorkRow()] }));
  const removeWorkRow = (key) => setForm(prev => ({
    // Never leave the section with no row at all: there would be nothing to click into.
    ...prev,
    workDetails: prev.workDetails.length <= 1 ? prev.workDetails : prev.workDetails.filter(row => row.key !== key)
  }));

  const submitForm = async (e) => {
    e.preventDefault();
    const Swal = await getSwal();
    const start = normalizeTime(form.startTime);
    const end = normalizeTime(form.endTime);
    const warn = (text) => Swal.fire({ icon: 'warning', title: t('common.warning', 'Cảnh báo'), text });

    if (!form.requestDate) return warn(t('approval.dateRequired', 'Vui lòng chọn ngày.'));
    if (!start || !end) return warn(t('approval.timeInvalid', 'Giờ không hợp lệ (định dạng HH:MM).'));
    if (end <= start) return warn(t('approval.timeOrder', 'Giờ kết thúc phải sau giờ bắt đầu.'));
    if (!form.reason.trim()) return warn(t('approval.reasonRequired', 'Vui lòng nhập lý do.'));

    const payload = {
      requesterId: currentUser.id,
      requestType: form.requestType,
      requestDate: form.requestDate,
      startTime: start,
      endTime: end,
      leaveKind: form.requestType === 'leave' ? form.leaveKind : null,
      projectName: form.projectName,
      workLocation: form.workLocation,
      reason: form.reason,
      workDetails: form.workDetails
        .map(row => ({
          startTime: normalizeTime(row.startTime) || '',
          endTime: normalizeTime(row.endTime) || '',
          content: row.content
        }))
        .filter(row => row.startTime || row.endTime || row.content)
    };

    setSaving(true);
    try {
      if (editingId) {
        await db.updateApprovalRequest({ ...payload, requestId: editingId });
      } else {
        await db.createApprovalRequest(payload);
      }
      setFormOpen(false);
      setEditingId(null);
      await loadMine();
      Swal.fire({
        icon: 'success', title: t('common.success', 'Thành công'),
        text: editingId
          ? t('approval.updateSuccess', 'Đã cập nhật đơn.')
          : t('approval.submitSuccess', 'Đã nộp đơn, chờ phê duyệt.')
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const removeRequest = async (row) => {
    const Swal = await getSwal();
    const result = await Swal.fire({
      icon: 'warning',
      title: t('approval.deleteConfirmTitle', 'Xóa đơn này?'),
      text: displayDate(row.request_date),
      showCancelButton: true,
      confirmButtonText: t('common.delete', 'Xóa'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--danger-color)'
    });
    if (!result.isConfirmed) return;
    try {
      await db.deleteApprovalRequest({ requestId: row.request_id, requesterId: currentUser.id });
      await loadMine();
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    }
  };

  const decide = async (row, status) => {
    const Swal = await getSwal();
    const approving = status === 'Approved';
    const result = await Swal.fire({
      icon: approving ? 'question' : 'warning',
      title: approving
        ? t('approval.approveConfirmTitle', 'Phê duyệt đơn này?')
        : t('approval.rejectConfirmTitle', 'Từ chối đơn này?'),
      input: 'textarea',
      inputLabel: t('approval.commentLabel', 'Ý kiến (không bắt buộc)'),
      inputPlaceholder: t('approval.commentPlaceholder', 'Nhập ý kiến của bạn...'),
      showCancelButton: true,
      confirmButtonText: approving ? t('approval.approve', 'Phê duyệt') : t('approval.reject', 'Từ chối'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: approving ? 'var(--primary-color)' : 'var(--danger-color)'
    });
    if (!result.isConfirmed) return;
    try {
      await db.decideApprovalRequest({
        requestId: row.request_id, requesterId: currentUser.id, status, comment: result.value || ''
      });
      await loadManaged();
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    }
  };

  // The details used to be one run of text inside a SweetAlert, which collapsed every
  // line break into a single paragraph. It is a real dialog now, laid out like the form
  // the request came from.
  const showDetail = (row) => setDetailRow(row);

  const statusStyle = (status) => {
    if (status === 'Approved') return { color: 'var(--success-color, #16a34a)' };
    if (status === 'Rejected') return { color: 'var(--danger-color, #dc2626)' };
    return { color: 'var(--warning-color, #d97706)' };
  };
  // The stylesheet already has badge colours; reuse them rather than inventing more.
  const statusBadge = (status) => {
    if (status === 'Approved') return 'badge-success';
    if (status === 'Rejected') return 'badge-danger';
    return 'badge-warning';
  };
  const leaveKindLabel = (kind) => {
    if (kind === 'morning') return t('approval.leaveMorning', 'Nửa phép sáng');
    if (kind === 'afternoon') return t('approval.leaveAfternoon', 'Nửa phép chiều');
    if (kind === 'full') return t('approval.leaveFull', 'Cả ngày');
    return '';
  };
  const statusLabel = (status) => {
    if (status === 'Approved') return t('approval.statusApproved', 'Đã duyệt');
    if (status === 'Rejected') return t('approval.statusRejected', 'Từ chối');
    return t('approval.statusPending', 'Chờ duyệt');
  };

  const tabButton = (id, label) => (
    <button
      type="button"
      className={`tab-btn ${activeTab === id ? 'active' : ''}`}
      onClick={() => setActiveTab(id)}
    >
      {label}
    </button>
  );

  const rows = isManageTab ? managed : myRequests;

  return (
    <div className="scrollable-view">
      <div className="view-header">
        <div className="view-title-group">
          <h2>{t('approval.pageTitle', 'Phê duyệt')}</h2>
          <p>{t('approval.pageSubtitle', 'Nộp và theo dõi đơn tăng ca, nghỉ phép.')}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {tabButton('overtime', t('approval.tabOvertime', 'Phê duyệt tăng ca'))}
        {tabButton('leave', t('approval.tabLeave', 'Phê duyệt nghỉ phép'))}
        {/* Only leaders and Admin get the queue; the server refuses the data either way. */}
        {permissions.canManage && tabButton('manage', t('approval.tabManage', 'Quản lý phê duyệt'))}
      </div>

      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {!isManageTab && (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <i className="fa-solid fa-plus"></i> {t('approval.create', 'Tạo đơn')}
            </button>
          )}
          {isManageTab && (
            <>
              <select  value={managedType} onChange={(e) => setManagedType(e.target.value)}>
                <option value="overtime">{t('approval.tabOvertime', 'Phê duyệt tăng ca')}</option>
                <option value="leave">{t('approval.tabLeave', 'Phê duyệt nghỉ phép')}</option>
              </select>
              {/* Admin only: a Part Leader's or Team Leader's scope is fixed by where they sit. */}
              {permissions.isAdmin && (
                <select  value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
                  <option value="">{t('approval.allTeams', 'Tất cả các Team')}</option>
                  {teams.map(team => (
                    <option key={team.department_id} value={team.department_id}>{team.name}</option>
                  ))}
                </select>
              )}
            </>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                {isManageTab && <th>{t('approval.requester', 'Người nộp')}</th>}
                {isManageTab && <th>{t('approval.department', 'Bộ phận')}</th>}
                <th>{t('approval.date', 'Ngày')}</th>
                <th>{t('approval.startTime', 'Bắt đầu')}</th>
                <th>{t('approval.endTime', 'Kết thúc')}</th>
                <th>{listType === 'leave'
                  ? t('approval.leaveReason', 'Lý do xin nghỉ')
                  : t('approval.overtimeReason', 'Lý do tăng ca')}</th>
                <th>{t('approval.comment', 'Ý kiến')}</th>
                <th>{t('approval.status', 'Trạng thái')}</th>
                <th>{t('approval.action', 'Thao tác')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={isManageTab ? 9 : 7} style={{ textAlign: 'center', padding: '24px', opacity: 0.7 }}>
                    {loading ? t('common.loading', 'Đang tải...') : t('approval.empty', 'Chưa có đơn nào.')}
                  </td>
                </tr>
              )}
              {rows.map(row => (
                <tr key={row.request_id}>
                  {isManageTab && <td>{row.requester_name}</td>}
                  {isManageTab && <td>{row.department_name}</td>}
                  <td>{displayDate(row.request_date)}</td>
                  <td>{row.start_time}</td>
                  <td>{row.end_time}</td>
                  <td style={{ whiteSpace: 'pre-wrap', maxWidth: '320px' }}>{row.reason}</td>
                  <td style={{ whiteSpace: 'pre-wrap', maxWidth: '220px' }}>{row.comment || ''}</td>
                  <td style={statusStyle(row.status)}>{statusLabel(row.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-sm" onClick={() => showDetail(row)}>
                        {t('approval.detail', 'Chi tiết')}
                      </button>
                      {/* A decided request is a record, not a draft: it stops being editable. */}
                      {!isManageTab && row.status === 'Pending' && (
                        <>
                          <button type="button" className="btn btn-sm btn-primary" onClick={() => openEdit(row)}>
                            {t('common.edit', 'Sửa')}
                          </button>
                          <button type="button" className="btn btn-sm btn-danger" onClick={() => removeRequest(row)}>
                            {t('common.delete', 'Xóa')}
                          </button>
                        </>
                      )}
                      {isManageTab && row.status === 'Pending' && (
                        <>
                          <button type="button" className="btn btn-sm btn-primary" onClick={() => decide(row, 'Approved')}>
                            {t('approval.approve', 'Phê duyệt')}
                          </button>
                          <button type="button" className="btn btn-sm btn-danger" onClick={() => decide(row, 'Rejected')}>
                            {t('approval.reject', 'Từ chối')}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <div className="modal show" style={{ display: 'flex', zIndex: 1000 }}>
          <div className="modal-dialog" style={{ maxWidth: '660px', width: '95%' }}>
            <div className="modal-content">
              <div className="modal-header">
                <h3>
                  {form.requestType === 'overtime'
                    ? t('approval.overtimeFormTitle', 'Đơn đăng ký tăng ca')
                    : t('approval.leaveFormTitle', 'Đơn xin nghỉ phép')}
                </h3>
                <button type="button" className="btn-close-modal" onClick={() => setFormOpen(false)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <form onSubmit={submitForm}>
                <div className="modal-body" style={{ display: 'grid', gap: '14px', padding: '20px', overflowY: 'auto' }}>
                  {/* Filled in from the org tree, not typed: routing must not depend on a
                      name somebody spelled differently. */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label>{t('approval.approver', 'Họ tên người làm phê duyệt')}</label>
                      <input type="text" value={form.approverName || t('approval.approverAuto', 'Tự động theo Part Leader')} readOnly />
                    </div>
                    <div className="form-group">
                      <label>{t('approval.employeeCode', 'Mã nhân viên')}</label>
                      <input type="text" value={currentUser.employee_id || currentUser.id} readOnly />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label>{t('approval.department', 'Bộ Phận')}</label>
                      <input type="text" value={currentUser.department_name || ''} readOnly />
                    </div>
                    {form.requestType === 'overtime' ? (
                      <div className="form-group">
                        <label>{t('approval.workLocation', 'Địa điểm làm việc')}</label>
                        <select
                          
                          value={form.workLocation}
                          onChange={(e) => setField('workLocation', e.target.value)}
                        >
                          {WORK_LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="form-group">
                        <label>{t('approval.currentProject', 'Dự án đang đảm nhận')}</label>
                        <input
                          type="text"
                          value={form.projectName}
                          placeholder={t('approval.projectPlaceholder', 'Nhập tên dự án')}
                          onChange={(e) => setField('projectName', e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label>{form.requestType === 'overtime'
                        ? t('approval.overtimeDate', 'Ngày tăng ca')
                        : t('approval.leaveDate', 'Ngày xin nghỉ phép')}</label>
                      <input
                        type="date"
                        value={form.requestDate}
                        onChange={(e) => setField('requestDate', e.target.value)}
                      />
                    </div>
                    {form.requestType === 'overtime' && (
                      <div className="form-group">
                        <label>{t('approval.project', 'Dự án')}</label>
                        <input
                          type="text"
                          value={form.projectName}
                          placeholder={t('approval.projectPlaceholder', 'Nhập tên dự án')}
                          onChange={(e) => setField('projectName', e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {form.requestType === 'leave' && (
                    <div className="form-group">
                      {LEAVE_KINDS.map(kind => (
                        <label key={kind.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <input
                            type="radio"
                            name="leaveKind"
                            checked={form.leaveKind === kind.id}
                            onChange={() => pickLeaveKind(kind.id)}
                          />
                          <span>
                            {kind.id === 'morning' && t('approval.leaveMorning', 'Nửa phép sáng')}
                            {kind.id === 'afternoon' && t('approval.leaveAfternoon', 'Nửa phép chiều')}
                            {kind.id === 'full' && t('approval.leaveFull', 'Cả ngày')}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>{t('approval.startTime', 'Start Time')}</label>
                      <TimeField value={form.startTime} onChange={(v) => setField('startTime', v)} />
                    </div>
                    <span style={{ padding: '0 4px 12px' }}>~</span>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>{t('approval.endTime', 'End Time')}</label>
                      <TimeField value={form.endTime} onChange={(v) => setField('endTime', v)} align="right" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>{form.requestType === 'overtime'
                      ? t('approval.overtimeReason', 'Lý do tăng ca')
                      : t('approval.leaveReason', 'Lý do nghỉ phép')}</label>
                    <textarea
                      rows={3}
                      value={form.reason}
                      placeholder={t('approval.reasonPlaceholder', 'Người dùng nhập nội dung')}
                      onChange={(e) => setField('reason', e.target.value)}
                    />
                  </div>

                  {form.requestType === 'overtime' && (
                    <div className="form-group">
                      <label>{t('approval.workDetails', 'Chi tiết công việc tăng ca')}</label>
                      {form.workDetails.map(row => (
                        <div key={row.key} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ width: '110px' }}>
                            <TimeField value={row.startTime} onChange={(v) => setWorkRow(row.key, 'startTime', v)} />
                          </div>
                          <span>~</span>
                          <div style={{ width: '110px' }}>
                            <TimeField value={row.endTime} onChange={(v) => setWorkRow(row.key, 'endTime', v)} />
                          </div>
                          <input
                            type="text"
                            style={{ flex: 1 }}
                            value={row.content}
                            placeholder={t('approval.reasonPlaceholder', 'Người dùng nhập nội dung')}
                            onChange={(e) => setWorkRow(row.key, 'content', e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            title={t('approval.removeWorkRow', 'Xóa dòng')}
                            onClick={() => removeWorkRow(row.key)}
                            disabled={form.workDetails.length <= 1}
                          >
                            <i className="fa-solid fa-minus"></i>
                          </button>
                        </div>
                      ))}
                      <button type="button" className="btn btn-sm" onClick={addWorkRow}>
                        <i className="fa-solid fa-plus"></i> {t('approval.addWorkRow', 'Thêm khung chi tiết công việc')}
                      </button>
                    </div>
                  )}
                </div>
                <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--neutral-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" className="btn" onClick={() => setFormOpen(false)}>
                    {t('common.cancel', 'Hủy')}
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? t('common.saving', 'Đang lưu...') : t('approval.submit', 'Nộp')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {detailRow && (
        <div className="modal show" style={{ display: 'flex', zIndex: 1100 }}>
          <div className="modal-dialog" style={{ maxWidth: '620px', width: '95%' }}>
            <div className="modal-content">
              <div className="modal-header">
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--neutral-dark)' }}>
                  <i
                    className={`fa-solid ${detailRow.request_type === 'overtime' ? 'fa-clock' : 'fa-umbrella-beach'}`}
                    style={{ marginRight: '8px', color: 'var(--primary-color)' }}
                  ></i>
                  {detailRow.request_type === 'overtime'
                    ? t('approval.overtimeFormTitle', 'Đơn đăng ký tăng ca')
                    : t('approval.leaveFormTitle', 'Đơn xin nghỉ phép')}
                  <span className={`badge ${statusBadge(detailRow.status)}`} style={{ marginLeft: '10px' }}>
                    {statusLabel(detailRow.status)}
                  </span>
                </h3>
                <button type="button" className="btn-close-modal" onClick={() => setDetailRow(null)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="modal-body" style={{ padding: '20px', overflowY: 'auto' }}>
                {/* One label above its value, two to a row: the same shape as the form. */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
                  {detailField(t('approval.requester', 'Người nộp'),
                    detailRow.requester_name || currentUser.name)}
                  {detailField(t('approval.employeeCode', 'Mã nhân viên'), detailRow.employee_code)}
                  {detailField(t('approval.department', 'Bộ phận'), detailRow.department_name)}
                  {detailField(t('approval.approver', 'Người phê duyệt'), detailRow.approver_name)}
                  {detailField(t('approval.date', 'Ngày'), displayDate(detailRow.request_date))}
                  {detailField(t('approval.time', 'Thời gian'), `${detailRow.start_time} - ${detailRow.end_time}`)}
                  {detailRow.request_type === 'overtime'
                    ? detailField(t('approval.workLocation', 'Địa điểm làm việc'), detailRow.work_location)
                    : detailField(t('approval.leaveKind', 'Loại nghỉ'), leaveKindLabel(detailRow.leave_kind))}
                  {detailField(t('approval.project', 'Dự án'), detailRow.project_name)}
                </div>

                <div style={{ marginTop: '18px' }}>
                  {detailBlock(detailRow.request_type === 'overtime'
                    ? t('approval.overtimeReason', 'Lý do tăng ca')
                    : t('approval.leaveReason', 'Lý do nghỉ phép'), detailRow.reason)}
                </div>

                {(detailRow.workDetails || []).length > 0 && (
                  <div style={{ marginTop: '18px' }}>
                    <div style={detailLabelStyle}>{t('approval.workDetails', 'Chi tiết công việc tăng ca')}</div>
                    <div style={{ border: '1px solid var(--neutral-border)', borderRadius: 'var(--border-radius)', overflow: 'hidden' }}>
                      {detailRow.workDetails.map((d, i) => (
                        <div
                          key={`${d.startTime}-${d.endTime}-${i}`}
                          style={{
                            display: 'flex', gap: '14px', padding: '8px 12px', fontSize: '13px',
                            borderTop: i === 0 ? 'none' : '1px solid var(--neutral-border)'
                          }}
                        >
                          <span style={{ color: 'var(--neutral-muted)', whiteSpace: 'nowrap', minWidth: '104px' }}>
                            {d.startTime} - {d.endTime}
                          </span>
                          <span style={{ whiteSpace: 'pre-wrap', color: 'var(--neutral-dark)' }}>{d.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Only once somebody has actually written one. */}
                {detailRow.comment && (
                  <div style={{ marginTop: '18px' }}>
                    {detailBlock(t('approval.comment', 'Ý kiến'), detailRow.comment, true)}
                  </div>
                )}
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--neutral-border)', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setDetailRow(null)}>
                  {t('common.close', 'Đóng')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
