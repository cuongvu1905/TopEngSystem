"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { db } from '@/utils/db';
import { getSwal } from '@/utils/swal';
import { getAllowedScopes, getScopeDepartmentIds, getOwningTeamId, toApiScope, UNSCOPED_SCOPE_ID } from '@/utils/orgScope';
import { toTsv, parseTsv } from '@/utils/tsvGrid';

const getTodayDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

// Who is missing from the board for a day: everyone in scope who neither filed a daily
// report nor was added to a cell by hand. Grouped by Part so a leader can chase them.
// Scope follows the org rules: Admin sees every Team, a Team Leader sees their own Team
// broken down by Part, a Part Leader sees only their own Part.
function ReportStatusModal({ isOpen, onClose, reportDate, users, departments, currentUser }) {
  const { t } = useLanguage();
  const [placedIds, setPlacedIds] = useState(null); // null = still loading

  useEffect(() => {
    if (!isOpen) { setPlacedIds(null); return undefined; }
    let cancelled = false;
    db.getPlacedUserIds(reportDate)
      .then(list => { if (!cancelled) setPlacedIds(new Set(list || [])); })
      .catch(() => { if (!cancelled) setPlacedIds(new Set()); });
    return () => { cancelled = true; };
  }, [isOpen, reportDate]);

  const groups = useMemo(() => {
    if (!isOpen || !placedIds) return [];
    const role = currentUser?.system_role || '';
    const isAdminUser = role.includes('Admin');
    const isPartLeaderUser = role === 'Part Leader';

    let departmentIds;
    if (isPartLeaderUser) {
      departmentIds = currentUser?.department_id ? [currentUser.department_id] : [];
    } else if (isAdminUser) {
      departmentIds = getAllowedScopes(departments, currentUser).map(s => s.department_id);
    } else {
      const teamId = getOwningTeamId(departments, currentUser?.department_id);
      departmentIds = teamId ? getScopeDepartmentIds(departments, teamId) : [];
    }

    return departmentIds
      .map(deptId => {
        const dept = departments.find(d => d.department_id === deptId);
        const all = (users || []).filter(u => u.department_id === deptId);
        return {
          departmentId: deptId,
          name: dept?.name || deptId,
          total: all.length,
          missing: all
            .filter(u => !placedIds.has(u.id))
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        };
      })
      .filter(g => g.total > 0);
  }, [isOpen, placedIds, users, departments, currentUser]);

  if (!isOpen) return null;

  const totalMissing = groups.reduce((sum, g) => sum + g.missing.length, 0);

  return (
    <div
      className="modal show"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
        zIndex: 1200, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '70vw', maxWidth: '900px', height: '75vh',
          backgroundColor: 'var(--neutral-bg-card)', border: '1.5px solid var(--neutral-border)',
          borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--neutral-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--neutral-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-user-clock" style={{ color: 'var(--primary-color)' }}></i>
              {t('manpower.reportStatusTitle', 'Tình trạng báo cáo ngày')} {formatDisplayDate(reportDate)}
            </h3>
            <div style={{ fontSize: '12.5px', color: 'var(--neutral-muted)', marginTop: '2px' }}>
              {t('manpower.reportStatusSubtitle', 'Thành viên chưa có dữ liệu trong Bảng nhân lực (chưa làm báo cáo và chưa được thêm vào ô nào)')}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {!placedIds ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-muted)' }}>
              <i className="fa-solid fa-circle-notch fa-spin"></i>
            </div>
          ) : groups.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-muted)', fontSize: '13px' }}>
              {t('manpower.noMembersInScope', 'Không có thành viên nào trong phạm vi của bạn.')}
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '14px', fontSize: '13px', fontWeight: 600, color: totalMissing > 0 ? 'var(--danger-color)' : 'var(--success-color, #16a34a)' }}>
                <i className={totalMissing > 0 ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-check'}></i>{' '}
                {totalMissing > 0
                  ? t('manpower.missingCount', 'Còn {count} thành viên chưa có dữ liệu').replace('{count}', totalMissing)
                  : t('manpower.allReported', 'Tất cả thành viên đều đã có dữ liệu trong bảng.')}
              </div>

              {groups.map(group => (
                <div key={group.departmentId} style={{ border: '1px solid var(--neutral-border)', borderRadius: '8px', marginBottom: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 12px', backgroundColor: 'var(--neutral-bg-hover)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <strong style={{ fontSize: '13.5px', color: 'var(--neutral-dark)' }}>
                      <i className="fa-solid fa-sitemap" style={{ marginRight: '6px', opacity: 0.7 }}></i>
                      {group.name}
                    </strong>
                    <span style={{
                      fontSize: '11.5px', fontWeight: 700, padding: '2px 10px', borderRadius: '10px',
                      backgroundColor: group.missing.length > 0 ? '#fee2e2' : '#dcfce7',
                      color: group.missing.length > 0 ? '#b91c1c' : '#15803d'
                    }}>
                      {group.missing.length}/{group.total}
                    </span>
                  </div>
                  {group.missing.length === 0 ? (
                    <div style={{ padding: '10px 12px', fontSize: '12.5px', color: 'var(--success-color, #16a34a)' }}>
                      <i className="fa-solid fa-circle-check"></i>{' '}
                      {t('manpower.partAllReported', 'Cả bộ phận đã có dữ liệu.')}
                    </div>
                  ) : (
                    group.missing.map(member => (
                      <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderTop: '1px solid var(--neutral-border)' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--neutral-dark)' }}>{member.name}</span>
                        {member.email && <span style={{ fontSize: '11.5px', color: 'var(--neutral-muted)' }}>· {member.email}</span>}
                      </div>
                    ))
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--neutral-border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '8px 18px', fontSize: '13px', fontWeight: 600 }}>
            {t('common.close', 'Đóng')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Double-clicking a headcount cell opens this: who makes up that number, a way to read
// each person's full day of reports, and a way to add someone who filed no report.
function CellDetailModal({ cell, onClose, onChanged, users, currentUser, excludedPartIds }) {
  const { t } = useLanguage();
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  // Whose reports are being read right now: { userId, userName, reports } | null
  const [viewing, setViewing] = useState(null);
  // Everyone already accounted for that day, by their own report or by having been
  // added to some cell by hand. Each person belongs to exactly one cell, so the picker
  // must not offer them again anywhere.
  const [placedUserIds, setPlacedUserIds] = useState(() => new Set());

  const loadMembers = useCallback(async () => {
    if (!cell) return;
    setIsLoading(true);
    try {
      const [list, placed] = await Promise.all([
        db.getManpowerCellMembers(cell.reportDate, cell.projectId, cell.locationId, [...excludedPartIds]),
        db.getPlacedUserIds(cell.reportDate).catch(() => [])
      ]);
      setMembers(list || []);
      setPlacedUserIds(new Set(placed || []));
    } catch (err) {
      console.error('Failed to load cell members', err);
      setMembers([]);
      setPlacedUserIds(new Set());
    } finally {
      setIsLoading(false);
    }
  }, [cell, excludedPartIds]);

  useEffect(() => { loadMembers(); }, [loadMembers]);
  useEffect(() => { setViewing(null); setNewUserId(''); }, [cell]);

  if (!cell) return null;

  const runAction = async (action) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await action();
      await loadMembers();
      await onChanged();
    } catch (err) {
      const Swal = await getSwal();
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    } finally {
      setIsBusy(false);
    }
  };

  const handleAddMember = () => {
    if (!newUserId) return;
    runAction(async () => {
      await db.addManpowerCellMember({
        reportDate: cell.reportDate,
        manpowerProjectId: cell.projectId,
        manpowerLocationId: cell.locationId,
        userId: newUserId,
        addedBy: currentUser?.id
      });
      setNewUserId('');
    });
  };

  const handleRemoveMember = (member) => {
    runAction(() => db.removeManpowerCellMember({
      reportDate: cell.reportDate,
      manpowerProjectId: cell.projectId,
      manpowerLocationId: cell.locationId,
      userId: member.user_id
    }));
  };

  const handleViewReports = async (member) => {
    setIsLoading(true);
    try {
      const reports = await db.getUserDayReports(cell.reportDate, member.user_id);
      setViewing({ userId: member.user_id, userName: member.user_name, reports: reports || [] });
    } catch (err) {
      const Swal = await getSwal();
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const alreadyIn = new Set(members.map(m => m.user_id));
  // Only people not already placed anywhere that day (no report, not hand-added to any
  // other cell) can be added here.
  const addableUsers = (users || [])
    .filter(u => !alreadyIn.has(u.id) && !placedUserIds.has(u.id))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div
      className="modal show"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
        zIndex: 1200, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '75vw', height: '75vh',
          backgroundColor: 'var(--neutral-bg-card)', border: '1.5px solid var(--neutral-border)',
          borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--neutral-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--neutral-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-users" style={{ color: 'var(--primary-color)' }}></i>
              {cell.projectName} — {cell.locationName}
            </h3>
            <div style={{ fontSize: '12.5px', color: 'var(--neutral-muted)', marginTop: '2px' }}>
              {t('manpower.boardTitle', 'Bảng nhân lực ngày')} {formatDisplayDate(cell.reportDate)}
              {' · '}
              {t('manpower.cellMemberCount', '{count} nhân lực').replace('{count}', members.length)}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {viewing ? (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setViewing(null)}
                style={{ padding: '6px 12px', fontSize: '12.5px', marginBottom: '14px' }}
              >
                <i className="fa-solid fa-arrow-left"></i> {t('common.back', 'Quay lại')}
              </button>
              <h4 style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--neutral-dark)', margin: '0 0 12px 0' }}>
                {t('manpower.reportsOf', 'Báo cáo ngày của')} {viewing.userName}
              </h4>
              {viewing.reports.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--neutral-muted)', fontSize: '13px' }}>
                  {t('manpower.noReportForMember', 'Thành viên này không có báo cáo trong ngày (được thêm thủ công vào bảng).')}
                </div>
              ) : (
                viewing.reports.map(report => (
                  <div key={report.id} style={{ border: '1px solid var(--neutral-border)', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--neutral-muted)', marginBottom: '10px' }}>
                      {t('report.statusLabel', 'Trạng thái:')} <strong>{report.status}</strong>
                    </div>
                    {report.cards.map((card, i) => (
                      <div key={i} style={{ border: '1px solid var(--neutral-border)', borderRadius: '6px', padding: '10px 12px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginBottom: '6px', borderBottom: '1px dashed var(--neutral-border)', paddingBottom: '6px' }}>
                          <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f766e', backgroundColor: '#ccfbf1', padding: '2px 6px', borderRadius: '4px' }}>
                            <i className="fa-regular fa-clock"></i> {card.startTime} - {card.endTime}
                          </span>
                          {card.projectName && (
                            <span style={{ fontSize: '11px', fontWeight: 600, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px' }}>
                              {card.projectName}
                            </span>
                          )}
                          {card.locationName && (
                            <span style={{ fontSize: '11px', fontWeight: 600, backgroundColor: '#ecfccb', color: '#4d7c0f', padding: '2px 6px', borderRadius: '4px' }}>
                              <i className="fa-solid fa-location-dot"></i> {card.locationName}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--neutral-dark)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                          {card.content}
                        </div>
                        {card.fileUrl && (
                          <div style={{ marginTop: '6px', fontSize: '11.5px' }}>
                            <a href={card.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                              <i className="fa-solid fa-paperclip"></i> {card.fileName || t('report.hasAttachment', 'Có đính kèm')}
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </>
          ) : (
            <>
              {isLoading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-muted)' }}>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                </div>
              ) : members.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-muted)', fontSize: '13px' }}>
                  {t('manpower.noCellMembers', 'Chưa có nhân lực nào trong ô này.')}
                </div>
              ) : (
                <div style={{ border: '1px solid var(--neutral-border)', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px' }}>
                  {members.map(member => (
                    <div
                      key={member.user_id}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderBottom: '1px solid var(--neutral-border)', flexWrap: 'wrap' }}
                    >
                      <span style={{ flex: 1, minWidth: '160px', fontSize: '13.5px', fontWeight: 600, color: 'var(--neutral-dark)' }}>
                        {member.user_name}
                        {member.email && <span style={{ fontWeight: 400, color: 'var(--neutral-muted)', fontSize: '12px' }}> · {member.email}</span>}
                      </span>
                      {member.source === 'manual' ? (
                        <span style={{ fontSize: '11px', fontWeight: 600, backgroundColor: 'var(--neutral-bg-hover)', color: 'var(--neutral-muted)', padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
                          {t('manpower.manuallyAdded', 'Thêm thủ công')}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewReports(member)}
                          style={{ padding: '5px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                        >
                          <i className="fa-solid fa-file-lines"></i> {t('manpower.viewReportBtn', 'Xem báo cáo')}
                        </button>
                      )}
                      {member.source === 'manual' && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={isBusy}
                          onClick={() => handleRemoveMember(member)}
                          style={{ padding: '5px 12px', fontSize: '12px', color: 'var(--danger-color)', whiteSpace: 'nowrap' }}
                        >
                          <i className="fa-solid fa-user-minus"></i> {t('common.delete', 'Xóa')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--neutral-dark)', margin: '0 0 8px 0' }}>
                {t('manpower.addMemberTitle', 'Bổ sung thành viên vào ô này')}
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--neutral-muted)', margin: '0 0 10px 0' }}>
                {t('manpower.addMemberHint3', 'Danh sách chỉ gồm thành viên chưa làm báo cáo và chưa được thêm vào ô nào trong ngày. Người được thêm ở đây không có nội dung báo cáo, chỉ được tính vào số nhân lực của ô.')}
              </p>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  disabled={isBusy || addableUsers.length === 0}
                  style={{
                    flex: 1, minWidth: '240px', padding: '8px 10px', borderRadius: '4px',
                    border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)',
                    color: 'var(--neutral-dark)', fontSize: '13px', outline: 'none'
                  }}
                >
                  <option value="">
                    {addableUsers.length === 0
                      ? t('manpower.noAddableMembers2', '-- Mọi thành viên đều đã được tính trong ngày --')
                      : t('manpower.selectMemberPlaceholder', '-- Chọn thành viên --')}
                  </option>
                  {addableUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name}{u.department_name ? ` (${u.department_name})` : ''}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAddMember}
                  disabled={isBusy || !newUserId}
                  style={{ padding: '8px 14px', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  <i className="fa-solid fa-user-plus"></i> {t('manpower.addMemberBtn', 'Thêm vào ô')}
                </button>
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--neutral-border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '8px 18px', fontSize: '13px', fontWeight: 600 }}>
            {t('common.close', 'Đóng')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Team picker. A native <select> cannot hold checkboxes, so this is a custom dropdown.
// The board's scope is always a Team (Parts are never selected on their own): clicking a
// Team switches to it, and its Parts appear underneath as checkboxes that choose whose
// data is shown. Unticking a Part hides that Part's rows from the board.
function ScopePicker({ scopeOptions, selectedScope, onSelectScope, excludedPartIds, onTogglePart, t }) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    const handleKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  // Only Teams (plus the Admin-only legacy bucket) can be picked as the scope.
  const selectableScopes = scopeOptions.filter(s => s.level !== 'part');
  const selected = selectableScopes.find(s => s.department_id === selectedScope);
  const selectedTeamParts = selected?.level === 'team'
    ? scopeOptions.filter(s => s.level === 'part' && s.teamId === selected.department_id)
    : [];
  const includedCount = selectedTeamParts.filter(p => !excludedPartIds.has(p.department_id)).length;

  const buttonLabel = !selected
    ? t('manpower.selectTeamPlaceholder', '-- Chọn Team --')
    : selectedTeamParts.length > 0
      ? `${selected.name} (${includedCount}/${selectedTeamParts.length} Part)`
      : selected.name;

  return (
    <div ref={wrapperRef} style={{ position: 'relative', minWidth: '280px' }}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '8px', padding: '7px 10px', borderRadius: '6px',
          border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)',
          color: 'var(--neutral-dark)', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{buttonLabel}</span>
        <i className={isOpen ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'} style={{ fontSize: '11px', flexShrink: 0 }}></i>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 30,
            minWidth: '100%', maxHeight: '340px', overflowY: 'auto',
            backgroundColor: 'var(--neutral-bg-card)', border: '1px solid var(--neutral-border)',
            borderRadius: '6px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.18)', padding: '4px'
          }}
        >
          {selectableScopes.map(scope => {
            const isSelected = scope.department_id === selectedScope;
            const partsOfThisTeam = isSelected ? selectedTeamParts : [];

            return (
              <React.Fragment key={scope.department_id || 'unscoped'}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '7px 8px', borderRadius: '4px', cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--primary-light)' : 'transparent',
                    color: isSelected ? 'var(--primary-color)' : 'var(--neutral-dark)',
                    fontWeight: isSelected ? 700 : 500, fontSize: '13px'
                  }}
                  onClick={() => { onSelectScope(scope.department_id); setIsOpen(false); }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {scope.name}
                  </span>
                </div>

                {/* Parts of the active Team: tick boxes only, they never become the scope */}
                {partsOfThisTeam.map(part => (
                  <div
                    key={part.department_id}
                    onClick={() => onTogglePart(part.department_id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '6px 8px 6px 22px', borderRadius: '4px', cursor: 'pointer',
                      color: 'var(--neutral-dark)', fontSize: '13px'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!excludedPartIds.has(part.department_id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => onTogglePart(part.department_id)}
                      style={{ cursor: 'pointer', margin: 0, flexShrink: 0 }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {part.name}
                    </span>
                  </div>
                ))}
              </React.Fragment>
            );
          })}
          {selectedTeamParts.length > 0 && (
            <div style={{ borderTop: '1px solid var(--neutral-border)', marginTop: '4px', padding: '8px', fontSize: '11.5px', color: 'var(--neutral-muted)' }}>
              <i className="fa-solid fa-circle-info"></i>{' '}
              {t('manpower.partFilterHint', 'Bỏ tick Part để ẩn dữ liệu của Part đó khỏi bảng.')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Editor for the manually curated project list and work-location list that define the
// manpower board's rows and columns. Deliberately unrelated to the real `project` table.
function ManpowerInfoModal({ isOpen, onClose, locations, onChanged, departments, scopeOptions, initialScope }) {
  const { t } = useLanguage();
  const [newProjectName, setNewProjectName] = useState('');
  const [newLocationName, setNewLocationName] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  // The project list is edited per Team/Part; work locations stay shared company-wide.
  const [modalScope, setModalScope] = useState(initialScope || '');
  const [scopedProjects, setScopedProjects] = useState([]);

  // Drag-and-drop reordering of the project rows. dragIndex is the row being carried,
  // dropIndex the gap it would land in, kept separate so the row under the cursor can be
  // highlighted without committing anything until the drop.
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);

  useEffect(() => {
    if (isOpen) setModalScope(initialScope || '');
  }, [isOpen, initialScope]);

  const loadScopedProjects = useCallback(async () => {
    if (!isOpen || !modalScope) {
      setScopedProjects([]);
      return;
    }
    try {
      // Selecting a Team also lists the projects of every Part inside it.
      const list = await db.getManpowerProjects(getScopeDepartmentIds(departments, modalScope));
      setScopedProjects(list || []);
    } catch (err) {
      console.error('Failed to load scoped manpower projects', err);
      setScopedProjects([]);
    }
  }, [isOpen, modalScope, departments]);

  useEffect(() => { loadScopedProjects(); }, [loadScopedProjects]);

  if (!isOpen) return null;

  const runAction = async (action) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await action();
      await loadScopedProjects();
      await onChanged();
    } catch (err) {
      const Swal = await getSwal();
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    } finally {
      setIsBusy(false);
    }
  };

  const handleAddProject = () => {
    if (!newProjectName.trim() || !modalScope || modalScope === UNSCOPED_SCOPE_ID) return;
    runAction(async () => {
      await db.createManpowerProject(newProjectName.trim(), toApiScope(modalScope));
      setNewProjectName('');
    });
  };

  // Reassigns a project to a different Team/Part. Also how legacy projects sitting in
  // the "(Chưa phân Team/Part)" bucket get moved into a real Team or Part.
  const promptMoveScope = async (project) => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const Swal = await getSwal();
    const assignable = scopeOptions.filter(sc => sc.level !== 'unscoped');
    const { value: target } = await Swal.fire({
      title: t('manpower.moveScopeTitle', 'Chuyển sang Team / Part'),
      input: 'select',
      inputOptions: assignable.reduce((acc, sc) => {
        acc[sc.department_id] = sc.level === 'part' ? `   └ ${sc.name}` : sc.name;
        return acc;
      }, {}),
      inputValue: project.department_id || '',
      showCancelButton: true,
      confirmButtonText: t('common.save', 'Lưu'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--primary-color)',
      inputValidator: (value) => (!value ? t('manpower.selectScopePlaceholder', '-- Chọn Team / Part --') : undefined)
    });
    if (!target || target === project.department_id) return;
    runAction(() => db.setManpowerProjectScope(project.manpower_project_id, target));
  };

  // Applied optimistically so the row follows the cursor immediately, then persisted.
  // On failure the previous order is restored rather than leaving the screen showing an
  // order the database does not have.
  const applyReorder = async (nextOrder) => {
    if (isBusy) return;
    const previous = scopedProjects;
    setScopedProjects(nextOrder);
    setIsBusy(true);
    try {
      await db.reorderManpowerProjects(nextOrder.map(p => p.manpower_project_id));
      await onChanged();
    } catch (err) {
      setScopedProjects(previous);
      const Swal = await getSwal();
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    } finally {
      setIsBusy(false);
    }
  };

  const reorderTo = (from, to) => {
    if (from === to || from < 0 || to < 0 || from >= scopedProjects.length || to >= scopedProjects.length) return;
    const next = [...scopedProjects];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    applyReorder(next);
  };

  const handleAddLocation = () => {
    if (!newLocationName.trim()) return;
    runAction(async () => {
      await db.createManpowerLocation(newLocationName.trim());
      setNewLocationName('');
    });
  };

  const promptRename = async (currentName, onConfirm) => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const Swal = await getSwal();
    const { value: name } = await Swal.fire({
      title: t('manpower.renameTitle', 'Sửa tên'),
      input: 'text',
      inputValue: currentName,
      showCancelButton: true,
      confirmButtonText: t('common.save', 'Lưu'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--primary-color)',
      inputValidator: (value) => (!value || !value.trim()) ? t('manpower.nameRequired', 'Vui lòng nhập tên') : undefined
    });
    if (!name || name.trim() === currentName) return;
    runAction(() => onConfirm(name.trim()));
  };

  const confirmDelete = async (itemName, onConfirm) => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const Swal = await getSwal();
    const result = await Swal.fire({
      icon: 'warning',
      title: t('manpower.deleteConfirmTitle', 'Xóa mục này?'),
      text: itemName,
      showCancelButton: true,
      confirmButtonText: t('common.delete', 'Xóa'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--danger-color)'
    });
    if (!result.isConfirmed) return;
    runAction(onConfirm);
  };

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    borderBottom: '1px solid var(--neutral-border)'
  };
  const smallBtn = {
    padding: '4px 10px',
    fontSize: '12px',
    borderRadius: '4px',
    border: '1px solid var(--neutral-border)',
    backgroundColor: 'var(--neutral-bg-card)',
    color: 'var(--neutral-dark)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0
  };
  const dangerBtn = { ...smallBtn, border: '1px solid #fecaca', color: '#ef4444' };

  const iconBtn = { ...smallBtn, padding: '4px 7px' };

  // onReorder makes the list drag-and-droppable and adds the up/down buttons. The buttons
  // are not a fallback afterthought: dragging is awkward for a single-step nudge, and it
  // is the only way to reorder from a keyboard.
  const renderList = (items, idKey, emptyText, onRename, onDelete, onMove, renderBadge, onReorder) => (
    <div style={{ border: '1px solid var(--neutral-border)', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
      {items.length === 0 ? (
        <div style={{ padding: '14px', textAlign: 'center', fontSize: '12.5px', color: 'var(--neutral-muted)' }}>{emptyText}</div>
      ) : (
        items.map((item, index) => {
          const isDragging = onReorder && dragIndex === index;
          const isDropTarget = onReorder && dropIndex === index && dragIndex !== index;
          return (
            <div
              key={item[idKey]}
              draggable={!!onReorder && !isBusy}
              onDragStart={onReorder ? (e) => {
                setDragIndex(index);
                // Firefox will not start a drag without some payload on the event.
                e.dataTransfer.effectAllowed = 'move';
                try { e.dataTransfer.setData('text/plain', String(index)); } catch (err) { /* older browsers */ }
              } : undefined}
              onDragOver={onReorder ? (e) => { e.preventDefault(); setDropIndex(index); } : undefined}
              onDragLeave={onReorder ? () => setDropIndex(prev => (prev === index ? null : prev)) : undefined}
              onDrop={onReorder ? (e) => {
                e.preventDefault();
                if (dragIndex !== null) onReorder(dragIndex, index);
                setDragIndex(null);
                setDropIndex(null);
              } : undefined}
              onDragEnd={onReorder ? () => { setDragIndex(null); setDropIndex(null); } : undefined}
              style={{
                ...rowStyle,
                opacity: isDragging ? 0.45 : 1,
                backgroundColor: isDropTarget ? 'rgba(59, 130, 246, 0.16)' : undefined,
                // shows which side of the row the dragged item will land on
                borderTop: isDropTarget && dragIndex > index ? '2px solid var(--primary-color)' : undefined,
                borderBottom: isDropTarget && dragIndex < index
                  ? '2px solid var(--primary-color)'
                  : '1px solid var(--neutral-border)'
              }}
            >
              {onReorder && (
                <i
                  className="fa-solid fa-grip-vertical"
                  title={t('manpower.dragToReorder', 'Kéo để đổi thứ tự')}
                  style={{ color: 'var(--neutral-muted)', cursor: isBusy ? 'default' : 'grab', flexShrink: 0 }}
                ></i>
              )}
              <span style={{ flex: 1, minWidth: 0, fontSize: '13.5px', fontWeight: 500, color: 'var(--neutral-dark)' }}>{item.name}</span>
              {renderBadge && renderBadge(item)}
              {onReorder && (
                <>
                  <button
                    type="button" style={iconBtn} disabled={isBusy || index === 0}
                    title={t('manpower.moveUp', 'Lên trên')}
                    onClick={() => onReorder(index, index - 1)}
                  >
                    <i className="fa-solid fa-arrow-up"></i>
                  </button>
                  <button
                    type="button" style={iconBtn} disabled={isBusy || index === items.length - 1}
                    title={t('manpower.moveDown', 'Xuống dưới')}
                    onClick={() => onReorder(index, index + 1)}
                  >
                    <i className="fa-solid fa-arrow-down"></i>
                  </button>
                </>
              )}
              {onMove && (
                <button type="button" style={smallBtn} disabled={isBusy} onClick={() => onMove(item)}>
                  <i className="fa-solid fa-right-left"></i> {t('manpower.moveScopeBtn', 'Chuyển')}
                </button>
              )}
              <button type="button" style={smallBtn} disabled={isBusy} onClick={() => promptRename(item.name, (name) => onRename(item[idKey], name))}>
                <i className="fa-solid fa-pen"></i> {t('manpower.renameBtn', 'Sửa tên')}
              </button>
              <button type="button" style={dangerBtn} disabled={isBusy} onClick={() => confirmDelete(item.name, () => onDelete(item[idKey]))}>
                <i className="fa-solid fa-trash-can"></i> {t('common.delete', 'Xóa')}
              </button>
            </div>
          );
        })
      )}
    </div>
  );

  const addRow = (value, setValue, placeholder, onAdd, addLabel) => (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }}
        placeholder={placeholder}
        disabled={isBusy}
        style={{
          flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: '4px',
          border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)',
          color: 'var(--neutral-dark)', fontSize: '13px', outline: 'none'
        }}
      />
      <button
        type="button"
        className="btn btn-primary"
        onClick={onAdd}
        disabled={isBusy || !value.trim()}
        style={{ padding: '8px 14px', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
      >
        <i className="fa-solid fa-plus"></i> {addLabel}
      </button>
    </div>
  );

  return (
    <div
      className="modal show"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
        zIndex: 1000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '640px', maxWidth: '94vw', maxHeight: '86vh',
          backgroundColor: 'var(--neutral-bg-card)', border: '1.5px solid var(--neutral-border)',
          borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--neutral-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--neutral-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-diagram-project" style={{ color: 'var(--primary-color)' }}></i>
            {t('manpower.infoModalTitle', 'Thông tin dự án và địa điểm làm việc')}
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div style={{ padding: '20px', overflowY: 'auto' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--neutral-dark)', margin: '0 0 10px 0' }}>
            {t('manpower.ongoingProjects', 'Các dự án đang thực hiện:')}
          </h4>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--neutral-muted)' }}>
              {t('manpower.teamLabel', 'Team:')}
            </label>
            <select
              value={modalScope}
              onChange={(e) => setModalScope(e.target.value)}
              disabled={isBusy}
              style={{
                flex: 1, minWidth: '220px', padding: '7px 10px', borderRadius: '4px',
                border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)',
                color: 'var(--neutral-dark)', fontSize: '13px', fontWeight: 500, outline: 'none'
              }}
            >
              <option value="">{t('manpower.selectTeamPlaceholder', '-- Chọn Team --')}</option>
              {/* Projects belong to a Team, never to an individual Part, so only Teams
                  (plus the Admin-only legacy bucket) appear here. */}
              {scopeOptions.filter(scope => scope.level !== 'part').map(scope => (
                <option key={scope.department_id} value={scope.department_id}>{scope.name}</option>
              ))}
            </select>
          </div>

          {!modalScope ? (
            <div style={{ padding: '14px', textAlign: 'center', fontSize: '12.5px', color: 'var(--neutral-muted)', border: '1px solid var(--neutral-border)', borderRadius: '6px', marginBottom: '12px' }}>
              {t('manpower.pickTeamHint', 'Chọn Team để xem và cập nhật danh sách dự án.')}
            </div>
          ) : (
            <>
              {renderList(
                scopedProjects, 'manpower_project_id',
                t('manpower.noProjectsYet', 'Chưa có dự án nào'),
                (id, name) => db.renameManpowerProject(id, name),
                (id) => db.deleteManpowerProject(id),
                // No "Chuyển" for a real Team: a project stays where it was created.
                // The legacy bucket keeps it, because reassigning is the only way to rescue
                // a project that predates scoping - without it those rows are unreachable.
                modalScope === UNSCOPED_SCOPE_ID ? promptMoveScope : null,
                null,
                reorderTo
              )}
              {/* The legacy bucket is read-only: a new project must belong to a Team/Part */}
              {modalScope !== UNSCOPED_SCOPE_ID && addRow(
                newProjectName, setNewProjectName,
                t('manpower.newProjectPlaceholder', 'Nhập tên dự án mới...'),
                handleAddProject,
                t('manpower.addProjectBtn', 'Thêm dự án mới')
              )}
            </>
          )}

          <div style={{ height: '1px', backgroundColor: 'var(--neutral-border)', margin: '24px 0' }} />

          <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--neutral-dark)', margin: '0 0 10px 0' }}>
            {t('manpower.workLocations', 'Các địa điểm làm việc:')}
          </h4>
          {renderList(
            locations, 'manpower_location_id',
            t('manpower.noLocationsYet', 'Chưa có địa điểm làm việc nào'),
            (id, name) => db.renameManpowerLocation(id, name),
            (id) => db.deleteManpowerLocation(id),
            null
          )}
          {addRow(
            newLocationName, setNewLocationName,
            t('manpower.newLocationPlaceholder', 'Nhập tên địa điểm làm việc mới...'),
            handleAddLocation,
            t('manpower.addLocationBtn', 'Thêm địa điểm làm việc')
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--neutral-border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '8px 18px', fontSize: '13px', fontWeight: 600 }}>
            {t('common.close', 'Đóng')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManpowerTab({ currentUser }) {
  const { t } = useLanguage();
  const { users } = useApp();

  const isAdmin = !!currentUser?.system_role?.includes('Admin');

  const [departments, setDepartments] = useState([]);
  // Which Team or Part the board is showing. Team scope also pulls in its Parts' projects.
  const [selectedScope, setSelectedScope] = useState('');
  // Parts of the selected Team whose data is hidden from the board. Stored as the
  // *excluded* set so a newly created Part is included by default (all ticked).
  const [excludedPartIds, setExcludedPartIds] = useState(() => new Set());
  // Rows exactly as they were read from the saved file, so a project that has dropped
  // out of the current view never loses its stored numbers when the board is saved.
  const loadedRowsRef = useRef([]);
  const [projects, setProjects] = useState([]);
  const [locations, setLocations] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  // { [manpower_project_id]: { values: { [manpower_location_id]: string }, detail: string } }
  const [cells, setCells] = useState({});
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingBoard, setIsLoadingBoard] = useState(false);
  const [savedFileName, setSavedFileName] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [saveError, setSaveError] = useState('');
  // JSON of the rows last written, so an unchanged board never triggers a write.
  const lastSavedSignatureRef = useRef('');
  // "<projectId>|<locationId>" -> true for cells whose number came from daily reports,
  // used only to mark them visually so the source of the figure is obvious.
  const [autoFilledCells, setAutoFilledCells] = useState({});
  // "<projectId>|<locationId>" -> the names making up that cell, shown on hover.
  const [cellNames, setCellNames] = useState({});
  // The cell whose detail popup is open (double-click), null when closed.
  const [openCell, setOpenCell] = useState(null);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  // Right-click menu over the grid: { x, y } while open, null when closed.
  const [contextMenu, setContextMenu] = useState(null);
  const contextMenuRef = useRef(null);

  // Rectangular cell-range selection over the headcount columns, so a block of cells
  // can be copied out as Excel-compatible TSV (and an Excel block pasted back in).
  // { anchor: {r, c}, focus: {r, c} } as indices into projects[] / locations[].
  const [selection, setSelection] = useState(null);
  const isDraggingRef = useRef(false);

  // Team/Part options this account may act on: Admin gets every Team and Part, while a
  // Team Leader or Part Leader is confined to their own Team subtree.
  const scopeOptions = useMemo(
    () => getAllowedScopes(departments, currentUser, { includeUnscoped: true }),
    [departments, currentUser]
  );

  // Who may be added to a cell: an Admin can pick anyone, while a Team Leader or Part
  // Leader is limited to their own Team — a Part Leader can still pick people from the
  // other Parts of that same Team, just never from another Team.
  const assignableUsers = useMemo(() => {
    if (isAdmin) return users || [];
    const ownTeamId = getOwningTeamId(departments, currentUser?.department_id);
    if (!ownTeamId) return [];
    const allowedDeptIds = new Set(getScopeDepartmentIds(departments, ownTeamId));
    return (users || []).filter(u => allowedDeptIds.has(u.department_id));
  }, [users, departments, currentUser?.department_id, isAdmin]);

  const selectedScopeName = useMemo(
    () => scopeOptions.find(s => s.department_id === selectedScope)?.name || '',
    [scopeOptions, selectedScope]
  );

  useEffect(() => {
    let cancelled = false;
    db.getDepartments(currentUser?.id)
      .then(list => { if (!cancelled) setDepartments(list || []); })
      .catch(() => { if (!cancelled) setDepartments([]); });
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  // The board's scope is always a Team. Defaults to the user's own Team, and a scope that
  // is (or has become) a Part snaps up to that Part's Team — Parts are filtered with the
  // tick boxes instead of being selected on their own.
  useEffect(() => {
    if (scopeOptions.length === 0) return;
    const teamScopes = scopeOptions.filter(s => s.level !== 'part');

    if (selectedScope) {
      const current = scopeOptions.find(s => s.department_id === selectedScope);
      if (current && current.level === 'part') {
        setSelectedScope(current.teamId || teamScopes[0]?.department_id || '');
      }
      return;
    }

    const ownTeamId = getOwningTeamId(departments, currentUser?.department_id);
    const preferred = teamScopes.find(s => s.department_id === ownTeamId) || teamScopes[0];
    if (preferred) setSelectedScope(preferred.department_id);
  }, [scopeOptions, selectedScope, departments, currentUser?.department_id]);

  // Switching Team starts again with every Part of that Team ticked.
  useEffect(() => { setExcludedPartIds(new Set()); }, [selectedScope]);

  const toggleExcludedPart = (partId) => {
    setExcludedPartIds(prev => {
      const next = new Set(prev);
      if (next.has(partId)) next.delete(partId); else next.add(partId);
      return next;
    });
  };

  // Departments feeding the board: the selected Team always counts, its Parts only while
  // ticked. Projects live on the Team now, but keeping the subtree means a project still
  // pointing at a Part (e.g. created before that rule) is never stranded off the board.
  const effectiveScopeIds = useMemo(() => {
    const all = getScopeDepartmentIds(departments, selectedScope);
    return all.filter(id => id === selectedScope || !excludedPartIds.has(id));
  }, [departments, selectedScope, excludedPartIds]);

  const loadConfig = useCallback(async () => {
    try {
      const scopeIds = effectiveScopeIds;
      const [projList, locList, reportList] = await Promise.all([
        selectedScope ? db.getManpowerProjects(scopeIds).catch(() => []) : Promise.resolve([]),
        db.getManpowerLocations().catch(() => []),
        selectedScope ? db.getManpowerReports(toApiScope(selectedScope)).catch(() => []) : Promise.resolve([])
      ]);
      setProjects(projList || []);
      setLocations(locList || []);
      setReports(reportList || []);
    } catch (err) {
      console.error('Failed to load manpower config', err);
    }
  }, [effectiveScopeIds, selectedScope]);

  const loadBoard = useCallback(async (dateStr) => {
    if (!selectedScope) {
      loadedRowsRef.current = [];
      setCellNames({});
      setCells({});
      setSavedFileName('');
      return;
    }
    setIsLoadingBoard(true);
    try {
      const [res, headcount] = await Promise.all([
        db.getManpowerReport(dateStr, toApiScope(selectedScope)),
        db.getManpowerHeadcount(dateStr, effectiveScopeIds, [...excludedPartIds]).catch(() => ({}))
      ]);
      loadedRowsRef.current = res?.data?.rows || [];
      // Baseline for the auto-save comparison: what the stored file already contains.
      lastSavedSignatureRef.current = JSON.stringify(res?.data?.rows || []);
      setSaveError('');
      setSavedAt(null);
      const next = {};
      // Only the free-text detail is restored from the saved file. The numbers are
      // ALWAYS recomputed below from reports + hand-added members: seeding them from the
      // file would leave a stale figure behind whenever a cell empties out (removing the
      // last member produces no headcount entry, so nothing would overwrite the old one).
      (res?.data?.rows || []).forEach(row => {
        next[row.manpower_project_id] = { values: {}, detail: row.detail || '' };
      });

      // Anyone who filed a daily report for this day against a project + work location
      // is counted straight into the matching cell. Recomputed on every load rather
      // than added on top, so editing or deleting a report can never double count.
      const auto = {};
      const names = {};
      Object.entries(headcount || {}).forEach(([projectId, byLocation]) => {
        const row = next[projectId] || { values: {}, detail: '' };
        const values = { ...row.values };
        Object.entries(byLocation).forEach(([locationId, cell]) => {
          values[locationId] = String(cell.count);
          auto[`${projectId}|${locationId}`] = true;
          names[`${projectId}|${locationId}`] = cell.names || [];
        });
        next[projectId] = { ...row, values };
      });

      setAutoFilledCells(auto);
      setCellNames(names);
      setCells(next);
      setSavedFileName(res?.exists ? (res.file_name || '') : '');
    } catch (err) {
      console.error('Failed to load manpower board', err);
      loadedRowsRef.current = [];
      setAutoFilledCells({});
      setCellNames({});
      setCells({});
      setSavedFileName('');
    } finally {
      setIsLoadingBoard(false);
    }
  }, [selectedScope, effectiveScopeIds, excludedPartIds]);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { loadBoard(selectedDate); }, [selectedDate, loadBoard]);

  const updateDetail = (projectId, value) => {
    setCells(prev => {
      const row = prev[projectId] || { values: {}, detail: '' };
      return { ...prev, [projectId]: { ...row, detail: value } };
    });
  };

  // Total headcount across every cell of the board, excluding the free-text detail column.
  const totalManpower = useMemo(() => {
    let sum = 0;
    projects.forEach(p => {
      const row = cells[p.manpower_project_id];
      if (!row) return;
      locations.forEach(loc => {
        const n = parseInt(row.values?.[loc.manpower_location_id], 10);
        if (!Number.isNaN(n)) sum += n;
      });
    });
    return sum;
  }, [cells, projects, locations]);

  useEffect(() => {
    const stopDragging = () => { isDraggingRef.current = false; };
    window.addEventListener('mouseup', stopDragging);
    return () => window.removeEventListener('mouseup', stopDragging);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onMouseDown = (e) => {
      // Clicks inside the menu (i.e. on "Copy") must not dismiss it first.
      if (contextMenuRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  const selectionBounds = selection ? {
    r1: Math.min(selection.anchor.r, selection.focus.r),
    r2: Math.max(selection.anchor.r, selection.focus.r),
    c1: Math.min(selection.anchor.c, selection.focus.c),
    c2: Math.max(selection.anchor.c, selection.focus.c)
  } : null;

  const isCellSelected = (r, c) => !!selectionBounds
    && r >= selectionBounds.r1 && r <= selectionBounds.r2
    && c >= selectionBounds.c1 && c <= selectionBounds.c2;

  // The free-text "Chi tiết công việc của dự án" column sits after the headcount
  // columns and takes part in selection / copy / paste as one extra column.
  // Column layout for selection/copy purposes: 0 = project name, 1..n = the headcount
  // columns, n+1 = "Chi tiết công việc". The name column takes part so a copied block
  // pasted into Excel carries the project it belongs to.
  const NAME_COL = 0;
  const detailColIndex = locations.length + 1;
  const totalCols = locations.length + 2;

  const readCell = (r, c) => {
    const project = projects[r];
    if (!project) return '';
    if (c === NAME_COL) return project.name || '';
    const row = cells[project.manpower_project_id];
    if (c === detailColIndex) return row?.detail || '';
    const loc = locations[c - 1];
    return (loc && row?.values?.[loc.manpower_location_id]) || '';
  };

  const handleCellMouseDown = (r, c, e) => {
    // A right-click also fires mousedown, and it fires *before* contextmenu. Restarting
    // the selection here would collapse the user's block to one cell right before the
    // Copy menu opens, so only the left button starts a new selection.
    if (e && e.button !== 0) return;
    isDraggingRef.current = true;
    setSelection({ anchor: { r, c }, focus: { r, c } });
  };

  const handleCellMouseEnter = (r, c) => {
    if (!isDraggingRef.current) return;
    setSelection(prev => (prev ? { ...prev, focus: { r, c } } : { anchor: { r, c }, focus: { r, c } }));
    // Dragging across cells would otherwise leave a native text-selection smear.
    const sel = window.getSelection?.();
    if (sel && !sel.isCollapsed) sel.removeAllRanges();
  };

  const handleCellKeyDown = (e, r, c) => {
    // Shift+click/arrow keeps the anchor and moves only the focus, like a spreadsheet.
    if (!e.shiftKey) return;
    const deltas = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const delta = deltas[e.key];
    if (!delta) return;
    e.preventDefault();
    setSelection(prev => {
      const base = prev || { anchor: { r, c }, focus: { r, c } };
      const nr = Math.min(projects.length - 1, Math.max(0, base.focus.r + delta[0]));
      const nc = Math.min(totalCols - 1, Math.max(0, base.focus.c + delta[1]));
      return { ...base, focus: { r: nr, c: nc } };
    });
  };

  // The selected block as tab/newline separated values, which Excel pastes straight back
  // into the matching grid of cells. Multi-line detail text gets quoted, so Excel still
  // lands it inside one cell.
  const buildSelectionTsv = () => {
    if (!selectionBounds) return '';
    const { r1, r2, c1, c2 } = selectionBounds;
    const matrix = [];
    for (let r = r1; r <= r2; r++) {
      const cols = [];
      for (let c = c1; c <= c2; c++) cols.push(readCell(r, c));
      matrix.push(cols);
    }
    return toTsv(matrix);
  };

  const handleCopy = (e) => {
    if (!selectionBounds) return;
    const { r1, r2, c1, c2 } = selectionBounds;
    if (r1 === r2 && c1 === c2) return; // single cell → let the input's native copy run
    e.clipboardData.setData('text/plain', buildSelectionTsv());
    e.preventDefault();
  };

  // Right-click → Copy. The async Clipboard API only exists in a secure context, so a
  // deployment served over plain HTTP falls back to the old execCommand path.
  const copySelectionToClipboard = async () => {
    const text = buildSelectionTsv();
    setContextMenu(null);
    if (!text) return;

    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard api unavailable');
      await navigator.clipboard.writeText(text);
      return;
    } catch (err) {
      const helper = document.createElement('textarea');
      helper.value = text;
      helper.setAttribute('readonly', '');
      helper.style.position = 'fixed';
      helper.style.top = '-1000px';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      let copied = false;
      try {
        copied = document.execCommand('copy');
      } catch (e2) {
        copied = false;
      }
      document.body.removeChild(helper);
      if (!copied) {
        const Swal = await getSwal();
        Swal.fire({
          icon: 'error',
          title: t('common.failed', 'Thất bại'),
          text: t('manpower.copyFailed', 'Không thể copy. Vui lòng dùng Ctrl+C.')
        });
      }
    }
  };

  const handleCellContextMenu = (e, r, c) => {
    e.preventDefault();
    // Right-clicking outside the current block selects that cell first, like a spreadsheet.
    if (!isCellSelected(r, c)) setSelection({ anchor: { r, c }, focus: { r, c } });
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Pasting an Excel block spreads it right/down from the selection's top-left cell.
  const handlePaste = (e) => {
    if (e.target?.dataset?.mpDetail === '1') return; // the detail column keeps normal paste
    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;

    // Quote-aware parse: a detail cell copied out of Excel may itself contain
    // newlines and tabs, which a naive split on \n / \t would shred into extra cells.
    const matrix = parseTsv(text);
    if (matrix.length === 1 && matrix[0].length === 1) return; // single value → native paste (onChange sanitizes)
    if (!selectionBounds) return;

    e.preventDefault();
    const { r1, c1 } = selectionBounds;
    setCells(prev => {
      const next = { ...prev };
      matrix.forEach((cols, i) => {
        const project = projects[r1 + i];
        if (!project) return;
        const row = next[project.manpower_project_id] || { values: {}, detail: '' };
        let detail = row.detail || '';
        cols.forEach((raw, j) => {
          // Headcount cells are read-only — they are driven by daily reports and by the
          // members added through the cell popup — so a paste only fills the free-text
          // "Chi tiết công việc" column and silently skips the numeric ones.
          if (c1 + j === detailColIndex) detail = raw;
        });
        next[project.manpower_project_id] = { ...row, detail };
      });
      return next;
    });

    const lastRow = Math.min(projects.length - 1, r1 + matrix.length - 1);
    const lastCol = Math.min(totalCols - 1, c1 + Math.max(...matrix.map(m => m.length)) - 1);
    setSelection({ anchor: { r: r1, c: c1 }, focus: { r: lastRow, c: lastCol } });
  };

  // The rows that would be written for the current view. Un-ticked Parts are hidden from
  // the view, not deleted, so their previously saved rows are carried through untouched.
  const buildBoardRows = () => {
    const rows = projects.map(p => ({
      manpower_project_id: p.manpower_project_id,
      project_name: p.name,
      values: cells[p.manpower_project_id]?.values || {},
      detail: cells[p.manpower_project_id]?.detail || ''
    }));
    const visibleIds = new Set(projects.map(p => p.manpower_project_id));
    loadedRowsRef.current.forEach(savedRow => {
      if (!visibleIds.has(savedRow.manpower_project_id)) rows.push(savedRow);
    });
    return rows;
  };

  const rowsHaveContent = (rows) => rows.some(row =>
    (row.detail && row.detail.trim()) ||
    Object.values(row.values || {}).some(v => String(v ?? '').trim())
  );

  // Auto-save: there is no save button. Writes the day's .html file whenever the board's
  // data actually differs from what is already stored, and stays quiet otherwise, so
  // merely browsing dates never creates junk files or pointless writes.
  const persistBoard = useCallback(async () => {
    if (!selectedScope || projects.length === 0) return;

    const rows = buildBoardRows();
    const signature = JSON.stringify(rows);
    if (signature === lastSavedSignatureRef.current) return;
    // Nothing worth recording yet, and no file exists to keep in sync.
    if (!savedFileName && !rowsHaveContent(rows)) return;

    setIsSaving(true);
    setSaveError('');
    try {
      await db.saveManpowerReport({
        reportDate: selectedDate,
        departmentId: toApiScope(selectedScope),
        departmentName: selectedScopeName,
        locations: locations.map(l => ({
          manpower_location_id: l.manpower_location_id,
          name: l.name
        })),
        rows,
        savedBy: currentUser?.id
      });
      lastSavedSignatureRef.current = signature;
      setSavedAt(new Date());

      // Deliberately not written to the activity log. The board auto-saves, so a save is
      // not a deliberate user action: merely opening and closing a cell popup reloads the
      // board and triggers one, which filled the log with UPDATE entries nobody performed.

      // A brand new day has to appear in the file combobox straight away.
      if (!savedFileName) await loadConfig();
    } catch (err) {
      setSaveError(err.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
    // buildBoardRows reads cells/projects/locations, which are already in the dep list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScope, selectedScopeName, selectedDate, projects, locations, cells, savedFileName, currentUser?.id, loadConfig]);

  // Debounced so typing in the detail column does not fire a request per keystroke.
  useEffect(() => {
    if (isLoadingBoard) return undefined;
    const timer = setTimeout(() => { persistBoard(); }, 800);
    return () => clearTimeout(timer);
  }, [persistBoard, isLoadingBoard]);

  const handleDeleteReport = async (dateStr, e) => {
    e.stopPropagation();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const Swal = await getSwal();
    const result = await Swal.fire({
      icon: 'warning',
      title: t('manpower.deleteReportConfirmTitle', 'Xóa bảng nhân lực của ngày này?'),
      text: formatDisplayDate(dateStr),
      showCancelButton: true,
      confirmButtonText: t('common.delete', 'Xóa'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--danger-color)'
    });
    if (!result.isConfirmed) return;
    try {
      await db.deleteManpowerReport(dateStr, toApiScope(selectedScope), currentUser?.id);
      await loadConfig();
      if (dateStr === selectedDate) await loadBoard(selectedDate);
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    }
  };

  const cellInputStyle = {
    width: '100%',
    padding: '6px 4px',
    borderRadius: '3px',
    border: '1px solid transparent',
    backgroundColor: 'transparent',
    color: 'var(--neutral-dark)',
    fontSize: '13px',
    textAlign: 'center',
    outline: 'none',
    boxSizing: 'border-box'
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsInfoModalOpen(true)}
          style={{ padding: '9px 16px', fontSize: '13px', fontWeight: 600 }}
        >
          <i className="fa-solid fa-diagram-project"></i> {t('manpower.updateInfoBtn', 'Cập nhật thông tin dự án')}
        </button>
      </div>

      {/* The board spans the full width; the saved-files list lives in the combobox below.
          minWidth:0 keeps the wide table scrolling inside its own container instead of
          stretching this flex column and forcing a page-level horizontal scrollbar. */}
      <div>
        <div className="doc-main-panel" style={{ minWidth: 0 }}>
          {/* Team / Part scope: drives which projects are rows and which day-files exist */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--neutral-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('manpower.viewByTeam', 'Xem theo Team')}
            </label>
            <ScopePicker
              scopeOptions={scopeOptions}
              selectedScope={selectedScope}
              onSelectScope={setSelectedScope}
              excludedPartIds={excludedPartIds}
              onTogglePart={toggleExcludedPart}
              t={t}
            />
          </div>

          {/* Saved daily .html files for this scope, newest first, capped at 30 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--neutral-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('manpower.fileListTitle', 'File nhân lực theo ngày')}
            </label>
            <select
              value={reports.some(r => r.report_date === selectedDate) ? selectedDate : ''}
              onChange={(e) => { if (e.target.value) setSelectedDate(e.target.value); }}
              style={{
                minWidth: '280px', padding: '7px 10px', borderRadius: '6px',
                border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-card)',
                color: 'var(--neutral-dark)', fontSize: '13px', fontWeight: 500, outline: 'none'
              }}
            >
              <option value="">
                {reports.length === 0
                  ? t('manpower.noReportsYet', 'Chưa có file nào được lưu')
                  : t('manpower.selectFilePlaceholder', '-- Chọn file nhân lực --')}
              </option>
              {reports.slice(0, 30).map(r => (
                <option key={r.report_date} value={r.report_date}>
                  {r.file_name} ({formatDisplayDate(r.report_date)})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsStatusOpen(true)}
              style={{ marginLeft: 'auto', padding: '7px 14px', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              <i className="fa-solid fa-user-clock"></i> {t('manpower.reportStatusBtn', 'Kiểm tra tình trạng báo cáo')}
            </button>

            {/* Downloading and deleting the raw .html board are Admin-only; a Team
                Leader / Part Leader only reads the board. */}
            {savedFileName && isAdmin && (
              <>
                <a
                  className="btn btn-secondary btn-sm"
                  href={db.getManpowerReportDownloadUrl(selectedDate, toApiScope(selectedScope), currentUser?.id)}
                  title={t('common.download', 'Tải về')}
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                >
                  <i className="fa-solid fa-download"></i>
                </a>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  title={t('common.delete', 'Xóa')}
                  onClick={(e) => handleDeleteReport(selectedDate, e)}
                  style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--danger-color)' }}
                >
                  <i className="fa-solid fa-trash-can"></i>
                </button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--neutral-dark)', margin: 0 }}>
                {t('manpower.boardTitle', 'Bảng nhân lực ngày')} {formatDisplayDate(selectedDate)}
                {selectedScopeName && <span style={{ color: 'var(--primary-color)' }}> — {selectedScopeName}</span>}
              </h3>
              <input
                type="date"
                value={selectedDate}
                max={getTodayDateString()}
                onChange={(e) => { if (e.target.value) setSelectedDate(e.target.value); }}
                style={{
                  padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--neutral-border)',
                  backgroundColor: 'var(--neutral-bg-card)', color: 'var(--neutral-dark)',
                  fontSize: '13px', outline: 'none'
                }}
              />
              <span
                style={{
                  fontSize: '12.5px', fontWeight: 700, color: 'var(--primary-color)',
                  backgroundColor: 'var(--primary-light)', padding: '4px 10px', borderRadius: '12px',
                  whiteSpace: 'nowrap'
                }}
              >
                {t('manpower.totalLabel', 'Tổng nhân lực')}: {totalManpower}
              </span>
              {savedFileName && (
                <span style={{ fontSize: '11.5px', color: 'var(--neutral-muted)' }}>
                  <i className="fa-solid fa-file-code"></i> {savedFileName}
                </span>
              )}
            </div>
            {/* No save button: the board writes its .html file by itself. This just
                reports what the auto-save is doing. */}
            <span style={{ fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap', color: saveError ? 'var(--danger-color)' : 'var(--neutral-muted)' }}>
              {saveError ? (
                <>
                  <i className="fa-solid fa-triangle-exclamation"></i>{' '}
                  {t('manpower.autoSaveFailed', 'Lưu tự động thất bại')}: {saveError}
                </>
              ) : isSaving ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>{' '}
                  {t('common.saving', 'Đang lưu...')}
                </>
              ) : savedAt ? (
                <>
                  <i className="fa-solid fa-check" style={{ color: 'var(--success-color, #16a34a)' }}></i>{' '}
                  {t('manpower.autoSavedAt', 'Đã tự động lưu lúc {time}').replace('{time}', savedAt.toLocaleTimeString())}
                </>
              ) : (
                <>
                  <i className="fa-solid fa-cloud"></i>{' '}
                  {t('manpower.autoSaveOn', 'Tự động lưu')}
                </>
              )}
            </span>
          </div>

          {projects.length === 0 || locations.length === 0 ? (
            <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--neutral-muted)', fontSize: '13.5px' }}>
              <i className="fa-solid fa-table-list" style={{ fontSize: '28px', display: 'block', marginBottom: '10px' }}></i>
              {t('manpower.emptyConfigHint', 'Hãy dùng "Cập nhật thông tin dự án" để thêm danh sách dự án và địa điểm làm việc trước.')}
            </div>
          ) : (
            <>
              {/* The table scrolls horizontally inside its own container, so the
                  scrollbar sits directly at the bottom edge of the table. */}
              <div
                onCopy={handleCopy}
                onPaste={handlePaste}
                className="data-table-wrapper"
                style={{ overflowX: 'auto' }}
              >
                <table className="data-table" style={{ minWidth: '900px' }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: '140px' }}></th>
                      {locations.map(loc => (
                        // Headcount columns are ~20% narrower than the default table
                        // header: the shared .data-table th padding (16px each side)
                        // drives most of the width here, so it is trimmed too.
                        <th
                          key={loc.manpower_location_id}
                          style={{ textAlign: 'center', minWidth: '56px', width: '56px', padding: '12px 6px' }}
                        >
                          {loc.name}
                        </th>
                      ))}
                      <th style={{ minWidth: '330px' }}>{t('manpower.detailColumn', 'Chi tiết công việc của dự án')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p, rowIndex) => (
                      <tr key={p.manpower_project_id}>
                        <td
                          onMouseDown={(e) => handleCellMouseDown(rowIndex, NAME_COL, e)}
                          onMouseEnter={() => handleCellMouseEnter(rowIndex, NAME_COL)}
                          onContextMenu={(e) => handleCellContextMenu(e, rowIndex, NAME_COL)}
                          style={{
                            fontWeight: 600,
                            cursor: 'default',
                            backgroundColor: isCellSelected(rowIndex, NAME_COL) ? 'rgba(59, 130, 246, 0.22)' : undefined
                          }}
                        >
                          {p.name}
                        </td>
                        {locations.map((loc, colIndex) => {
                          const gridCol = colIndex + 1; // column 0 is the project name
                          const selected = isCellSelected(rowIndex, gridCol);
                          const cellKey = `${p.manpower_project_id}|${loc.manpower_location_id}`;
                          const isAuto = !!autoFilledCells[cellKey];
                          // Hovering lists the people in this cell, one name per line, so
                          // a leader can scan the board without opening each cell.
                          const hoverNames = cellNames[cellKey] || [];
                          const hoverTitle = hoverNames.length > 0
                            ? hoverNames.join('\n')
                            : t('manpower.cellReadOnlyTooltip', 'Nhấp đúp để xem danh sách nhân lực và bổ sung thành viên. Không sửa số trực tiếp tại đây.');
                          return (
                            <td
                              key={loc.manpower_location_id}
                              onMouseDown={(e) => handleCellMouseDown(rowIndex, gridCol, e)}
                              onMouseEnter={() => handleCellMouseEnter(rowIndex, gridCol)}
                              onContextMenu={(e) => handleCellContextMenu(e, rowIndex, gridCol)}
                              onDoubleClick={() => setOpenCell({
                                reportDate: selectedDate,
                                projectId: p.manpower_project_id,
                                projectName: p.name,
                                locationId: loc.manpower_location_id,
                                locationName: loc.name
                              })}
                              style={{
                                padding: '2px',
                                backgroundColor: selected
                                  ? 'rgba(59, 130, 246, 0.22)'
                                  : (isAuto ? 'rgba(22, 163, 74, 0.14)' : undefined)
                              }}
                            >
                              <input
                                type="text"
                                inputMode="numeric"
                                value={cells[p.manpower_project_id]?.values?.[loc.manpower_location_id] || ''}
                                readOnly
                                onKeyDown={(e) => handleCellKeyDown(e, rowIndex, gridCol)}
                                disabled={isLoadingBoard}
                                title={hoverTitle}
                                style={{
                                  ...cellInputStyle,
                                  cursor: 'pointer',
                                  ...(isAuto ? { fontWeight: 700, color: 'var(--success-color, #16a34a)' } : {})
                                }}
                              />
                            </td>
                          );
                        })}
                        <td
                          onMouseDown={(e) => handleCellMouseDown(rowIndex, detailColIndex, e)}
                          onMouseEnter={() => handleCellMouseEnter(rowIndex, detailColIndex)}
                          style={{
                            padding: '2px',
                            backgroundColor: isCellSelected(rowIndex, detailColIndex) ? 'rgba(59, 130, 246, 0.22)' : undefined
                          }}
                        >
                          <textarea
                            data-mp-detail="1"
                            rows={2}
                            value={cells[p.manpower_project_id]?.detail || ''}
                            onChange={(e) => updateDetail(p.manpower_project_id, e.target.value)}
                            onKeyDown={(e) => handleCellKeyDown(e, rowIndex, detailColIndex)}
                            disabled={isLoadingBoard}
                            style={{
                              ...cellInputStyle,
                              textAlign: 'left',
                              resize: 'vertical',
                              minHeight: '42px',
                              lineHeight: 1.45,
                              fontFamily: 'inherit'
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--neutral-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span>
                  <i className="fa-solid fa-circle-info"></i>{' '}
                  {t('manpower.selectionHint', 'Kéo chuột để bôi đen nhiều ô, rồi Ctrl+C hoặc click chuột phải chọn Copy để copy sang Excel. Ctrl+V chỉ dán được vào cột Chi tiết công việc.')}
                </span>
                <span>
                  <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', backgroundColor: 'rgba(22, 163, 74, 0.35)', marginRight: '4px' }}></span>
                  {t('manpower.autoCountHint', 'Ô nền xanh được đếm tự động từ báo cáo ngày của nhân viên; mỗi người chỉ tính 1 lần theo khung giờ cuối cùng trong ngày. Nhấp đúp vào ô để xem danh sách tên và bổ sung thành viên.')}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 1400,
            backgroundColor: 'var(--neutral-bg-card)',
            border: '1px solid var(--neutral-border)',
            borderRadius: '6px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)',
            minWidth: '170px',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={copySelectionToClipboard}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
              padding: '10px 14px', border: 'none', background: 'none',
              color: 'var(--neutral-dark)', fontSize: '13.5px', cursor: 'pointer', textAlign: 'left'
            }}
          >
            <i className="fa-regular fa-copy" style={{ width: '14px' }}></i>
            {t('manpower.copySelection', 'Copy')}
          </button>
        </div>
      )}

      <ReportStatusModal
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
        reportDate={selectedDate}
        users={users}
        departments={departments}
        currentUser={currentUser}
      />

      <CellDetailModal
        cell={openCell}
        onClose={() => setOpenCell(null)}
        onChanged={() => loadBoard(selectedDate)}
        users={assignableUsers}
        currentUser={currentUser}
        excludedPartIds={excludedPartIds}
      />

      <ManpowerInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        locations={locations}
        onChanged={loadConfig}
        departments={departments}
        scopeOptions={scopeOptions}
        initialScope={selectedScope}
      />
    </div>
  );
}
