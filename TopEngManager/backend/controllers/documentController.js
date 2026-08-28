const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');
const prisma = require('../config/prisma');

// Multer decodes multipart filename headers as latin1; re-decode to UTF-8
// so Vietnamese/Unicode original filenames display correctly.
function fixOriginalName(name) {
  return Buffer.from(name, 'latin1').toString('utf8');
}

// A required prefix may be written like "1.[BOM LIST]" or just "[CONCEPT]" — only the
// bracketed token itself is enforced; up to this many arbitrary characters (e.g. a
// running number like "00001.") are allowed before it in the string being checked.
const PREFIX_LEADING_SLACK = 6;
function extractPrefixToken(prefix) {
  const match = prefix && prefix.match(/\[[^\]]*\]/);
  return match ? match[0] : null;
}
function matchesRequiredPrefix(value, requiredPrefix) {
  if (!requiredPrefix) return true;
  if (!value) return false;
  const token = extractPrefixToken(requiredPrefix);
  if (!token) return value.startsWith(requiredPrefix);
  const idx = value.indexOf(token);
  return idx !== -1 && idx <= PREFIX_LEADING_SLACK;
}

// A folder's allowed-extensions setting is a semicolon-separated list, e.g. "pdf;xlsx;pptx".
function parseAllowedExtensions(allowedExtensions) {
  if (!allowedExtensions) return [];
  return allowedExtensions.split(';').map(e => e.trim().replace(/^\./, '').toLowerCase()).filter(Boolean);
}
function matchesAllowedExtensions(filename, allowedExtensions) {
  const list = parseAllowedExtensions(allowedExtensions);
  if (list.length === 0) return true;
  const ext = path.extname(filename).slice(1).toLowerCase();
  return list.includes(ext);
}

// Allow-list for the in-browser text document editor: basic formatting only,
// no scripts/event handlers/links — content is rendered via dangerouslySetInnerHTML.
const TEXT_DOC_SANITIZE_OPTIONS = {
  allowedTags: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'span', 'div', 'ul', 'ol', 'li', 'table', 'colgroup', 'col', 'thead', 'tbody', 'tr', 'td', 'th', 'h1', 'h2', 'h3'],
  allowedAttributes: {
    '*': ['style']
  },
  allowedStyles: {
    '*': {
      'color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
      'background-color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
      'font-size': [/^\d+(?:px|pt)$/],
      'text-align': [/^(left|right|center)$/],
      'width': [/^\d+(?:px|%)$/],
      'height': [/^\d+(?:px|%)$/],
      'min-width': [/^\d+px$/],
      'padding': [/^\d+px$/],
      'border': [/^\d+px (solid|dashed|dotted) #[0-9a-fA-F]{3,6}$/],
      'table-layout': [/^fixed$/],
      'border-collapse': [/^collapse$/]
    }
  },
  allowedSchemes: []
};

// In-memory single-editor lock for text documents, mirrors issueController's issueLocks exactly.
const documentLocks = {}; // key: documentId, value: { userId, userName, lockedAt }
const DOCUMENT_LOCK_TTL_MS = 15000;

// Collect a folder's id plus every descendant folder id (for recursive delete/search scoping)
function collectFolderSubtreeIds(allFolders, rootFolderId) {
  const ids = [rootFolderId];
  let frontier = [rootFolderId];
  while (frontier.length > 0) {
    const children = allFolders.filter(f => frontier.includes(f.parent_folder_id)).map(f => f.folder_id);
    ids.push(...children);
    frontier = children;
  }
  return ids;
}

exports.getDocumentFolders = async (req, res, next) => {
  try {
    const { projectId } = req.body;
    const folders = await prisma.documentfolder.findMany({
      where: { project_id: projectId || null },
      orderBy: { name: 'asc' }
    });
    res.json(folders);
  } catch (err) {
    next(err);
  }
};

exports.createDocumentFolder = async (req, res, next) => {
  try {
    const { name, parentFolderId, projectId, createdBy } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tên thư mục không được để trống' });
    }
    const folder = await prisma.documentfolder.create({
      data: {
        folder_id: 'fold-' + crypto.randomUUID(),
        name: name.trim(),
        parent_folder_id: parentFolderId || null,
        project_id: projectId || null,
        created_by: createdBy || null
      }
    });
    res.json(folder);
  } catch (err) {
    next(err);
  }
};

// Clones template nodes (and everything below them, including the required-file-prefix
// rows of a file_slot_table folder) into real folders under parentRealFolderId.
// Shared by project creation and by the "+" buttons in the Documents tree, so a tree
// built by hand is identical to the one a new project is given.
async function cloneTemplateNodes(nodes, parentRealFolderId, { projectId, createdBy, templateFolders, templateSlots }) {
  let created = 0;

  const cloneNode = async (templateNode, parentId) => {
    const realFolder = await prisma.documentfolder.create({
      data: {
        folder_id: 'fold-' + crypto.randomUUID(),
        name: templateNode.name,
        parent_folder_id: parentId,
        project_id: projectId,
        created_by: createdBy || null,
        folder_type: templateNode.folder_type,
        default_prefix: templateNode.default_prefix,
        allowed_extensions: templateNode.allowed_extensions
      }
    });
    created += 1;

    if (templateNode.folder_type === 'file_slot_table') {
      const slots = templateSlots
        .filter(s => s.template_folder_id === templateNode.template_folder_id)
        .sort((a, b) => a.row_order - b.row_order);
      let rowOrder = 1;
      for (const slot of slots) {
        await prisma.documentfileslot.create({
          data: {
            folder_id: realFolder.folder_id,
            row_order: rowOrder++,
            prefix: slot.prefix,
            document_id: null
          }
        });
      }
    }

    const children = templateFolders.filter(f => f.parent_template_folder_id === templateNode.template_folder_id);
    for (const child of children) {
      await cloneNode(child, realFolder.folder_id);
    }
  };

  for (const node of nodes) {
    await cloneNode(node, parentRealFolderId);
  }
  return created;
}

async function loadTemplate() {
  const templateFolders = await prisma.foldertemplate.findMany();
  const templateSlots = templateFolders.length > 0
    ? await prisma.foldertemplateslot.findMany()
    : [];
  return { templateFolders, templateSlots };
}

// Called once from project creation (not exposed as its own route) to clone the
// admin-designed default folder tree (see getFolderTemplates/etc. below, edited via
// the "Thiết kế cây thư mục" admin modal) into real folders/slots for a brand new
// project. A completely empty template (admin deleted everything) is a safe no-op.
// The template folders a project creator gets to choose from: everything one level below
// the second template level, i.e. <Tên_Xưởng>/<Tên_Máy>/*. The two levels above them are
// structural and always created.
function selectableTemplateFolders(templateFolders) {
  const roots = templateFolders.filter(f => !f.parent_template_folder_id);
  const second = templateFolders.filter(f => roots.some(r => r.template_folder_id === f.parent_template_folder_id));
  return templateFolders.filter(f => second.some(x => x.template_folder_id === f.parent_template_folder_id));
}

exports.getSelectableTemplateFolders = async (req, res, next) => {
  try {
    const templateFolders = await prisma.foldertemplate.findMany({ orderBy: { name: 'asc' } });
    res.json(selectableTemplateFolders(templateFolders).map(f => ({
      template_folder_id: f.template_folder_id,
      name: f.name,
      folder_type: f.folder_type
    })));
  } catch (err) {
    next(err);
  }
};

// selectedFolderIds (optional) limits which of the <Tên_Máy>/* folders get created. Passing
// null/undefined keeps the old behaviour of cloning the whole design, so a caller that does
// not know about the choice still provisions a complete tree.
exports.createDefaultProjectFolderTree = async (projectId, createdBy, selectedFolderIds) => {
  const { templateFolders, templateSlots } = await loadTemplate();
  if (templateFolders.length === 0) return;

  let effective = templateFolders;
  if (Array.isArray(selectedFolderIds)) {
    const selectable = selectableTemplateFolders(templateFolders);
    const keep = new Set(selectedFolderIds);
    // drop the unpicked branches: the folder itself and everything under it
    const pruned = new Set();
    const dropSubtree = (id) => {
      pruned.add(id);
      templateFolders
        .filter(f => f.parent_template_folder_id === id)
        .forEach(child => dropSubtree(child.template_folder_id));
    };
    selectable
      .filter(f => !keep.has(f.template_folder_id))
      .forEach(f => dropSubtree(f.template_folder_id));
    effective = templateFolders.filter(f => !pruned.has(f.template_folder_id));
  }

  const roots = effective.filter(f => !f.parent_template_folder_id);
  await cloneTemplateNodes(roots, null, {
    projectId, createdBy, templateFolders: effective, templateSlots
  });
};

// The "+" buttons in the Documents tree. templateLevel 0 clones the template's own roots
// (the whole designed tree); level 1 clones the children of those roots - which is what
// "add another machine under this workshop" means. Deeper "+" buttons never come here:
// they create a single empty folder as before.
exports.createFolderTreeFromTemplate = async (req, res, next) => {
  try {
    const { projectId, parentFolderId, templateLevel, createdBy } = req.body || {};
    const level = Number(templateLevel);
    if (level !== 0 && level !== 1) {
      return res.status(400).json({ error: 'templateLevel không hợp lệ (chỉ nhận 0 hoặc 1).' });
    }

    if (parentFolderId) {
      const parent = await prisma.documentfolder.findUnique({ where: { folder_id: parentFolderId } });
      if (!parent) {
        return res.status(404).json({ error: 'Không tìm thấy thư mục cha.' });
      }
    }

    const { templateFolders, templateSlots } = await loadTemplate();
    const roots = templateFolders.filter(f => !f.parent_template_folder_id);
    const nodes = level === 0
      ? roots
      : templateFolders.filter(f => roots.some(r => r.template_folder_id === f.parent_template_folder_id));

    if (nodes.length === 0) {
      // Nothing designed at this level; the caller falls back to creating a plain folder.
      return res.json({ created: 0, names: [], empty: true });
    }

    const created = await cloneTemplateNodes(nodes, parentFolderId || null, {
      projectId: projectId || null,
      createdBy: createdBy || null,
      templateFolders,
      templateSlots
    });

    res.json({ created, names: nodes.map(n => n.name), empty: false });
  } catch (err) {
    next(err);
  }
};

exports.getFolderTemplates = async (req, res, next) => {
  try {
    const folders = await prisma.foldertemplate.findMany({ orderBy: { name: 'asc' } });
    res.json(folders);
  } catch (err) {
    next(err);
  }
};

exports.createFolderTemplateFolder = async (req, res, next) => {
  try {
    const { name, parentTemplateFolderId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tên thư mục không được để trống' });
    }
    const folder = await prisma.foldertemplate.create({
      data: {
        template_folder_id: 'ftpl-' + crypto.randomUUID(),
        name: name.trim(),
        parent_template_folder_id: parentTemplateFolderId || null
      }
    });
    res.json(folder);
  } catch (err) {
    next(err);
  }
};

exports.renameFolderTemplateFolder = async (req, res, next) => {
  try {
    const { templateFolderId, name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tên thư mục không được để trống' });
    }
    const folder = await prisma.foldertemplate.update({
      where: { template_folder_id: templateFolderId },
      data: { name: name.trim() }
    });
    res.json(folder);
  } catch (err) {
    next(err);
  }
};

exports.deleteFolderTemplateFolder = async (req, res, next) => {
  try {
    const { templateFolderId } = req.body;
    if (!templateFolderId) {
      return res.status(400).json({ error: 'Thiếu templateFolderId' });
    }
    // DB cascade removes descendant template folders + their slot rows automatically
    await prisma.foldertemplate.delete({ where: { template_folder_id: templateFolderId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.setFolderTemplateType = async (req, res, next) => {
  try {
    const { templateFolderId, folderType } = req.body;
    if (!templateFolderId) {
      return res.status(400).json({ error: 'Thiếu templateFolderId' });
    }
    if (folderType !== 'file_slot_table') {
      // No longer a file-slot-table folder: its prefix definitions are now orphaned.
      await prisma.foldertemplateslot.deleteMany({ where: { template_folder_id: templateFolderId } });
    }
    const folder = await prisma.foldertemplate.update({
      where: { template_folder_id: templateFolderId },
      data: { folder_type: folderType || null }
    });
    res.json(folder);
  } catch (err) {
    next(err);
  }
};

exports.setFolderTemplateDefaultPrefix = async (req, res, next) => {
  try {
    const { templateFolderId, defaultPrefix } = req.body;
    if (!templateFolderId) {
      return res.status(400).json({ error: 'Thiếu templateFolderId' });
    }
    const trimmed = defaultPrefix && defaultPrefix.trim() ? defaultPrefix.trim() : null;
    // Existing row prefixes that no longer comply with the new default aren't
    // retroactively touched — the rule only applies going forward, to new/edited rows.
    const folder = await prisma.foldertemplate.update({
      where: { template_folder_id: templateFolderId },
      data: { default_prefix: trimmed }
    });
    res.json(folder);
  } catch (err) {
    next(err);
  }
};

exports.setFolderTemplateAllowedExtensions = async (req, res, next) => {
  try {
    const { templateFolderId, allowedExtensions } = req.body;
    if (!templateFolderId) {
      return res.status(400).json({ error: 'Thiếu templateFolderId' });
    }
    const normalized = parseAllowedExtensions(allowedExtensions).join(';');
    const folder = await prisma.foldertemplate.update({
      where: { template_folder_id: templateFolderId },
      data: { allowed_extensions: normalized || null }
    });
    res.json(folder);
  } catch (err) {
    next(err);
  }
};

exports.getFolderTemplateSlots = async (req, res, next) => {
  try {
    const { templateFolderId } = req.body;
    const slots = await prisma.foldertemplateslot.findMany({
      where: { template_folder_id: templateFolderId },
      orderBy: { row_order: 'asc' }
    });
    res.json(slots);
  } catch (err) {
    next(err);
  }
};

exports.createFolderTemplateSlot = async (req, res, next) => {
  try {
    const { templateFolderId, prefix } = req.body;
    if (!templateFolderId) {
      return res.status(400).json({ error: 'Thiếu templateFolderId' });
    }
    if (!prefix || !prefix.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập tiền tố tên tệp' });
    }
    const trimmedPrefix = prefix.trim();
    const parentFolder = await prisma.foldertemplate.findUnique({ where: { template_folder_id: templateFolderId } });
    if (parentFolder?.default_prefix && !matchesRequiredPrefix(trimmedPrefix, parentFolder.default_prefix)) {
      return res.status(400).json({ error: `Tiền tố hàng phải chứa tiền tố mặc định của thư mục ("${parentFolder.default_prefix}"), tối đa 6 ký tự bất kỳ phía trước` });
    }
    const maxRow = await prisma.foldertemplateslot.aggregate({
      where: { template_folder_id: templateFolderId },
      _max: { row_order: true }
    });
    const slot = await prisma.foldertemplateslot.create({
      data: {
        template_folder_id: templateFolderId,
        row_order: (maxRow._max.row_order || 0) + 1,
        prefix: trimmedPrefix
      }
    });
    res.json(slot);
  } catch (err) {
    next(err);
  }
};

exports.updateFolderTemplateSlot = async (req, res, next) => {
  try {
    const { slotId, prefix } = req.body;
    if (!prefix || !prefix.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập tiền tố tên tệp' });
    }
    const trimmedPrefix = prefix.trim();
    const existingSlot = await prisma.foldertemplateslot.findUnique({ where: { id: parseInt(slotId) } });
    if (existingSlot) {
      const parentFolder = await prisma.foldertemplate.findUnique({ where: { template_folder_id: existingSlot.template_folder_id } });
      if (parentFolder?.default_prefix && !matchesRequiredPrefix(trimmedPrefix, parentFolder.default_prefix)) {
        return res.status(400).json({ error: `Tiền tố hàng phải chứa tiền tố mặc định của thư mục ("${parentFolder.default_prefix}"), tối đa 6 ký tự bất kỳ phía trước` });
      }
    }
    const slot = await prisma.foldertemplateslot.update({
      where: { id: parseInt(slotId) },
      data: { prefix: trimmedPrefix }
    });
    res.json(slot);
  } catch (err) {
    next(err);
  }
};

exports.deleteFolderTemplateSlot = async (req, res, next) => {
  try {
    const { slotId } = req.body;
    if (!slotId) {
      return res.status(400).json({ error: 'Thiếu slotId' });
    }
    await prisma.foldertemplateslot.delete({ where: { id: parseInt(slotId) } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.renameDocumentFolder = async (req, res, next) => {
  try {
    const { folderId, name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tên thư mục không được để trống' });
    }
    const folder = await prisma.documentfolder.update({
      where: { folder_id: folderId },
      data: { name: name.trim() }
    });
    res.json(folder);
  } catch (err) {
    next(err);
  }
};

exports.deleteDocumentFolder = async (req, res, next) => {
  try {
    const { folderId } = req.body;
    if (!folderId) {
      return res.status(400).json({ error: 'Thiếu folderId' });
    }

    const allFolders = await prisma.documentfolder.findMany();
    const subtreeIds = collectFolderSubtreeIds(allFolders, folderId);

    const docsToDelete = await prisma.document.findMany({
      where: { folder_id: { in: subtreeIds } }
    });

    for (const doc of docsToDelete) {
      const absolutePath = path.join(__dirname, '..', doc.file_path);
      fs.unlink(absolutePath, (err) => {
        if (err && err.code !== 'ENOENT') console.error('Failed to delete file:', absolutePath, err.message);
      });
    }

    // DB cascade removes descendant folders + documents automatically
    await prisma.documentfolder.delete({ where: { folder_id: folderId } });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.getDocuments = async (req, res, next) => {
  try {
    const { projectId, folderId, searchQuery } = req.body;
    const scopeWhere = { project_id: projectId || null };

    let documents;
    if (searchQuery && searchQuery.trim()) {
      documents = await prisma.document.findMany({
        where: { ...scopeWhere, original_name: { contains: searchQuery.trim() } },
        orderBy: { created_at: 'desc' }
      });
    } else {
      documents = await prisma.document.findMany({
        where: { ...scopeWhere, folder_id: folderId || null },
        orderBy: { created_at: 'desc' }
      });
    }
    res.json(documents);
  } catch (err) {
    next(err);
  }
};

exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Không tìm thấy tệp tải lên' });
    }
    const { folderId, projectId, uploadedBy } = req.body;

    if (folderId) {
      const targetFolder = await prisma.documentfolder.findUnique({ where: { folder_id: folderId } });
      const rejectBatch = async (error) => {
        // Multer already wrote these to disk before this handler ran — clean them up
        // since the whole batch is being rejected, not just the offending files.
        for (const file of req.files) {
          const absolutePath = path.join(__dirname, '..', 'uploads', 'documents', file.filename);
          fs.unlink(absolutePath, (err) => {
            if (err && err.code !== 'ENOENT') console.error('Failed to delete rejected upload:', absolutePath, err.message);
          });
        }
        return res.status(400).json({ error });
      };

      if (targetFolder?.default_prefix) {
        const invalidFiles = req.files
          .map(f => fixOriginalName(f.originalname))
          .filter(name => !matchesRequiredPrefix(name, targetFolder.default_prefix));
        if (invalidFiles.length > 0) {
          return rejectBatch(`Tên tệp phải chứa tiền tố "${targetFolder.default_prefix}" (tối đa 6 ký tự bất kỳ phía trước): ${invalidFiles.join(', ')}`);
        }
      }

      if (targetFolder?.allowed_extensions) {
        const invalidFiles = req.files
          .map(f => fixOriginalName(f.originalname))
          .filter(name => !matchesAllowedExtensions(name, targetFolder.allowed_extensions));
        if (invalidFiles.length > 0) {
          return rejectBatch(`Thư mục này chỉ chấp nhận đuôi tệp: ${parseAllowedExtensions(targetFolder.allowed_extensions).join(', ')}. Tệp không hợp lệ: ${invalidFiles.join(', ')}`);
        }
      }
    }

    const created = [];
    for (const file of req.files) {
      const ext = path.extname(file.originalname).slice(1).toLowerCase();
      const doc = await prisma.document.create({
        data: {
          document_id: 'doc-' + crypto.randomUUID(),
          folder_id: folderId || null,
          project_id: projectId || null,
          original_name: fixOriginalName(file.originalname),
          stored_name: file.filename,
          file_path: `/uploads/documents/${file.filename}`,
          file_size: file.size,
          file_ext: ext,
          uploaded_by: uploadedBy || null
        }
      });
      created.push(doc);
    }
    res.json(created);
  } catch (err) {
    next(err);
  }
};

// Returns every file-slot row across every folder scoped to a project (or the
// company-wide root when projectId is null), used by the frontend to compute
// each folder's required-file upload progress percentage without one round
// trip per folder.
exports.getProjectFileSlots = async (req, res, next) => {
  try {
    const { projectId } = req.body;
    const folders = await prisma.documentfolder.findMany({
      where: { project_id: projectId || null, folder_type: 'file_slot_table' },
      select: { folder_id: true }
    });
    const folderIds = folders.map(f => f.folder_id);
    if (folderIds.length === 0) return res.json([]);
    const slots = await prisma.documentfileslot.findMany({
      where: { folder_id: { in: folderIds } },
      select: { folder_id: true, prefix: true, document_id: true }
    });
    res.json(slots);
  } catch (err) {
    next(err);
  }
};

exports.getDocumentFileSlots = async (req, res, next) => {
  try {
    const { folderId } = req.body;
    const slots = await prisma.documentfileslot.findMany({
      where: { folder_id: folderId },
      orderBy: { row_order: 'asc' },
      include: { document: true }
    });
    res.json(slots);
  } catch (err) {
    next(err);
  }
};

exports.createDocumentFileSlot = async (req, res, next) => {
  try {
    const { folderId } = req.body;
    if (!folderId) {
      return res.status(400).json({ error: 'Thiếu folderId' });
    }
    const maxRow = await prisma.documentfileslot.aggregate({
      where: { folder_id: folderId },
      _max: { row_order: true }
    });
    const slot = await prisma.documentfileslot.create({
      data: {
        folder_id: folderId,
        row_order: (maxRow._max.row_order || 0) + 1,
        prefix: null,
        document_id: null
      },
      include: { document: true }
    });
    res.json(slot);
  } catch (err) {
    next(err);
  }
};

exports.uploadDocumentFileSlot = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Không tìm thấy tệp tải lên' });
    }
    const { slotId, folderId, projectId, uploadedBy } = req.body;
    if (!slotId) {
      return res.status(400).json({ error: 'Thiếu slotId' });
    }

    const slot = await prisma.documentfileslot.findUnique({ where: { id: parseInt(slotId) } });
    if (!slot) {
      return res.status(404).json({ error: 'Không tìm thấy hàng trong bảng quản lý file' });
    }

    const originalName = fixOriginalName(req.file.originalname);
    if (slot.prefix && !matchesRequiredPrefix(originalName, slot.prefix)) {
      return res.status(400).json({ error: `Tên tệp phải chứa "${slot.prefix}" (tối đa 6 ký tự bất kỳ phía trước)` });
    }

    const parentFolder = await prisma.documentfolder.findUnique({ where: { folder_id: folderId || slot.folder_id } });
    if (parentFolder?.allowed_extensions && !matchesAllowedExtensions(originalName, parentFolder.allowed_extensions)) {
      return res.status(400).json({ error: `Thư mục này chỉ chấp nhận đuôi tệp: ${parseAllowedExtensions(parentFolder.allowed_extensions).join(', ')}` });
    }

    const ext = path.extname(req.file.originalname).slice(1).toLowerCase();
    const newDoc = await prisma.document.create({
      data: {
        document_id: 'doc-' + crypto.randomUUID(),
        folder_id: folderId || slot.folder_id,
        project_id: projectId || null,
        original_name: originalName,
        stored_name: req.file.filename,
        file_path: `/uploads/documents/${req.file.filename}`,
        file_size: req.file.size,
        file_ext: ext,
        uploaded_by: uploadedBy || null
      }
    });

    // Re-uploading to an already-filled row replaces the previous file instead of leaving an orphan.
    if (slot.document_id) {
      const oldDoc = await prisma.document.findUnique({ where: { document_id: slot.document_id } });
      if (oldDoc) {
        const absolutePath = path.join(__dirname, '..', oldDoc.file_path);
        fs.unlink(absolutePath, (err) => {
          if (err && err.code !== 'ENOENT') console.error('Failed to delete replaced file:', absolutePath, err.message);
        });
        await prisma.document.delete({ where: { document_id: oldDoc.document_id } }).catch(() => {});
      }
    }

    const updatedSlot = await prisma.documentfileslot.update({
      where: { id: slot.id },
      data: { document_id: newDoc.document_id },
      include: { document: true }
    });

    res.json(updatedSlot);
  } catch (err) {
    next(err);
  }
};

exports.downloadDocument = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const doc = await prisma.document.findUnique({ where: { document_id: documentId } });
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    }
    const absolutePath = path.join(__dirname, '..', doc.file_path);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'Tệp không còn tồn tại trên máy chủ' });
    }
    if (req.query.inline === '1') {
      // Used by the in-browser preview (pdf/image iframe & img tags) so the
      // browser renders the file instead of prompting a download. Helmet's
      // default frame-ancestors/X-Frame-Options only allow same-origin
      // framing, but the frontend runs on a different port, so relax those
      // two headers just for this response.
      const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'];
      res.removeHeader('X-Frame-Options');
      res.setHeader('Content-Security-Policy', `frame-ancestors 'self' ${allowedOrigins.join(' ')}`);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.original_name)}"`);
      return res.sendFile(absolutePath);
    }
    res.download(absolutePath, doc.original_name, (err) => {
      if (err) {
        console.error('Lỗi khi tải tệp:', doc.original_name, err.message);
        if (!res.headersSent) res.status(500).json({ error: 'Lỗi khi tải tệp.' });
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteDocument = async (req, res, next) => {
  try {
    const { documentId } = req.body;
    const doc = await prisma.document.findUnique({ where: { document_id: documentId } });
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    }
    await prisma.document.delete({ where: { document_id: documentId } });

    const absolutePath = path.join(__dirname, '..', doc.file_path);
    fs.unlink(absolutePath, (err) => {
      if (err && err.code !== 'ENOENT') console.error('Failed to delete file:', absolutePath, err.message);
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.getDocumentContent = async (req, res, next) => {
  try {
    const { documentId } = req.body;
    const doc = await prisma.document.findUnique({ where: { document_id: documentId } });
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    }
    const absolutePath = path.join(__dirname, '..', doc.file_path);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'Tệp không còn tồn tại trên máy chủ' });
    }
    const content = fs.readFileSync(absolutePath, 'utf8');
    res.json({ content });
  } catch (err) {
    next(err);
  }
};

exports.createTextDocument = async (req, res, next) => {
  try {
    const { name, folderId, projectId, createdBy, content } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tên tài liệu không được để trống' });
    }
    const clean = sanitizeHtml(content || '', TEXT_DOC_SANITIZE_OPTIONS);

    const documentsDir = path.join(__dirname, '../uploads/documents');
    if (!fs.existsSync(documentsDir)) fs.mkdirSync(documentsDir, { recursive: true });
    const storedName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.html`;
    fs.writeFileSync(path.join(documentsDir, storedName), clean, 'utf8');

    const doc = await prisma.document.create({
      data: {
        document_id: 'doc-' + crypto.randomUUID(),
        folder_id: folderId || null,
        project_id: projectId || null,
        original_name: `${name.trim()}.html`,
        stored_name: storedName,
        file_path: `/uploads/documents/${storedName}`,
        file_size: Buffer.byteLength(clean, 'utf8'),
        file_ext: 'html',
        uploaded_by: createdBy || null,
        doc_type: 'text'
      }
    });
    res.json(doc);
  } catch (err) {
    next(err);
  }
};

exports.updateTextDocument = async (req, res, next) => {
  try {
    const { documentId, content, updatedBy } = req.body;
    const doc = await prisma.document.findUnique({ where: { document_id: documentId } });
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    }

    const lock = documentLocks[documentId];
    if (lock && lock.userId !== updatedBy && (Date.now() - lock.lockedAt) < DOCUMENT_LOCK_TTL_MS) {
      return res.status(409).json({ error: 'Tài liệu đang được chỉnh sửa bởi người khác', lockedBy: lock.userName });
    }

    const clean = sanitizeHtml(content || '', TEXT_DOC_SANITIZE_OPTIONS);
    const absolutePath = path.join(__dirname, '..', doc.file_path);
    fs.writeFileSync(absolutePath, clean, 'utf8');

    const updated = await prisma.document.update({
      where: { document_id: documentId },
      data: { file_size: Buffer.byteLength(clean, 'utf8'), updated_at: new Date() }
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

exports.lockDocument = async (req, res, next) => {
  try {
    const { documentId, userId } = req.body;
    const now = Date.now();
    const existingLock = documentLocks[documentId];

    if (existingLock && existingLock.userId !== userId && (now - existingLock.lockedAt) < DOCUMENT_LOCK_TTL_MS) {
      return res.json({ success: false, isLocked: true, lockedBy: existingLock.userName });
    }
    const user = await prisma.user.findUnique({ where: { user_id: userId } });
    const userName = user ? user.full_name : 'Người dùng khác';
    documentLocks[documentId] = { userId, userName, lockedAt: now };
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.unlockDocument = async (req, res, next) => {
  try {
    const { documentId, userId } = req.body;
    const lock = documentLocks[documentId];
    if (lock && lock.userId === userId) {
      delete documentLocks[documentId];
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
