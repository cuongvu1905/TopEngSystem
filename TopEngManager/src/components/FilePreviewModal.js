"use client";

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { db } from '@/utils/db';

const PREVIEWABLE_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'txt'];

export default function FilePreviewModal({ doc, onClose }) {
  const { t } = useLanguage();
  const [textContent, setTextContent] = useState('');
  const [loadingText, setLoadingText] = useState(doc.file_ext === 'txt');

  useEffect(() => {
    if (doc.file_ext !== 'txt') return;
    let cancelled = false;
    db.getDocumentContent(doc.document_id)
      .then(res => { if (!cancelled) setTextContent(res.content || ''); })
      .catch(() => { if (!cancelled) setTextContent(''); })
      .finally(() => { if (!cancelled) setLoadingText(false); });
    return () => { cancelled = true; };
  }, [doc]);

  const previewUrl = db.getDocumentPreviewUrl(doc.document_id);

  return (
    <div className="modal show" style={{ display: 'flex', zIndex: 330 }}>
      <div className="modal-dialog file-preview-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h3>{doc.original_name}</h3>
            <button className="btn-close-modal" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
          </div>
          <div className="modal-body file-preview-body">
            {doc.file_ext === 'pdf' && (
              <iframe src={previewUrl} title={doc.original_name} className="file-preview-iframe" />
            )}
            {['png', 'jpg', 'jpeg'].includes(doc.file_ext) && (
              <img src={previewUrl} alt={doc.original_name} className="file-preview-image" />
            )}
            {doc.file_ext === 'txt' && (
              loadingText
                ? <div className="empty-widget-state"><i className="fa-solid fa-circle-notch fa-spin"></i></div>
                : <pre className="file-preview-text">{textContent}</pre>
            )}
          </div>
          <div className="modal-footer">
            <a className="btn btn-primary" href={db.getDocumentDownloadUrl(doc.document_id)}>
              <i className="fa-solid fa-download"></i> {t('common.download', 'Tải về')}
            </a>
            <button className="btn btn-secondary" onClick={onClose}>{t('common.close', 'Đóng')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { PREVIEWABLE_EXTENSIONS };
