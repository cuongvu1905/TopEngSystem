const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/signup', authController.signup);
router.post('/getUsers', authController.getUsers);
router.post('/getRoles', authController.getRoles);
router.post('/createUser', authController.createUser);
router.post('/testConnection', authController.testConnection);

module.exports = router;
