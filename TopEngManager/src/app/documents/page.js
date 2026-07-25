"use client";

import React from 'react';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import DocumentExplorer from '@/components/DocumentExplorer';

export default function Documents() {
  const { currentUser } = useApp();
  const { t } = useLanguage();

  if (!currentUser) return null;

  return (
    <div className="scrollable-view">
      <div className="view-header">
        <div className="view-title-group">
          <h2>{t('documents.companyTitle', 'Kho lưu trữ tài liệu công ty')}</h2>
          <p>{t('documents.companySubtitle', 'Quản lý tài liệu chung theo cấu trúc thư mục cây.')}</p>
        </div>
      </div>
      <DocumentExplorer />
    </div>
  );
}
