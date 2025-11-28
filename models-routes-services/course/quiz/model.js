// quiz/model.js
const mongoose = require('mongoose');
const { eStatus } = require('../../../data');
const { CourseDBConnect } = require('../../../database/mongoose');

const { Schema } = mongoose;

const QuizSchema = new Schema({
  sTitle: {
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
    required: true
  },

  nTotalMarks: {
    type: Number,
    default: 0,
    min: 0
  },

  nTimeLimitInMinutes: {
    type: Number,
    default: 0,
    min: 0
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

QuizSchema.index({ iGradeId: 1, iSubjectId: 1, iTermId: 1, iVideoId: 1, eStatus: 1, bDelete: 1 });
QuizSchema.index({ sTitle: 'text', sDescription: 'text' });

const QuizModel = CourseDBConnect.model('quizzes', QuizSchema);

QuizModel.syncIndexes({ force: false })
  .then(() => console.log('Quiz Model Indexes Synced'))
  .catch((err) => console.log('Quiz Model Indexes Sync Error', err));

module.exports = QuizModel;
