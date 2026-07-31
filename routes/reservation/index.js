const express = require('express');
const router = express.Router();
const reservation = require('./reservation');

router.post('/information', reservation.getReservationInformation);
router.put('/information', reservation.addReservation);
router.patch('/information', reservation.setReservation);
router.delete('/information', reservation.removeReservation);

router.post('/start', reservation.startCharging);
router.post('/end', reservation.endCharging);

module.exports = router;
