const express = require('express');
const router = express.Router();
const {
  createComment,
  getComments,
  voteComment,
} = require('../controllers/commentController');
const { protect } = require('../middleware/auth');

router.get('/:postId', getComments);
router.post('/:postId', protect, createComment);
router.post('/vote/:id', protect, voteComment);

module.exports = router;

