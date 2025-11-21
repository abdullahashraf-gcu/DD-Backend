const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Post content is required'],
      maxlength: [2000, 'Post content cannot exceed 2000 characters'],
    },
    images: [
      {
        type: String,
      },
    ],
    location: {
      name: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    // Voting: upvotes/downvotes (replace old \"likes\" behavior)
    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    downvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
      },
    ],
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    tags: [String],
    trendingScore: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate trending score before saving
postSchema.pre('save', function (next) {
  const hoursSinceCreation = (Date.now() - this.createdAt) / (1000 * 60 * 60);
  const voteScore = (this.upvotes?.length || 0) - (this.downvotes?.length || 0);
  const likeWeight = voteScore * 2;
  const commentWeight = this.comments.length * 3;
  const timeDecay = Math.max(0, 1 - hoursSinceCreation / 48); // Decay over 48 hours
  
  this.trendingScore = (likeWeight + commentWeight) * timeDecay;
  next();
});

// Index for trending queries
postSchema.index({ trendingScore: -1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);

