// quiz/attempt.model.js
const mongoose = require('mongoose');
const { CourseDBConnect } = require('../../../database/mongoose');

const { Schema } = mongoose;

const AttemptQuestionSchema = new Schema({
  iQuestionId: {
    type: Schema.Types.ObjectId,
    ref: 'quiz_questions',
    required: true
  },
  sQuestion: {
    type: String,
    required: true
  },
  aOptions: [{
    iOptionId: { type: Schema.Types.ObjectId, required: true },
    sText: { type: String, required: true },
    sImage: { type: String, default: '' },
    iOrder: { type: Number, default: 0 }
  }],
  nMarks: {
    type: Number,
    default: 1,
    min: 0
  },
  iSelectedOptionId: {
    type: Schema.Types.ObjectId,
    required: false
  },
  iCorrectOptionId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  bIsCorrect: {
    type: Boolean,
    default: false
  },
  sExplanation: {
    type: String,
    default: ''
  }
}, { _id: false });

const QuizAttemptSchema = new Schema({
  iUserId: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: true
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
  iQuizId: {
    type: Schema.Types.ObjectId,
    ref: 'quizzes',
    required: true
  },
  iVideoId: {
    type: Schema.Types.ObjectId,
    ref: 'videos',
    required: false
  },
  aQuestions: {
    type: [AttemptQuestionSchema],
    default: []
  },
  nTotalQuestions: {
    type: Number,
    default: 0
  },
  nCorrectAnswers: {
    type: Number,
    default: 0
  },
  nIncorrectAnswers: {
    type: Number,
    default: 0
  },
  nTotalMarks: {
    type: Number,
    default: 0
  },
  nScoreEarned: {
    type: Number,
    default: 0
  },
  nPercentage: {
    type: Number,
    default: 0
  },
  nTimeTakenInSeconds: {
    type: Number,
    default: 0
  },
  dStartedAt: {
    type: Date
  },
  dCompletedAt: {
    type: Date,
    default: Date.now
  },
  oSummary: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: {
    createdAt: 'dCreatedAt',
    updatedAt: 'dUpdatedAt'
  }
});

QuizAttemptSchema.index({ iUserId: 1, dCreatedAt: -1 });
QuizAttemptSchema.index({ iQuizId: 1, dCreatedAt: -1 });
QuizAttemptSchema.index({ iGradeId: 1, iSubjectId: 1, iTermId: 1, iQuizId: 1 });

const QuizAttemptModel = CourseDBConnect.model('quiz_attempts', QuizAttemptSchema);

QuizAttemptModel.syncIndexes({ force: false })
  .then(() => console.log('QuizAttempt Model Indexes Synced'))
  .catch((err) => console.log('QuizAttempt Model Indexes Sync Error', err));

module.exports = QuizAttemptModel;
