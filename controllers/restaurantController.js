const Restaurant = require('../models/Restaurant');
const RestaurantReview = require('../models/RestaurantReview');
const asyncHandler = require('express-async-handler');
const uploadImage = require('../utils/uploadImage');
const multer = require('multer');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// @desc    Create restaurant (Admin only)
// @route   POST /api/restaurants
// @access  Private/Admin
exports.createRestaurant = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    address,
    cuisine,
    priceRange,
    phone,
    website,
    hours,
    location,
  } = req.body;

  // Upload images if provided
  const images = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const imageUrl = await uploadImage(file.buffer);
      images.push(imageUrl);
    }
  }

  const restaurantData = {
    name,
    description,
    address,
    cuisine,
    priceRange,
    phone,
    website,
    images,
    submittedBy: req.user._id,
    source: 'admin',
    approvalStatus: 'approved',
    approvedBy: req.user._id,
    approvedAt: new Date(),
    isActive: true,
  };

  if (location) {
    try {
      const locationData = JSON.parse(location);
      restaurantData.location = locationData;
    } catch (e) {
      // If not JSON, ignore location
    }
  }

  if (hours) {
    try {
      const hoursData = JSON.parse(hours);
      restaurantData.hours = hoursData;
    } catch (e) {
      // If not JSON, ignore hours
    }
  }

  const restaurant = await Restaurant.create(restaurantData);

  res.status(201).json({
    success: true,
    data: restaurant,
  });
});

// @desc    Get all restaurants
// @route   GET /api/restaurants
// @access  Public
exports.getRestaurants = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, cuisine, priceRange, search } = req.query;

  const query = {
    isActive: true,
    $or: [{ approvalStatus: { $exists: false } }, { approvalStatus: 'approved' }],
  };

  if (cuisine) query.cuisine = { $regex: cuisine, $options: 'i' };
  if (priceRange) query.priceRange = priceRange;
  if (search) {
    query.$text = { $search: search };
  }

  const restaurants = await Restaurant.find(query)
    .sort({ averageRating: -1, totalReviews: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Restaurant.countDocuments(query);

  res.json({
    success: true,
    data: restaurants,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// @desc    Submit restaurant (User - requires admin approval)
// @route   POST /api/restaurants/submit
// @access  Private
exports.submitRestaurant = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    address,
    cuisine,
    priceRange,
    phone,
    website,
    hours,
    location,
  } = req.body;

  if (!name || !address || !cuisine || !priceRange) {
    return res.status(400).json({
      success: false,
      message: 'Name, address, cuisine, and price range are required',
    });
  }

  const images = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const imageUrl = await uploadImage(file.buffer);
      images.push(imageUrl);
    }
  }

  const restaurantData = {
    name,
    description,
    address,
    cuisine,
    priceRange,
    phone,
    website,
    images,
    submittedBy: req.user._id,
    submittedAt: new Date(),
    source: 'user',
    approvalStatus: 'pending',
    isActive: false,
  };

  if (location) {
    try {
      restaurantData.location = JSON.parse(location);
    } catch (e) {
      // ignore invalid location payloads
    }
  }

  if (hours) {
    try {
      restaurantData.hours = JSON.parse(hours);
    } catch (e) {
      // ignore invalid hours payloads
    }
  }

  const restaurant = await Restaurant.create(restaurantData);

  res.status(201).json({
    success: true,
    message: 'Restaurant submitted successfully. Awaiting admin approval.',
    data: restaurant,
  });
});

// @desc    Get single restaurant
// @route   GET /api/restaurants/:id
// @access  Public
exports.getRestaurant = asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findById(req.params.id);

  if (!restaurant) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant not found',
    });
  }

  const isApproved =
    !restaurant.approvalStatus || restaurant.approvalStatus === 'approved';

  if (!restaurant.isActive || !isApproved) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant not available',
    });
  }

  res.json({
    success: true,
    data: restaurant,
  });
});

// @desc    Update restaurant (Admin only)
// @route   PUT /api/restaurants/:id
// @access  Private/Admin
exports.updateRestaurant = asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findById(req.params.id);

  if (!restaurant) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant not found',
    });
  }

  const {
    name,
    description,
    address,
    cuisine,
    priceRange,
    phone,
    website,
    hours,
    location,
    isActive,
  } = req.body;

  const updateData = {};
  if (name) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (address) updateData.address = address;
  if (cuisine) updateData.cuisine = cuisine;
  if (priceRange) updateData.priceRange = priceRange;
  if (phone !== undefined) updateData.phone = phone;
  if (website !== undefined) updateData.website = website;
  if (isActive !== undefined) updateData.isActive = isActive;

  if (location) {
    try {
      const locationData = JSON.parse(location);
      updateData.location = locationData;
    } catch (e) {
      // If not JSON, ignore location
    }
  }

  if (hours) {
    try {
      const hoursData = JSON.parse(hours);
      updateData.hours = hoursData;
    } catch (e) {
      // If not JSON, ignore hours
    }
  }

  // Handle new images if provided
  if (req.files && req.files.length > 0) {
    const newImages = [];
    for (const file of req.files) {
      const imageUrl = await uploadImage(file.buffer);
      newImages.push(imageUrl);
    }
    updateData.images = [...restaurant.images, ...newImages];
  }

  const updatedRestaurant = await Restaurant.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  );

  res.json({
    success: true,
    data: updatedRestaurant,
  });
});

// @desc    Delete restaurant (Admin only)
// @route   DELETE /api/restaurants/:id
// @access  Private/Admin
exports.deleteRestaurant = asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findById(req.params.id);

  if (!restaurant) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant not found',
    });
  }

  // Delete all reviews for this restaurant
  await RestaurantReview.deleteMany({ restaurant: req.params.id });

  await restaurant.deleteOne();

  res.json({
    success: true,
    message: 'Restaurant deleted successfully',
  });
});

// @desc    Create restaurant review
// @route   POST /api/restaurants/:id/reviews
// @access  Private
exports.createReview = asyncHandler(async (req, res) => {
  const { rating, review } = req.body;
  const restaurantId = req.params.id;
  const userId = req.user._id;

  const restaurant = await Restaurant.findById(restaurantId);

  if (!restaurant) {
  const isApproved =
    !restaurant.approvalStatus || restaurant.approvalStatus === 'approved';

  if (!restaurant.isActive || !isApproved) {
    return res.status(400).json({
      success: false,
      message: 'Reviews can only be added to approved restaurants',
    });
  }
    return res.status(404).json({
      success: false,
      message: 'Restaurant not found',
    });
  }

  // Check if user already reviewed this restaurant
  const existingReview = await RestaurantReview.findOne({
    restaurant: restaurantId,
    user: userId,
  });

  if (existingReview) {
    return res.status(400).json({
      success: false,
      message: 'You have already reviewed this restaurant',
    });
  }

  // Upload images if provided
  const images = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const imageUrl = await uploadImage(file.buffer);
      images.push(imageUrl);
    }
  }

  const restaurantReview = await RestaurantReview.create({
    restaurant: restaurantId,
    user: userId,
    rating,
    review,
    images,
  });

  await restaurantReview.populate('user', 'username avatar fullName');

  res.status(201).json({
    success: true,
    data: restaurantReview,
  });
});

// @desc    Get restaurant reviews
// @route   GET /api/restaurants/:id/reviews
// @access  Public
exports.getRestaurantReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const reviews = await RestaurantReview.find({ restaurant: req.params.id })
    .populate('user', 'username avatar fullName')
    .populate('likes', 'username avatar')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await RestaurantReview.countDocuments({ restaurant: req.params.id });

  res.json({
    success: true,
    data: reviews,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// @desc    Like/Unlike restaurant review
// @route   POST /api/restaurants/reviews/:reviewId/like
// @access  Private
exports.likeReview = asyncHandler(async (req, res) => {
  const review = await RestaurantReview.findById(req.params.reviewId);

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found',
    });
  }

  const userId = req.user._id;
  const isLiked = review.likes.includes(userId);

  if (isLiked) {
    review.likes = review.likes.filter((id) => id.toString() !== userId.toString());
  } else {
    review.likes.push(userId);
  }

  await review.save();

  res.json({
    success: true,
    data: {
      liked: !isLiked,
      likesCount: review.likes.length,
    },
  });
});

// @desc    Flag restaurant review as suspicious
// @route   POST /api/restaurants/reviews/:reviewId/flag
// @access  Private
exports.flagReview = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const review = await RestaurantReview.findById(req.params.reviewId);

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found',
    });
  }

  review.isFlagged = true;
  review.flags.push({
    user: req.user._id,
    reason: reason || 'Suspicious review',
  });

  await review.save();

  res.json({
    success: true,
    data: review,
  });
});

// Export multer upload middleware
exports.upload = upload.array('images', 10);
