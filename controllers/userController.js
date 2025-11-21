const User = require('../models/User');
const Post = require('../models/Post');
const Restaurant = require('../models/Restaurant');
const Food = require('../models/Food');
const asyncHandler = require('express-async-handler');
const uploadImage = require('../utils/uploadImage');
const multer = require('multer');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

const parseArrayField = (value) => {
  if (value === undefined || value === null) return undefined;

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : item))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === 'string' ? item.trim() : item))
          .filter(Boolean);
      }
    } catch (e) {
      // treat as comma separated string
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return undefined;
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Public
exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('-password -refreshToken')
    .populate('followers', 'username avatar fullName')
    .populate('following', 'username avatar fullName')
    .populate('favoriteRestaurants', 'name images cuisine priceRange')
    .populate('favoriteFoods', 'name images cuisine category priceRange');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  res.json({
    success: true,
    data: user,
  });
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private
exports.updateUser = asyncHandler(async (req, res) => {
  const { fullName, bio, favoriteRestaurants, favoriteFoods } = req.body;
  const userId = req.params.id;

  // Check if user is updating their own profile
  if (req.user._id.toString() !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this profile',
    });
  }

  const updateData = {};
  if (fullName) updateData.fullName = fullName;
  if (bio !== undefined) updateData.bio = bio;

  if (favoriteRestaurants !== undefined) {
    const parsedFavorites = parseArrayField(favoriteRestaurants) || [];
    const uniqueFavorites = [...new Set(parsedFavorites.map((id) => id.toString()))];

    if (uniqueFavorites.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'You can only select up to 4 favorite restaurants',
      });
    }

    const approvedRestaurants = await Restaurant.find({
      _id: { $in: uniqueFavorites },
      isActive: true,
      $or: [{ approvalStatus: { $exists: false } }, { approvalStatus: 'approved' }],
    }).select('_id');

    if (approvedRestaurants.length !== uniqueFavorites.length) {
      return res.status(400).json({
        success: false,
        message: 'Favorite restaurants must be from the approved list',
      });
    }

    updateData.favoriteRestaurants = uniqueFavorites;
  }

  if (favoriteFoods !== undefined) {
    const parsedFoods = parseArrayField(favoriteFoods) || [];
    const uniqueFoods = [...new Set(parsedFoods.map((id) => id.toString()))];

    if (uniqueFoods.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'You can only select up to 4 favorite foods',
      });
    }

    const approvedFoods = await Food.find({
      _id: { $in: uniqueFoods },
      isActive: true,
      $or: [{ approvalStatus: { $exists: false } }, { approvalStatus: 'approved' }],
    }).select('_id');

    if (approvedFoods.length !== uniqueFoods.length) {
      return res.status(400).json({
        success: false,
        message: 'Favorite foods must be from the approved list',
      });
    }

    updateData.favoriteFoods = uniqueFoods;
  }

  // Handle avatar upload if provided
  if (req.files && req.files.avatar) {
    const avatarUrl = await uploadImage(req.files.avatar[0].buffer);
    updateData.avatar = avatarUrl;
  }

  // Handle cover image upload if provided
  if (req.files && req.files.coverImage) {
    const coverUrl = await uploadImage(req.files.coverImage[0].buffer);
    updateData.coverImage = coverUrl;
  }

  const user = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  }).select('-password -refreshToken');

  res.json({
    success: true,
    data: user,
  });
});

// @desc    Follow user
// @route   POST /api/users/follow/:id
// @access  Private
exports.followUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const currentUserId = req.user._id;

  if (userId === currentUserId.toString()) {
    return res.status(400).json({
      success: false,
      message: 'Cannot follow yourself',
    });
  }

  const userToFollow = await User.findById(userId);
  const currentUser = await User.findById(currentUserId);

  if (!userToFollow) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Check if already following
  if (currentUser.following.includes(userId)) {
    return res.status(400).json({
      success: false,
      message: 'Already following this user',
    });
  }

  // Add to following and followers
  currentUser.following.push(userId);
  userToFollow.followers.push(currentUserId);

  await currentUser.save();
  await userToFollow.save();

  res.json({
    success: true,
    message: 'User followed successfully',
  });
});

// @desc    Unfollow user
// @route   POST /api/users/unfollow/:id
// @access  Private
exports.unfollowUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const currentUserId = req.user._id;

  const userToUnfollow = await User.findById(userId);
  const currentUser = await User.findById(currentUserId);

  if (!userToUnfollow) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Remove from following and followers
  currentUser.following = currentUser.following.filter(
    (id) => id.toString() !== userId
  );
  userToUnfollow.followers = userToUnfollow.followers.filter(
    (id) => id.toString() !== currentUserId.toString()
  );

  await currentUser.save();
  await userToUnfollow.save();

  res.json({
    success: true,
    message: 'User unfollowed successfully',
  });
});

// @desc    Toggle favorite restaurant
// @route   POST /api/users/favorites/restaurants/:restaurantId
// @access  Private
exports.toggleFavoriteRestaurant = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;

  const restaurant = await Restaurant.findOne({
    _id: restaurantId,
    isActive: true,
    $or: [{ approvalStatus: { $exists: false } }, { approvalStatus: 'approved' }],
  });

  if (!restaurant) {
    return res.status(404).json({
      success: false,
      message: 'Restaurant not found or not approved',
    });
  }

  const user = await User.findById(req.user._id);

  const alreadyFavorite = user.favoriteRestaurants.some(
    (fav) => fav.toString() === restaurantId.toString()
  );

  if (alreadyFavorite) {
    user.favoriteRestaurants = user.favoriteRestaurants.filter(
      (fav) => fav.toString() !== restaurantId.toString()
    );
  } else {
    if (user.favoriteRestaurants.length >= 4) {
      return res.status(400).json({
        success: false,
        message: 'You can only favorite up to 4 restaurants',
      });
    }
    user.favoriteRestaurants.push(restaurantId);
  }

  await user.save();
  await user.populate('favoriteRestaurants', 'name images cuisine priceRange');

  res.json({
    success: true,
    data: {
      favorite: !alreadyFavorite,
      favorites: user.favoriteRestaurants,
    },
  });
});

// @desc    Toggle favorite food
// @route   POST /api/users/favorites/foods/:foodId
// @access  Private
exports.toggleFavoriteFood = asyncHandler(async (req, res) => {
  const { foodId } = req.params;

  const food = await Food.findOne({
    _id: foodId,
    isActive: true,
    $or: [{ approvalStatus: { $exists: false } }, { approvalStatus: 'approved' }],
  });

  if (!food) {
    return res.status(404).json({
      success: false,
      message: 'Food not found or not approved',
    });
  }

  const user = await User.findById(req.user._id);

  const alreadyFavorite = user.favoriteFoods.some(
    (fav) => fav.toString() === foodId.toString()
  );

  if (alreadyFavorite) {
    user.favoriteFoods = user.favoriteFoods.filter(
      (fav) => fav.toString() !== foodId.toString()
    );
  } else {
    if (user.favoriteFoods.length >= 4) {
      return res.status(400).json({
        success: false,
        message: 'You can only favorite up to 4 foods',
      });
    }
    user.favoriteFoods.push(foodId);
  }

  await user.save();
  await user.populate('favoriteFoods', 'name images cuisine category priceRange');

  res.json({
    success: true,
    data: {
      favorite: !alreadyFavorite,
      favorites: user.favoriteFoods,
    },
  });
});

// @desc    Search users
// @route   GET /api/users/search?q=
// @access  Public
exports.searchUsers = asyncHandler(async (req, res) => {
  const query = req.query.q || '';

  if (!query) {
    return res.json({
      success: true,
      data: [],
    });
  }

  const users = await User.find({
    $or: [
      { username: { $regex: query, $options: 'i' } },
      { fullName: { $regex: query, $options: 'i' } },
    ],
  })
    .select('username fullName avatar bio followers following')
    .limit(20);

  res.json({
    success: true,
    data: users,
  });
});

// Export multer upload middleware
exports.upload = upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 },
]);

