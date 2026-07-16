const express = require('express');
const router = express.Router();
const dailyReportController = require('../controllers/dailyReportController');

router.post('/getDailyReports', dailyReportController.getDailyReports);
router.post('/createDailyReport', dailyReportController.createDailyReport);
router.post('/updateDailyReportStatus', dailyReportController.updateDailyReportStatus);
router.post('/updateDailyReport', dailyReportController.updateDailyReport);
router.post('/deleteDailyReport', dailyReportController.deleteDailyReport);

module.exports = router;
