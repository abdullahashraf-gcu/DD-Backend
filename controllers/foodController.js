const Food = require('../models/Food');
const FoodReview = require('../models/FoodReview');
const asyncHandler = require('express-async-handler');
const uploadImage = require('../utils/uploadImage');
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage });

const parseJsonField = (value) => {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch (err) {
    return undefined;
  }
};

const isApprovedQuery = {
  $or: [{ approvalStatus: { $exists: false } }, { approvalStatus: 'approved' }],
};

// @desc    Create food (Admin only)
// @route   POST /api/foods
// @access  Private/Admin
exports.createFood = asyncHandler(async (req, res) => {
  const { name, description, cuisine, category, origin, priceRange, ingredients } = req.body;

  const images = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const imageUrl = await uploadImage(file.buffer);
      images.push(imageUrl);
    }
  }

  const food = await Food.create({
    name,
    description,
    cuisine,
    category,
    origin,
    priceRange,
    ingredients: parseJsonField(ingredients) || [],
    images,
    source: 'admin',
    submittedBy: req.user._id,
    approvalStatus: 'approved',
    approvedBy: req.user._id,
    approvedAt: new Date(),
  });

  res.status(201).json({
    success: true,
    data: food,
  });
});

// @desc    Submit food (User)
// @route   POST /api/foods/submit
// @access  Private
exports.submitFood = asyncHandler(async (req, res) => {
  const { name, description, cuisine, category, origin, priceRange, ingredients } = req.body;

  if (!name || !cuisine) {
    return res.status(400).json({
      success: false,
      message: 'Name and cuisine are required',
    });
  }

  const images = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const imageUrl = await uploadImage(file.buffer);
      images.push(imageUrl);
    }
  }

  const food = await Food.create({
    name,
    description,
    cuisine,
    category,
    origin,
    priceRange,
    ingredients: parseJsonField(ingredients) || [],
    images,
    source: 'user',
    submittedBy: req.user._id,
    submittedAt: new Date(),
    approvalStatus: 'pending',
    isActive: false,
  });

  res.status(201).json({
    success: true,
    message: 'Food submitted successfully. Awaiting admin approval.',
    data: food,
  });
});

// @desc    Get foods
// @route   GET /api/foods
// @access  Public
exports.getFoods = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, cuisine, category, search } = req.query;

  const query = { isActive: true, ...isApprovedQuery };

  if (cuisine) query.cuisine = { $regex: cuisine, $options: 'i' };
  if (category) query.category = { $regex: category, $options: 'i' };
  if (search) query.$text = { $search: search };

  const foods = await Food.find(query)
    .sort({ averageRating: -1, totalReviews: -1, createdAt: -1 })
    .limit(Number(limit))
    .skip((Number(page) - 1) * Number(limit));

  const total = await Food.countDocuments(query);

  res.json({
    success: true,
    data: foods,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

// @desc    Get single food
// @route   GET /api/foods/:id
// @access  Public
exports.getFood = asyncHandler(async (req, res) => {
  const food = await Food.findById(req.params.id);

  if (!food || !food.isActive || (food.approvalStatus && food.approvalStatus !== 'approved')) {
    return res.status(404).json({
      success: false,
      message: 'Food not found',
    });
  }

  res.json({
    success: true,
    data: food,
  });
});

// @desc    Update food (Admin)
// @route   PUT /api/foods/:id
// @access  Private/Admin
exports.updateFood = asyncHandler(async (req, res) => {
  const food = await Food.findById(req.params.id);

  if (!food) {
    return res.status(404).json({
      success: false,
      message: 'Food not found',
    });
  }

  const { name, description, cuisine, category, origin, priceRange, ingredients, isActive } = req.body;

  const updateData = {};
  if (name) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (cuisine) updateData.cuisine = cuisine;
  if (category) updateData.category = category;
  if (origin !== undefined) updateData.origin = origin;
  if (priceRange) updateData.priceRange = priceRange;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (ingredients) {
    const parsedIngredients = parseJsonField(ingredients);
    if (parsedIngredients) updateData.ingredients = parsedIngredients;
  }

  if (req.files && req.files.length > 0) {
    const newImages = [];
    for (const file of req.files) {
      const imageUrl = await uploadImage(file.buffer);
      newImages.push(imageUrl);
    }
    updateData.images = [...food.images, ...newImages];
  }

  const updatedFood = await Food.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  });

  res.json({
    success: true,
    data: updatedFood,
  });
});

// @desc    Delete food (Admin)
// @route   DELETE /api/foods/:id
// @access  Private/Admin
exports.deleteFood = asyncHandler(async (req, res) => {
  const food = await Food.findById(req.params.id);

  if (!food) {
    return res.status(404).json({
      success: false,
      message: 'Food not found',
    });
  }

  await FoodReview.deleteMany({ food: food._id });
  await food.deleteOne();

  res.json({
    success: true,
    message: 'Food deleted successfully',
  });
});

// @desc    Create food review
// @route   POST /api/foods/:id/reviews
// @access  Private
exports.createReview = asyncHandler(async (req, res) => {
  const { rating, review } = req.body;
  const foodId = req.params.id;
  const userId = req.user._id;

  const food = await Food.findById(foodId);

  if (!food || !food.isActive || (food.approvalStatus && food.approvalStatus !== 'approved')) {
    return res.status(400).json({
      success: false,
      message: 'Reviews can only be added to approved foods',
    });
  }

  const existingReview = await FoodReview.findOne({ food: foodId, user: userId });
  if (existingReview) {
    return res.status(400).json({
      success: false,
      message: 'You have already reviewed this food',
    });
  }

  const images = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const imageUrl = await uploadImage(file.buffer);
      images.push(imageUrl);
    }
  }

  const foodReview = await FoodReview.create({
    food: foodId,
    user: userId,
    rating,
    review,
    images,
  });

  await foodReview.populate('user', 'username avatar fullName');

  res.status(201).json({
    success: true,
    data: foodReview,
  });
});

// @desc    Get food reviews
// @route   GET /api/foods/:id/reviews
// @access  Public
exports.getFoodReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const reviews = await FoodReview.find({ food: req.params.id })
    .populate('user', 'username avatar fullName')
    .populate('likes', 'username avatar')
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip((Number(page) - 1) * Number(limit));

  const total = await FoodReview.countDocuments({ food: req.params.id });

  res.json({
    success: true,
    data: reviews,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

// @desc    Like/Unlike food review
// @route   POST /api/foods/reviews/:reviewId/like
// @access  Private
exports.likeFoodReview = asyncHandler(async (req, res) => {
  const review = await FoodReview.findById(req.params.reviewId);

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

// @desc    Flag food review
// @route   POST /api/foods/reviews/:reviewId/flag
// @access  Private
exports.flagFoodReview = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const review = await FoodReview.findById(req.params.reviewId);

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

// @desc    Get flagged food reviews (Admin)
// @route   GET /api/foods/reviews/flagged
// @access  Private/Admin
exports.getFlaggedFoodReviews = asyncHandler(async (req, res) => {
  const reviews = await FoodReview.find({ isFlagged: true })
    .populate('food', 'name')
    .populate('user', 'username fullName');

  res.json({
    success: true,
    data: reviews,
  });
});

exports.upload = upload.array('images', 10);

