const mongoose = require('mongoose');
const { CourseDBConnect } = require('../../database/mongoose');

const { Schema } = mongoose;

const UserBadgeSchema = new Schema({
  iUserId: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: true
  },
  iBadgeId: {
    type: Schema.Types.ObjectId,
    ref: 'badges',
    required: true
  },
  aVideoIds: [{
    type: Schema.Types.ObjectId,
    ref: 'videos'
  }],
  nVideoCount: {
    type: Number,
    default: 0,
    min: 0
  },
  oContext: {
    type: Schema.Types.Mixed,
    default: {}
  },
  dEarnedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: {
    createdAt: 'dCreatedAt',
    updatedAt: 'dUpdatedAt'
  }
});

UserBadgeSchema.index({ iUserId: 1, iBadgeId: 1 }, { unique: true });
UserBadgeSchema.index({ iUserId: 1, dEarnedAt: -1 });

const UserBadgeModel = CourseDBConnect.model('user_badges', UserBadgeSchema);

UserBadgeModel.syncIndexes({ force: false })
  .then(() => console.log('UserBadge Model Indexes Synced'))
  .catch((err) => console.log('UserBadge Model Indexes Sync Error', err));

module.exports = UserBadgeModel;
