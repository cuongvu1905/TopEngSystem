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
