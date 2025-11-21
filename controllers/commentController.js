const Comment = require('../models/Comment');
const Post = require('../models/Post');
const asyncHandler = require('express-async-handler');

// @desc    Create comment
// @route   POST /api/comments/:postId
// @access  Private
exports.createComment = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const postId = req.params.postId;
  const userId = req.user._id;

  const post = await Post.findById(postId);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  const comment = await Comment.create({
    post: postId,
    user: userId,
    content,
  });

  // Add comment to post
  post.comments.push(comment._id);
  await post.save();

  await comment.populate('user', 'username avatar fullName');

  res.status(201).json({
    success: true,
    data: comment,
  });
});

// @desc    Get comments for a post
// @route   GET /api/comments/:postId
// @access  Public
exports.getComments = asyncHandler(async (req, res) => {
  const comments = await Comment.find({ post: req.params.postId })
    .populate('user', 'username avatar fullName')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: comments,
  });
});

// @desc    Vote on comment (upvote/downvote/remove)
// @route   POST /api/comments/vote/:id
// @access  Private
exports.voteComment = asyncHandler(async (req, res) => {
  const { value } = req.body; // 1 = upvote, -1 = downvote, 0 = remove

  if (![1, 0, -1].includes(value)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid vote value',
    });
  }

  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    return res.status(404).json({
      success: false,
      message: 'Comment not found',
    });
  }

  const userId = req.user._id;

  // Remove existing vote from both arrays
  comment.upvotes = comment.upvotes.filter(
    (id) => id.toString() !== userId.toString()
  );
  comment.downvotes = comment.downvotes.filter(
    (id) => id.toString() !== userId.toString()
  );

  // Apply new vote
  if (value === 1) {
    comment.upvotes.push(userId);
  } else if (value === -1) {
    comment.downvotes.push(userId);
  }

  await comment.save();

  res.json({
    success: true,
    data: {
      value,
      upvotes: comment.upvotes.length,
      downvotes: comment.downvotes.length,
      score: comment.upvotes.length - comment.downvotes.length,
    },
  });
});

