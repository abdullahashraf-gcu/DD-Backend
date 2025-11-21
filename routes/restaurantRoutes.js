const express = require('express');
const router = express.Router();
const {
  createRestaurant,
  getRestaurants,
  getRestaurant,
  updateRestaurant,
  deleteRestaurant,
  createReview,
  getRestaurantReviews,
  likeReview,
  flagReview,
  submitRestaurant,
  upload,
} = require('../controllers/restaurantController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');

// Public routes
router.get('/', getRestaurants);
router.get('/:id', getRestaurant);
router.get('/:id/reviews', getRestaurantReviews);

// Protected routes
router.post('/submit', protect, upload, submitRestaurant);
router.post('/:id/reviews', protect, upload, createReview);
router.post('/reviews/:reviewId/like', protect, likeReview);
router.post('/reviews/:reviewId/flag', protect, flagReview);

// Admin only routes
router.post('/', protect, adminOnly, upload, createRestaurant);
router.put('/:id', protect, adminOnly, upload, updateRestaurant);
router.delete('/:id', protect, adminOnly, deleteRestaurant);

module.exports = router;
