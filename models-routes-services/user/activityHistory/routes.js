// activityHistory.routes.js
const express = require('express');
const router = express.Router();

const {
  getChildrenActivityHistory,
  getChildActivitySummary,
  markActivitiesAsSeen,
  getActivityTimeline,
  getUnseenActivityCount,
  getRecentChildrenActivity
} = require('./services');

const {
  validateGetChildrenActivityHistory,
  validateGetChildActivitySummary,
  validateMarkActivitiesAsSeen,
  validateGetActivityTimeline,
  validateGetUnseenActivityCount,
  validateGetRecentChildrenActivity
} = require('./validators');

const { handleValidation } = require('../../../helper/utilities.services');
const { isUserAuthenticated } = require('../../../middlewares/middleware');

// Get children's activity history with filters
router.get(
  '/user/parent/activity-history/v1',
  isUserAuthenticated,
  validateGetChildrenActivityHistory,
  handleValidation,
  getChildrenActivityHistory
);

// Get activity summary for a specific child
router.get(
  '/user/parent/activity-summary/:childId/v1',
  isUserAuthenticated,
  validateGetChildActivitySummary,
  handleValidation,
  getChildActivitySummary
);

// Mark activities as seen by parent
router.post(
  '/user/parent/activity-seen/v1',
  isUserAuthenticated,
  validateMarkActivitiesAsSeen,
  handleValidation,
  markActivitiesAsSeen
);

// Get activity timeline grouped by date
router.get(
  '/user/parent/activity-timeline/v1',
  isUserAuthenticated,
  validateGetActivityTimeline,
  handleValidation,
  getActivityTimeline
);

// Get unseen activity count
router.get(
  '/user/parent/unseen-count/v1',
  isUserAuthenticated,
  validateGetUnseenActivityCount,
  handleValidation,
  getUnseenActivityCount
);

// Get recent 24hr activity for parent's children
router.get(
  '/user/parent/recent-activity/v1',
  isUserAuthenticated,
  validateGetRecentChildrenActivity,
  handleValidation,
  getRecentChildrenActivity
);

module.exports = router;
