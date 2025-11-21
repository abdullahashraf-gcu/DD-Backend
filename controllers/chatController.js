const Chat = require('../models/Chat');
const User = require('../models/User');
const asyncHandler = require('express-async-handler');

// @desc    Send message
// @route   POST /api/chat/:receiverId
// @access  Private
exports.sendMessage = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const receiverId = req.params.receiverId;
  const senderId = req.user._id;

  if (senderId.toString() === receiverId) {
    return res.status(400).json({
      success: false,
      message: 'Cannot send message to yourself',
    });
  }

  // Find or create chat
  let chat = await Chat.findOne({
    participants: { $all: [senderId, receiverId] },
  });

  if (!chat) {
    chat = await Chat.create({
      participants: [senderId, receiverId],
      messages: [],
    });
  }

  // Add message
  const message = {
    sender: senderId,
    content,
    read: false,
    createdAt: new Date(),
  };

  chat.messages.push(message);
  chat.lastMessage = content;
  chat.lastMessageAt = new Date();

  await chat.save();

  await chat.populate('participants', 'username avatar fullName');
  await chat.populate('messages.sender', 'username avatar fullName');

  res.status(201).json({
    success: true,
    data: {
      chat,
      message: chat.messages[chat.messages.length - 1],
    },
  });
});

// @desc    Get user chats
// @route   GET /api/chat/:userId
// @access  Private
exports.getUserChats = asyncHandler(async (req, res) => {
  const userId = req.params.userId;

  // Verify user is accessing their own chats
  if (req.user._id.toString() !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const chats = await Chat.find({
    participants: userId,
  })
    .populate('participants', 'username avatar fullName')
    .populate('messages.sender', 'username avatar fullName')
    .sort({ lastMessageAt: -1 });

  res.json({
    success: true,
    data: chats,
  });
});

