// term.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { eStatus } = require('../../../data');
const { CourseDBConnect } = require('../../../database/mongoose');

const TermSchema = new Schema({
  sName: {
    type: String,
    required: true,
    trim: true
  },

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

  sDescription: {
    type: String,
    trim: true,
    default: ''
  },

  iOrder: {
    type: Number,
    required: true,
    default: 0
  },

  eStatus: {
    type: String,
    required: true,
    enum: eStatus.value,
    default: eStatus.map.ACTIVE
  },

  bFeature: {
    type: Boolean,
    default: false
  },

  sImage: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: {
    createdAt: 'dCreatedAt',
    updatedAt: 'dUpdatedAt'
  }
});

// Indexes for ordering and relationships
// TermSchema.index({ iGradeId: 1, iSubjectId: 1, iOrder: 1 });
TermSchema.index({ iGradeId: 1, iSubjectId: 1, sName: 1 }, { unique: true, partialFilterExpression: { eStatus: { $in: [eStatus.map.ACTIVE, eStatus.map.INACTIVE] } } });
TermSchema.index({ iGradeId: 1, iSubjectId: 1, iOrder: 1 }, { unique: true, partialFilterExpression: { eStatus: { $in: [eStatus.map.ACTIVE, eStatus.map.INACTIVE] } } });

const TermModel = CourseDBConnect.model('terms', TermSchema);

TermModel.syncIndexes({ force: false })
  .then(() => console.log('Term Model Indexes Synced'))
  .catch((err) => console.log('Term Model Indexes Sync Error', err));

module.exports = TermModel;
