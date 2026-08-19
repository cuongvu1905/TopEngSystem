const express = require('express');
const router = express.Router();
const manpowerController = require('../controllers/manpowerController');

router.post('/getManpowerProjects', manpowerController.getManpowerProjects);
router.post('/createManpowerProject', manpowerController.createManpowerProject);
router.post('/renameManpowerProject', manpowerController.renameManpowerProject);

router.post('/setManpowerProjectScope', manpowerController.setManpowerProjectScope);
router.post('/deleteManpowerProject', manpowerController.deleteManpowerProject);

router.post('/getManpowerLocations', manpowerController.getManpowerLocations);
router.post('/createManpowerLocation', manpowerController.createManpowerLocation);
router.post('/renameManpowerLocation', manpowerController.renameManpowerLocation);
router.post('/deleteManpowerLocation', manpowerController.deleteManpowerLocation);

router.post('/getManpowerHeadcount', manpowerController.getManpowerHeadcount);
router.post('/getManpowerCellMembers', manpowerController.getManpowerCellMembers);
router.post('/getUserDayReports', manpowerController.getUserDayReports);
router.post('/getPlacedUserIds', manpowerController.getPlacedUserIds);
router.post('/addManpowerCellMember', manpowerController.addManpowerCellMember);
router.post('/removeManpowerCellMember', manpowerController.removeManpowerCellMember);
router.post('/getManpowerReports', manpowerController.getManpowerReports);
router.post('/getManpowerReport', manpowerController.getManpowerReport);
router.post('/saveManpowerReport', manpowerController.saveManpowerReport);
router.post('/deleteManpowerReport', manpowerController.deleteManpowerReport);
router.get('/downloadManpowerReport/:reportDate', manpowerController.downloadManpowerReport);

module.exports = router;
