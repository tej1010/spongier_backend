// quiz/question.model.js
const mongoose = require('mongoose');
const { eStatus } = require('../../../data');
const { CourseDBConnect } = require('../../../database/mongoose');

const { Schema } = mongoose;

const OptionSchema = new Schema({
  sText: {
    type: String,
    required: true,
    trim: true
  },
  sImage: {
    type: String,
    trim: true,
    default: ''
  },
  iOrder: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  _id: true,
  id: false,
  versionKey: false
});

const QuizQuestionSchema = new Schema({
  sQuestion: {
    type: String,
    required: true,
    trim: true
  },

  sExplanation: {
    type: String,
    trim: true,
    default: ''
  },

  aOptions: {
    type: [OptionSchema],
    validate: [
      {
        validator: (val) => Array.isArray(val) && val.length >= 2,
        message: 'A minimum of two options are required'
      }
    ]
  },

  oCorrectAnswer: {
    iOptionId: { type: Schema.Types.ObjectId, required: true },
    nOptionIndex: { type: Number, required: true, min: 0 },
    sText: { type: String, required: true }
  },

  nMarks: {
    type: Number,
    default: 1,
    min: 0
  },

  iQuizId: {
    type: Schema.Types.ObjectId,
    ref: 'quizzes',
    required: true
  },

  // aTags: [{
  //   type: String,
  //   trim: true
  // }],

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

QuizQuestionSchema.index({ iQuizId: 1, eStatus: 1, bDelete: 1 });
QuizQuestionSchema.index({ sQuestion: 'text' });

const QuizQuestionModel = CourseDBConnect.model('quiz_questions', QuizQuestionSchema);

QuizQuestionModel.syncIndexes({ force: false })
  .then(() => console.log('QuizQuestion Model Indexes Synced'))
  .catch((err) => console.log('QuizQuestion Model Indexes Sync Error', err));

module.exports = QuizQuestionModel;
