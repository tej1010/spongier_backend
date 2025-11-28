const mongoose = require('mongoose');
const { eStatus, eBadgeTier, eBadgeType } = require('../../data');
const { CourseDBConnect } = require('../../database/mongoose');

const { Schema } = mongoose;

const BadgeSchema = new Schema({
  sName: {
    type: String,
    required: true,
    trim: true
  },
  sDescription: {
    type: String,
    required: true,
    trim: true
  },
  sIcon: {
    type: String,
    trim: true,
    default: '🏆'
  },
  eTier: {
    type: String,
    enum: eBadgeTier.value,
    default: eBadgeTier.default || eBadgeTier.map.BRONZE
  },
  eType: {
    type: String,
    enum: eBadgeType.value,
    default: eBadgeType.default || eBadgeType.map.QUIZ_PERFORMANCE
  },
  nMinimumVideos: {
    type: Number,
    min: 0,
    default: 0
  },
  oRule: {
    type: Schema.Types.Mixed,
    default: {}
  },
  iGradeId: {
    type: Schema.Types.ObjectId,
    ref: 'grades'
  },
  iSubjectId: {
    type: Schema.Types.ObjectId,
    ref: 'subjects'
  },
  iTermId: {
    type: Schema.Types.ObjectId,
    ref: 'terms'
  },
  eStatus: {
    type: String,
    enum: eStatus.value,
    default: eStatus.map.ACTIVE
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

BadgeSchema.index({ eType: 1, eTier: 1, eStatus: 1, bDelete: 1 });
BadgeSchema.index({ sName: 1, eStatus: 1 });
BadgeSchema.index({ iGradeId: 1, iSubjectId: 1, iTermId: 1 });

const BadgeModel = CourseDBConnect.model('badges', BadgeSchema);

BadgeModel.syncIndexes({ force: false })
  .then(() => console.log('Badge Model Indexes Synced'))
  .catch((err) => console.log('Badge Model Indexes Sync Error', err));

module.exports = BadgeModel;
