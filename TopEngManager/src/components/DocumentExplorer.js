"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { db } from '@/utils/db';
import { getSwal } from '@/utils/swal';
import TextDocumentEditor from '@/components/TextDocumentEditor';
import FilePreviewModal, { PREVIEWABLE_EXTENSIONS } from '@/components/FilePreviewModal';

const FILE_ICONS = {
  pdf: 'fa-file-pdf',
  doc: 'fa-file-word',
  docx: 'fa-file-word',
  xls: 'fa-file-excel',
  xlsx: 'fa-file-excel',
  csv: 'fa-file-csv',
  ppt: 'fa-file-powerpoint',
  pptx: 'fa-file-powerpoint',
  png: 'fa-file-image',
  jpg: 'fa-file-image',
  jpeg: 'fa-file-image',
  zip: 'fa-file-zipper',
  rar: 'fa-file-zipper',
  txt: 'fa-file-lines',
  html: 'fa-file-lines'
};
const ACCEPT_EXT = '.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.csv,.png,.jpg,.jpeg,.zip,.rar';

function formatFileSize(bytes) {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentExplorer({ projectId = null }) {
  const { currentUser, users } = useApp();
  const { t, currentLang } = useLanguage();
  const fileInputRef = useRef(null);

  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [collapsedFolders, setCollapsedFolders] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);
  const [textEditorState, setTextEditorState] = useState(null); // { doc, autoEdit } | null
  const [previewDoc, setPreviewDoc] = useState(null);

  const isAdmin = currentUser?.system_role?.includes('Admin');

  const loadFolders = useCallback(async () => {
    try {
      const list = await db.getDocumentFolders(projectId);
      setFolders(list || []);
    } catch (err) {
      console.error('Failed to load document folders', err);
    }
  }, [projectId]);

  const loadDocuments = useCallback(async () => {
    try {
      const list = await db.getDocuments({ projectId, folderId: selectedFolderId, searchQuery: activeSearch });
      setDocuments(list || []);
    } catch (err) {
      console.error('Failed to load documents', err);
    }
  }, [projectId, selectedFolderId, activeSearch]);

  useEffect(() => { loadFolders(); }, [loadFolders]);
  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const getChildren = (parentId) => folders.filter(f => (f.parent_folder_id || null) === parentId);

  const toggleCollapse = (id) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getFolderPath = (folderId) => {
    const parts = [];
    let current = folders.find(f => f.folder_id === folderId);
    while (current) {
      parts.unshift(current.name);
      current = folders.find(f => f.folder_id === current.parent_folder_id);
    }
    return parts.join(' / ');
  };

  const rootLabel = projectId ? t('documents.projectRoot', 'Tài liệu dự án') : t('documents.companyRoot', 'Tất cả tài liệu');

  const handleCreateFolder = async (parentFolderId) => {
    // SweetAlert2 restores focus to the triggering button on close, which in
    // some browsers re-fires a phantom keyboard "click" on it — blur it
    // first so that phantom click has no target and can't re-open the dialog.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const Swal = await getSwal();
    const { value: name } = await Swal.fire({
      title: t('documents.newFolderTitle', 'Thư mục mới'),
      input: 'text',
      inputPlaceholder: t('documents.folderNamePlaceholder', 'Nhập tên thư mục...'),
      showCancelButton: true,
      confirmButtonText: t('common.create', 'Tạo mới'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--primary-color)',
      inputValidator: (value) => (!value || !value.trim()) ? t('documents.folderNameRequired', 'Vui lòng nhập tên thư mục') : undefined
    });
    if (!name) return;
    try {
      const created = await db.createDocumentFolder({ name: name.trim(), parentFolderId, projectId, createdBy: currentUser.id });
      await loadFolders();
      const parentPath = parentFolderId ? getFolderPath(parentFolderId) : rootLabel;
      await db.logActivity(currentUser.id, 'CREATE_FOLDER', 'Document', created.folder_id, `đã tạo thư mục '${name.trim()}' trong '${parentPath}'`, { project_id: projectId });
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    }
  };

  const canManageFolder = (folder) => isAdmin || folder.created_by === currentUser?.id;
  const canManageDoc = (doc) => isAdmin || doc.uploaded_by === currentUser?.id;

  const handleDeleteFolder = async (folder, e) => {
    e.stopPropagation();
    e.currentTarget.blur();
    const Swal = await getSwal();
    const result = await Swal.fire({
      icon: 'warning',
      title: t('documents.deleteFolderConfirmTitle', 'Xóa thư mục?'),
      text: t('documents.deleteFolderConfirmText', 'Toàn bộ thư mục con và tài liệu bên trong sẽ bị xóa vĩnh viễn.'),
      showCancelButton: true,
      confirmButtonText: t('common.delete', 'Xóa'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--danger-color)'
    });
    if (!result.isConfirmed) return;
    try {
      await db.deleteDocumentFolder(folder.folder_id);
      if (selectedFolderId === folder.folder_id) setSelectedFolderId(null);
      await loadFolders();
      await loadDocuments();
      await db.logActivity(currentUser.id, 'DELETE_FOLDER', 'Document', folder.folder_id, `đã xóa thư mục '${folder.name}'`, { project_id: projectId });
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const created = await db.uploadDocuments(files, { folderId: selectedFolderId, projectId, uploadedBy: currentUser.id });
      await loadDocuments();
      const folderPath = selectedFolderId ? getFolderPath(selectedFolderId) : rootLabel;
      for (const doc of (created || [])) {
        await db.logActivity(currentUser.id, 'UPLOAD', 'Document', doc.document_id, `đã tải lên tài liệu '${doc.original_name}' vào '${folderPath}'`, { project_id: projectId });
      }
    } catch (err) {
      const Swal = await getSwal();
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteDocument = async (doc) => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const Swal = await getSwal();
    const result = await Swal.fire({
      icon: 'warning',
      title: t('documents.deleteDocConfirmTitle', 'Xóa tài liệu này?'),
      text: doc.original_name,
      showCancelButton: true,
      confirmButtonText: t('common.delete', 'Xóa'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--danger-color)'
    });
    if (!result.isConfirmed) return;
    try {
      await db.deleteDocument(doc.document_id);
      await loadDocuments();
      const folderPath = doc.folder_id ? getFolderPath(doc.folder_id) : rootLabel;
      await db.logActivity(currentUser.id, 'DELETE', 'Document', doc.document_id, `đã xóa tài liệu '${doc.original_name}' khỏi '${folderPath}'`, { project_id: projectId });
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    }
  };

  const handleDownloadClick = (doc) => {
    const folderPath = doc.folder_id ? getFolderPath(doc.folder_id) : rootLabel;
    db.logActivity(currentUser.id, 'DOWNLOAD', 'Document', doc.document_id, `đã tải về tài liệu '${doc.original_name}' từ '${folderPath}'`, { project_id: projectId }).catch(() => {});
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setActiveSearch(searchQuery.trim());
  };

  const clearSearch = () => {
    setSearchQuery('');
    setActiveSearch('');
  };

  const currentFolder = folders.find(f => f.folder_id === selectedFolderId);
  const rootFolders = getChildren(null);

  const renderFolderNode = (folder, depth = 0) => {
    const children = getChildren(folder.folder_id);
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedFolders.has(folder.folder_id);
    const isSelected = selectedFolderId === folder.folder_id;

    return (
      <div key={folder.folder_id} style={{ marginLeft: depth > 0 ? '14px' : '0px' }}>
        <div
          className={`doc-folder-node ${isSelected ? 'active' : ''}`}
          onClick={() => {
            setSelectedFolderId(folder.folder_id);
            setMobileTreeOpen(false);
            if (hasChildren) toggleCollapse(folder.folder_id);
          }}
        >
          <div className="doc-folder-node-left">
            {hasChildren ? (
              <i className={isCollapsed ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-down'}></i>
            ) : (
              <span className="doc-folder-node-spacer" />
            )}
            <i className={hasChildren && !isCollapsed ? 'fa-solid fa-folder-open' : 'fa-solid fa-folder'}></i>
            <span>{folder.name}</span>
          </div>
          <div className="doc-folder-node-actions">
            <button
              type="button"
              title={t('documents.newSubfolder', 'Thư mục con mới')}
              onClick={(e) => { e.stopPropagation(); handleCreateFolder(folder.folder_id); }}
            >
              <i className="fa-solid fa-plus"></i>
            </button>
            {canManageFolder(folder) && (
              <button
                type="button"
                title={t('common.delete', 'Xóa')}
                onClick={(e) => handleDeleteFolder(folder, e)}
              >
                <i className="fa-solid fa-trash-can"></i>
              </button>
            )}
          </div>
        </div>
        {hasChildren && !isCollapsed && (
          <div className="doc-folder-children">
            {children.map(child => renderFolderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!currentUser) return null;

  return (
    <div className={`doc-layout doc-explorer-layout ${textEditorState ? 'editor-open' : ''}`}>
      <div className={`doc-folder-tree-panel ${mobileTreeOpen ? 'show' : ''}`}>
        <div className="doc-folder-tree-header">
          <span>{t('documents.folders', 'Thư mục')}</span>
          <button
            type="button"
            className="doc-folder-add-root"
            title={t('documents.newFolder', 'Thư mục mới')}
            onClick={() => handleCreateFolder(null)}
          >
            <i className="fa-solid fa-folder-plus"></i>
          </button>
        </div>
        <div
          className={`doc-folder-node root-node ${selectedFolderId === null ? 'active' : ''}`}
          onClick={() => { setSelectedFolderId(null); setMobileTreeOpen(false); }}
        >
          <div className="doc-folder-node-left">
            <i className="fa-solid fa-building"></i>
            <span>{rootLabel}</span>
          </div>
        </div>
        <div className="doc-folder-tree-scroll">
          {rootFolders.length === 0 ? (
            <div className="doc-folder-empty">{t('documents.noFoldersYet', 'Chưa có thư mục nào')}</div>
          ) : rootFolders.map(f => renderFolderNode(f, 0))}
        </div>
      </div>

      <div className="doc-main-panel">
        {textEditorState ? (
          <TextDocumentEditor
            doc={textEditorState.doc}
            autoEdit={textEditorState.autoEdit}
            folderId={selectedFolderId}
            folderPath={selectedFolderId ? getFolderPath(selectedFolderId) : rootLabel}
            projectId={projectId}
            currentUser={currentUser}
            onClose={() => setTextEditorState(null)}
            onSaved={loadDocuments}
          />
        ) : (
        <>
        <button type="button" className="doc-folder-toggle-btn" onClick={() => setMobileTreeOpen(prev => !prev)}>
          <i className="fa-solid fa-folder-tree"></i> {t('documents.folders', 'Thư mục')}
        </button>

        <div className="doc-filters">
          <form onSubmit={handleSearchSubmit} className="doc-search-input">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              type="text"
              placeholder={t('documents.searchPlaceholder', 'Tìm tài liệu trong toàn bộ thư mục...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT_EXT}
            style={{ display: 'none' }}
            onChange={handleFilesSelected}
          />
          <button type="button" className="btn btn-secondary" onClick={() => setTextEditorState({ doc: null, autoEdit: true })}>
            <i className="fa-solid fa-file-circle-plus"></i> {t('documents.createDocument', 'Tạo tài liệu')}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleUploadClick} disabled={uploading}>
            <i className="fa-solid fa-upload"></i> {uploading ? t('documents.uploading', 'Đang tải lên...') : t('common.upload', 'Tải lên')}
          </button>
        </div>

        <div className="doc-breadcrumb">
          {activeSearch ? (
            <span>
              {t('documents.searchResultsFor', 'Kết quả tìm kiếm cho')} &quot;{activeSearch}&quot;
              <button type="button" className="btn-text" onClick={clearSearch}>{t('documents.clearSearch', 'Xóa tìm kiếm')}</button>
            </span>
          ) : (
            <span><i className="fa-solid fa-folder"></i> {currentFolder ? getFolderPath(currentFolder.folder_id) : rootLabel}</span>
          )}
        </div>

        <div className="doc-file-list">
          {documents.length === 0 ? (
            <div className="empty-widget-state">
              <i className="fa-solid fa-folder-open" style={{ fontSize: '28px' }}></i>
              {activeSearch
                ? t('documents.noSearchResults', 'Không tìm thấy tài liệu phù hợp.')
                : t('documents.noDocumentsInFolder', 'Chưa có tài liệu nào trong thư mục này.')}
            </div>
          ) : (
            documents.map(doc => {
              const uploader = users.find(u => u.id === doc.uploaded_by);
              const icon = FILE_ICONS[doc.file_ext] || 'fa-file';
              const isTextDoc = doc.doc_type === 'text';
              const isPreviewableUpload = !isTextDoc && PREVIEWABLE_EXTENSIONS.includes(doc.file_ext);
              const nameClickable = isTextDoc || isPreviewableUpload;
              const handleNameClick = () => {
                if (isTextDoc) setTextEditorState({ doc, autoEdit: false });
                else if (isPreviewableUpload) setPreviewDoc(doc);
              };
              return (
                <div className="document-item-card" key={doc.document_id}>
                  <div className="doc-card-left">
                    <div className="doc-icon-box"><i className={`fa-solid ${icon}`}></i></div>
                    <div className="doc-info-box">
                      {nameClickable ? (
                        <h3 className="doc-name-link" onClick={handleNameClick}>{doc.original_name}</h3>
                      ) : (
                        <h3>{doc.original_name}</h3>
                      )}
                      <p>
                        {formatFileSize(doc.file_size)} · {uploader?.name || t('documents.unknownUploader', 'Không rõ')} · {new Date(doc.created_at).toLocaleDateString(currentLang === 'vi' ? 'vi-VN' : 'en-US')}
                        {activeSearch && (
                          <> · <i className="fa-solid fa-folder" style={{ fontSize: '10px' }}></i> {doc.folder_id ? getFolderPath(doc.folder_id) : rootLabel}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="doc-card-right">
                    {isTextDoc && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        title={t('common.edit', 'Sửa')}
                        onClick={() => setTextEditorState({ doc, autoEdit: true })}
                      >
                        <i className="fa-solid fa-pen"></i>
                      </button>
                    )}
                    <a
                      className="btn btn-secondary btn-sm"
                      href={db.getDocumentDownloadUrl(doc.document_id)}
                      title={t('common.download', 'Tải về')}
                      onClick={() => handleDownloadClick(doc)}
                    >
                      <i className="fa-solid fa-download"></i>
                    </a>
                    {canManageDoc(doc) && (
                      <button type="button" className="btn-reset-icon" title={t('common.delete', 'Xóa')} onClick={() => handleDeleteDocument(doc)}>
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        </>
        )}
      </div>
      {previewDoc && (
        <FilePreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}
    </div>
  );
}
