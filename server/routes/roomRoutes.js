const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');

router.post('/generate-token', roomController.generateToken);
router.get('/verify-token/:token', roomController.verifyToken);
router.post('/update-token', roomController.updateToken);

module.exports = router;
