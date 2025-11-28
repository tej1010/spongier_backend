// videoWatchHistory.routes.js
const express = require('express');
const router = express.Router();
const {
  recordVideoWatch,
  getUserWatchHistory,
  getWatchStatistics,
  getActiveSubjects,
  getMyLearning,
  getWeeklyProgress
} = require('./services');
const {
  validateRecordVideoWatch,
  validateGetUserWatchHistory,
  validateGetWatchStatistics,
  validateGetActiveSubjects,
  validateGetWeeklyProgress
} = require('./validators');
const { handleValidation } = require('../../../../helper/utilities.services');
const { isUserAuthenticated } = require('../../../../middlewares/middleware');

// Record or update video watch activity
router.post('/user/videos/watch/v1', isUserAuthenticated, validateRecordVideoWatch, handleValidation, recordVideoWatch);

// Get user's watch history
router.get('/user/videos/watch-history/v1', isUserAuthenticated, validateGetUserWatchHistory, handleValidation, getUserWatchHistory);

// Get watch statistics for authenticated user or their children
router.get('/user/videos/statistics/:userId?/v1', isUserAuthenticated, validateGetWatchStatistics, handleValidation, getWatchStatistics);

// Get active subjects for the authenticated user
router.get('/user/subjects/active/v1', isUserAuthenticated, validateGetActiveSubjects, handleValidation, getActiveSubjects);

// Get My Learning list (watched videos aggregated for UI)
router.get('/user/my-learning/v1', isUserAuthenticated, validateGetUserWatchHistory, handleValidation, getMyLearning);

// Get weekly progress (last 7 days) for authenticated user or their children
router.get('/user/weekly-progress/:userId?/v1', isUserAuthenticated, validateGetWeeklyProgress, handleValidation, getWeeklyProgress);

module.exports = router;
