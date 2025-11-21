const express = require('express');
const router = express.Router();
const { sendMessage, getUserChats } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

router.get('/:userId', protect, getUserChats);
router.post('/:receiverId', protect, sendMessage);

module.exports = router;

