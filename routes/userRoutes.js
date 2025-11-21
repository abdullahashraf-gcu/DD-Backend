const express = require('express');
const router = express.Router();
const {
  getUser,
  updateUser,
  followUser,
  unfollowUser,
  searchUsers,
  toggleFavoriteRestaurant,
  toggleFavoriteFood,
  upload,
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.get('/search', searchUsers);
router.get('/:id', getUser);
router.put('/:id', protect, upload, updateUser);
router.post('/follow/:id', protect, followUser);
router.post('/unfollow/:id', protect, unfollowUser);
router.post('/favorites/restaurants/:restaurantId', protect, toggleFavoriteRestaurant);
router.post('/favorites/foods/:foodId', protect, toggleFavoriteFood);

module.exports = router;

