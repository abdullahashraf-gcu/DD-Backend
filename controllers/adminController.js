const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Restaurant = require('../models/Restaurant');
const RestaurantReview = require('../models/RestaurantReview');
const Food = require('../models/Food');
const FoodReview = require('../models/FoodReview');

// ---------------- Analytics ---------------- //

exports.getAnalytics = asyncHandler(async (req, res) => {
  const [
    usersCount,
    postsCount,
    commentsCount,
    restaurantsCount,
    restaurantReviewsCount,
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

  const reviewsCount = restaurantReviewsCount + foodReviewsCount;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [latestUsers, topRestaurants, topFoods, newUsersWeek, postsWeek] = await Promise.all([
    User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('username fullName createdAt role'),

    Restaurant.find({ approvalStatus: 'approved', isActive: true })
      .sort({ averageRating: -1, totalReviews: -1 })
      .limit(5)
      .select('name averageRating totalReviews'),

    Food.find({ approvalStatus: 'approved', isActive: true })
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

// ---------------- Restaurants ---------------- //

exports.getAllRestaurants = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status = 'all', search = '' } = req.query;

  const pageNum = Number(page);
  const limitNum = Number(limit);

  const conditions = [];

  if (status !== 'all') {
    conditions.push({ approvalStatus: status });
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

exports.getPendingRestaurants = asyncHandler(async (req, res) => {
  const pending = await Restaurant.find({ approvalStatus: 'pending' })
    .populate('submittedBy', 'username fullName email')
    .sort({ createdAt: -1 });

  res.json({ success: true, data: pending });
});

exports.approveRestaurant = asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findById(req.params.id);

  if (!restaurant) {
    return res.status(404).json({ success: false, message: 'Restaurant not found' });
  }

  await Restaurant.updateOne(
    { _id: restaurant._id },
    {
      $set: {
        approvalStatus: 'approved',
        approvedBy: req.user._id,
        approvedAt: new Date(),
        isActive: true,
      },
      $unset: {
        deniedAt: "",
        denyReason: "",
      },
    }
  );

  const updated = await Restaurant.findById(restaurant._id);

  res.json({
    success: true,
    message: 'Restaurant approved successfully',
    data: updated,
  });
});

exports.denyRestaurant = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const restaurant = await Restaurant.findById(req.params.id);

  if (!restaurant) {
    return res.status(404).json({ success: false, message: 'Restaurant not found' });
  }

  await Restaurant.updateOne(
    { _id: restaurant._id },
    {
      $set: {
        approvalStatus: 'denied',
        deniedAt: new Date(),
        denyReason: reason || 'No reason provided',
        isActive: false,
      },
      $unset: {
        approvedBy: "",
        approvedAt: "",
      },
    }
  );

  const updated = await Restaurant.findById(restaurant._id);

  res.json({
    success: true,
    message: 'Restaurant denied successfully',
    data: updated,
  });
});

// ---------------- Reviews (Restaurant) ---------------- //

exports.getFlaggedReviews = asyncHandler(async (req, res) => {
  const reviews = await RestaurantReview.find({ isFlagged: true })
    .populate('restaurant', 'name')
    .populate('user', 'username fullName');

  res.json({ success: true, data: reviews });
});

exports.resolveFlaggedReview = asyncHandler(async (req, res) => {
  const review = await RestaurantReview.findById(req.params.id);

  if (!review) {
    return res.status(404).json({ success: false, message: 'Review not found' });
  }

  review.isFlagged = false;
  review.flags = [];

  await review.save();

  res.json({
    success: true,
    message: 'Review marked as safe',
    data: review,
  });
});

exports.deleteFlaggedReview = asyncHandler(async (req, res) => {
  const review = await RestaurantReview.findById(req.params.id);

  if (!review) {
    return res.status(404).json({ success: false, message: 'Review not found' });
  }

  const restaurantId = review.restaurant;

  await review.deleteOne();

  // Recalculate restaurant rating
  const reviews = await RestaurantReview.find({ restaurant: restaurantId });
  const totalReviews = reviews.length;
  const averageRating = totalReviews
    ? reviews.reduce((s, r) => s + r.rating, 0) / totalReviews
    : 0;

  await Restaurant.updateOne(
    { _id: restaurantId },
    { totalReviews, averageRating }
  );

  res.json({ success: true, message: 'Review removed successfully' });
});

// ---------------- Posts ---------------- //

exports.getAllPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '' } = req.query;

  const pageNum = Number(page);
  const limitNum = Number(limit);

  const query = search
    ? { content: { $regex: search, $options: 'i' } }
    : {};

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

exports.deleteUserPost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return res.status(404).json({ success: false, message: 'Post not found' });
  }

  await Comment.deleteMany({ post: post._id });
  await post.deleteOne();

  res.json({ success: true, message: 'Post deleted successfully' });
});

// ---------------- Foods ---------------- //

exports.getAllFoods = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status = 'all', search = '' } = req.query;

  const pageNum = Number(page);
  const limitNum = Number(limit);

  const conditions = [];

  if (status !== 'all') {
    conditions.push({ approvalStatus: status });
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

  res.json({ success: true, data: pending });
});

exports.approveFood = asyncHandler(async (req, res) => {
  const food = await Food.findById(req.params.id);

  if (!food) {
    return res.status(404).json({ success: false, message: 'Food not found' });
  }

  await Food.updateOne(
    { _id: food._id },
    {
      $set: {
        approvalStatus: 'approved',
        approvedBy: req.user._id,
        approvedAt: new Date(),
        isActive: true,
      },
      $unset: {
        deniedAt: "",
        denyReason: "",
      },
    }
  );

  const updated = await Food.findById(food._id);

  res.json({
    success: true,
    message: 'Food approved successfully',
    data: updated,
  });
});

exports.denyFood = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const food = await Food.findById(req.params.id);

  if (!food) {
    return res.status(404).json({ success: false, message: 'Food not found' });
  }

  await Food.updateOne(
    { _id: food._id },
    {
      $set: {
        approvalStatus: 'denied',
        deniedAt: new Date(),
        denyReason: reason || 'No reason provided',
        isActive: false,
      },
      $unset: {
        approvedBy: "",
        approvedAt: "",
      },
    }
  );

  const updated = await Food.findById(food._id);

  res.json({
    success: true,
    message: 'Food denied successfully',
    data: updated,
  });
});

exports.getFlaggedFoodReviews = asyncHandler(async (req, res) => {
  const reviews = await FoodReview.find({ isFlagged: true })
    .populate('food', 'name')
    .populate('user', 'username fullName');

  res.json({ success: true, data: reviews });
});

exports.resolveFlaggedFoodReview = asyncHandler(async (req, res) => {
  const review = await FoodReview.findById(req.params.id);

  if (!review) {
    return res.status(404).json({ success: false, message: 'Review not found' });
  }

  review.isFlagged = false;
  review.flags = [];

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
    return res.status(404).json({ success: false, message: 'Food review not found' });
  }

  const foodId = review.food;

  await review.deleteOne();

  // Recalculate food rating
  const reviews = await FoodReview.find({ food: foodId });
  const totalReviews = reviews.length;
  const averageRating = totalReviews
    ? reviews.reduce((s, r) => s + r.rating, 0) / totalReviews
    : 0;

  await Food.updateOne(
    { _id: foodId },
    { totalReviews, averageRating }
  );

  res.json({ success: true, message: 'Food review removed successfully' });
});
