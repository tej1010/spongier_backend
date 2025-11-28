// grade.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { eStatus } = require('../../../data');
const { CourseDBConnect } = require('../../../database/mongoose');

const GradeSchema = new Schema({
  sImage: {
    type: String,
    required: false,
    trim: true
  },

  sName: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },

  iOrder: {
    type: Number,
    // unique: true,
    required: true,
    default: 0
  },

  eStatus: {
    type: String,
    required: true,
    enum: eStatus.value,
    default: eStatus.map.ACTIVE
  },

  sDescription: {
    type: String,
    trim: true,
    default: ''
  },

  bFeature: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: {
    createdAt: 'dCreatedAt',
    updatedAt: 'dUpdatedAt'
  }
});

// Unique order across all non-deleted grades
GradeSchema.index(
  { sName: 1, iOrder: 1 },
  { unique: true, partialFilterExpression: { eStatus: { $in: [eStatus.map.ACTIVE, eStatus.map.INACTIVE] } } }
);

const GradeModel = CourseDBConnect.model('grades', GradeSchema);

GradeModel.syncIndexes({ force: false })
  .then(() => console.log('Grade Model Indexes Synced'))
  .catch((err) => console.log('Grade Model Indexes Sync Error', err));

module.exports = GradeModel;
