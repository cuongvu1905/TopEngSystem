const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.post('/getChatRooms', chatController.getChatRooms);
router.post('/getChatRoomMembers', chatController.getChatRoomMembers);
router.post('/getMessages', chatController.getMessages);
router.post('/sendMessage', chatController.sendMessage);
router.post('/createDirectChat', chatController.createDirectChat);
router.post('/getTaskChats', chatController.getTaskChats);
router.post('/sendTaskChat', chatController.sendTaskChat);

module.exports = router;
