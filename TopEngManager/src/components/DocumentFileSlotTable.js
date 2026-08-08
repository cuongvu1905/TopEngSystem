"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/utils/db';
import { useLanguage } from '@/context/LanguageContext';
import { getSwal } from '@/utils/swal';
import { matchesRequiredPrefix, matchesAllowedExtensions, parseAllowedExtensions } from '@/utils/filePrefixMatch';

// Kept in sync with DocumentExplorer.js's ACCEPT_EXT (duplicated rather than
// imported to avoid a circular import between the two sibling components).
const ACCEPT_EXT = '.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.csv,.png,.jpg,.jpeg,.zip,.rar,.dwg,.zw1';

// Fixed-row file manager for folders tagged folder_type === 'file_slot_table'
// (e.g. the auto-provisioned "01.TK Điện" folder): each predefined row only
// accepts an upload whose filename starts with that row's required prefix.
export default function DocumentFileSlotTable({ folderId, projectId, currentUser, canUpload = true, allowedExtensions = null, onSlotsChanged }) {
  const { t } = useLanguage();
  const [slots, setSlots] = useState([]);
  const [uploadingSlotId, setUploadingSlotId] = useState(null);
  const [addingRow, setAddingRow] = useState(false);
  const fileInputRef = useRef(null);
  const pendingSlotRef = useRef(null);

  const loadSlots = useCallback(async () => {
    if (!folderId) return;
    try {
      const list = await db.getDocumentFileSlots({ folderId });
      setSlots(list || []);
    } catch (err) {
      console.error('Failed to load file slots', err);
    }
  }, [folderId]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const handleUploadClick = (slot) => {
    pendingSlotRef.current = slot;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    const slot = pendingSlotRef.current;
    e.target.value = '';
    if (!file || !slot) return;

    if (slot.prefix && !matchesRequiredPrefix(file.name, slot.prefix)) {
      const Swal = await getSwal();
      Swal.fire({
        icon: 'error',
        title: t('common.failed', 'Thất bại'),
        text: t('documents.slotPrefixMismatch', 'Tên tệp phải chứa "{prefix}" (tối đa 6 ký tự bất kỳ phía trước)').replace('{prefix}', slot.prefix)
      });
      return;
    }
    if (allowedExtensions && !matchesAllowedExtensions(file.name, allowedExtensions)) {
      const Swal = await getSwal();
      Swal.fire({
        icon: 'error',
        title: t('common.failed', 'Thất bại'),
        text: t('documents.uploadExtensionMismatch', 'Thư mục này chỉ chấp nhận đuôi tệp: {exts}. Tệp không hợp lệ: {files}')
          .replace('{exts}', parseAllowedExtensions(allowedExtensions).join(', '))
          .replace('{files}', file.name)
      });
      return;
    }

    setUploadingSlotId(slot.id);
    try {
      await db.uploadDocumentFileSlot(file, { slotId: slot.id, folderId, projectId, uploadedBy: currentUser.id });
      await loadSlots();
      onSlotsChanged?.();
    } catch (err) {
      const Swal = await getSwal();
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    } finally {
      setUploadingSlotId(null);
    }
  };

  const handleAddRow = async () => {
    setAddingRow(true);
    try {
      await db.createDocumentFileSlot({ folderId });
      await loadSlots();
    } catch (err) {
      const Swal = await getSwal();
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    } finally {
      setAddingRow(false);
    }
  };

  return (
    <div className="doc-file-slot-table" style={{ padding: '4px 0' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_EXT}
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--neutral-border)' }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '12.5px', color: 'var(--neutral-muted)', width: '48px' }}>{t('documents.slotColNo', 'No.')}</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '12.5px', color: 'var(--neutral-muted)' }}>{t('documents.slotColFileName', 'File Name')}</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '12.5px', color: 'var(--neutral-muted)', width: '110px' }}>{t('documents.slotColStatus', 'Status')}</th>
            <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: '12.5px', color: 'var(--neutral-muted)', width: '90px' }}>{t('documents.slotColUpload', 'Upload')}</th>
            <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: '12.5px', color: 'var(--neutral-muted)', width: '90px' }}>{t('documents.slotColDownload', 'Download')}</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot, idx) => {
            const hasDoc = !!slot.document;
            return (
              <tr key={slot.id} style={{ borderBottom: '1px solid var(--neutral-border)' }}>
                <td style={{ padding: '10px' }}>{idx + 1}</td>
                <td style={{ padding: '10px' }}>
                  {hasDoc ? (
                    <span>{slot.document.original_name}</span>
                  ) : slot.prefix ? (
                    <span style={{ color: 'var(--neutral-muted)', fontStyle: 'italic' }}>{slot.prefix}</span>
                  ) : (
                    <span style={{ color: 'var(--neutral-muted)' }}>—</span>
                  )}
                </td>
                <td style={{ padding: '10px' }}>
                  <span style={{ color: hasDoc ? 'var(--success-color)' : 'var(--neutral-muted)', fontWeight: 600, fontSize: '12.5px' }}>
                    {hasDoc ? t('documents.slotAvailable', 'Available') : t('documents.slotNotAvailable', 'N/A')}
                  </span>
                </td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  {canUpload && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={uploadingSlotId === slot.id}
                      onClick={() => handleUploadClick(slot)}
                      title={t('common.upload', 'Tải lên')}
                    >
                      <i className="fa-solid fa-upload"></i>
                    </button>
                  )}
                </td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  {hasDoc ? (
                    <a
                      className="btn btn-secondary btn-sm"
                      href={db.getDocumentDownloadUrl(slot.document.document_id)}
                      title={t('common.download', 'Tải về')}
                    >
                      <i className="fa-solid fa-download"></i>
                    </a>
                  ) : (
                    <button type="button" className="btn btn-secondary btn-sm" disabled style={{ opacity: 0.4, cursor: 'not-allowed' }}>
                      <i className="fa-solid fa-download"></i>
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {canUpload && (
        <button
          type="button"
          onClick={handleAddRow}
          disabled={addingRow}
          title={t('documents.slotAddRow', 'Thêm hàng')}
          style={{ marginTop: '12px', width: '36px', height: '36px', borderRadius: '4px', border: 'none', backgroundColor: '#0f766e', color: '#fff', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          +
        </button>
      )}
    </div>
  );
}
