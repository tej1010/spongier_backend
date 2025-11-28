// resource.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { eStatus, eDocumentType } = require('../../../data');
const { CourseDBConnect } = require('../../../database/mongoose');

const ResourceSchema = new Schema({
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

  iVideoId: {
    type: Schema.Types.ObjectId,
    ref: 'videos',
    default: null
  },

  sTitle: {
    type: String,
    required: true,
    trim: true
  },

  eType: {
    type: String, // ['pdf', 'presentation', 'assignement', 'notes', 'other']
    required: true,
    enum: eDocumentType.value,
    default: eDocumentType.default
  },

  sDescription: {
    type: String,
    trim: true,
    default: ''
  },

  sFileUrl: {
    type: String,
    required: true,
    trim: true
  },

  iFileSizeBytes: {
    type: Number,
    required: true,
    min: 0,
    default: 0
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
    enum: eStatus.value,
    default: eStatus.map.ACTIVE
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

// Helpful indexes
ResourceSchema.index({ iGradeId: 1, iSubjectId: 1, iTermId: 1 });
ResourceSchema.index({ iVideoId: 1 });
ResourceSchema.index({ iGradeId: 1, iSubjectId: 1, iTermId: 1, sTitle: 1 }, { unique: true, partialFilterExpression: { eStatus: { $in: [eStatus.map.ACTIVE, eStatus.map.INACTIVE] } } });
// Uniqueness of order across grade+subject+term+video (video can be null)
ResourceSchema.index({ iGradeId: 1, iSubjectId: 1, iTermId: 1, iVideoId: 1, iOrder: 1 }, { unique: true, partialFilterExpression: { eStatus: { $in: [eStatus.map.ACTIVE, eStatus.map.INACTIVE] } } });
const ResourceModel = CourseDBConnect.model('resources', ResourceSchema);

ResourceModel.syncIndexes({ force: false })
  .then(() => console.log('Resource Model Indexes Synced'))
  .catch((err) => console.log('Resource Model Indexes Sync Error', err));

module.exports = ResourceModel;
