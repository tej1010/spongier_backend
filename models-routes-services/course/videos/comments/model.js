// videoComment.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { eStatus } = require('../../../../data');
const { CourseDBConnect } = require('../../../../database/mongoose');

const VideoCommentSchema = new Schema({
  iVideoId: {
    type: Schema.Types.ObjectId,
    ref: 'videos',
    required: true,
    index: true
  },

  iUserId: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: true,
    index: true
  },

  sComment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },

  // For threaded comments/replies
  iParentCommentId: {
    type: Schema.Types.ObjectId,
    ref: 'videocomments',
    default: null,
    index: true
  },

  // Array of user IDs who liked this comment
  aLikes: [{
    type: Schema.Types.ObjectId,
    ref: 'users'
  }],

  nLikeCount: {
    type: Number,
    default: 0,
    min: 0
  },

  nReplyCount: {
    type: Number,
    default: 0,
    min: 0
  },

  eStatus: {
    type: String,
    required: true,
    enum: eStatus.value,
    default: eStatus.map.ACTIVE
  },

  bDelete: {
    type: Boolean,
    default: false,
    index: true
  }

}, {
  timestamps: {
    createdAt: 'dCreatedAt',
    updatedAt: 'dUpdatedAt'
  }
});

// Compound index for efficient querying
VideoCommentSchema.index({ iVideoId: 1, iParentCommentId: 1, dCreatedAt: -1 });
VideoCommentSchema.index({ iVideoId: 1, bDelete: 1, eStatus: 1 });

const VideoCommentModel = CourseDBConnect.model('videocomments', VideoCommentSchema);

VideoCommentModel.syncIndexes({ force: false })
  .then(() => console.log('VideoComment Model Indexes Synced'))
  .catch(err => console.log('VideoComment Model Indexes Sync Error', err));

module.exports = VideoCommentModel;
