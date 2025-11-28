// videoWatchHistory.validators.js
const { body, param, query } = require('express-validator');
const { isValidHHMMSS } = require('../../../../helper/utilities.services');

// Custom validator for hh:mm:ss format
const validateDurationFormat = (value) => {
  if (!isValidHHMMSS(value)) {
    throw new Error('Duration must be in hh:mm:ss format (e.g., 01:30:45)');
  }
  return true;
};

const validateRecordVideoWatch = [
  body('iVideoId')
    .notEmpty()
    .withMessage('Video ID is required')
    .isMongoId()
    .withMessage('Valid Video ID is required'),

  body('nWatchDuration')
    .notEmpty()
    .withMessage('Watch duration is required')
    .custom(validateDurationFormat),

  body('nLastPosition')
    .optional()
    .custom(validateDurationFormat),

  body('sDeviceType')
    .optional()
    .isString()
    .withMessage('Device type must be a string'),

  body('sDeviceOS')
    .optional()
    .isString()
    .withMessage('Device OS must be a string'),

  body('sBrowser')
    .optional()
    .isString()
    .withMessage('Browser must be a string')
];

const validateGetUserWatchHistory = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('start')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Start must be a non-negative integer'),

  query('gradeId')
    .optional()
    .isMongoId()
    .withMessage('Valid Grade ID is required'),

  query('subjectId')
    .optional()
    .isMongoId()
    .withMessage('Valid Subject ID is required'),

  query('termId')
    .optional()
    .isMongoId()
    .withMessage('Valid Term ID is required'),

  query('completed')
    .optional()
    .isBoolean()
    .withMessage('Completed must be a boolean'),

  query('watchStatus')
    .optional()
    .isIn(['pending', 'fully_watched', 'fullywatched'])
    .withMessage('Watch status must be either "pending" or "fully_watched"'),

  query('sortBy')
    .optional()
    .isIn(['dLastWatchedAt', 'dCreatedAt', 'nWatchDuration', 'nWatchPercentage'])
    .withMessage('Invalid sort field'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

const validateGetWatchStatistics = [
  param('userId')
    .optional()
    .isMongoId()
    .withMessage('Valid User ID is required')
];

const validateGetActiveSubjects = [];

const validateGetWeeklyProgress = [
  param('userId')
    .optional()
    .isMongoId()
    .withMessage('Valid User ID is required')
];

module.exports = {
  validateRecordVideoWatch,
  validateGetUserWatchHistory,
  validateGetWatchStatistics,
  validateGetActiveSubjects,
  validateGetWeeklyProgress
};
