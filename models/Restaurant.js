const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Restaurant name is required'],
      trim: true,
      maxlength: [100, 'Restaurant name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      maxlength: [200, 'Address cannot exceed 200 characters'],
    },
    location: {
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    cuisine: {
      type: String,
      required: [true, 'Cuisine type is required'],
    },
    priceRange: {
      type: String,
      enum: ['$', '$$', '$$$', '$$$$'],
      required: [true, 'Price range is required'],
    },
    images: [
      {
        type: String,
      },
    ],
    phone: {
      type: String,
    },
    website: {
      type: String,
    },
    hours: {
      monday: String,
      tuesday: String,
      wednesday: String,
      thursday: String,
      friday: String,
      saturday: String,
      sunday: String,
    },
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

// Index for location-based queries
restaurantSchema.index({ 'location.coordinates': '2dsphere' });

// Index for text search
restaurantSchema.index({ name: 'text', description: 'text', cuisine: 'text' });
restaurantSchema.index({ approvalStatus: 1, isActive: 1 });

module.exports = mongoose.model('Restaurant', restaurantSchema);
