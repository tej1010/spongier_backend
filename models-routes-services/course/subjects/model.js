// subject.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { eStatus } = require('../../../data');
const { CourseDBConnect } = require('../../../database/mongoose');

const SubjectSchema = new Schema({
  sName: {
    type: String,
    required: true,
    trim: true
  },

  sDescription: {
    type: String,
    trim: true,
    default: ''
  },

  iGradeId: {
    type: Schema.Types.ObjectId,
    ref: 'grades',
    required: true
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

  sFeatureImage: {
    type: String,
    trim: true,
    default: ''
  },

  sImage: {
    type: String,
    trim: true,
    default: ''
  },

  sTeacher: {
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

// Indexes for ordering and grade relationship
SubjectSchema.index({ iGradeId: 1, sName: 1 }, { unique: true, partialFilterExpression: { eStatus: { $in: [eStatus.map.ACTIVE, eStatus.map.INACTIVE] } } });
SubjectSchema.index({ iGradeId: 1, iOrder: 1 }, { unique: true, partialFilterExpression: { eStatus: { $in: [eStatus.map.ACTIVE, eStatus.map.INACTIVE] } } });

const SubjectModel = CourseDBConnect.model('subjects', SubjectSchema);

SubjectModel.syncIndexes({ force: false })
  .then(() => console.log('Subject Model Indexes Synced'))
  .catch((err) => console.log('Subject Model Indexes Sync Error', err));

module.exports = SubjectModel;
