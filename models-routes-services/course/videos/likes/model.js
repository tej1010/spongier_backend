// videoLike.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { CourseDBConnect } = require('../../../../database/mongoose');

const VideoLikeSchema = new Schema({
  iUserId: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: true,
    index: true
  },
  iVideoId: {
    type: Schema.Types.ObjectId,
    ref: 'videos',
    required: true,
    index: true
  },
  // Soft delete flag - when user unlikes, we set this to true instead of deleting
  bDelete: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: {
    createdAt: 'dCreatedAt',
    updatedAt: 'dUpdatedAt'
  }
});

// Ensure a user can like a video only once (ignoring soft-deleted ones)
// This unique index prevents duplicate likes
VideoLikeSchema.index({ iUserId: 1, iVideoId: 1 }, { unique: true, partialFilterExpression: { bDelete: false } });

const VideoLikeModel = CourseDBConnect.model('videolikes', VideoLikeSchema);

VideoLikeModel.syncIndexes({ force: false })
  .then(() => console.log('VideoLike Model Indexes Synced'))
  .catch(err => {
    console.log('VideoLike Model Indexes Sync Error', err);
    if (err.code === 11000) {
      console.log('VideoLike Model Indexes Sync Error: Duplicate key error', err);
    }
  });

module.exports = VideoLikeModel;
