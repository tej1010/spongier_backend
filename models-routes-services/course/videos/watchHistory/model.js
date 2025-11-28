// videoWatchHistory.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { UsersDBConnect } = require('../../../../database/mongoose');

const VideoWatchHistorySchema = new Schema({
  iUserId: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: true,
    index: true
  },

  iVideoId: {
    type: Schema.Types.ObjectId,
    ref: 'videos',
    required: true
  },

  iGradeId: {
    type: Schema.Types.ObjectId,
    ref: 'grades',
    required: true,
    index: true
  },

  iSubjectId: {
    type: Schema.Types.ObjectId,
    ref: 'subjects',
    required: true,
    index: true
  },

  iTermId: {
    type: Schema.Types.ObjectId,
    ref: 'terms',
    required: true,
    index: true
  },

  // Duration watched in hh:mm:ss format
  nWatchDuration: {
    type: String,
    required: true,
    default: '00:00:00',
    trim: true,
    validate: {
      validator: function (v) {
        return /^([0-9]{2}):([0-5][0-9]):([0-5][0-9])$/.test(v);
      },
      message: props => `${props.value} is not a valid duration format! Use hh:mm:ss`
    }
  },

  // Total video duration in hh:mm:ss format (stored for quick reference)
  nTotalDuration: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function (v) {
        return /^([0-9]{2}):([0-5][0-9]):([0-5][0-9])$/.test(v);
      },
      message: props => `${props.value} is not a valid duration format! Use hh:mm:ss`
    }
  },

  // Watch percentage (0-100)
  nWatchPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  // Whether video was fully watched (>= 90%)
  bCompleted: {
    type: Boolean,
    default: false
  },

  // Last position where user stopped watching in hh:mm:ss format
  nLastPosition: {
    type: String,
    default: '00:00:00',
    trim: true,
    validate: {
      validator: function (v) {
        return /^([0-9]{2}):([0-5][0-9]):([0-5][0-9])$/.test(v);
      },
      message: props => `${props.value} is not a valid duration format! Use hh:mm:ss`
    }
  },

  // Session metadata
  oSessionData: {
    sDeviceType: { type: String, default: '' }, // mobile, tablet, desktop
    sDeviceOS: { type: String, default: '' }, // iOS, Android, Windows, etc.
    sBrowser: { type: String, default: '' },
    sIpAddress: { type: String, default: '' }
  },

  dLastWatchedAt: {
    type: Date,
    default: Date.now
  },

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

// Compound indexes for efficient queries
VideoWatchHistorySchema.index({ iUserId: 1, iVideoId: 1 });
VideoWatchHistorySchema.index({ iUserId: 1, iGradeId: 1, iSubjectId: 1, iTermId: 1 });
VideoWatchHistorySchema.index({ iUserId: 1, dLastWatchedAt: -1 });
VideoWatchHistorySchema.index({ iUserId: 1, bCompleted: 1 });
VideoWatchHistorySchema.index({ dCreatedAt: -1 });

const VideoWatchHistoryModel = UsersDBConnect.model('videowatchhistories', VideoWatchHistorySchema);

VideoWatchHistoryModel.syncIndexes({ force: false })
  .then(() => console.log('Video Watch History Model Indexes Synced'))
  .catch(err => {
    console.log('Video Watch History Model Indexes Sync Error', err);
  });

module.exports = VideoWatchHistoryModel;
