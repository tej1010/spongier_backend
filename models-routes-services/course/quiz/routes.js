// quiz.routes.js
const express = require('express');
const router = express.Router();

const {
  createQuizQuestion,
  getQuizQuestion,
  updateQuizQuestion,
  deleteQuizQuestion,
  listQuizQuestions,
  getVideoQuestionCount,
  getRandomQuizQuestions,
  submitQuizAttempt,
  listMyQuizAttempts,
  listQuizAttempts,
  createQuiz,
  getQuiz,
  updateQuiz,
  deleteQuiz,
  listQuizzes
} = require('./services');

const {
  validateCreateQuizQuestion,
  validateGetQuizQuestion,
  validateUpdateQuizQuestion,
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
} = require('./validators');

const { handleValidation } = require('../../../helper/utilities.services');
const { validateAdmin, isUserAuthenticated } = require('../../../middlewares/middleware');
const data = require('../../../data');

// Admin quiz question routes (specific before parameterized)
router.post(
  '/admin/quiz/question/create/v1',
  validateAdmin('QUIZ', data.eAdminPermission.map.WRITE),
  validateCreateQuizQuestion,
  handleValidation,
  createQuizQuestion
);

router.get(
  '/admin/quiz/questions/v1',
  validateAdmin('QUIZ', data.eAdminPermission.map.READ),
  validateListQuizQuestions,
  handleValidation,
  listQuizQuestions
);

router.get(
  '/admin/quiz/video/:videoId/question-count/v1',
  validateAdmin('QUIZ', data.eAdminPermission.map.READ),
  validateVideoQuestionCount,
  handleValidation,
  getVideoQuestionCount
);

router.get(
  '/admin/quiz/question/:id/v1',
  validateAdmin('QUIZ', data.eAdminPermission.map.READ),
  validateGetQuizQuestion,
  handleValidation,
  getQuizQuestion
);

router.put(
  '/admin/quiz/question/:id/v1',
  validateAdmin('QUIZ', data.eAdminPermission.map.WRITE),
  validateUpdateQuizQuestion,
  handleValidation,
  updateQuizQuestion
);

router.delete(
  '/admin/quiz/question/:id/v1',
  validateAdmin('QUIZ', data.eAdminPermission.map.WRITE),
  validateDeleteQuizQuestion,
  handleValidation,
  deleteQuizQuestion
);

// Admin quiz routes (specific before :id catch-alls)
router.post(
  '/admin/quiz/create/v1',
  validateAdmin('QUIZ', data.eAdminPermission.map.WRITE),
  validateCreateQuiz,
  handleValidation,
  createQuiz
);

router.get(
  '/admin/quiz/list/v1',
  validateAdmin('QUIZ', data.eAdminPermission.map.READ),
  validateListQuizzes,
  handleValidation,
  listQuizzes
);

router.get(
  '/admin/quiz/attempts/v1',
  validateAdmin('QUIZ', data.eAdminPermission.map.READ),
  validateListQuizAttempts,
  handleValidation,
  listQuizAttempts
);

router.get(
  '/admin/quiz/:id/v1',
  validateAdmin('QUIZ', data.eAdminPermission.map.READ),
  validateGetQuiz,
  handleValidation,
  getQuiz
);

router.put(
  '/admin/quiz/:id/v1',
  validateAdmin('QUIZ', data.eAdminPermission.map.WRITE),
  validateUpdateQuiz,
  handleValidation,
  updateQuiz
);

router.delete(
  '/admin/quiz/:id/v1',
  validateAdmin('QUIZ', data.eAdminPermission.map.WRITE),
  validateDeleteQuiz,
  handleValidation,
  deleteQuiz
);

// User quiz routes
router.get(
  '/user/quiz/questions/random/v1',
  isUserAuthenticated,
  validateRandomQuizQuestions,
  handleValidation,
  getRandomQuizQuestions
);

router.post(
  '/user/quiz/attempt/submit/v1',
  isUserAuthenticated,
  validateSubmitQuizAttempt,
  handleValidation,
  submitQuizAttempt
);

router.get(
  '/user/quiz/attempts/v1',
  isUserAuthenticated,
  validateListQuizAttempts,
  handleValidation,
  listMyQuizAttempts
);

module.exports = router;
