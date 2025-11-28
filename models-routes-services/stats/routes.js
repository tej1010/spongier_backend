// course-stats.routes.js
const express = require('express');
const router = express.Router();
const { getCourseCounts, getDashboardCounts, getUserStatistics, getQuizStatistics } = require('./services');
const { isAdminAuthenticated } = require('../../middlewares/middleware');

// Admin: Get total counts for grades, subjects, terms, videos
router.get('/admin/course/counts/v1', getCourseCounts);

// Admin: Get total counts for dashboard
router.get('/admin/dashboard/counts/v1', getDashboardCounts);

// Admin: Get user statistics (active, inactive, trial users)
router.get('/admin/user/statistics/v1', isAdminAuthenticated, getUserStatistics);

// Admin: Get quiz statistics (total, attempts, active, inactive)
router.get('/admin/quiz/statistics/v1', isAdminAuthenticated, getQuizStatistics);

module.exports = router;
