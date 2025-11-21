const mongoose = require('mongoose');

const restaurantReviewSchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: 1,
      max: 5,
    },
    review: {
      type: String,
      required: [true, 'Review text is required'],
      maxlength: [1000, 'Review cannot exceed 1000 characters'],
    },
    images: [
      {
        type: String,
      },
    ],
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isFlagged: {
      type: Boolean,
      default: false,
    },
    flags: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        reason: {
          type: String,
          maxlength: 200,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure one review per user per restaurant
restaurantReviewSchema.index({ restaurant: 1, user: 1 }, { unique: true });

// Update restaurant average rating when review is saved
restaurantReviewSchema.post('save', async function() {
  const Restaurant = mongoose.model('Restaurant');
  const reviews = await mongoose.model('RestaurantReview').find({ restaurant: this.restaurant });
  
  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalRating / reviews.length;
  
  await Restaurant.findByIdAndUpdate(this.restaurant, {
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews: reviews.length,
  });
});

// Update restaurant average rating when review is removed
restaurantReviewSchema.post('deleteOne', { document: true, query: false }, async function() {
  const Restaurant = mongoose.model('Restaurant');
  const reviews = await mongoose.model('RestaurantReview').find({ restaurant: this.restaurant });
  
  if (reviews.length === 0) {
    await Restaurant.findByIdAndUpdate(this.restaurant, {
      averageRating: 0,
      totalReviews: 0,
    });
  } else {
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;
    
    await Restaurant.findByIdAndUpdate(this.restaurant, {
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews: reviews.length,
    });
  }
});

module.exports = mongoose.model('RestaurantReview', restaurantReviewSchema);
