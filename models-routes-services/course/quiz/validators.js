// quiz/validators.js
const { body, check, param, query } = require('express-validator');
const { PAGINATION_LIMIT } = require('../../../config/common');
const { eStatus } = require('../../../data');

const optionValidation = [
  body('aOptions').isArray({ min: 2 }).withMessage('aOptions must have at least two entries'),
  body('aOptions.*.sText').notEmpty().withMessage('Option text is required').bail().isString().trim(),
  body('aOptions.*.sImage').optional().isString().withMessage('Option image must be a string'),
  body('aOptions.*.iOrder').optional().isInt({ min: 0 }).withMessage('Option order must be positive')
];

// const baseContextValidators = [
//   check('iGradeId').isMongoId().withMessage('Valid grade ID is required'),
//   check('iSubjectId').isMongoId().withMessage('Valid subject ID is required'),
//   check('iTermId').isMongoId().withMessage('Valid term ID is required'),
//   check('iVideoId').isMongoId().withMessage('Valid video ID is required')
// ];

// const bodyContextValidators = [
//   body('iGradeId').optional().isMongoId().withMessage('Valid grade ID is required'),
//   body('iSubjectId').optional().isMongoId().withMessage('Valid subject ID is required'),
//   body('iTermId').optional().isMongoId().withMessage('Valid term ID is required'),
//   body('iVideoId').isMongoId().withMessage('Valid video ID is required')
// ];

const validateCreateQuizQuestion = [
  body('iQuizId').isMongoId().withMessage('Valid quiz ID is required'),
  check('sQuestion').notEmpty().withMessage('Question text is required').trim(),
  check('sExplanation').optional().isString(),
  check('nMarks').optional().isFloat({ min: 0 }),
  check('nCorrectOptionIndex').isInt({ min: 0 }).withMessage('nCorrectOptionIndex must be a positive integer'),
  // check('aTags').optional().isArray().withMessage('aTags must be an array'),
  // check('aTags.*').optional().isString(),
  check('eStatus').optional().isIn(eStatus.value),
  ...optionValidation
];

const validateUpdateQuizQuestion = [
  param('id').isMongoId().withMessage('Invalid quiz question ID'),
  check('iQuizId').optional().isMongoId().withMessage('Valid quiz ID is required when provided'),
  check('sQuestion').optional().notEmpty().withMessage('Question text cannot be empty').trim(),
  check('sExplanation').optional().isString(),
  check('nMarks').optional().isFloat({ min: 0 }),
  check('nCorrectOptionIndex').optional().isInt({ min: 0 }),
  // check('aTags').optional().isArray(),
  // check('aTags.*').optional().isString(),
  check('eStatus').optional().isIn(eStatus.value),
  body('aOptions').optional().isArray({ min: 2 }).withMessage('aOptions must have at least two entries'),
  body('aOptions.*.sText').optional().notEmpty().withMessage('Option text is required when provided').bail().isString().trim(),
  body('aOptions.*.sImage').optional().isString(),
  body('aOptions.*.iOrder').optional().isInt({ min: 0 })
];

const validateGetQuizQuestion = [
  param('id').isMongoId().withMessage('Invalid quiz question ID')
];

const validateDeleteQuizQuestion = [
  param('id').isMongoId().withMessage('Invalid quiz question ID')
];

const validateListQuizQuestions = [
  query('limit').optional().isInt({ min: 1, max: PAGINATION_LIMIT }),
  query('quizId').optional().isMongoId(),
  query('status').optional().isIn(eStatus.value),
  query('search').optional().isString(),
  query('sortBy').optional().isIn(['dCreatedAt', 'sQuestion', 'nMarks']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
];

const validateVideoQuestionCount = [
  param('videoId').isMongoId().withMessage('Invalid video ID')
];

const validateRandomQuizQuestions = [
  query('quizId').isMongoId().withMessage('quizId is required'),
  query('limit').optional().isInt({ min: 1, max: 50 })
];

const validateSubmitQuizAttempt = [
  body('iQuizId').isMongoId().withMessage('Valid quiz ID is required'),
  body('nTimeTakenInSeconds').optional().isInt({ min: 0 }),
  body('aResponses').isArray({ min: 1 }).withMessage('aResponses must be a non-empty array'),
  body('aResponses.*.iQuestionId').isMongoId().withMessage('Valid question ID is required'),
  body('aResponses.*.iSelectedOptionId').optional({ nullable: true }).isMongoId().withMessage('Valid option ID is required when provided'),
  body('dStartedAt').optional().isISO8601().toDate(),
  body('dCompletedAt').optional().isISO8601().toDate()
];

const validateListQuizAttempts = [
  query('limit').optional().isInt({ min: 1, max: PAGINATION_LIMIT }),
  query('gradeId').optional().isMongoId(),
  query('subjectId').optional().isMongoId(),
  query('termId').optional().isMongoId(),
  query('videoId').optional().isMongoId(),
  query('quizId').optional().isMongoId(),
  query('userId').optional().isMongoId(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('sortBy').optional().isIn(['dCreatedAt', 'nScoreEarned']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
];

const validateCreateQuiz = [
  body('sTitle').notEmpty().withMessage('Quiz title is required').trim(),
  body('sDescription').optional().isString(),
  body('iGradeId').optional().isMongoId().withMessage('Valid grade ID is required'),
  body('iSubjectId').optional().isMongoId().withMessage('Valid subject ID is required'),
  body('iTermId').optional().isMongoId().withMessage('Valid term ID is required'),
  body('iVideoId').isMongoId().withMessage('Valid video ID is required'),
  body('nTotalMarks').optional().isFloat({ min: 0 }),
  body('nTimeLimitInMinutes').optional().isInt({ min: 0 }),
  body('eStatus').optional().isIn(eStatus.value)
];

const validateUpdateQuiz = [
  param('id').isMongoId().withMessage('Invalid quiz ID'),
  body('sTitle').optional().notEmpty().withMessage('Quiz title cannot be empty').trim(),
  body('sDescription').optional().isString(),
  body('iGradeId').optional().isMongoId().withMessage('Valid grade ID is required'),
  body('iSubjectId').optional().isMongoId().withMessage('Valid subject ID is required'),
  body('iTermId').optional().isMongoId().withMessage('Valid term ID is required'),
  body('iVideoId').optional().isMongoId().withMessage('Valid video ID is required'),
  body('nTotalMarks').optional().isFloat({ min: 0 }),
  body('nTimeLimitInMinutes').optional().isInt({ min: 0 }),
  body('eStatus').optional().isIn(eStatus.value)
];

const validateGetQuiz = [
  param('id').isMongoId().withMessage('Invalid quiz ID')
];

const validateDeleteQuiz = [
  param('id').isMongoId().withMessage('Invalid quiz ID')
];

const validateListQuizzes = [
  query('limit').optional().isInt({ min: 1, max: PAGINATION_LIMIT }),
  query('gradeId').optional().isMongoId(),
  query('subjectId').optional().isMongoId(),
  query('termId').optional().isMongoId(),
  query('videoId').optional().isMongoId(),
  query('status').optional().isIn(eStatus.value),
  query('search').optional().isString(),
  query('sortBy').optional().isIn(['dCreatedAt', 'sTitle', 'nTotalMarks']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
];

module.exports = {
  validateCreateQuizQuestion,
  validateUpdateQuizQuestion,
  validateGetQuizQuestion,
  validateDeleteQuizQuestion,
  validateListQuizQuestions,
  validateVideoQuestionCount,
  validateRandomQuizQuestions,
  validateSubmitQuizAttempt,
  validateListQuizAttempts,
  validateCreateQuiz,
  validateUpdateQuiz,
  validateGetQuiz,
  validateDeleteQuiz,
  validateListQuizzes
};
