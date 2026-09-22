const express = require('express');
const router = express.Router();
const mailSettingController = require('../controllers/mailSettingController');

router.post('/getMailSettings', mailSettingController.getMailSettings);
router.post('/updateMailSettings', mailSettingController.updateMailSettings);
router.post('/testMailSettings', mailSettingController.testMailSettings);

module.exports = router;
