const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
const asyncHandler = require('express-async-handler');
const uploadImage = require('../utils/uploadImage');
const multer = require('multer');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// @desc    Create post
// @route   POST /api/posts
// @access  Private
exports.createPost = asyncHandler(async (req, res) => {
  const { content, location, rating, tags } = req.body;
  const userId = req.user._id;

  // Upload images if provided
  const images = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const imageUrl = await uploadImage(file.buffer);
      images.push(imageUrl);
    }
  }

  const postData = {
    user: userId,
    content,
    images,
  };

  if (location) {
    try {
      const locationData = JSON.parse(location);
      postData.location = locationData;
    } catch (e) {
      // If not JSON, treat as string name
      postData.location = { name: location };
    }
  }

  if (rating) postData.rating = parseInt(rating);
  if (tags) {
    postData.tags = Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim());
  }

  const post = await Post.create(postData);
  await post.populate('user', 'username avatar fullName');

  res.status(201).json({
    success: true,
    data: post,
  });
});

// @desc    Get all posts (feed)
// @route   GET /api/posts
// @access  Private
exports.getPosts = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user = await User.findById(userId);

  // Get posts from following + own posts
  const followingIds = [...user.following, userId];

  const posts = await Post.find({ user: { $in: followingIds } })
    .populate('user', 'username avatar fullName')
    .sort({ createdAt: -1 })
    .limit(50);

  res.json({
    success: true,
    data: posts,
  });
});

// @desc    Get trending posts
// @route   GET /api/posts/trending
// @access  Public
exports.getTrendingPosts = asyncHandler(async (req, res) => {
  const posts = await Post.find()
    .populate('user', 'username avatar fullName')
    .sort({ trendingScore: -1, createdAt: -1 })
    .limit(50);

  res.json({
    success: true,
    data: posts,
  });
});

// @desc    Get post by ID
// @route   GET /api/posts/:id
// @access  Public
exports.getPost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id)
    .populate('user', 'username avatar fullName')
    .populate('likes', 'username avatar')
    .populate({
      path: 'comments',
      populate: {
        path: 'user',
        select: 'username avatar fullName',
      },
    });

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  res.json({
    success: true,
    data: post,
  });
});

// @desc    Update post
// @route   PUT /api/posts/:id
// @access  Private
exports.updatePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  // Check if user owns the post
  if (post.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this post',
    });
  }

  const { content, rating, tags } = req.body;
  if (content) post.content = content;
  if (rating) post.rating = parseInt(rating);
  if (tags) {
    post.tags = Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim());
  }

  // Handle new images if provided
  if (req.files && req.files.length > 0) {
    const newImages = [];
    for (const file of req.files) {
      const imageUrl = await uploadImage(file.buffer);
      newImages.push(imageUrl);
    }
    post.images = [...post.images, ...newImages];
  }

  await post.save();
  await post.populate('user', 'username avatar fullName');

  res.json({
    success: true,
    data: post,
  });
});

// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Private
exports.deletePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  // Check if user owns the post or is admin
  if (
    post.user.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this post',
    });
  }

  // Delete all comments associated with this post
  await Comment.deleteMany({ post: post._id });

  await post.deleteOne();

  res.json({
    success: true,
    message: 'Post deleted successfully',
  });
});

// @desc    Get user posts
// @route   GET /api/posts/user/:id
// @access  Public
exports.getUserPosts = asyncHandler(async (req, res) => {
  const posts = await Post.find({ user: req.params.id })
    .populate('user', 'username avatar fullName')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: posts,
  });
});

// @desc    Vote on post (upvote/downvote/remove)
// @route   POST /api/posts/vote/:id
// @access  Private
exports.votePost = asyncHandler(async (req, res) => {
  const { value } = req.body; // 1 = upvote, -1 = downvote, 0 = remove vote

  if (![1, 0, -1].includes(value)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid vote value',
    });
  }

  const post = await Post.findById(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  const userId = req.user._id;

  // Remove existing vote from both arrays
  post.upvotes = post.upvotes.filter((id) => id.toString() !== userId.toString());
  post.downvotes = post.downvotes.filter((id) => id.toString() !== userId.toString());

  // Apply new vote
  if (value === 1) {
    post.upvotes.push(userId);
  } else if (value === -1) {
    post.downvotes.push(userId);
  }

  await post.save();

  res.json({
    success: true,
    data: {
      value,
      upvotes: post.upvotes.length,
      downvotes: post.downvotes.length,
      score: post.upvotes.length - post.downvotes.length,
    },
  });
});

// @desc    Save/Unsave post
// @route   POST /api/posts/save/:id
// @access  Private
exports.savePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  const user = await User.findById(req.user._id);
  const isSaved = user.savedPosts.includes(post._id);

  if (isSaved) {
    user.savedPosts = user.savedPosts.filter(
      (id) => id.toString() !== post._id.toString()
    );
  } else {
    user.savedPosts.push(post._id);
  }

  await user.save();

  res.json({
    success: true,
    data: {
      saved: !isSaved,
    },
  });
});

// Export multer upload middleware
exports.upload = upload.array('images', 10);

