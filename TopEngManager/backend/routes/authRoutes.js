const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/signup', authController.signup);
router.post('/getUsers', authController.getUsers);
router.post('/getRoles', authController.getRoles);
router.post('/getRolesPermissions', authController.getRolesPermissions);
router.post('/saveRolesPermissions', authController.saveRolesPermissions);
router.post('/createUser', authController.createUser);
router.post('/changePassword', authController.changePassword);
router.post('/resetUserPassword', authController.resetUserPassword);
router.post('/deleteUser', authController.deleteUser);
router.post('/testConnection', authController.testConnection);

module.exports = router;
