const express = require('express');
const router = express.Router();
const users = require('./users');

router.post('/information', users.getUsersInformation);
router.put('/information', users.addUser);
router.patch('/information', users.setUser);
router.delete('/information', users.removeUser);

module.exports = router;
