const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Restaurant = require('../models/Restaurant');
const RestaurantReview = require('../models/RestaurantReview');
const Food = require('../models/Food');
const FoodReview = require('../models/FoodReview');

// @desc    Basic app analytics
// @route   GET /api/admin/analytics
// @access  Private/Admin
exports.getAnalytics = asyncHandler(async (req, res) => {
  const [
    usersCount,
    postsCount,
    commentsCount,
    restaurantsCount,
    reviewsCount,
    foodsCount,
    foodReviewsCount,
    pendingRestaurantsCount,
    pendingFoodsCount,
    flaggedReviewsCount,
    flaggedFoodReviewsCount,
  ] = await Promise.all([
    User.countDocuments(),
    Post.countDocuments(),
    Comment.countDocuments(),
    Restaurant.countDocuments(),
    RestaurantReview.countDocuments(),
    Food.countDocuments(),
    FoodReview.countDocuments(),
    Restaurant.countDocuments({ approvalStatus: 'pending' }),
    Food.countDocuments({ approvalStatus: 'pending' }),
    RestaurantReview.countDocuments({ isFlagged: true }),
    FoodReview.countDocuments({ isFlagged: true }),
  ]);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [latestUsers, topRestaurants, topFoods, newUsersWeek, postsWeek] = await Promise.all([
    User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('username fullName createdAt role'),
    Restaurant.find({
      isActive: true,
      $or: [{ approvalStatus: { $exists: false } }, { approvalStatus: 'approved' }],
    })
      .sort({ averageRating: -1, totalReviews: -1 })
      .limit(5)
      .select('name averageRating totalReviews'),
    Food.find({
      isActive: true,
      $or: [{ approvalStatus: { $exists: false } }, { approvalStatus: 'approved' }],
    })
      .sort({ averageRating: -1, totalReviews: -1 })
      .limit(5)
      .select('name averageRating totalReviews'),
    User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    Post.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
  ]);

  res.json({
    success: true,
    data: {
      usersCount,
      postsCount,
      commentsCount,
      restaurantsCount,
      reviewsCount,
      foodsCount,
      foodReviewsCount,
      pendingRestaurantsCount,
      pendingFoodsCount,
      flaggedReviewsCount,
      flaggedFoodReviewsCount,
      newUsersWeek,
      postsWeek,
      latestUsers,
      topRestaurants,
      topFoods,
    },
  });
});

// @desc    Get all restaurants for admin management
// @route   GET /api/admin/restaurants
// @access  Private/Admin
exports.getAllRestaurants = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status = 'all',
    search = '',
  } = req.query;

  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 20;

  const conditions = [];

  if (status !== 'all') {
    if (status === 'approved') {
      conditions.push({
        $or: [
          { approvalStatus: 'approved' },
          { approvalStatus: { $exists: false } },
        ],
      });
    } else {
      conditions.push({ approvalStatus: status });
    }
  }

  if (search) {
    conditions.push({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { cuisine: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
      ],
    });
  }

  const query = conditions.length ? { $and: conditions } : {};

  const [restaurants, total] = await Promise.all([
    Restaurant.find(query)
      .populate('submittedBy', 'username fullName')
      .populate('approvedBy', 'username fullName')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Restaurant.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: restaurants,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
});

// @desc    Get pending restaurant submissions
// @route   GET /api/admin/restaurants/pending
// @access  Private/Admin
exports.getPendingRestaurants = asyncHandler(async (req, res) => {
  const pending = await Restaurant.find({ approvalStatus: 'pending' })
    .populate('submittedBy', 'username fullName email')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: pending,
  });
});

// @desc    Approve restaurant submission
// @route   PATCH /api/admin/restaurants/:id/approve
// @access  Private/Admin
exports.approveRestaurant = asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findById(req.params.id);

  if (!restaurant) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant not found',
    });
  }

  restaurant.approvalStatus = 'approved';
  restaurant.approvedBy = req.user._id;
  restaurant.approvedAt = new Date();
  restaurant.deniedAt = null;
  restaurant.denyReason = undefined;
  restaurant.isActive = true;

  await restaurant.save();

  res.json({
    success: true,
    message: 'Restaurant approved successfully',
    data: restaurant,
  });
});

// @desc    Deny restaurant submission
// @route   PATCH /api/admin/restaurants/:id/deny
// @access  Private/Admin
exports.denyRestaurant = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const restaurant = await Restaurant.findById(req.params.id);

  if (!restaurant) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant not found',
    });
  }

  restaurant.approvalStatus = 'denied';
  restaurant.approvedBy = undefined;
  restaurant.approvedAt = undefined;
  restaurant.deniedAt = new Date();
  restaurant.denyReason = reason || 'No reason provided';
  restaurant.isActive = false;

  await restaurant.save();

  res.json({
    success: true,
    message: 'Restaurant denied successfully',
    data: restaurant,
  });
});

// @desc    Get flagged restaurant reviews
// @route   GET /api/admin/reviews/flagged
// @access  Private/Admin
exports.getFlaggedReviews = asyncHandler(async (req, res) => {
  const reviews = await RestaurantReview.find({ isFlagged: true })
    .populate('restaurant', 'name')
    .populate('user', 'username fullName');

  res.json({
    success: true,
    data: reviews,
  });
});

// @desc    Resolve flagged restaurant review
// @route   PATCH /api/admin/reviews/:id/resolve
// @access  Private/Admin
exports.resolveFlaggedReview = asyncHandler(async (req, res) => {
  const review = await RestaurantReview.findById(req.params.id);

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found',
    });
  }

  review.isFlagged = false;
  review.flags = [];
  review.isVerified = true;

  await review.save();

  res.json({
    success: true,
    message: 'Review marked as safe',
    data: review,
  });
});

// @desc    Delete a flagged review
// @route   DELETE /api/admin/reviews/:id
// @access  Private/Admin
exports.deleteFlaggedReview = asyncHandler(async (req, res) => {
  const review = await RestaurantReview.findById(req.params.id);

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found',
    });
  }

  await review.deleteOne();

  res.json({
    success: true,
    message: 'Review removed successfully',
  });
});

// @desc    Get all posts for moderation
// @route   GET /api/admin/posts
// @access  Private/Admin
exports.getAllPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '' } = req.query;
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 20;

  const query = {};

  if (search) {
    query.content = { $regex: search, $options: 'i' };
  }

  const [posts, total] = await Promise.all([
    Post.find(query)
      .populate('user', 'username fullName avatar')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Post.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: posts,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
});

// @desc    Delete any user post
// @route   DELETE /api/admin/posts/:id
// @access  Private/Admin
exports.deleteUserPost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  await Comment.deleteMany({ post: post._id });
  await post.deleteOne();

  res.json({
    success: true,
    message: 'Post deleted successfully',
  });
});

// -------- Food management --------

exports.getAllFoods = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status = 'all', search = '' } = req.query;
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 20;

  const conditions = [];

  if (status !== 'all') {
    if (status === 'approved') {
      conditions.push({
        $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }],
      });
    } else {
      conditions.push({ approvalStatus: status });
    }
  }

  if (search) {
    conditions.push({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { cuisine: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ],
    });
  }

  const query = conditions.length ? { $and: conditions } : {};

  const [foods, total] = await Promise.all([
    Food.find(query)
      .populate('submittedBy', 'username fullName')
      .populate('approvedBy', 'username fullName')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Food.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: foods,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
});

exports.getPendingFoods = asyncHandler(async (req, res) => {
  const pending = await Food.find({ approvalStatus: 'pending' })
    .populate('submittedBy', 'username fullName email')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: pending,
  });
});

exports.approveFood = asyncHandler(async (req, res) => {
  const food = await Food.findById(req.params.id);

  if (!food) {
    return res.status(404).json({
      success: false,
      message: 'Food not found',
    });
  }

  food.approvalStatus = 'approved';
  food.approvedBy = req.user._id;
  food.approvedAt = new Date();
  food.deniedAt = null;
  food.denyReason = undefined;
  food.isActive = true;

  await food.save();

  res.json({
    success: true,
    message: 'Food approved successfully',
    data: food,
  });
});

exports.denyFood = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const food = await Food.findById(req.params.id);

  if (!food) {
    return res.status(404).json({
      success: false,
      message: 'Food not found',
    });
  }

  food.approvalStatus = 'denied';
  food.approvedBy = undefined;
  food.approvedAt = undefined;
  food.deniedAt = new Date();
  food.denyReason = reason || 'No reason provided';
  food.isActive = false;

  await food.save();

  res.json({
    success: true,
    message: 'Food denied successfully',
    data: food,
  });
});

exports.getFlaggedFoodReviews = asyncHandler(async (req, res) => {
  const reviews = await FoodReview.find({ isFlagged: true })
    .populate('food', 'name')
    .populate('user', 'username fullName');

  res.json({
    success: true,
    data: reviews,
  });
});

exports.resolveFlaggedFoodReview = asyncHandler(async (req, res) => {
  const review = await FoodReview.findById(req.params.id);

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found',
    });
  }

  review.isFlagged = false;
  review.flags = [];
  review.isVerified = true;

  await review.save();

  res.json({
    success: true,
    message: 'Food review marked as safe',
    data: review,
  });
});

exports.deleteFlaggedFoodReview = asyncHandler(async (req, res) => {
  const review = await FoodReview.findById(req.params.id);

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found',
    });
  }

  await review.deleteOne();

  res.json({
    success: true,
    message: 'Food review removed successfully',
  });
});
