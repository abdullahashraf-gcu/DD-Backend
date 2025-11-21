const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Food name is required'],
      trim: true,
      maxlength: [120, 'Food name cannot exceed 120 characters'],
    },
    description: {
      type: String,
      maxlength: [800, 'Description cannot exceed 800 characters'],
    },
    cuisine: {
      type: String,
      required: [true, 'Cuisine is required'],
    },
    category: {
      type: String,
      default: 'Dish',
    },
    origin: {
      type: String,
    },
    priceRange: {
      type: String,
      enum: ['$', '$$', '$$$', '$$$$'],
      default: '$$',
    },
    ingredients: [
      {
        type: String,
        trim: true,
      },
    ],
    images: [
      {
        type: String,
      },
    ],
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    approvalStatus: {
      type: String,
      enum: ['approved', 'pending', 'denied'],
      default: 'approved',
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    approvedAt: Date,
    deniedAt: Date,
    denyReason: String,
    approvalNotes: String,
    source: {
      type: String,
      enum: ['admin', 'user'],
      default: 'admin',
    },
  },
  {
    timestamps: true,
  }
);

foodSchema.index({ name: 'text', description: 'text', cuisine: 'text', category: 'text' });
foodSchema.index({ approvalStatus: 1, isActive: 1 });

module.exports = mongoose.model('Food', foodSchema);

