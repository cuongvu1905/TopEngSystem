const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');

router.post('/getDocumentCategories', documentController.getDocumentCategories);
router.post('/getDocuments', documentController.getDocuments);
router.post('/getDocumentVersions', documentController.getDocumentVersions);
router.post('/saveDocument', documentController.saveDocument);

module.exports = router;
