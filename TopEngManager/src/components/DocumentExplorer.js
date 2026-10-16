"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { db } from '@/utils/db';
import { getSwal } from '@/utils/swal';
import TextDocumentEditor from '@/components/TextDocumentEditor';
import FilePreviewModal, { PREVIEWABLE_EXTENSIONS } from '@/components/FilePreviewModal';
import DocumentFileSlotTable from '@/components/DocumentFileSlotTable';
import { matchesRequiredPrefix, matchesAllowedExtensions, parseAllowedExtensions, UPLOAD_ACCEPT_EXT } from '@/utils/filePrefixMatch';

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
  zw1: 'fa-file-pen',
  drawio: 'fa-diagram-project'
};
const ACCEPT_EXT = UPLOAD_ACCEPT_EXT;

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
  const folderInputRef = useRef(null);
  const uploadDropdownRef = useRef(null);
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
  const [uploadDropdownOpen, setUploadDropdownOpen] = useState(false);
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);
  const [textEditorState, setTextEditorState] = useState(null); // { doc, autoEdit } | null
  const [previewDoc, setPreviewDoc] = useState(null);
  // Right-click folder menu: { x, y, folder } while open, null when closed.
  const [folderContextMenu, setFolderContextMenu] = useState(null);
  const [copiedFolders, setCopiedFolders] = useState([]); // [{ folder_id, name, parent_folder_id }, ...]
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedFolderIdsForCopy, setSelectedFolderIdsForCopy] = useState(new Set());
  const [treeWidth, setTreeWidth] = useState(260);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [selectedItemInView, setSelectedItemInView] = useState(null); // { type: 'folder' | 'doc', id }
  const [draggedFolder, setDraggedFolder] = useState(null);
  const [dragOverFolderId, setDragOverFolderId] = useState(null);
  const [dragOverPosition, setDragOverPosition] = useState(null); // 'before' | 'after'

  useEffect(() => {
    try {
      const saved = localStorage.getItem('topv_wiki_view_mode');
      if (saved === 'list' || saved === 'grid') setViewMode(saved);
    } catch (e) {}
  }, []);

  useEffect(() => {
    setSelectedItemInView(null);
  }, [selectedFolderId]);

  useEffect(() => {
    if (!uploadDropdownOpen) return;
    const handleOutsideClick = (e) => {
      if (uploadDropdownRef.current && !uploadDropdownRef.current.contains(e.target)) {
        setUploadDropdownOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [uploadDropdownOpen]);

  const copiedFolderIds = useMemo(() => new Set(copiedFolders.map(f => f.folder_id)), [copiedFolders]);
  const currentFolder = folders.find(f => f.folder_id === selectedFolderId);

  const isAdmin = currentUser?.system_role?.includes('Admin');

  // Upload is only gated inside a project's Tài liệu tab; the company-wide Documents
  // page (no projectId) keeps its existing open-to-everyone behavior.
  const myProjectRole = projectId
    ? projectMembers.find(m => m.project_id === projectId && m.user_id === currentUser?.id)?.project_role
    : null;
  const canUploadDocuments = !projectId || hasPermission('upload_project_documents') || myProjectRole === 'PM';
  // Creating folders inside a project is limited to its PM (and Admin). A Team/Part Leader
  // who is not the PM of THIS project cannot, so a general role is not enough. The
  // company-wide Documents page keeps its existing open behaviour.
  const canCreateFolders = !projectId || isAdmin || myProjectRole === 'PM';

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

  // Slot uploads always change the progress figures; a replacement can also add the
  // "Backup file" folder, which only shows up once the tree itself is reloaded.
  const handleSlotsChanged = useCallback(async ({ replaced = false } = {}) => {
    await loadFileSlots();
    if (replaced) await loadFolders();
  }, [loadFileSlots, loadFolders]);

  const getChildren = (parentId) => {
    return folders
      .filter(f => (f.parent_folder_id || null) === parentId)
      .sort((a, b) => {
        const orderA = typeof a.sort_order === 'number' ? a.sort_order : 0;
        const orderB = typeof b.sort_order === 'number' ? b.sort_order : 0;
        if (orderA !== orderB) return orderA - orderB;
        return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true });
      });
  };

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

  const getFolderBreadcrumbTrail = (folderId) => {
    const trail = [];
    let current = folders.find(f => f.folder_id === folderId);
    while (current) {
      trail.unshift(current);
      current = folders.find(f => f.folder_id === current.parent_folder_id);
    }
    return trail;
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
    if (!canCreateFolders) return;
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

  const handleDeleteMultipleFolders = async (e) => {
    if (e) {
      e.stopPropagation?.();
      e.currentTarget?.blur?.();
    }
    const ids = Array.from(selectedFolderIdsForCopy);
    if (ids.length === 0) return;

    const selectedList = folders.filter(f => ids.includes(f.folder_id));
    const unauthorized = selectedList.filter(f => !canManageFolder(f));
    const Swal = await getSwal();

    if (unauthorized.length > 0) {
      Swal.fire({
        icon: 'error',
        title: t('common.permissionDenied', 'Không có quyền'),
        text: `Bạn không có quyền xóa một số thư mục đã chọn (${unauthorized.map(f => f.name).join(', ')}).`
      });
      return;
    }

    const count = ids.length;
    const result = await Swal.fire({
      icon: 'warning',
      title: t('documents.deleteMultiFoldersConfirmTitle', 'Xóa {count} thư mục đã chọn?').replace('{count}', count),
      text: t('documents.deleteMultiFoldersConfirmText', 'Toàn bộ thư mục con và tài liệu bên trong {count} thư mục này sẽ bị xóa vĩnh viễn.').replace('{count}', count),
      showCancelButton: true,
      confirmButtonText: t('common.delete', 'Xóa'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--danger-color)'
    });
    if (!result.isConfirmed) return;

    try {
      await db.deleteDocumentFolder({ folderIds: ids });
      if (selectedFolderId && ids.includes(selectedFolderId)) {
        setSelectedFolderId(null);
      }
      setSelectedFolderIdsForCopy(new Set());
      setIsMultiSelectMode(false);
      await loadFolders();
      await loadDocuments();
      await db.logActivity(
        currentUser.id,
        'DELETE_FOLDERS',
        'Document',
        ids.join(','),
        `đã xóa ${count} thư mục (${selectedList.map(f => f.name).join(', ')})`,
        { project_id: projectId, count }
      );
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    }
  };

  const getDescendantFolderIds = (folderIdOrIds) => {
    const startIds = Array.isArray(folderIdOrIds) ? folderIdOrIds : (folderIdOrIds ? [folderIdOrIds] : []);
    const ids = new Set(startIds);
    let frontier = [...startIds];
    while (frontier.length > 0) {
      const children = folders.filter(f => frontier.includes(f.parent_folder_id)).map(f => f.folder_id);
      children.forEach(id => ids.add(id));
      frontier = children;
    }
    return ids;
  };

  const handleCopyFolderToClipboard = (folder, e) => {
    if (e) {
      e.stopPropagation();
      e.currentTarget?.blur();
    }
    setCopiedFolders([folder]);
    getSwal().then(s => {
      s.fire({
        icon: 'info',
        title: t('documents.copyFolderTitle', 'Sao chép thư mục'),
        text: t('documents.copyCopiedToClipboard', 'Đã sao chép thư mục "{name}". Đi đến thư mục đích và chọn Dán (Ctrl+V).')
          .replace('{name}', folder.name),
        timer: 1600,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    });
  };

  const handleCopyMultipleFoldersToClipboard = (e) => {
    if (e) {
      e.stopPropagation();
      e.currentTarget?.blur();
    }
    const ids = Array.from(selectedFolderIdsForCopy);
    if (ids.length === 0) {
      getSwal().then(s => {
        s.fire({
          icon: 'warning',
          title: t('documents.noFoldersSelected', 'Chưa chọn thư mục nào.'),
          timer: 1500,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
      });
      return;
    }

    const selectedList = folders.filter(f => ids.includes(f.folder_id));
    setCopiedFolders(selectedList);
    setIsMultiSelectMode(false);
    setSelectedFolderIdsForCopy(new Set());

    getSwal().then(s => {
      s.fire({
        icon: 'info',
        title: t('documents.copyFolderTitle', 'Sao chép thư mục'),
        text: `Đã sao chép ${selectedList.length} thư mục vào clipboard. Đi đến thư mục đích và chọn Dán (Ctrl+V).`,
        timer: 1800,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    });
  };

  const handlePasteFolder = async (targetParentFolderId, targetParentFolder, e) => {
    if (e) {
      e.stopPropagation();
      e.currentTarget?.blur();
    }
    if (!canCreateFolders || !copiedFolders || copiedFolders.length === 0) return;

    const copiedIds = copiedFolders.map(f => f.folder_id);
    const forbiddenIds = getDescendantFolderIds(copiedIds);
    if (targetParentFolderId && forbiddenIds.has(targetParentFolderId)) {
      const Swal = await getSwal();
      Swal.fire({
        icon: 'warning',
        title: t('common.warning', 'Cảnh báo'),
        text: 'Không thể dán thư mục vào chính nó hoặc thư mục con của nó.'
      });
      return;
    }

    try {
      await db.copyDocumentFolder({
        sourceFolderIds: copiedIds,
        targetParentFolderId: targetParentFolderId || null,
        targetProjectId: projectId,
        createdBy: currentUser.id
      });

      await loadFolders();
      await loadDocuments();

      if (targetParentFolderId) {
        setCollapsedFolders(prev => {
          const next = new Set(prev);
          next.delete(targetParentFolderId);
          return next;
        });
      }

      const destPath = targetParentFolderId ? getFolderPath(targetParentFolderId) : rootLabel;
      await db.logActivity(
        currentUser.id,
        'COPY_FOLDERS',
        'Document',
        targetParentFolderId || projectId || 'root',
        `đã dán ${copiedIds.length} thư mục vào '${destPath}'`,
        { project_id: projectId, count: copiedIds.length }
      );

      // NOTICE: No success popup per user requirement: "dán thành công không cần hiện popup thành công"
    } catch (err) {
      const Swal = await getSwal();
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    }
  };

  const toggleFolderSelection = (folderId) => {
    setSelectedFolderIdsForCopy(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const selectAllVisibleFolders = () => {
    const allIds = new Set(folders.map(f => f.folder_id));
    setSelectedFolderIdsForCopy(allIds);
  };

  // Move a single folder up or down among its siblings
  const handleMoveFolder = async (folder, direction) => {
    const parentId = folder.parent_folder_id || null;
    const siblings = [...getChildren(parentId)];
    const index = siblings.findIndex(f => f.folder_id === folder.folder_id);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    // Swap positions
    const [moved] = siblings.splice(index, 1);
    siblings.splice(targetIndex, 0, moved);

    const orders = siblings.map((f, idx) => ({
      folder_id: f.folder_id,
      sort_order: idx,
      parent_folder_id: parentId
    }));

    const orderMap = new Map(orders.map(o => [o.folder_id, o.sort_order]));
    setFolders(prev => prev.map(f => {
      if (orderMap.has(f.folder_id)) {
        return { ...f, sort_order: orderMap.get(f.folder_id) };
      }
      return f;
    }));

    try {
      await db.reorderDocumentFolders(orders);
    } catch (err) {
      console.error('Failed to save folder order', err);
    }
  };

  // Batch move selected folders up or down
  const handleBatchMoveSelectedFolders = async (direction) => {
    if (selectedFolderIdsForCopy.size === 0) return;
    const selectedIds = Array.from(selectedFolderIdsForCopy);

    const parentGroups = new Map();
    for (const id of selectedIds) {
      const f = folders.find(item => item.folder_id === id);
      if (!f) continue;
      const pid = f.parent_folder_id || null;
      if (!parentGroups.has(pid)) parentGroups.set(pid, []);
      parentGroups.get(pid).push(f);
    }

    let allUpdatedOrders = [];
    let updatedFolders = [...folders];

    parentGroups.forEach((groupFolders, parentId) => {
      let siblings = [...getChildren(parentId)];
      const selectedSet = new Set(groupFolders.map(f => f.folder_id));

      if (direction === 'up') {
        for (let i = 1; i < siblings.length; i++) {
          if (selectedSet.has(siblings[i].folder_id) && !selectedSet.has(siblings[i - 1].folder_id)) {
            const temp = siblings[i];
            siblings[i] = siblings[i - 1];
            siblings[i - 1] = temp;
          }
        }
      } else {
        for (let i = siblings.length - 2; i >= 0; i--) {
          if (selectedSet.has(siblings[i].folder_id) && !selectedSet.has(siblings[i + 1].folder_id)) {
            const temp = siblings[i];
            siblings[i] = siblings[i + 1];
            siblings[i + 1] = temp;
          }
        }
      }

      const orders = siblings.map((f, idx) => ({
        folder_id: f.folder_id,
        sort_order: idx,
        parent_folder_id: parentId
      }));

      allUpdatedOrders.push(...orders);
      const orderMap = new Map(orders.map(o => [o.folder_id, o.sort_order]));
      updatedFolders = updatedFolders.map(f => {
        if (orderMap.has(f.folder_id)) {
          return { ...f, sort_order: orderMap.get(f.folder_id) };
        }
        return f;
      });
    });

    setFolders(updatedFolders);

    try {
      await db.reorderDocumentFolders(allUpdatedOrders);
    } catch (err) {
      console.error('Failed to save batch folder order', err);
    }
  };

  // Drag and Drop reordering handlers
  const handleFolderDragStart = (e, folder) => {
    if (!isMultiSelectMode) return;
    setDraggedFolder(folder);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', folder.folder_id);
    } catch (err) {}
  };

  const handleFolderDragOver = (e, targetFolder) => {
    if (!isMultiSelectMode || !draggedFolder) return;
    if (draggedFolder.folder_id === targetFolder.folder_id) return;

    const draggedParent = draggedFolder.parent_folder_id || null;
    const targetParent = targetFolder.parent_folder_id || null;
    if (draggedParent !== targetParent) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'before' : 'after';
    if (dragOverFolderId !== targetFolder.folder_id || dragOverPosition !== position) {
      setDragOverFolderId(targetFolder.folder_id);
      setDragOverPosition(position);
    }
  };

  const handleFolderDrop = async (e, targetFolder) => {
    if (!isMultiSelectMode || !draggedFolder) return;
    e.preventDefault();
    e.stopPropagation();

    const draggedParent = draggedFolder.parent_folder_id || null;
    const targetParent = targetFolder.parent_folder_id || null;

    if (draggedParent === targetParent && draggedFolder.folder_id !== targetFolder.folder_id) {
      const siblings = [...getChildren(draggedParent)];
      const fromIdx = siblings.findIndex(f => f.folder_id === draggedFolder.folder_id);
      if (fromIdx !== -1) {
        const [removed] = siblings.splice(fromIdx, 1);
        let toIdx = siblings.findIndex(f => f.folder_id === targetFolder.folder_id);
        if (toIdx !== -1) {
          if (dragOverPosition === 'after') toIdx += 1;
          siblings.splice(toIdx, 0, removed);

          const orders = siblings.map((f, idx) => ({
            folder_id: f.folder_id,
            sort_order: idx,
            parent_folder_id: draggedParent
          }));

          const orderMap = new Map(orders.map(o => [o.folder_id, o.sort_order]));
          setFolders(prev => prev.map(f => {
            if (orderMap.has(f.folder_id)) {
              return { ...f, sort_order: orderMap.get(f.folder_id) };
            }
            return f;
          }));

          try {
            await db.reorderDocumentFolders(orders);
          } catch (err) {
            console.error('Failed to save folder order', err);
          }
        }
      }
    }

    setDraggedFolder(null);
    setDragOverFolderId(null);
    setDragOverPosition(null);
  };

  const handleFolderDragEnd = () => {
    setDraggedFolder(null);
    setDragOverFolderId(null);
    setDragOverPosition(null);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) {
        return;
      }

      // Ctrl+C / Cmd+C: Copy
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        if (isMultiSelectMode && selectedFolderIdsForCopy.size > 0) {
          e.preventDefault();
          handleCopyMultipleFoldersToClipboard();
        } else if (selectedFolderId) {
          const f = folders.find(item => item.folder_id === selectedFolderId);
          if (f) {
            e.preventDefault();
            handleCopyFolderToClipboard(f);
          }
        }
      }

      // Ctrl+V / Cmd+V: Paste
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        if (canCreateFolders && copiedFolders.length > 0) {
          e.preventDefault();
          handlePasteFolder(selectedFolderId, currentFolder);
        }
      }

      // Delete: Delete selected folders in multi-select mode
      if (e.key === 'Delete' && isMultiSelectMode && selectedFolderIdsForCopy.size > 0) {
        e.preventDefault();
        handleDeleteMultipleFolders();
      }

      // Escape: clear clipboard or exit multi-select mode
      if (e.key === 'Escape') {
        if (copiedFolders.length > 0) {
          setCopiedFolders([]);
        } else if (isMultiSelectMode) {
          setIsMultiSelectMode(false);
          setSelectedFolderIdsForCopy(new Set());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFolderId, selectedFolderIdsForCopy, isMultiSelectMode, copiedFolders, folders, canCreateFolders, currentFolder, handleDeleteMultipleFolders]);

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

    // A file already in this folder is never overwritten silently. The copy that is there
    // gets filed into a "Backup file" folder under a dated name, and only if the user says
    // so here. Asked before the upload so a cancelled batch never leaves the browser.
    let conflictNames = [];
    try {
      const check = await db.checkDocumentNameConflicts({
        folderId: selectedFolderId, projectId, fileNames: files.map(f => f.name)
      });
      conflictNames = check?.conflicts || [];
    } catch (err) {
      // Only an optimisation: the server refuses an unconfirmed replacement on its own,
      // so a failure here must not stand in the way of an ordinary upload.
      console.error('Failed to check for duplicate document names', err);
    }
    if (conflictNames.length > 0) {
      const Swal = await getSwal();
      const result = await Swal.fire({
        icon: 'question',
        title: t('documents.replaceConfirmTitle', 'Bạn có muốn thay thế file hiện tại không?'),
        // text, not html: the names come from whatever the user uploaded earlier.
        text: t('documents.replaceConfirmText', 'Thư mục đã có tệp: {files}. Nếu đồng ý, tệp hiện tại sẽ được chuyển vào thư mục "Backup file" và đổi tên theo ngày tải lên.')
          .replace('{files}', conflictNames.join(', ')),
        showCancelButton: true,
        confirmButtonText: t('documents.replaceConfirmBtn', 'Đồng ý'),
        cancelButtonText: t('common.cancel', 'Hủy')
      });
      if (!result.isConfirmed) {
        e.target.value = '';
        return;
      }
    }

    setUploading(true);
    try {
      const created = await db.uploadDocuments(files, {
        folderId: selectedFolderId, projectId, uploadedBy: currentUser.id,
        replaceExisting: conflictNames.length > 0
      });
      // A replacement may have just created the "Backup file" folder, so the tree is
      // reloaded too, not only the file list.
      if (conflictNames.length > 0) await loadFolders();
      await loadDocuments();
      const folderPath = selectedFolderId ? getFolderPath(selectedFolderId) : rootLabel;
      const replaced = new Set(conflictNames.map(name => name.toLowerCase()));
      for (const doc of (created || [])) {
        const wasReplacement = replaced.has((doc.original_name || '').toLowerCase());
        await db.logActivity(
          currentUser.id,
          wasReplacement ? 'UPDATE' : 'UPLOAD',
          'Document',
          doc.document_id,
          wasReplacement
            ? `đã thay thế tài liệu '${doc.original_name}' trong '${folderPath}' (bản cũ được lưu vào 'Backup file')`
            : `đã tải lên tài liệu '${doc.original_name}' vào '${folderPath}'`,
          { project_id: projectId }
        );
      }
    } catch (err) {
      const Swal = await getSwal();
      Swal.fire({ icon: 'error', title: t('common.failed', 'Thất bại'), text: err.message });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleFolderSelected = async (e) => {
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;

    const validFiles = [];
    const validPaths = [];
    let skippedCount = 0;

    for (const file of rawFiles) {
      const baseName = file.name.toLowerCase();
      if (baseName === '.ds_store' || baseName === 'thumbs.db' || baseName === 'desktop.ini') {
        continue;
      }
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!UPLOAD_EXTENSIONS.includes(ext)) {
        skippedCount++;
        continue;
      }
      validFiles.push(file);
      validPaths.push(file.webkitRelativePath || file.name);
    }

    if (validFiles.length === 0) {
      const Swal = await getSwal();
      Swal.fire({
        icon: 'warning',
        title: t('common.warning', 'Cảnh báo'),
        text: t('documents.noValidFilesFoundInFolder', 'Không tìm thấy tệp hợp lệ nào trong thư mục được chọn để tải lên.')
      });
      e.target.value = '';
      return;
    }

    const firstRelPath = validPaths[0] || '';
    const rootFolderName = firstRelPath.split(/[/\\]/)[0] || 'Thư mục mới';

    const Swal = await getSwal();
    const confirmResult = await Swal.fire({
      icon: 'question',
      title: t('documents.uploadFolderConfirmTitle', 'Tải lên thư mục?'),
      text: t('documents.uploadFolderConfirmText', 'Bạn có muốn tải lên thư mục "{name}" ({count} tệp) không?')
        .replace('{name}', rootFolderName)
        .replace('{count}', validFiles.length)
        + (skippedCount > 0 ? ` (Đã bỏ qua ${skippedCount} tệp không được hỗ trợ)` : ''),
      showCancelButton: true,
      confirmButtonText: t('common.upload', 'Tải lên'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--primary-color)'
    });
    if (!confirmResult.isConfirmed) {
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      await db.uploadDocuments(validFiles, {
        folderId: selectedFolderId,
        projectId,
        uploadedBy: currentUser.id,
        relativePaths: validPaths,
        isFolderUpload: true,
        replaceExisting: true
      });

      await loadFolders();
      await loadDocuments();

      const folderPath = selectedFolderId ? getFolderPath(selectedFolderId) : rootLabel;
      await db.logActivity(
        currentUser.id,
        'UPLOAD_FOLDER',
        'Document',
        selectedFolderId || projectId || 'root',
        `đã tải lên thư mục '${rootFolderName}' (${validFiles.length} tệp) vào '${folderPath}'`,
        { project_id: projectId, count: validFiles.length }
      );

      Swal.fire({
        icon: 'success',
        title: t('common.success', 'Thành công'),
        text: t('documents.uploadFolderSuccess', 'Đã tải lên thư mục "{name}" ({count} tệp) thành công.')
          .replace('{name}', rootFolderName)
          .replace('{count}', validFiles.length),
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (err) {
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

  const isSlotTableFolder = currentFolder?.folder_type === 'file_slot_table';
  const rootFolders = getChildren(null);
  const currentSubfolders = useMemo(() => {
    if (activeSearch) return [];
    return getChildren(selectedFolderId || null);
  }, [folders, selectedFolderId, activeSearch]);

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
    // 2-level limit for sidebar tree:
    // depth 0 = Root folders (Level 1, e.g. 2024, 2025, PC Team)
    // depth 1 = Immediate children (Level 2, e.g. LG, SDV, SEVT)
    // Deeper levels (depth >= 1) do NOT expand in the sidebar; they are explored in the main pane.
    const children = depth < 1 ? getChildren(folder.folder_id) : [];
    const hasChildren = depth < 1 && children.length > 0;
    const isCollapsed = collapsedFolders.has(folder.folder_id);
    const isSelected = selectedFolderId === folder.folder_id;
    const isChecked = selectedFolderIdsForCopy.has(folder.folder_id);
    const isCopied = copiedFolderIds.has(folder.folder_id);

    // Check if this folder is an ancestor of the currently selected folder
    let isAncestor = false;
    if (selectedFolderId && !isSelected) {
      let cur = folders.find(f => f.folder_id === selectedFolderId);
      while (cur) {
        if (cur.parent_folder_id === folder.folder_id) {
          isAncestor = true;
          break;
        }
        cur = folders.find(f => f.folder_id === cur.parent_folder_id);
      }
    }

    const isDragging = draggedFolder?.folder_id === folder.folder_id;
    const isDragOver = dragOverFolderId === folder.folder_id;
    const dragClass = isDragOver ? (dragOverPosition === 'before' ? 'drag-over-top' : 'drag-over-bottom') : '';

    return (
      <div key={folder.folder_id} style={{ marginLeft: depth > 0 ? '14px' : '0px' }}>
        <div
          className={`doc-folder-node ${isSelected ? 'active' : ''} ${isAncestor ? 'ancestor-active' : ''} ${isChecked ? 'selected-for-copy' : ''} ${isCopied ? 'copied-in-clipboard' : ''} ${isDragging ? 'is-dragging' : ''} ${dragClass} ${isMultiSelectMode ? 'multi-select-mode' : ''}`}
          draggable={isMultiSelectMode}
          onDragStart={(e) => handleFolderDragStart(e, folder)}
          onDragOver={(e) => handleFolderDragOver(e, folder)}
          onDragLeave={() => {
            if (dragOverFolderId === folder.folder_id) {
              setDragOverFolderId(null);
              setDragOverPosition(null);
            }
          }}
          onDrop={(e) => handleFolderDrop(e, folder)}
          onDragEnd={handleFolderDragEnd}
          onClick={() => {
            if (isMultiSelectMode) {
              toggleFolderSelection(folder.folder_id);
              return;
            }
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
              if (!canManageFolder(folder) && !canCreateFolders) return;
              e.preventDefault();
              e.stopPropagation();
              setFolderContextMenu({ x: e.clientX, y: e.clientY, folder });
            }}
          >
            {isMultiSelectMode && (
              <span
                className="doc-folder-drag-handle"
                title={t('documents.dragToReorder', 'Kéo để đổi thứ tự')}
                onClick={(e) => e.stopPropagation()}
              >
                <i className="fa-solid fa-grip-vertical"></i>
              </span>
            )}
            {hasChildren ? (
              <i
                className={`doc-folder-node-chevron ${isCollapsed ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-down'}`}
                onClick={(e) => { e.stopPropagation(); toggleCollapse(folder.folder_id); }}
              ></i>
            ) : (
              <span className="doc-folder-node-spacer" />
            )}
            {isMultiSelectMode && (
              <input
                type="checkbox"
                className="doc-folder-checkbox"
                checked={isChecked}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleFolderSelection(folder.folder_id);
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  marginRight: '6px',
                  cursor: 'pointer',
                  accentColor: 'var(--primary-color)',
                  width: '14px',
                  height: '14px',
                  flexShrink: 0
                }}
              />
            )}
            <i className={hasChildren && !isCollapsed ? 'fa-solid fa-folder-open' : 'fa-solid fa-folder'}></i>
            <span>{folder.name}</span>
          </div>
          <div className="doc-folder-node-actions">
            {isMultiSelectMode ? (
              <div className="doc-folder-reorder-btns" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="doc-reorder-btn"
                  title={t('documents.moveUp', 'Di chuyển lên')}
                  onClick={(e) => { e.stopPropagation(); handleMoveFolder(folder, 'up'); }}
                >
                  <i className="fa-solid fa-arrow-up"></i>
                </button>
                <button
                  type="button"
                  className="doc-reorder-btn"
                  title={t('documents.moveDown', 'Di chuyển xuống')}
                  onClick={(e) => { e.stopPropagation(); handleMoveFolder(folder, 'down'); }}
                >
                  <i className="fa-solid fa-arrow-down"></i>
                </button>
              </div>
            ) : (
              canCreateFolders && (
                <>
                  <button
                    type="button"
                    title={t('documents.copyToClipboardAction', 'Sao chép (Ctrl+C)')}
                    onClick={(e) => handleCopyFolderToClipboard(folder, e)}
                  >
                    <i className="fa-regular fa-copy"></i>
                  </button>
                  <button
                    type="button"
                    title={t('documents.newSubfolder', 'Thư mục con mới')}
                    onClick={(e) => { e.stopPropagation(); handleCreateFolder(folder.folder_id, folder); }}
                  >
                    <i className="fa-solid fa-plus"></i>
                  </button>
                </>
              )
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
    <div
      ref={layoutRef}
      className={`doc-layout doc-explorer-layout ${textEditorState ? 'editor-open' : ''}`}
      style={{ '--doc-tree-width': `${treeWidth}px` }}
    >
      <div className={`doc-folder-tree-panel ${mobileTreeOpen ? 'show' : ''}`}>
        <div className="doc-folder-tree-header" style={isMultiSelectMode ? { textTransform: 'none', letterSpacing: 'normal' } : {}}>
          {isMultiSelectMode ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                <span style={{ fontWeight: 600, color: 'var(--primary-color)', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                  {selectedFolderIdsForCopy.size > 0
                    ? `${t('documents.selectedCount', 'Đã chọn')}: ${selectedFolderIdsForCopy.size}`
                    : t('documents.selectFoldersMode', 'Chọn thư mục')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  className="doc-folder-add-root"
                  title={selectedFolderIdsForCopy.size === folders.length ? t('documents.clearFolderSelection', 'Bỏ chọn tất cả') : t('documents.selectAllFolders', 'Chọn tất cả')}
                  onClick={selectedFolderIdsForCopy.size === folders.length ? () => setSelectedFolderIdsForCopy(new Set()) : selectAllVisibleFolders}
                  style={{ fontSize: '13px', color: 'var(--neutral-muted)' }}
                >
                  <i className={selectedFolderIdsForCopy.size > 0 && selectedFolderIdsForCopy.size === folders.length ? 'fa-solid fa-square-check' : 'fa-regular fa-square-check'}></i>
                </button>
                {selectedFolderIdsForCopy.size > 0 && (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        padding: '3px 7px',
                        fontSize: '11px',
                        height: '26px',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                      onClick={() => handleBatchMoveSelectedFolders('up')}
                      title={t('documents.moveSelectedUp', 'Di chuyển lên trên')}
                    >
                      <i className="fa-solid fa-arrow-up"></i>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        padding: '3px 7px',
                        fontSize: '11px',
                        height: '26px',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                      onClick={() => handleBatchMoveSelectedFolders('down')}
                      title={t('documents.moveSelectedDown', 'Di chuyển xuống dưới')}
                    >
                      <i className="fa-solid fa-arrow-down"></i>
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{
                        padding: '3px 8px',
                        fontSize: '11.5px',
                        height: '26px',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        cursor: 'pointer'
                      }}
                      onClick={handleCopyMultipleFoldersToClipboard}
                      title={t('documents.copySelectedFolders', 'Sao chép (Ctrl+C)')}
                    >
                      <i className="fa-regular fa-copy"></i>
                      <span>{t('documents.copy', 'Sao chép')}</span>
                    </button>
                    {canCreateFolders && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{
                          padding: '3px 8px',
                          fontSize: '11.5px',
                          height: '26px',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          background: 'var(--danger-color, #dc3545)',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        onClick={handleDeleteMultipleFolders}
                        title={t('documents.deleteSelectedFoldersAction', 'Xóa thư mục đã chọn (Delete)')}
                      >
                        <i className="fa-solid fa-trash-can"></i>
                        <span>{t('common.delete', 'Xóa')}</span>
                      </button>
                    )}
                  </>
                )}
                <button
                  type="button"
                  className="doc-folder-add-root"
                  style={{ color: 'var(--neutral-muted)', fontSize: '13px' }}
                  title={t('documents.exitSelectFoldersMode', 'Thoát')}
                  onClick={() => {
                    setIsMultiSelectMode(false);
                    setSelectedFolderIdsForCopy(new Set());
                  }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </>
          ) : (
            <>
              <span>{t('documents.folders', 'Thư mục')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {canCreateFolders && (
                  <button
                    type="button"
                    className="doc-folder-add-root"
                    title={t('documents.selectFoldersMode', 'Chọn nhiều thư mục')}
                    onClick={() => setIsMultiSelectMode(true)}
                  >
                    <i className="fa-solid fa-list-check"></i>
                  </button>
                )}
                {canCreateFolders && copiedFolders.length > 0 && (
                  <button
                    type="button"
                    className="doc-folder-add-root"
                    style={{ color: 'var(--primary-color)' }}
                    title={`${t('documents.pasteToRoot', 'Dán vào thư mục gốc')} (${copiedFolders.length} thư mục)`}
                    onClick={(e) => handlePasteFolder(null, null, e)}
                  >
                    <i className="fa-solid fa-paste"></i>
                  </button>
                )}
                {canCreateFolders && (
                  <button
                    type="button"
                    className="doc-folder-add-root"
                    title={t('documents.newFolder', 'Thư mục mới')}
                    onClick={() => handleCreateFolder(null)}
                  >
                    <i className="fa-solid fa-folder-plus"></i>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        {copiedFolders.length > 0 && !isMultiSelectMode && (
          <div style={{
            padding: '6px 10px',
            background: 'rgba(59, 130, 246, 0.08)',
            borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: 'var(--primary-color)'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <i className="fa-solid fa-clipboard"></i>
              {copiedFolders.length === 1
                ? `Đã sao chép: "${copiedFolders[0].name}"`
                : `Đã sao chép ${copiedFolders.length} thư mục`}
            </span>
            <button
              type="button"
              onClick={() => setCopiedFolders([])}
              title="Hủy sao chép (Esc)"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--neutral-muted)',
                cursor: 'pointer',
                fontSize: '13px',
                padding: '2px 4px'
              }}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}
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
                <input
                  ref={folderInputRef}
                  type="file"
                  webkitdirectory=""
                  directory=""
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFolderSelected}
                />
                {canCreateFolders && copiedFolders.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      borderColor: 'var(--primary-color)',
                      color: 'var(--primary-color)',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onClick={(e) => handlePasteFolder(selectedFolderId, currentFolder, e)}
                    title={selectedFolderId ? `Dán vào thư mục "${currentFolder?.name || ''}" (Ctrl+V)` : t('documents.pasteToRoot', 'Dán vào thư mục gốc (Ctrl+V)')}
                  >
                    <i className="fa-solid fa-paste"></i>
                    <span>{t('documents.pasteFolderAction', 'Dán')} ({copiedFolders.length})</span>
                  </button>
                )}
                {canCreateFolders && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => handleCreateFolder(selectedFolderId, currentFolder)}
                    title={selectedFolderId ? `Tạo thư mục con trong "${currentFolder?.name || ''}"` : t('documents.newFolder', 'Tạo thư mục')}
                  >
                    <i className="fa-solid fa-folder-plus"></i>
                    <span>{t('documents.newFolder', 'Tạo thư mục')}</span>
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setTextEditorState({ doc: null, autoEdit: true })}>
                  <i className="fa-solid fa-file-circle-plus"></i> {t('documents.createDocument', 'Tạo tài liệu')}
                </button>
                <div ref={uploadDropdownRef} style={{ position: 'relative', display: 'inline-flex' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setUploadDropdownOpen(prev => !prev)}
                    disabled={uploading}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <i className="fa-solid fa-cloud-arrow-up"></i>
                    <span>{uploading ? t('documents.uploading', 'Đang tải lên...') : t('common.upload', 'Tải lên')}</span>
                    <i className="fa-solid fa-chevron-down" style={{ fontSize: '10px', marginLeft: '2px', transition: 'transform 0.2s', transform: uploadDropdownOpen ? 'rotate(180deg)' : 'none' }}></i>
                  </button>
                  {uploadDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        right: 0,
                        background: 'var(--neutral-bg-card, #fff)',
                        borderRadius: '6px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                        border: '1px solid var(--neutral-border, #e2e8f0)',
                        zIndex: 1000,
                        minWidth: '175px',
                        padding: '4px 0'
                      }}
                    >
                      <button
                        type="button"
                        className="doc-context-menu-item"
                        onClick={() => {
                          setUploadDropdownOpen(false);
                          fileInputRef.current?.click();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '8px 14px',
                          border: 'none',
                          background: 'none',
                          color: 'var(--neutral-dark, #1e293b)',
                          fontSize: '13px',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <i className="fa-solid fa-file-arrow-up" style={{ width: '16px', color: 'var(--primary-color)' }}></i>
                        <span>{t('documents.uploadFiles', 'Tải tệp lên')}</span>
                      </button>
                      <button
                        type="button"
                        className="doc-context-menu-item"
                        onClick={() => {
                          setUploadDropdownOpen(false);
                          folderInputRef.current?.click();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '8px 14px',
                          border: 'none',
                          background: 'none',
                          color: 'var(--neutral-dark, #1e293b)',
                          fontSize: '13px',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <i className="fa-solid fa-folder-arrow-up" style={{ width: '16px', color: '#eab308' }}></i>
                        <span>{t('documents.uploadFolder', 'Tải thư mục lên')}</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Windows Explorer Navigation Bar: Up button, Clickable Breadcrumbs & View Mode Toggle */}
        <div className="doc-breadcrumb">
          <div className="doc-breadcrumb-left">
            <button
              type="button"
              className="doc-nav-up-btn"
              title={t('documents.upOneLevel', 'Lên một cấp (Thư mục cha)')}
              disabled={!currentFolder}
              onClick={() => {
                if (currentFolder?.parent_folder_id) {
                  setSelectedFolderId(currentFolder.parent_folder_id);
                } else {
                  setSelectedFolderId(null);
                }
              }}
            >
              <i className="fa-solid fa-arrow-up"></i>
            </button>

            {activeSearch ? (
              <span className="doc-breadcrumb-search">
                {t('documents.searchResultsFor', 'Kết quả tìm kiếm cho')} &quot;{activeSearch}&quot;
                <button type="button" className="btn-text" onClick={clearSearch}>{t('documents.clearSearch', 'Xóa tìm kiếm')}</button>
              </span>
            ) : (
              <div className="doc-breadcrumb-trail">
                <span
                  className={`doc-breadcrumb-segment ${!selectedFolderId ? 'active' : ''}`}
                  onClick={() => setSelectedFolderId(null)}
                  title={rootLabel}
                >
                  <i className="fa-solid fa-house-chimney" style={{ fontSize: '11px', marginRight: '4px' }}></i>
                  {rootLabel}
                </span>

                {getFolderBreadcrumbTrail(selectedFolderId).map((crumb, idx, arr) => {
                  const isLast = idx === arr.length - 1;
                  return (
                    <React.Fragment key={crumb.folder_id}>
                      <span className="doc-breadcrumb-sep">/</span>
                      <span
                        className={`doc-breadcrumb-segment ${isLast ? 'active' : ''}`}
                        onClick={() => {
                          if (!isLast) setSelectedFolderId(crumb.folder_id);
                        }}
                        title={crumb.name}
                      >
                        <i className="fa-solid fa-folder" style={{ fontSize: '11px', marginRight: '4px' }}></i>
                        {crumb.name}
                      </span>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {!activeSearch && progressPercent !== null && (
              <div className="doc-folder-progress" title={t('documents.folderProgressTitle', 'Tỉ lệ upload các file bắt buộc')}>
                <span className="doc-folder-progress-bar">
                  <span className="doc-folder-progress-fill" style={{ width: `${progressPercent}%` }}></span>
                </span>
                <span className="doc-folder-progress-label">{progressPercent}%</span>
              </div>
            )}

            {/* View Mode Toggle: List vs Grid */}
            <div className="doc-view-mode-toggle">
              <button
                type="button"
                className={`doc-view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => {
                  setViewMode('list');
                  try { localStorage.setItem('topv_wiki_view_mode', 'list'); } catch (e) {}
                }}
                title={t('documents.listView', 'Dạng danh sách')}
              >
                <i className="fa-solid fa-list"></i>
              </button>
              <button
                type="button"
                className={`doc-view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => {
                  setViewMode('grid');
                  try { localStorage.setItem('topv_wiki_view_mode', 'grid'); } catch (e) {}
                }}
                title={t('documents.gridView', 'Dạng lưới')}
              >
                <i className="fa-solid fa-grip"></i>
              </button>
            </div>
          </div>
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
          <DocumentFileSlotTable folderId={selectedFolderId} projectId={projectId} currentUser={currentUser} canUpload={canUploadDocuments} allowedExtensions={currentFolder?.allowed_extensions} onSlotsChanged={handleSlotsChanged} />
        ) : (
          <div className="doc-explorer-content-panel">
            {(!activeSearch && currentSubfolders.length === 0 && documents.length === 0) || (activeSearch && documents.length === 0) ? (
              <div className="empty-widget-state">
                <i className="fa-solid fa-folder-open" style={{ fontSize: '32px' }}></i>
                {activeSearch
                  ? t('documents.noSearchResults', 'Không tìm thấy tài liệu phù hợp.')
                  : t('documents.noDocumentsInFolder', 'Chưa có thư mục hoặc tài liệu nào.')}
              </div>
            ) : viewMode === 'list' ? (
              /* ================== LIST VIEW (Windows Explorer Details Style) ================== */
              <div className="doc-explorer-table">
                <div className="doc-explorer-table-header">
                  <div className="doc-col-name">{t('documents.name', 'Tên')}</div>
                  <div className="doc-col-date">{t('documents.dateModified', 'Ngày sửa đổi')}</div>
                  <div className="doc-col-type">{t('documents.type', 'Loại')}</div>
                  <div className="doc-col-size">{t('documents.size', 'Kích thước')}</div>
                  <div className="doc-col-actions"></div>
                </div>

                <div className="doc-explorer-table-body">
                  {/* SUBFOLDERS FIRST */}
                  {currentSubfolders.map(f => {
                    const isSelected = selectedItemInView?.type === 'folder' && selectedItemInView?.id === f.folder_id;
                    const subChildren = getChildren(f.folder_id);
                    return (
                      <div
                        key={`folder-${f.folder_id}`}
                        className={`doc-explorer-row doc-folder-row ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => setSelectedItemInView({ type: 'folder', id: f.folder_id })}
                        onDoubleClick={() => {
                          setSelectedFolderId(f.folder_id);
                          setSelectedItemInView(null);
                        }}
                        onContextMenu={(e) => {
                          if (!canManageFolder(f) && !canCreateFolders) return;
                          e.preventDefault();
                          e.stopPropagation();
                          setFolderContextMenu({ x: e.clientX, y: e.clientY, folder: f });
                        }}
                      >
                        <div className="doc-col-name">
                          <i className="fa-solid fa-folder doc-folder-icon-main"></i>
                          <span className="doc-item-title" title={f.name}>{f.name}</span>
                        </div>
                        <div className="doc-col-date">
                          {f.updated_at ? new Date(f.updated_at).toLocaleDateString(currentLang === 'vi' ? 'vi-VN' : 'en-US') : (f.created_at ? new Date(f.created_at).toLocaleDateString(currentLang === 'vi' ? 'vi-VN' : 'en-US') : '--')}
                        </div>
                        <div className="doc-col-type">
                          {t('documents.typeFolder', 'Thư mục tệp')}
                        </div>
                        <div className="doc-col-size">
                          {subChildren.length > 0 ? `${subChildren.length} ${t('documents.subfolders', 'thư mục')}` : '--'}
                        </div>
                        <div className="doc-col-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="doc-row-action-btn"
                            title={t('common.open', 'Mở thư mục')}
                            onClick={() => setSelectedFolderId(f.folder_id)}
                          >
                            <i className="fa-solid fa-folder-open"></i>
                          </button>
                          {canCreateFolders && (
                            <>
                              <button
                                type="button"
                                className="doc-row-action-btn"
                                title={t('common.rename', 'Đổi tên')}
                                onClick={(e) => handleRenameFolder(f, e)}
                              >
                                <i className="fa-solid fa-pen"></i>
                              </button>
                              <button
                                type="button"
                                className="doc-row-action-btn"
                                title={t('common.copy', 'Sao chép')}
                                onClick={(e) => handleCopyFolderToClipboard(f, e)}
                              >
                                <i className="fa-regular fa-copy"></i>
                              </button>
                              <button
                                type="button"
                                className="doc-row-action-btn text-danger"
                                title={t('common.delete', 'Xóa')}
                                onClick={(e) => handleDeleteFolder(f, e)}
                              >
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* DOCUMENTS NEXT */}
                  {documents.map(doc => {
                    const isSelected = selectedItemInView?.type === 'doc' && selectedItemInView?.id === doc.document_id;
                    const uploader = users.find(u => u.id === doc.uploaded_by);
                    const icon = FILE_ICONS[doc.file_ext] || 'fa-file';
                    const isTextDoc = doc.doc_type === 'text';
                    const isPreviewableUpload = !isTextDoc && PREVIEWABLE_EXTENSIONS.includes(doc.file_ext);
                    const handleOpenDoc = () => {
                      if (isTextDoc) setTextEditorState({ doc, autoEdit: false });
                      else if (isPreviewableUpload) setPreviewDoc(doc);
                    };

                    return (
                      <div
                        key={`doc-${doc.document_id}`}
                        className={`doc-explorer-row doc-file-row ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => setSelectedItemInView({ type: 'doc', id: doc.document_id })}
                        onDoubleClick={handleOpenDoc}
                      >
                        <div className="doc-col-name">
                          <i className={`fa-solid ${icon} doc-file-icon-main ext-${doc.file_ext}`}></i>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span
                              className={`doc-item-title ${(isTextDoc || isPreviewableUpload) ? 'clickable' : ''}`}
                              onClick={(e) => {
                                if (isTextDoc || isPreviewableUpload) {
                                  e.stopPropagation();
                                  handleOpenDoc();
                                }
                              }}
                              title={doc.original_name}
                            >
                              {doc.original_name}
                            </span>
                            {activeSearch && (
                              <span style={{ fontSize: '11px', color: 'var(--neutral-muted)' }}>
                                <i className="fa-solid fa-folder" style={{ fontSize: '10px', marginRight: '3px' }}></i>
                                {doc.folder_id ? getFolderPath(doc.folder_id) : rootLabel}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="doc-col-date">
                          {new Date(doc.updated_at || doc.created_at).toLocaleDateString(currentLang === 'vi' ? 'vi-VN' : 'en-US')}
                        </div>
                        <div className="doc-col-type">
                          {doc.file_ext ? `${doc.file_ext.toUpperCase()} File` : (isTextDoc ? 'Text Document' : 'File')}
                        </div>
                        <div className="doc-col-size">
                          {formatFileSize(doc.file_size)}
                        </div>
                        <div className="doc-col-actions" onClick={(e) => e.stopPropagation()}>
                          {(isTextDoc || isPreviewableUpload) && (
                            <button
                              type="button"
                              className="doc-row-action-btn"
                              title={isTextDoc ? t('common.edit', 'Chỉnh sửa') : t('common.preview', 'Xem trước')}
                              onClick={handleOpenDoc}
                            >
                              <i className={isTextDoc ? 'fa-solid fa-pen-to-square' : 'fa-solid fa-eye'}></i>
                            </button>
                          )}
                          {doc.file_path && (
                            <a
                              href={db.getDocumentDownloadUrl(doc.document_id)}
                              download
                              className="doc-row-action-btn"
                              title={t('common.download', 'Tải xuống')}
                              onClick={() => handleDownloadClick(doc)}
                            >
                              <i className="fa-solid fa-download"></i>
                            </a>
                          )}
                          {canManageDoc(doc) && (
                            <button
                              type="button"
                              className="doc-row-action-btn text-danger"
                              title={t('common.delete', 'Xóa')}
                              onClick={() => handleDeleteDocument(doc)}
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ================== GRID VIEW (Windows Explorer Icons Style) ================== */
              <div className="doc-explorer-grid">
                {/* SUBFOLDERS FIRST */}
                {currentSubfolders.map(f => {
                  const isSelected = selectedItemInView?.type === 'folder' && selectedItemInView?.id === f.folder_id;
                  const subChildren = getChildren(f.folder_id);
                  return (
                    <div
                      key={`grid-folder-${f.folder_id}`}
                      className={`doc-grid-card doc-folder-grid-card ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => setSelectedItemInView({ type: 'folder', id: f.folder_id })}
                      onDoubleClick={() => {
                        setSelectedFolderId(f.folder_id);
                        setSelectedItemInView(null);
                      }}
                      onContextMenu={(e) => {
                        if (!canManageFolder(f) && !canCreateFolders) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setFolderContextMenu({ x: e.clientX, y: e.clientY, folder: f });
                      }}
                      title={`${f.name} (Nhấp đúp để mở)`}
                    >
                      <div className="doc-grid-icon-wrap">
                        <i className="fa-solid fa-folder doc-grid-folder-icon"></i>
                      </div>
                      <div className="doc-grid-title" title={f.name}>
                        {f.name}
                      </div>
                      <div className="doc-grid-meta">
                        {subChildren.length > 0 ? `${subChildren.length} ${t('documents.subfolders', 'thư mục')}` : t('documents.typeFolder', 'Thư mục')}
                      </div>
                      <div className="doc-grid-hover-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="doc-grid-action-btn"
                          title={t('common.open', 'Mở thư mục')}
                          onClick={() => setSelectedFolderId(f.folder_id)}
                        >
                          <i className="fa-solid fa-folder-open"></i>
                        </button>
                        {canCreateFolders && (
                          <button
                            type="button"
                            className="doc-grid-action-btn text-danger"
                            title={t('common.delete', 'Xóa')}
                            onClick={(e) => handleDeleteFolder(f, e)}
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* DOCUMENTS NEXT */}
                {documents.map(doc => {
                  const isSelected = selectedItemInView?.type === 'doc' && selectedItemInView?.id === doc.document_id;
                  const icon = FILE_ICONS[doc.file_ext] || 'fa-file';
                  const isTextDoc = doc.doc_type === 'text';
                  const isPreviewableUpload = !isTextDoc && PREVIEWABLE_EXTENSIONS.includes(doc.file_ext);
                  const handleOpenDoc = () => {
                    if (isTextDoc) setTextEditorState({ doc, autoEdit: false });
                    else if (isPreviewableUpload) setPreviewDoc(doc);
                  };

                  return (
                    <div
                      key={`grid-doc-${doc.document_id}`}
                      className={`doc-grid-card doc-file-grid-card ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => setSelectedItemInView({ type: 'doc', id: doc.document_id })}
                      onDoubleClick={handleOpenDoc}
                      title={`${doc.original_name} (${formatFileSize(doc.file_size)})`}
                    >
                      <div className="doc-grid-icon-wrap">
                        <i className={`fa-solid ${icon} doc-grid-file-icon ext-${doc.file_ext}`}></i>
                      </div>
                      <div className="doc-grid-title" title={doc.original_name}>
                        {doc.original_name}
                      </div>
                      <div className="doc-grid-meta">
                        {formatFileSize(doc.file_size)}
                      </div>
                      <div className="doc-grid-hover-actions" onClick={(e) => e.stopPropagation()}>
                        {(isTextDoc || isPreviewableUpload) && (
                          <button
                            type="button"
                            className="doc-grid-action-btn"
                            title={isTextDoc ? t('common.edit', 'Chỉnh sửa') : t('common.preview', 'Xem trước')}
                            onClick={handleOpenDoc}
                          >
                            <i className={isTextDoc ? 'fa-solid fa-pen-to-square' : 'fa-solid fa-eye'}></i>
                          </button>
                        )}
                        {doc.file_path && (
                          <a
                            href={db.getDocumentDownloadUrl(doc.document_id)}
                            download
                            className="doc-grid-action-btn"
                            title={t('common.download', 'Tải về')}
                            onClick={() => handleDownloadClick(doc)}
                          >
                            <i className="fa-solid fa-download"></i>
                          </a>
                        )}
                        {canManageDoc(doc) && (
                          <button
                            type="button"
                            className="doc-grid-action-btn text-danger"
                            title={t('common.delete', 'Xóa')}
                            onClick={() => handleDeleteDocument(doc)}
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
            borderRadius: '8px',
            boxShadow: '0 12px 24px -4px rgba(0,0,0,0.25)',
            minWidth: '190px',
            overflow: 'hidden',
            padding: '4px 0'
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {canCreateFolders && (
            <>
              {isMultiSelectMode && selectedFolderIdsForCopy.size > 0 ? (
                <>
                  <button
                    type="button"
                    className="doc-context-menu-item"
                    onClick={(e) => {
                      setFolderContextMenu(null);
                      handleCopyMultipleFoldersToClipboard(e);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', color: 'var(--neutral-dark)', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <i className="fa-solid fa-copy" style={{ width: '14px', color: 'var(--primary-color)' }}></i> {t('documents.copySelectedFolders', 'Sao chép thư mục đã chọn')} ({selectedFolderIdsForCopy.size})
                  </button>
                  <button
                    type="button"
                    className="doc-context-menu-item"
                    onClick={(e) => {
                      setFolderContextMenu(null);
                      handleDeleteMultipleFolders(e);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', color: 'var(--danger-color)', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <i className="fa-solid fa-trash-can" style={{ width: '14px', color: 'var(--danger-color)' }}></i> {t('documents.deleteSelectedFoldersAction', 'Xóa thư mục đã chọn')} ({selectedFolderIdsForCopy.size})
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="doc-context-menu-item"
                    onClick={() => {
                      const f = folderContextMenu.folder;
                      setFolderContextMenu(null);
                      setSelectedFolderId(f.folder_id);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', color: 'var(--neutral-dark)', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontWeight: 600 }}
                  >
                    <i className="fa-solid fa-folder-open" style={{ width: '14px', color: '#eab308' }}></i> {t('common.open', 'Mở thư mục')}
                  </button>
                  <button
                    type="button"
                    className="doc-context-menu-item"
                    onClick={(e) => {
                      const f = folderContextMenu.folder;
                      setFolderContextMenu(null);
                      handleCopyFolderToClipboard(f, e);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', color: 'var(--neutral-dark)', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <i className="fa-regular fa-copy" style={{ width: '14px', color: 'var(--primary-color)' }}></i> {t('documents.copyToClipboardAction', 'Sao chép (Copy)')}
                  </button>
                  <button
                    type="button"
                    className="doc-context-menu-item"
                    onClick={(e) => {
                      const f = folderContextMenu.folder;
                      setFolderContextMenu(null);
                      setIsMultiSelectMode(true);
                      setSelectedFolderIdsForCopy(prev => new Set([...prev, f.folder_id]));
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', color: 'var(--neutral-dark)', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <i className="fa-solid fa-list-check" style={{ width: '14px', color: 'var(--primary-color)' }}></i> {t('documents.selectFoldersMode', 'Chọn nhiều thư mục')}
                  </button>
                </>
              )}
              {copiedFolders.length > 0 && !getDescendantFolderIds(copiedFolders.map(f => f.folder_id)).has(folderContextMenu.folder.folder_id) && (
                <button
                  type="button"
                  className="doc-context-menu-item"
                  onClick={(e) => {
                    const f = folderContextMenu.folder;
                    setFolderContextMenu(null);
                    handlePasteFolder(f.folder_id, f, e);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'rgba(59, 130, 246, 0.08)', color: 'var(--primary-color)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
                >
                  <i className="fa-solid fa-paste" style={{ width: '14px' }}></i> {t('documents.pasteFolderAction', 'Dán vào đây (Paste)')} ({copiedFolders.length})
                </button>
              )}
              <button
                type="button"
                className="doc-context-menu-item"
                onClick={(e) => {
                  const f = folderContextMenu.folder;
                  setFolderContextMenu(null);
                  handleCreateFolder(f.folder_id, f);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', color: 'var(--neutral-dark)', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}
              >
                <i className="fa-solid fa-folder-plus" style={{ width: '14px' }}></i> {t('documents.newSubfolder', 'Thư mục con mới')}
              </button>
              {canUploadDocuments && !isMultiSelectMode && (
                <button
                  type="button"
                  className="doc-context-menu-item"
                  onClick={(e) => {
                    const f = folderContextMenu.folder;
                    setFolderContextMenu(null);
                    setSelectedFolderId(f.folder_id);
                    setTimeout(() => folderInputRef.current?.click(), 50);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', color: 'var(--neutral-dark)', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}
                >
                  <i className="fa-solid fa-folder-arrow-up" style={{ width: '14px', color: '#eab308' }}></i> {t('documents.uploadFolderToHere', 'Tải thư mục vào đây')}
                </button>
              )}
              {canManageFolder(folderContextMenu.folder) && (
                <div style={{ height: '1px', background: 'var(--neutral-border)', margin: '4px 0' }} />
              )}
            </>
          )}
          {(!isMultiSelectMode || selectedFolderIdsForCopy.size === 0) && canManageFolder(folderContextMenu.folder) && (
            <>
              <button
                type="button"
                className="doc-context-menu-item"
                onClick={(e) => { handleRenameFolder(folderContextMenu.folder, e); setFolderContextMenu(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', color: 'var(--neutral-dark)', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}
              >
                <i className="fa-solid fa-pen" style={{ width: '14px' }}></i> {t('documents.renameFolderAction', 'Đổi tên thư mục')}
              </button>
              <button
                type="button"
                className="doc-context-menu-item"
                onClick={(e) => { handleDeleteFolder(folderContextMenu.folder, e); setFolderContextMenu(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', color: 'var(--danger-color)', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}
              >
                <i className="fa-solid fa-trash-can" style={{ width: '14px' }}></i> {t('documents.deleteFolderAction', 'Xóa thư mục')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
