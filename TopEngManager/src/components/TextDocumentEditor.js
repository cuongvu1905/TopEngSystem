"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { db } from '@/utils/db';
import { getSwal } from '@/utils/swal';

const TEXT_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#000000', '#ffffff'];
const FONT_SIZES = [12, 14, 16, 18, 24, 32];
const RESIZE_EDGE_PX = 6;
const NEW_CELL_HTML = 'border:1px solid #94a3b8;padding:6px;min-width:40px;';

function makeCell() {
  const td = document.createElement('td');
  td.setAttribute('style', NEW_CELL_HTML);
  td.innerHTML = '&nbsp;';
  return td;
}

function applyFontSize(px) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const span = document.createElement('span');
  span.style.fontSize = px + 'px';
  try {
    range.surroundContents(span);
  } catch (e) {
    const content = range.extractContents();
    span.appendChild(content);
    range.insertNode(span);
  }
  sel.removeAllRanges();
  const newRange = document.createRange();
  newRange.selectNodeContents(span);
  sel.addRange(newRange);
}

// doc: existing document row (null when creating a brand new text document)
export default function TextDocumentEditor({ doc = null, folderId = null, folderPath = '', projectId = null, currentUser, onClose, onSaved, autoEdit = false }) {
  const { t } = useLanguage();
  const canvasRef = useRef(null);
  const canvasWrapperRef = useRef(null);
  const lockIntervalRef = useRef(null);
  const isNew = !doc;
  const insertingTableRef = useRef(false);
  const dragStateRef = useRef(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(isNew);
  const [canEdit, setCanEdit] = useState(isNew);
  const [lockedByName, setLockedByName] = useState('');
  const [activeTableInfo, setActiveTableInfo] = useState(null);

  const releaseLock = useCallback(() => {
    if (lockIntervalRef.current) {
      clearInterval(lockIntervalRef.current);
      lockIntervalRef.current = null;
    }
    if (doc && canEdit) {
      db.unlockDocument(doc.document_id, currentUser.id).catch(() => {});
    }
  }, [doc, canEdit, currentUser]);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    (async () => {
      try {
        const [contentRes, lockRes] = await Promise.all([
          db.getDocumentContent(doc.document_id),
          db.lockDocument(doc.document_id, currentUser.id)
        ]);
        if (cancelled) return;
        setContent(contentRes.content || '');
        setTitle(doc.original_name.replace(/\.html$/i, ''));
        if (lockRes.success) {
          setCanEdit(true);
          if (autoEdit) setEditing(true);
          lockIntervalRef.current = setInterval(() => {
            db.lockDocument(doc.document_id, currentUser.id).catch(() => {});
          }, 10000);
        } else {
          setCanEdit(false);
          setLockedByName(lockRes.lockedBy || '');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (lockIntervalRef.current) {
        clearInterval(lockIntervalRef.current);
        lockIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.document_id]);

  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.innerHTML = content || '';
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTableInfo(null);
  }, [content, editing]);

  const exec = (command, value = null) => {
    canvasRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const handleForeColor = (color) => exec('foreColor', color);
  const handleBackColor = (color) => {
    canvasRef.current?.focus();
    if (document.queryCommandSupported && document.queryCommandSupported('hiliteColor')) {
      document.execCommand('hiliteColor', false, color);
    } else {
      document.execCommand('backColor', false, color);
    }
  };

  const handleFontSize = (e) => {
    const px = parseInt(e.target.value, 10);
    if (px) applyFontSize(px);
    e.target.value = '';
  };

  // ===== Table active-selection + add row/column =====
  const updateActiveTable = (table) => {
    if (!table || !canvasWrapperRef.current) {
      setActiveTableInfo(null);
      return;
    }
    const wrapperRect = canvasWrapperRef.current.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    setActiveTableInfo({
      table,
      top: tableRect.top - wrapperRect.top,
      left: tableRect.left - wrapperRect.left,
      width: tableRect.width,
      height: tableRect.height
    });
  };

  // ===== Table resize (drag column/row borders) =====
  const handleDragMove = (e) => {
    const state = dragStateRef.current;
    if (!state) return;
    if (state.type === 'col') {
      const delta = e.clientX - state.startPos;
      state.el.style.width = Math.round(Math.max(30, state.start + delta)) + 'px';
    } else {
      const delta = e.clientY - state.startPos;
      state.el.style.height = Math.round(Math.max(20, state.start + delta)) + 'px';
    }
    if (state.table) updateActiveTable(state.table);
  };

  const handleDragEnd = () => {
    dragStateRef.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = '';
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
  };

  const handleCanvasMouseDown = (e) => {
    if (!editing) return;
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const cell = target.closest('td, th');
    if (!cell || !canvasRef.current || !canvasRef.current.contains(cell)) return;
    const table = cell.closest('table');
    const rect = cell.getBoundingClientRect();
    const nearRight = e.clientX >= rect.right - RESIZE_EDGE_PX;
    const nearBottom = e.clientY >= rect.bottom - RESIZE_EDGE_PX;

    if (nearRight) {
      const colIndex = Array.from(cell.parentElement.children).indexOf(cell);
      const colgroup = table && table.querySelector('colgroup');
      const col = colgroup ? colgroup.children[colIndex] : null;
      if (!col) return;
      e.preventDefault();
      dragStateRef.current = { type: 'col', el: col, table, start: col.getBoundingClientRect().width, startPos: e.clientX };
      canvasRef.current.style.cursor = 'col-resize';
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
    } else if (nearBottom) {
      const tr = cell.closest('tr');
      if (!tr) return;
      e.preventDefault();
      dragStateRef.current = { type: 'row', el: tr, table, start: tr.getBoundingClientRect().height, startPos: e.clientY };
      canvasRef.current.style.cursor = 'row-resize';
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (!editing || dragStateRef.current || !canvasRef.current) return;
    const target = e.target;
    const cell = target instanceof HTMLElement ? target.closest('td, th') : null;
    if (!cell || !canvasRef.current.contains(cell)) {
      canvasRef.current.style.cursor = '';
      return;
    }
    const rect = cell.getBoundingClientRect();
    if (e.clientX >= rect.right - RESIZE_EDGE_PX) {
      canvasRef.current.style.cursor = 'col-resize';
    } else if (e.clientY >= rect.bottom - RESIZE_EDGE_PX) {
      canvasRef.current.style.cursor = 'row-resize';
    } else {
      canvasRef.current.style.cursor = '';
    }
  };

  const handleCanvasClick = (e) => {
    if (!editing) return;
    const target = e.target;
    const table = target instanceof HTMLElement ? target.closest('table') : null;
    if (table && canvasRef.current && canvasRef.current.contains(table)) {
      updateActiveTable(table);
    } else {
      setActiveTableInfo(null);
    }
  };

  const handleAddColumn = () => {
    if (!activeTableInfo) return;
    const table = activeTableInfo.table;
    const colgroup = table.querySelector('colgroup');
    if (colgroup) {
      const newCol = document.createElement('col');
      newCol.style.width = '120px';
      colgroup.appendChild(newCol);
    }
    table.querySelectorAll('tr').forEach(tr => tr.appendChild(makeCell()));
    updateActiveTable(table);
  };

  const handleAddRow = () => {
    if (!activeTableInfo) return;
    const table = activeTableInfo.table;
    const rows = table.querySelectorAll('tr');
    const lastRow = rows[rows.length - 1];
    const colCount = lastRow ? lastRow.children.length : 1;
    const newRow = document.createElement('tr');
    for (let i = 0; i < colCount; i++) newRow.appendChild(makeCell());
    const tbody = table.querySelector('tbody') || table;
    tbody.appendChild(newRow);
    updateActiveTable(table);
  };

  const handleInsertTable = async () => {
    if (insertingTableRef.current) return;
    insertingTableRef.current = true;
    try {
    // Opening the SweetAlert2 prompt steals focus from the canvas, which
    // collapses the text selection/cursor position — save it now so the
    // table gets inserted where the user was actually typing, not at the
    // start of the document.
    const sel = window.getSelection();
    const savedRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;

    const Swal = await getSwal();
    const { value: formValues } = await Swal.fire({
      title: t('documents.insertTable', 'Chèn bảng'),
      html:
        `<div style="display:flex; gap:10px; justify-content:center;">` +
        `<input id="doc-table-rows" type="number" min="1" max="20" value="2" class="swal2-input" style="width:100px;" placeholder="${t('documents.rows', 'Số hàng')}">` +
        `<input id="doc-table-cols" type="number" min="1" max="10" value="2" class="swal2-input" style="width:100px;" placeholder="${t('documents.columns', 'Số cột')}">` +
        `</div>`,
      showCancelButton: true,
      confirmButtonText: t('common.create', 'Tạo mới'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--primary-color)',
      preConfirm: () => {
        const rows = parseInt(document.getElementById('doc-table-rows').value, 10);
        const cols = parseInt(document.getElementById('doc-table-cols').value, 10);
        if (!rows || !cols || rows < 1 || cols < 1) {
          Swal.showValidationMessage(t('documents.tableSizeInvalid', 'Vui lòng nhập số hàng/cột hợp lệ'));
          return false;
        }
        return { rows, cols };
      }
    });
    if (!formValues) return;
    const { rows, cols } = formValues;
    let html = '<table style="border-collapse:collapse;table-layout:fixed;">';
    html += '<colgroup>';
    for (let c = 0; c < cols; c++) {
      html += '<col style="width:120px">';
    }
    html += '</colgroup>';
    html += '<tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += `<td style="${NEW_CELL_HTML}">&nbsp;</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';

    canvasRef.current?.focus();
    if (savedRange) {
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
    exec('insertHTML', html);
    } finally {
      insertingTableRef.current = false;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      exec('insertHTML', '&emsp;');
    }
  };

  const handleCancel = () => {
    if (isNew) {
      onClose();
      return;
    }
    if (canvasRef.current) canvasRef.current.innerHTML = content || '';
    setActiveTableInfo(null);
    setEditing(false);
  };

  const handleClose = () => {
    releaseLock();
    onClose();
  };

  const handleSave = async () => {
    const html = canvasRef.current ? canvasRef.current.innerHTML : '';
    if (isNew && !title.trim()) {
      const Swal = await getSwal();
      Swal.fire({ icon: 'warning', title: t('common.warning', 'Cảnh báo'), text: t('documents.docNameRequired', 'Vui lòng nhập tên tài liệu') });
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const created = await db.createTextDocument({ name: title.trim(), folderId, projectId, createdBy: currentUser.id, content: html });
        await db.logActivity(currentUser.id, 'CREATE_TEXT_DOC', 'Document', created.document_id, `đã tạo tài liệu văn bản '${created.original_name}' trong '${folderPath}'`, { project_id: projectId });
      } else {
        await db.updateTextDocument({ documentId: doc.document_id, content: html, updatedBy: currentUser.id });
        await db.logActivity(currentUser.id, 'UPDATE_TEXT_DOC', 'Document', doc.document_id, `đã chỉnh sửa tài liệu văn bản '${doc.original_name}'`, { project_id: projectId });
      }
      releaseLock();
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      const Swal = await getSwal();
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.lockedBy ? t('documents.lockedByOtherAlert', 'Tài liệu đang được chỉnh sửa bởi {lockOwnerName}. Chế độ xem chỉ đọc (Read-only).').replace('{lockOwnerName}', err.lockedBy) : err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="doc-editor-panel">
      <div className="doc-editor-header">
        {isNew ? (
          <input
            type="text"
            className="doc-editor-title-input"
            placeholder={t('documents.docNamePlaceholder', 'Nhập tên tài liệu...')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        ) : (
          <h3 className="doc-editor-title">{doc.original_name.replace(/\.html$/i, '')}</h3>
        )}
        <div className="doc-editor-header-actions">
          {!isNew && !editing && canEdit && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
              <i className="fa-solid fa-pen"></i> {t('common.edit', 'Sửa')}
            </button>
          )}
          <button type="button" className="btn-close-modal" onClick={handleClose} title={t('common.close', 'Đóng')}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      {!isNew && !canEdit && (
        <div className="doc-editor-lock-banner">
          <i className="fa-solid fa-lock"></i>
          <span>{t('documents.lockedByOtherAlert', 'Tài liệu đang được chỉnh sửa bởi {lockOwnerName}. Chế độ xem chỉ đọc (Read-only).').replace('{lockOwnerName}', lockedByName || t('documents.unknownUploader', 'Không rõ'))}</span>
        </div>
      )}

      {loading ? (
        <div className="empty-widget-state"><i className="fa-solid fa-circle-notch fa-spin"></i></div>
      ) : (
        <>
          {editing && (
            <div className="doc-editor-toolbar">
              <button type="button" title={t('documents.bold', 'In đậm')} onClick={() => exec('bold')}><i className="fa-solid fa-bold"></i></button>
              <button type="button" title={t('documents.italic', 'In nghiêng')} onClick={() => exec('italic')}><i className="fa-solid fa-italic"></i></button>
              <button type="button" title={t('documents.underline', 'Gạch chân')} onClick={() => exec('underline')}><i className="fa-solid fa-underline"></i></button>
              <span className="doc-editor-toolbar-sep" />
              <select className="doc-editor-fontsize-select" defaultValue="" onChange={handleFontSize} title={t('documents.fontSize', 'Cỡ chữ')}>
                <option value="" disabled>{t('documents.fontSize', 'Cỡ chữ')}</option>
                {FONT_SIZES.map(sz => <option key={sz} value={sz}>{sz}px</option>)}
              </select>
              <span className="doc-editor-toolbar-sep" />
              <div className="doc-editor-swatch-group" title={t('documents.textColor', 'Màu chữ')}>
                <i className="fa-solid fa-font" style={{ fontSize: '11px', marginRight: '2px' }}></i>
                {TEXT_COLORS.map(c => (
                  <button key={'fg-' + c} type="button" className="doc-editor-swatch" style={{ backgroundColor: c }} onClick={() => handleForeColor(c)} />
                ))}
              </div>
              <div className="doc-editor-swatch-group" title={t('documents.backgroundColor', 'Màu nền')}>
                <i className="fa-solid fa-fill-drip" style={{ fontSize: '11px', marginRight: '2px' }}></i>
                {TEXT_COLORS.map(c => (
                  <button key={'bg-' + c} type="button" className="doc-editor-swatch" style={{ backgroundColor: c }} onClick={() => handleBackColor(c)} />
                ))}
              </div>
              <span className="doc-editor-toolbar-sep" />
              <button type="button" title={t('documents.alignLeft', 'Căn trái')} onClick={() => exec('justifyLeft')}><i className="fa-solid fa-align-left"></i></button>
              <button type="button" title={t('documents.alignCenter', 'Căn giữa')} onClick={() => exec('justifyCenter')}><i className="fa-solid fa-align-center"></i></button>
              <button type="button" title={t('documents.alignRight', 'Căn phải')} onClick={() => exec('justifyRight')}><i className="fa-solid fa-align-right"></i></button>
              <span className="doc-editor-toolbar-sep" />
              <button type="button" title={t('documents.insertTable', 'Chèn bảng')} onClick={(e) => { e.currentTarget.blur(); handleInsertTable(); }}><i className="fa-solid fa-table"></i></button>
            </div>
          )}

          <div ref={canvasWrapperRef} className="doc-editor-canvas-wrapper">
            <div
              ref={canvasRef}
              className={`doc-editor-canvas ${editing ? 'editable' : ''}`}
              contentEditable={editing}
              suppressContentEditableWarning
              spellCheck={false}
              onKeyDown={editing ? handleKeyDown : undefined}
              onMouseDown={editing ? handleCanvasMouseDown : undefined}
              onMouseMove={editing ? handleCanvasMouseMove : undefined}
              onClick={editing ? handleCanvasClick : undefined}
            />
            {editing && activeTableInfo && (
              <>
                <button
                  type="button"
                  className="doc-table-add-btn doc-table-add-col"
                  style={{ top: activeTableInfo.top - 14, left: activeTableInfo.left + activeTableInfo.width - 14 }}
                  title={t('documents.addColumn', 'Thêm cột')}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleAddColumn}
                >
                  <i className="fa-solid fa-plus"></i>
                </button>
                <button
                  type="button"
                  className="doc-table-add-btn doc-table-add-row"
                  style={{ top: activeTableInfo.top + activeTableInfo.height - 14, left: activeTableInfo.left - 14 }}
                  title={t('documents.addRow', 'Thêm hàng')}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleAddRow}
                >
                  <i className="fa-solid fa-plus"></i>
                </button>
              </>
            )}
          </div>
        </>
      )}

      {editing && (
        <div className="doc-editor-footer">
          <button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={saving}>
            {t('common.cancel', 'Hủy')}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? t('common.saving', 'Đang lưu...') : t('common.save', 'Lưu thay đổi')}
          </button>
        </div>
      )}
    </div>
  );
}
