// video.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { eVideoStatus } = require('../../../data');
const { CourseDBConnect } = require('../../../database/mongoose');

const VideoSchema = new Schema({
  iGradeId: {
    type: Schema.Types.ObjectId,
    ref: 'grades',
    required: true
  },

  iSubjectId: {
    type: Schema.Types.ObjectId,
    ref: 'subjects',
    required: true
  },

  iTermId: {
    type: Schema.Types.ObjectId,
    ref: 'terms',
    required: true
  },

  sTitle: {
    type: String,
    required: true,
    trim: true
  },

  iDuration: {
    type: String, // Duration in hh:mm:ss format
    required: true,
    trim: true,
    validate: {
      validator: function (v) {
        return /^([0-9]{2}):([0-5][0-9]):([0-5][0-9])$/.test(v);
      },
      message: props => `${props.value} is not a valid duration format! Use hh:mm:ss`
    }
  },

  sDescription: {
    type: String,
    trim: true,
    default: ''
  },

  sUrl: {
    type: String,
    required: true,
    trim: true
    // unique: true
  },

  sThumbnailUrl: {
    type: String,
    trim: true,
    default: ''
  },

  iOrder: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },

  eStatus: {
    type: String,
    required: true,
    enum: eVideoStatus.value,
    default: eVideoStatus.map.ACTIVE
  },

  bFeature: {
    type: Boolean,
    default: false
  },

  bDelete: {
    type: Boolean,
    default: false
  },

  // Like and view counts
  nLikeCount: {
    type: Number,
    default: 0,
    min: 0
  },

  nViewCount: {
    type: Number,
    default: 0,
    min: 0
  },

  iLibraryId: { type: String },
  iExternalVideoId: { type: String },
  sS3Url: { type: String }

}, {
  timestamps: {
    createdAt: 'dCreatedAt',
    updatedAt: 'dUpdatedAt'
  }
});

// Indexes for relationships and search
VideoSchema.index({ iGradeId: 1, iSubjectId: 1, iTermId: 1, iOrder: 1 }, { unique: true, partialFilterExpression: { bDelete: false } });
VideoSchema.index({ sTitle: 'text', sDescription: 'text' });
VideoSchema.index({ nLikeCount: -1 }); // For sorting by popularity
VideoSchema.index({ nViewCount: -1 }); // For sorting by views
// VideoSchema.index({ sUrl: 1 }, { unique: true });

const VideoModel = CourseDBConnect.model('videos', VideoSchema);

VideoModel.syncIndexes({ force: false })
  .then(() => console.log('Video Model Indexes Synced'))
  .catch(err => {
    console.log('Video Model Indexes Sync Error', err);
    if (err.code === 11000) {
      console.log('Video Model Indexes Sync Error: Duplicate key error', err);
    }
  });

module.exports = VideoModel;
