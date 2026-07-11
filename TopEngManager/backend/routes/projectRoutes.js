const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');

router.post('/getProjects', projectController.getProjects);
router.post('/getProjectMembers', projectController.getProjectMembers);
router.post('/saveProject', projectController.saveProject);
router.post('/addProjectMember', projectController.addProjectMember);
router.post('/removeProjectMember', projectController.removeProjectMember);
router.post('/getCustomers', projectController.getCustomers);
router.post('/getDepartments', projectController.getDepartments);
router.post('/saveCustomer', projectController.saveCustomer);

module.exports = router;
