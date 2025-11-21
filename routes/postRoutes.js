const express = require('express');
const router = express.Router();
const {
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
  getUserPosts,
  votePost,
  savePost,
  getTrendingPosts,
  upload,
} = require('../controllers/postController');
const { protect } = require('../middleware/auth');

router.get('/trending', getTrendingPosts);
router.get('/user/:id', getUserPosts);
router.get('/:id', getPost);
router.get('/', protect, getPosts);
router.post('/', protect, upload, createPost);
router.put('/:id', protect, upload, updatePost);
router.delete('/:id', protect, deletePost);
router.post('/vote/:id', protect, votePost);
router.post('/save/:id', protect, savePost);

module.exports = router;

