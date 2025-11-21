const mongoose = require('mongoose');

const foodReviewSchema = new mongoose.Schema(
  {
    food: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Food',
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

foodReviewSchema.index({ food: 1, user: 1 }, { unique: true });

foodReviewSchema.post('save', async function () {
  const Food = mongoose.model('Food');
  const reviews = await mongoose.model('FoodReview').find({ food: this.food });
  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = reviews.length ? totalRating / reviews.length : 0;

  await Food.findByIdAndUpdate(this.food, {
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews: reviews.length,
  });
});

foodReviewSchema.post('deleteOne', { document: true, query: false }, async function () {
  const Food = mongoose.model('Food');
  const reviews = await mongoose.model('FoodReview').find({ food: this.food });

  if (reviews.length === 0) {
    await Food.findByIdAndUpdate(this.food, { averageRating: 0, totalReviews: 0 });
  } else {
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;
    await Food.findByIdAndUpdate(this.food, {
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews: reviews.length,
    });
  }
});

module.exports = mongoose.model('FoodReview', foodReviewSchema);

