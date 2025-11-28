// activityHistory.validators.js
const { query, body, param } = require('express-validator');
const { eActivityType } = require('../../../data');

const validateGetChildrenActivityHistory = [
  query('childId')
    .optional()
    .isMongoId()
    .withMessage('Invalid child ID format'),

  query('activityType')
    .optional()
    .custom((value) => {
      const validTypes = eActivityType.value;

      if (typeof value === 'string') {
        const types = value.split(',');
        return types.every(type => validTypes.includes(type));
      }

      if (Array.isArray(value)) {
        return value.every(type => validTypes.includes(type));
      }

      return false;
    })
    .withMessage('Invalid activity type'),

  query('subjectId')
    .optional()
    .isMongoId()
    .withMessage('Invalid subject ID format'),

  query('gradeId')
    .optional()
    .isMongoId()
    .withMessage('Invalid grade ID format'),

  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format for dateFrom'),

  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format for dateTo'),

  query('unseenOnly')
    .optional()
    .isBoolean()
    .withMessage('unseenOnly must be a boolean'),

  query('highlightedOnly')
    .optional()
    .isBoolean()
    .withMessage('highlightedOnly must be a boolean'),

  query('sortBy')
    .optional()
    .isIn(['dActivityDate', 'nPoints', 'eActivityType', 'dCreatedAt'])
    .withMessage('Invalid sort field'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('start')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Start must be a non-negative integer')
];

const validateGetChildActivitySummary = [
  param('childId')
    .exists()
    .withMessage('Child ID is required')
    .isMongoId()
    .withMessage('Invalid child ID format'),

  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365')
];

const validateMarkActivitiesAsSeen = [
  body('activityIds')
    .optional()
    .isArray()
    .withMessage('activityIds must be an array'),

  body('activityIds.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid activity ID format'),

  body('childId')
    .optional()
    .isMongoId()
    .withMessage('Invalid child ID format'),

  body('markAllForChild')
    .optional()
    .isBoolean()
    .withMessage('markAllForChild must be a boolean'),

  body()
    .custom((value) => {
      const { activityIds, markAllForChild, childId } = value;

      // Either activityIds OR (markAllForChild with childId) must be provided
      if (!activityIds && !markAllForChild) {
        throw new Error('Either activityIds or markAllForChild must be provided');
      }

      if (markAllForChild && !childId) {
        throw new Error('childId is required when markAllForChild is true');
      }

      return true;
    })
];

const validateGetActivityTimeline = [
  query('childId')
    .optional()
    .isMongoId()
    .withMessage('Invalid child ID format'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('start')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Start must be a non-negative integer')
];

const validateGetUnseenActivityCount = [
  query('childId')
    .optional()
    .isMongoId()
    .withMessage('Invalid child ID format')
];

const validateGetRecentChildrenActivity = [
  query('childId')
    .optional()
    .isMongoId()
    .withMessage('Invalid child ID format'),

  query('activityType')
    .optional()
    .custom((value) => {
      const validTypes = eActivityType.value;

      if (typeof value === 'string') {
        const types = value.split(',');
        return types.every(type => validTypes.includes(type));
      }

      if (Array.isArray(value)) {
        return value.every(type => validTypes.includes(type));
      }

      return false;
    })
    .withMessage('Invalid activity type'),

  query('sortBy')
    .optional()
    .isIn(['dActivityDate', 'eActivityType', 'dCreatedAt'])
    .withMessage('Invalid sort field'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('start')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Start must be a non-negative integer')
];

module.exports = {
  validateGetChildrenActivityHistory,
  validateGetChildActivitySummary,
  validateMarkActivitiesAsSeen,
  validateGetActivityTimeline,
  validateGetUnseenActivityCount,
  validateGetRecentChildrenActivity
};
