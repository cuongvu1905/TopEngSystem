const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');

router.post('/getTasks', taskController.getTasks);
router.post('/getSubtasks', taskController.getSubtasks);
router.post('/getComments', taskController.getComments);
router.post('/saveTask', taskController.saveTask);
router.post('/updateTaskStatus', taskController.updateTaskStatus);
router.post('/saveSubtask', taskController.saveSubtask);
router.post('/deleteSubtask', taskController.deleteSubtask);
router.post('/addComment', taskController.addComment);

module.exports = router;
