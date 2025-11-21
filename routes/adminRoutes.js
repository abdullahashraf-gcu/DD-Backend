const express = require('express');
const router = express.Router();
const {
  getAnalytics,
  getAllRestaurants,
  getPendingRestaurants,
  approveRestaurant,
  denyRestaurant,
  getFlaggedReviews,
  resolveFlaggedReview,
  deleteFlaggedReview,
  getAllPosts,
  deleteUserPost,
  getAllFoods,
  getPendingFoods,
  approveFood,
  denyFood,
  getFlaggedFoodReviews,
  resolveFlaggedFoodReview,
  deleteFlaggedFoodReview,
} = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');

// Basic analytics
router.get('/analytics', protect, adminOnly, getAnalytics);
router.get('/restaurants', protect, adminOnly, getAllRestaurants);
router.get('/restaurants/pending', protect, adminOnly, getPendingRestaurants);
router.patch('/restaurants/:id/approve', protect, adminOnly, approveRestaurant);
router.patch('/restaurants/:id/deny', protect, adminOnly, denyRestaurant);

router.get('/reviews/flagged', protect, adminOnly, getFlaggedReviews);
router.patch('/reviews/:id/resolve', protect, adminOnly, resolveFlaggedReview);
router.delete('/reviews/:id', protect, adminOnly, deleteFlaggedReview);

router.get('/posts', protect, adminOnly, getAllPosts);
router.delete('/posts/:id', protect, adminOnly, deleteUserPost);

router.get('/foods', protect, adminOnly, getAllFoods);
router.get('/foods/pending', protect, adminOnly, getPendingFoods);
router.patch('/foods/:id/approve', protect, adminOnly, approveFood);
router.patch('/foods/:id/deny', protect, adminOnly, denyFood);
router.get('/foods/reviews/flagged', protect, adminOnly, getFlaggedFoodReviews);
router.patch('/foods/reviews/:id/resolve', protect, adminOnly, resolveFlaggedFoodReview);
router.delete('/foods/reviews/:id', protect, adminOnly, deleteFlaggedFoodReview);

module.exports = router;


