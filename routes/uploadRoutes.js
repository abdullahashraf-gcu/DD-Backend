const express = require('express');
const router = express.Router();
const { uploadImage, upload } = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');

router.post('/', protect, upload, uploadImage);

module.exports = router;

