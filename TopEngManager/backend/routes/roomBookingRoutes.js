const express = require('express');
const router = express.Router();
const roomBookingController = require('../controllers/roomBookingController');

router.post('/getRoomBookings', roomBookingController.getRoomBookings);
router.post('/createRoomBooking', roomBookingController.createRoomBooking);
router.post('/deleteRoomBooking', roomBookingController.deleteRoomBooking);

module.exports = router;
