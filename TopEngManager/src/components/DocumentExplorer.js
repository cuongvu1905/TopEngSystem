"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { db } from '@/utils/db';
import { getSwal } from '@/utils/swal';
import TextDocumentEditor from '@/components/TextDocumentEditor';
import FilePreviewModal, { PREVIEWABLE_EXTENSIONS } from '@/components/FilePreviewModal';
import DocumentFileSlotTable from '@/components/DocumentFileSlotTable';
import { matchesRequiredPrefix, matchesAllowedExtensions, parseAllowedExtensions } from '@/utils/filePrefixMatch';

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
  html: 'fa-file-lines',
  dwg: 'fa-file-pen',
  zw1: 'fa-file-pen'
};
const ACCEPT_EXT = '.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.csv,.png,.jpg,.jpeg,.zip,.rar,.dwg,.zw1';

function formatFileSize(bytes) {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentExplorer({ projectId = null }) {
  const { currentUser, users, projectMembers, hasPermission } = useApp();
  const { t, currentLang } = useLanguage();
  const fileInputRef = useRef(null);
  const layoutRef = useRef(null);
  const resizeStateRef = useRef(null);

  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [fileSlots, setFileSlots] = useState([]); // required-prefix slots across every folder, for progress %
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [collapsedFolders, setCollapsedFolders] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);
  const [textEditorState, setTextEditorState] = useState(null); // { doc, autoEdit } | null
  const [previewDoc, setPreviewDoc] = useState(null);
  // Right-click folder menu: { x, y, folder } while open, null when closed.
  const [folderContextMenu, setFolderContextMenu] = useState(null);
  const [treeWidth, setTreeWidth] = useState(260);

  const isAdmin = currentUser?.system_role?.includes('Admin');

  // Upload is only gated inside a project's Tài liệu tab; the company-wide Documents
  // page (no projectId) keeps its existing open-to-everyone behavior.
  const myProjectRole = projectId
    ? projectMembers.find(m => m.project_id === projectId && m.user_id === currentUser?.id)?.project_role
    : null;
  const canUploadDocuments = !projectId || hasPermission('upload_project_documents') || myProjectRole === 'PM';

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

  const loadFileSlots = useCallback(async () => {
    try {
      const list = await db.getProjectFileSlots(projectId);
      setFileSlots(list || []);
    } catch (err) {
      console.error('Failed to load file slot progress', err);
    }
  }, [projectId]);

  useEffect(() => { loadFolders(); }, [loadFolders]);
  useEffect(() => { loadDocuments(); }, [loadDocuments]);
  useEffect(() => { loadFileSlots(); }, [loadFileSlots]);

  // Default the cursor to the top-level folder (e.g. <Tên_Xưởng>) instead of the
  // company/project root once folders have loaded, rather than leaving it unselected.
  useEffect(() => {
    if (selectedFolderId || folders.length === 0) return;
    const firstRoot = folders.find(f => !f.parent_folder_id);
    if (firstRoot) setSelectedFolderId(firstRoot.folder_id);
  }, [folders, selectedFolderId]);

  useEffect(() => {
    if (!folderContextMenu) return;
    const closeMenu = () => setFolderContextMenu(null);
    const handleKeyDown = (e) => { if (e.key === 'Escape') closeMenu(); };
    window.addEventListener('click', closeMenu);
    window.addEventListener('contextmenu', closeMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('contextmenu', closeMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [folderContextMenu]);

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

  // Renders the tree to be created, with a checkbox on every <Tên_Máy>/* folder so the
  // creator picks the same way they do in the new-project dialog. Levels above those are
  // structural and always created, so they are plain text.
  const buildTemplateDialogHtml = (templates, nodes, selectableIds) => {
    const escapeHtml = (s) => String(s).replace(/[&<>"']/g, ch => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
    const lines = [];
    const walk = (list, depth) => {
      list.forEach(node => {
        const pad = '&nbsp;'.repeat(depth * 4);
        if (selectableIds.has(node.template_folder_id)) {
          lines.push(
            `<label style="display:block;cursor:pointer">${pad}` +
            `<input type="checkbox" class="tmpl-pick" value="${escapeHtml(node.template_folder_id)}" checked ` +
            `style="vertical-align:middle;margin-right:6px" />` +
            `<span style="vertical-align:middle">${escapeHtml(node.name)}</span></label>`
          );
        } else {
          lines.push(`<div>${pad}${escapeHtml(node.name)}</div>`);
        }
        walk(templates.filter(c => c.parent_template_folder_id === node.template_folder_id), depth + 1);
      });
    };
    walk(nodes, 0);
    return lines.join('');
  };

  // Creates the Admin-designed tree instead of a single empty folder.
  // templateLevel 0 = the whole designed tree (the "THƯ MỤC" header button);
  // templateLevel 1 = the children of the template root, i.e. another <Tên_Máy> subtree
  // with its subfolders and required-file-prefix rules (the button on a root folder).
  // Returns false when the template has nothing at that level, so the caller can fall
  // back to the normal "type a folder name" flow rather than the button doing nothing.
  const createFromTemplate = async (parentFolderId, templateLevel) => {
    let templates;
    try {
      templates = await db.getFolderTemplates();
    } catch (err) {
      return false;   // template unreadable: behave like before rather than blocking
    }
    if (!Array.isArray(templates) || templates.length === 0) return false;

    const roots = templates.filter(f => !f.parent_template_folder_id);
    const nodes = templateLevel === 0
      ? roots
      : templates.filter(f => roots.some(r => r.template_folder_id === f.parent_template_folder_id));
    if (nodes.length === 0) return false;

    const Swal = await getSwal();
    const escapeHtml = (s) => String(s).replace(/[&<>"']/g, ch => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
    // The pickable folders are always the same ones: the children of the template's second
    // level, i.e. <Tên_Xưởng>/<Tên_Máy>/*, whichever level this button starts from.
    let selectable;
    try {
      selectable = await db.getSelectableTemplateFolders();
    } catch (err) {
      selectable = [];
    }
    const selectableIds = new Set((selectable || []).map(f => f.template_folder_id));
    const previewHtml = buildTemplateDialogHtml(templates, nodes, selectableIds);

    const result = await Swal.fire({
      title: t('documents.templateTreeTitle', 'Tạo thư mục theo mẫu'),
      html: `<div style="text-align:left;font-size:13px;line-height:1.7">
        <div style="margin-bottom:8px">${escapeHtml(t('documents.templateTreePick', 'Chọn các thư mục cần tạo (theo thiết kế của Admin):'))}</div>
        <div style="font-family:monospace">${previewHtml}</div>
      </div>`,
      showCancelButton: true,
      confirmButtonText: t('common.create', 'Tạo mới'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--primary-color)',
      preConfirm: () => Array.from(document.querySelectorAll('.tmpl-pick:checked')).map(el => el.value)
    });
    if (!result.isConfirmed) return true;   // handled: the user chose not to
    const picked = Array.isArray(result.value) ? result.value : [];

    try {
      const res = await db.createFolderTreeFromTemplate({
        projectId, parentFolderId, templateLevel, createdBy: currentUser.id,
        // only meaningful when the design actually offers a choice
        selectedFolderIds: selectableIds.size > 0 ? picked : undefined
      });
      await loadFolders();
      const parentPath = parentFolderId ? getFolderPath(parentFolderId) : rootLabel;
      await db.logActivity(
        currentUser.id, 'CREATE_FOLDER', 'Document', parentFolderId || projectId || '',
        `đã tạo ${res?.created || 0} thư mục theo mẫu trong '${parentPath}'`,
        { project_id: projectId }
      );
      Swal.fire({
        icon: 'success',
        title: t('common.success', 'Thành công'),
        text: t('documents.templateTreeCreated', 'Đã tạo {count} thư mục theo mẫu.')
          .replace('{count}', String(res?.created || 0)),
        timer: 1800,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    }
    return true;
  };

  const handleCreateFolder = async (parentFolderId, parentFolder) => {
    // SweetAlert2 restores focus to the triggering button on close, which in
    // some browsers re-fires a phantom keyboard "click" on it — blur it
    // first so that phantom click has no target and can't re-open the dialog.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

    // Only the top two levels follow the Admin template: the tree header creates the whole
    // designed tree, a root folder gets another <Tên_Máy> subtree. Anything deeper, and the
    // company-wide Documents view (which has no project template), creates one plain folder.
    if (projectId) {
      const templateLevel = parentFolderId === null
        ? 0
        : (parentFolder && !parentFolder.parent_folder_id ? 1 : null);
      if (templateLevel !== null && await createFromTemplate(parentFolderId, templateLevel)) return;
    }

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

  const handleRenameFolder = async (folder, e) => {
    e.stopPropagation();
    e.currentTarget.blur();
    const Swal = await getSwal();
    const { value: name } = await Swal.fire({
      title: t('documents.renameFolderTitle', 'Đổi tên thư mục'),
      input: 'text',
      inputValue: folder.name,
      inputPlaceholder: t('documents.folderNamePlaceholder', 'Nhập tên thư mục...'),
      showCancelButton: true,
      confirmButtonText: t('common.save', 'Lưu thay đổi'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--primary-color)',
      inputValidator: (value) => (!value || !value.trim()) ? t('documents.folderNameRequired', 'Vui lòng nhập tên thư mục') : undefined
    });
    if (!name || name.trim() === folder.name) return;
    try {
      const oldName = folder.name;
      await db.renameDocumentFolder(folder.folder_id, name.trim());
      await loadFolders();
      await db.logActivity(currentUser.id, 'RENAME_FOLDER', 'Document', folder.folder_id, `đã đổi tên thư mục '${oldName}' thành '${name.trim()}'`, { project_id: projectId });
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

  const handleTreeResizeStart = (e) => {
    e.preventDefault();
    resizeStateRef.current = { startX: e.clientX, startWidth: treeWidth };
    const handleMove = (moveEvent) => {
      const state = resizeStateRef.current;
      if (!state) return;
      const delta = moveEvent.clientX - state.startX;
      const containerWidth = layoutRef.current?.getBoundingClientRect().width || 800;
      const maxWidth = containerWidth / 2;
      setTreeWidth(Math.min(maxWidth, Math.max(180, state.startWidth + delta)));
    };
    const handleUp = () => {
      resizeStateRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const targetFolder = folders.find(f => f.folder_id === selectedFolderId);
    if (targetFolder?.default_prefix) {
      const invalidFiles = files.filter(f => !matchesRequiredPrefix(f.name, targetFolder.default_prefix));
      if (invalidFiles.length > 0) {
        const Swal = await getSwal();
        Swal.fire({
          icon: 'warning',
          title: t('common.warning', 'Cảnh báo'),
          text: t('documents.uploadPrefixMismatch', 'Tên tệp phải chứa tiền tố "{prefix}" (tối đa 6 ký tự bất kỳ phía trước): {files}')
            .replace('{prefix}', targetFolder.default_prefix)
            .replace('{files}', invalidFiles.map(f => f.name).join(', '))
        });
        e.target.value = '';
        return;
      }
    }
    if (targetFolder?.allowed_extensions) {
      const invalidFiles = files.filter(f => !matchesAllowedExtensions(f.name, targetFolder.allowed_extensions));
      if (invalidFiles.length > 0) {
        const Swal = await getSwal();
        Swal.fire({
          icon: 'warning',
          title: t('common.warning', 'Cảnh báo'),
          text: t('documents.uploadExtensionMismatch', 'Thư mục này chỉ chấp nhận đuôi tệp: {exts}. Tệp không hợp lệ: {files}')
            .replace('{exts}', parseAllowedExtensions(targetFolder.allowed_extensions).join(', '))
            .replace('{files}', invalidFiles.map(f => f.name).join(', '))
        });
        e.target.value = '';
        return;
      }
    }

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
  const isSlotTableFolder = currentFolder?.folder_type === 'file_slot_table';
  const rootFolders = getChildren(null);

  // A folder's required-file upload progress = (filled required-prefix rows) / (total
  // required-prefix rows), counted across itself AND every descendant folder recursively.
  // Rows with no prefix defined (free-form rows) never count toward either side.
  const computeFolderProgress = (folderId) => {
    let filled = 0;
    let total = 0;
    const folder = folders.find(f => f.folder_id === folderId);
    if (folder?.folder_type === 'file_slot_table') {
      const requiredSlots = fileSlots.filter(s => s.folder_id === folderId && s.prefix && s.prefix.trim());
      total += requiredSlots.length;
      filled += requiredSlots.filter(s => s.document_id).length;
    }
    for (const child of getChildren(folderId)) {
      const sub = computeFolderProgress(child.folder_id);
      total += sub.total;
      filled += sub.filled;
    }
    return { filled, total };
  };

  const progressFolderIds = selectedFolderId ? [selectedFolderId] : rootFolders.map(f => f.folder_id);
  const progressTotals = progressFolderIds.reduce((acc, id) => {
    const sub = computeFolderProgress(id);
    return { filled: acc.filled + sub.filled, total: acc.total + sub.total };
  }, { filled: 0, total: 0 });
  const progressPercent = progressTotals.total > 0 ? Math.round((progressTotals.filled / progressTotals.total) * 100) : null;

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
            // Clicking the row itself only ever expands (never collapses) — collapsing
            // is exclusively the chevron's job, handled by its own click below.
            if (hasChildren && isCollapsed) toggleCollapse(folder.folder_id);
          }}
        >
          <div
            className="doc-folder-node-left"
            onContextMenu={(e) => {
              if (!canManageFolder(folder)) return;
              e.preventDefault();
              e.stopPropagation();
              setFolderContextMenu({ x: e.clientX, y: e.clientY, folder });
            }}
          >
            {hasChildren ? (
              <i
                className={`doc-folder-node-chevron ${isCollapsed ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-down'}`}
                onClick={(e) => { e.stopPropagation(); toggleCollapse(folder.folder_id); }}
              ></i>
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
              onClick={(e) => { e.stopPropagation(); handleCreateFolder(folder.folder_id, folder); }}
            >
              <i className="fa-solid fa-plus"></i>
            </button>
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
    <div
      ref={layoutRef}
      className={`doc-layout doc-explorer-layout ${textEditorState ? 'editor-open' : ''}`}
      style={{ '--doc-tree-width': `${treeWidth}px` }}
    >
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
        <div className="doc-folder-tree-scroll">
          {rootFolders.length === 0 ? (
            <div className="doc-folder-empty">{t('documents.noFoldersYet', 'Chưa có thư mục nào')}</div>
          ) : rootFolders.map(f => renderFolderNode(f, 0))}
        </div>
        <div className="doc-tree-resize-handle" onMouseDown={handleTreeResizeStart} title={t('documents.resizeTreePanel', 'Kéo để thay đổi kích thước')}></div>
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

        {!isSlotTableFolder && (
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
            {canUploadDocuments && (
              <>
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
              </>
            )}
          </div>
        )}

        <div className="doc-breadcrumb">
          {activeSearch ? (
            <span>
              {t('documents.searchResultsFor', 'Kết quả tìm kiếm cho')} &quot;{activeSearch}&quot;
              <button type="button" className="btn-text" onClick={clearSearch}>{t('documents.clearSearch', 'Xóa tìm kiếm')}</button>
            </span>
          ) : (
            <span><i className="fa-solid fa-folder"></i> {currentFolder ? getFolderPath(currentFolder.folder_id) : rootLabel}</span>
          )}
          {!activeSearch && progressPercent !== null && (
            <div className="doc-folder-progress" title={t('documents.folderProgressTitle', 'Tỉ lệ upload các file bắt buộc')}>
              <span className="doc-folder-progress-bar">
                <span className="doc-folder-progress-fill" style={{ width: `${progressPercent}%` }}></span>
              </span>
              <span className="doc-folder-progress-label">{progressPercent}%</span>
            </div>
          )}
        </div>
        {!activeSearch && (currentFolder?.default_prefix || currentFolder?.allowed_extensions) && (
          <div style={{ marginTop: '-8px', marginBottom: '12px' }}>
            {currentFolder?.default_prefix && (
              <div style={{ fontSize: '12px', color: 'var(--warning-color)' }}>
                <i className="fa-solid fa-circle-info"></i> {t('documents.folderDefaultPrefixHint2', 'Tên file phải chứa "{prefix}" (tối đa 6 ký tự bất kỳ phía trước)').replace('{prefix}', currentFolder.default_prefix)}
              </div>
            )}
            {currentFolder?.allowed_extensions && (
              <div style={{ fontSize: '12px', color: 'var(--warning-color)' }}>
                <i className="fa-solid fa-circle-info"></i> {t('documents.folderAllowedExtensionsHint2', 'Chỉ chấp nhận đuôi tệp: {exts}').replace('{exts}', parseAllowedExtensions(currentFolder.allowed_extensions).join(', '))}
              </div>
            )}
          </div>
        )}

        {isSlotTableFolder ? (
          <DocumentFileSlotTable folderId={selectedFolderId} projectId={projectId} currentUser={currentUser} canUpload={canUploadDocuments} allowedExtensions={currentFolder?.allowed_extensions} onSlotsChanged={loadFileSlots} />
        ) : (
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
        )}
        </>
        )}
      </div>
      {previewDoc && (
        <FilePreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}
      {folderContextMenu && (
        <div
          style={{
            position: 'fixed',
            top: folderContextMenu.y,
            left: folderContextMenu.x,
            zIndex: 1000,
            backgroundColor: 'var(--neutral-bg-card)',
            border: '1px solid var(--neutral-border)',
            borderRadius: '6px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15)',
            minWidth: '160px',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={(e) => { handleRenameFolder(folderContextMenu.folder, e); setFolderContextMenu(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 14px', border: 'none', background: 'none', color: 'var(--neutral-dark)', fontSize: '13.5px', cursor: 'pointer', textAlign: 'left' }}
          >
            <i className="fa-solid fa-pen" style={{ width: '14px' }}></i> {t('documents.renameFolderAction', 'Đổi tên thư mục')}
          </button>
          <button
            type="button"
            onClick={(e) => { handleDeleteFolder(folderContextMenu.folder, e); setFolderContextMenu(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 14px', border: 'none', background: 'none', color: 'var(--danger-color)', fontSize: '13.5px', cursor: 'pointer', textAlign: 'left' }}
          >
            <i className="fa-solid fa-trash-can" style={{ width: '14px' }}></i> {t('documents.deleteFolderAction', 'Xóa thư mục')}
          </button>
        </div>
      )}
    </div>
  );
}
