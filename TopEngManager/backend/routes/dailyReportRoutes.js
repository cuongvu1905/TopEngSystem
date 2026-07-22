const express = require('express');
const router = express.Router();
const dailyReportController = require('../controllers/dailyReportController');

router.post('/getDailyReports', dailyReportController.getDailyReports);
router.post('/getProjectReports', dailyReportController.getProjectReports);
router.post('/createDailyReport', dailyReportController.createDailyReport);
router.post('/createProjectReport', dailyReportController.createProjectReport);
router.post('/updateDailyReportStatus', dailyReportController.updateDailyReportStatus);
router.post('/updateDailyReport', dailyReportController.updateDailyReport);
router.post('/deleteDailyReport', dailyReportController.deleteDailyReport);

module.exports = router;
