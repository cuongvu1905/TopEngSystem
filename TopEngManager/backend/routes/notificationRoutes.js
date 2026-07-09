const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

router.post('/getNotifications', notificationController.getNotifications);
router.post('/createNotification', notificationController.createNotification);
router.post('/markNotificationRead', notificationController.markNotificationRead);
router.post('/markAllNotificationsRead', notificationController.markAllNotificationsRead);
router.post('/getActivityLogs', notificationController.getActivityLogs);
router.post('/logActivity', notificationController.logActivity);

module.exports = router;
