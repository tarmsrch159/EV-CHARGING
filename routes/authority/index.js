const express = require('express');
const router = express.Router();
const authority = require('./authority');

router.post('/information', authority.getAuthorityInformation);
router.put('/information', authority.addAuthority);
router.patch('/information', authority.setAuthority);
router.delete('/information', authority.removeAuthority);

module.exports = router;
