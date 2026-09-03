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
      <DocumentExplorer />
    </div>
  );
}
