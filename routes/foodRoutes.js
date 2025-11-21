const express = require('express');
const router = express.Router();
const {
  createFood,
  submitFood,
  getFoods,
  getFood,
  updateFood,
  deleteFood,
  createReview,
  getFoodReviews,
  likeFoodReview,
  flagFoodReview,
  getFlaggedFoodReviews,
  upload,
} = require('../controllers/foodController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');

// Public
router.get('/', getFoods);
router.get('/:id', getFood);
router.get('/:id/reviews', getFoodReviews);

// User
router.post('/submit', protect, upload, submitFood);
router.post('/:id/reviews', protect, upload, createReview);
router.post('/reviews/:reviewId/like', protect, likeFoodReview);
router.post('/reviews/:reviewId/flag', protect, flagFoodReview);

// Admin
router.get('/reviews/flagged', protect, adminOnly, getFlaggedFoodReviews);
router.post('/', protect, adminOnly, upload, createFood);
router.put('/:id', protect, adminOnly, upload, updateFood);
router.delete('/:id', protect, adminOnly, deleteFood);

module.exports = router;

