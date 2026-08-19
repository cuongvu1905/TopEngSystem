const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const documentController = require('../controllers/documentController');

const documentsUploadDir = path.join(__dirname, '../uploads/documents');
if (!fs.existsSync(documentsUploadDir)) {
  fs.mkdirSync(documentsUploadDir, { recursive: true });
}

const ALLOWED_EXTENSIONS = ['txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'csv', 'png', 'jpg', 'jpeg', 'zip', 'rar', 'dwg', 'zw1'];

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, documentsUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error(`Định dạng tệp .${ext} không được hỗ trợ`));
    }
    cb(null, true);
  }
});

router.post('/getDocumentFolders', documentController.getDocumentFolders);
router.post('/createDocumentFolder', documentController.createDocumentFolder);
router.post('/renameDocumentFolder', documentController.renameDocumentFolder);
router.post('/deleteDocumentFolder', documentController.deleteDocumentFolder);
router.post('/getDocuments', documentController.getDocuments);
router.post('/getDocumentFileSlots', documentController.getDocumentFileSlots);
router.post('/getProjectFileSlots', documentController.getProjectFileSlots);
router.post('/createDocumentFileSlot', documentController.createDocumentFileSlot);
router.post('/uploadDocumentFileSlot', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, documentController.uploadDocumentFileSlot);
router.post('/createFolderTreeFromTemplate', documentController.createFolderTreeFromTemplate);
router.post('/getFolderTemplates', documentController.getFolderTemplates);
router.post('/createFolderTemplateFolder', documentController.createFolderTemplateFolder);
router.post('/renameFolderTemplateFolder', documentController.renameFolderTemplateFolder);
router.post('/deleteFolderTemplateFolder', documentController.deleteFolderTemplateFolder);
router.post('/setFolderTemplateType', documentController.setFolderTemplateType);
router.post('/setFolderTemplateDefaultPrefix', documentController.setFolderTemplateDefaultPrefix);
router.post('/setFolderTemplateAllowedExtensions', documentController.setFolderTemplateAllowedExtensions);
router.post('/getFolderTemplateSlots', documentController.getFolderTemplateSlots);
router.post('/createFolderTemplateSlot', documentController.createFolderTemplateSlot);
router.post('/updateFolderTemplateSlot', documentController.updateFolderTemplateSlot);
router.post('/deleteFolderTemplateSlot', documentController.deleteFolderTemplateSlot);
router.post('/deleteDocument', documentController.deleteDocument);
router.get('/downloadDocument/:documentId', documentController.downloadDocument);
router.post('/getDocumentContent', documentController.getDocumentContent);
router.post('/createTextDocument', documentController.createTextDocument);
router.post('/updateTextDocument', documentController.updateTextDocument);
router.post('/lockDocument', documentController.lockDocument);
router.post('/unlockDocument', documentController.unlockDocument);

router.post('/uploadDocument', (req, res, next) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, documentController.uploadDocument);

module.exports = router;
