const User = require('../models/User');
const { generateToken, generateRefreshToken } = require('../utils/generateToken');
const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './config.env' });

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res) => {
  const { username, email, password, fullName } = req.body;

  // Check if user exists
  const userExists = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (userExists) {
    return res.status(400).json({
      success: false,
      message: 'User already exists with this email or username',
    });
  }

  // Create user
  const user = await User.create({
    username,
    email,
    password,
    fullName: fullName || username,
    avatar: `https://via.placeholder.com/150/4A90E2/FFFFFF?text=${username.charAt(0).toUpperCase()}`,
  });

  if (user) {
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          avatar: user.avatar,
          bio: user.bio,
          role: user.role,
          followers: user.followers,
          following: user.following,
        },
        token,
        refreshToken,
      },
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Invalid user data',
    });
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Check for user
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }

  // Check if password matches
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }

  const token = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save();

  res.json({
    success: true,
    data: {
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        avatar: user.avatar,
        bio: user.bio,
        role: user.role,
        followers: user.followers,
        following: user.following,
      },
      token,
      refreshToken,
    },
  });
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('followers', 'username avatar')
    .populate('following', 'username avatar')
    .populate('favoriteRestaurants', 'name images cuisine priceRange')
    .populate('favoriteFoods', 'name images cuisine category priceRange');

  res.json({
    success: true,
    data: user,
  });
});

// @desc    Refresh token
// @route   POST /api/auth/refresh
// @access  Public
exports.refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token required',
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    const token = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({
      success: true,
      data: {
        token,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token',
    });
  }
});

