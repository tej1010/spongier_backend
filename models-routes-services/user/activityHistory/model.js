// activityHistory.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { UsersDBConnect } = require('../../../database/mongoose');
const { eActivityType } = require('../../../data');

const ActivityHistorySchema = new Schema({
  // User who performed the activity (student)
  iUserId: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: true,
    index: true
  },

  // Activity type - flexible for future additions
  eActivityType: {
    type: String,
    required: true,
    enum: eActivityType.value,
    index: true
  },

  // Human-readable activity title
  sTitle: {
    type: String,
    required: true,
    trim: true
  },

  // Detailed description of the activity
  sDescription: {
    type: String,
    trim: true,
    default: ''
  },

  // Flexible metadata object to store activity-specific data
  oMetadata: {
    // For video activities
    videoId: { type: Schema.Types.ObjectId, ref: 'videos' },
    videoTitle: { type: String },
    videoThumbnail: { type: String },
    videoDuration: { type: Number },
    watchDuration: { type: Number },
    watchPercentage: { type: Number },

    // For subject/term/grade activities
    subjectId: { type: Schema.Types.ObjectId, ref: 'subjects' },
    subjectName: { type: String },
    termId: { type: Schema.Types.ObjectId, ref: 'terms' },
    termName: { type: String },
    gradeId: { type: Schema.Types.ObjectId, ref: 'grades' },
    gradeName: { type: String },

    // For streak activities
    streakCount: { type: Number },
    streakType: { type: String }, // 'daily', 'weekly', etc.

    // For badge activities
    badgeId: { type: String },
    badgeName: { type: String },
    badgeIcon: { type: String },

    // For completion activities
    totalItems: { type: Number },
    completedItems: { type: Number },
    completionPercentage: { type: Number },

    // Device/Session info
    deviceType: { type: String },
    deviceOS: { type: String },

    // Any additional custom fields
    type: Schema.Types.Mixed,
    default: {}
  },

  // Quick reference IDs for filtering
  iGradeId: {
    type: Schema.Types.ObjectId,
    ref: 'grades',
    index: true
  },

  iSubjectId: {
    type: Schema.Types.ObjectId,
    ref: 'subjects',
    index: true
  },

  iTermId: {
    type: Schema.Types.ObjectId,
    ref: 'terms',
    index: true
  },

  iVideoId: {
    type: Schema.Types.ObjectId,
    ref: 'videos',
    index: true
  },

  // Whether this activity is important/highlighted
  bHighlight: {
    type: Boolean,
    default: false
  },

  // Whether parents have seen this activity
  bSeenByParent: {
    type: Boolean,
    default: false
  },

  // Activity timestamp (when it occurred)
  dActivityDate: {
    type: Date,
    default: Date.now,
    index: true
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
ActivityHistorySchema.index({ iUserId: 1, eActivityType: 1 });
ActivityHistorySchema.index({ iUserId: 1, dActivityDate: -1 });
ActivityHistorySchema.index({ iUserId: 1, iSubjectId: 1, eActivityType: 1 });
ActivityHistorySchema.index({ iUserId: 1, bSeenByParent: 1, dActivityDate: -1 });
ActivityHistorySchema.index({ eActivityType: 1, dActivityDate: -1 });

// Text index for searching activity titles and descriptions
ActivityHistorySchema.index({ sTitle: 'text', sDescription: 'text' });

const ActivityHistoryModel = UsersDBConnect.model('activityhistories', ActivityHistorySchema);

ActivityHistoryModel.syncIndexes({ force: false })
  .then(() => console.log('Activity History Model Indexes Synced'))
  .catch(err => {
    console.log('Activity History Model Indexes Sync Error', err);
  });

module.exports = ActivityHistoryModel;
