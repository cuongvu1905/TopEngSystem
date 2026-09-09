const express = require('express');
const router = express.Router();
const approvalController = require('../controllers/approvalController');

router.post('/getApprovalPermissions', approvalController.getApprovalPermissions);
router.post('/getMyApprovalRequests', approvalController.getMyApprovalRequests);
router.post('/createApprovalRequest', approvalController.createApprovalRequest);
router.post('/updateApprovalRequest', approvalController.updateApprovalRequest);
router.post('/deleteApprovalRequest', approvalController.deleteApprovalRequest);
router.post('/getManagedApprovalRequests', approvalController.getManagedApprovalRequests);
router.post('/decideApprovalRequest', approvalController.decideApprovalRequest);
router.post('/getApprovalTeams', approvalController.getApprovalTeams);

module.exports = router;
