// videoView.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { CourseDBConnect } = require('../../../../database/mongoose');

const VideoViewSchema = new Schema({
  iVideoId: {
    type: Schema.Types.ObjectId,
    ref: 'videos',
    required: true,
    index: true
  },
  // User ID - null for anonymous users
  iUserId: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    default: null,
    index: true
  },
  // IP address for anonymous user tracking
  sIpAddress: {
    type: String,
    default: ''
  },
  // Device information (optional)
  sDeviceType: {
    type: String,
    default: ''
  },
  sDeviceOS: {
    type: String,
    default: ''
  },
  sBrowser: {
    type: String,
    default: ''
  }
}, {
  timestamps: {
    createdAt: 'dCreatedAt',
    updatedAt: 'dUpdatedAt'
  }
});

// For authenticated users: ensure one view per user per video
// This unique index prevents duplicate views from the same user
// Note: Using $type to ensure iUserId is an ObjectId (not null) since $ne is not supported in partial indexes
VideoViewSchema.index({ iVideoId: 1, iUserId: 1 }, {
  unique: true,
  partialFilterExpression: { iUserId: { $type: 'objectId' } }
});

// For anonymous users: ensure one view per IP per video
// This unique index prevents duplicate views from the same IP
// Note: Using $gt: '' instead of $ne since $ne is not supported in partial indexes
VideoViewSchema.index({ iVideoId: 1, sIpAddress: 1 }, {
  unique: true,
  partialFilterExpression: {
    iUserId: null,
    sIpAddress: { $exists: true, $gt: '' }
  }
});

// Additional index for analytics
VideoViewSchema.index({ iVideoId: 1, dCreatedAt: -1 });

const VideoViewModel = CourseDBConnect.model('videoviews', VideoViewSchema);

VideoViewModel.syncIndexes({ force: false })
  .then(() => console.log('VideoView Model Indexes Synced'))
  .catch(err => {
    console.log('VideoView Model Indexes Sync Error', err);
    if (err.code === 11000) {
      console.log('VideoView Model Indexes Sync Error: Duplicate key error', err);
    }
  });

module.exports = VideoViewModel;
