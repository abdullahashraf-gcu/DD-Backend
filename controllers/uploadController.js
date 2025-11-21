const uploadImage = require('../utils/uploadImage');
const multer = require('multer');
const asyncHandler = require('express-async-handler');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// @desc    Upload image to Cloudinary
// @route   POST /api/upload
// @access  Private
exports.uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded',
    });
  }

  const imageUrl = await uploadImage(req.file.buffer);

  res.json({
    success: true,
    data: {
      url: imageUrl,
    },
  });
});

// Export multer middleware
exports.upload = upload.single('image');

