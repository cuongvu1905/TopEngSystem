const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const issueController = require('../controllers/issueController');

// Configure disk storage for Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

router.post('/getIssues', issueController.getIssues);
router.post('/getIssueTags', issueController.getIssueTags);
router.post('/saveIssue', issueController.saveIssue);
router.post('/getIssueDetail', issueController.getIssueDetail);
router.post('/createIssue', issueController.createIssue);
router.post('/updateIssue', issueController.updateIssue);
router.post('/updateIssueStatus', issueController.updateIssueStatus);
router.post('/deleteIssue', issueController.deleteIssue);
router.post('/addComment', issueController.addComment);
router.post('/deleteComment', issueController.deleteComment);

// Route to handle single file upload
router.post('/uploadFile', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Không tìm thấy tệp tải lên' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, fileUrl });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải tệp: ' + err.message });
  }
});

module.exports = router;
