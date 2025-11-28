// video.validators.js
const { check, body, query, param } = require('express-validator');
const { eVideoStatus } = require('../../../data');
const { PAGINATION_LIMIT } = require('../../../config/common');
const { isValidHHMMSS } = require('../../../helper/utilities.services');

// Custom validator for hh:mm:ss format
const validateDurationFormat = (value) => {
  if (!isValidHHMMSS(value)) {
    throw new Error('Duration must be in hh:mm:ss format (e.g., 01:30:45)');
  }
  return true;
};

// Validate create video
const validateCreateVideo = [
  check('iGradeId').isMongoId().withMessage('Valid grade ID is required'),
  check('iSubjectId').isMongoId().withMessage('Valid subject ID is required'),
  check('iTermId').isMongoId().withMessage('Valid term ID is required'),
  check('sTitle').notEmpty().withMessage('Video title is required').trim(),
  check('iDuration').notEmpty().withMessage('Duration is required').custom(validateDurationFormat),
  check('sDescription').notEmpty().withMessage('Description is required').isString().withMessage('Description must be a string'),
  check('sUrl').notEmpty().withMessage('Video URL is required').trim(),
  check('sThumbnailUrl').optional().isString().withMessage('Thumbnail URL must be a string').trim(),
  check('iOrder').isInt({ min: 0 }).withMessage('iOrder must be a non-negative integer'),
  check('eStatus').isIn(eVideoStatus.value).withMessage('Invalid status'),
  check('bFeature').optional().isBoolean().withMessage('bFeature must be a boolean')
];

// Validate bulk create videos
const validateBulkCreateVideos = [
  body().isArray({ min: 1 }).withMessage('Body must be a non-empty array'),
  body('*.iGradeId').isMongoId().withMessage('Valid grade ID is required'),
  body('*.iSubjectId').isMongoId().withMessage('Valid subject ID is required'),
  body('*.iTermId').isMongoId().withMessage('Valid term ID is required'),
  body('*.sTitle').notEmpty().withMessage('Video title is required').trim(),
  body('*.iDuration').notEmpty().withMessage('Duration is required').custom(validateDurationFormat),
  body('*.sDescription').notEmpty().withMessage('Description is required').isString().withMessage('Description must be a string'),
  body('*.sUrl').notEmpty().withMessage('Video URL is required').trim(),
  body('*.sThumbnailUrl').optional().isString().withMessage('Thumbnail URL must be a string').trim(),
  body('*.iOrder').isInt({ min: 0 }).withMessage('iOrder must be a non-negative integer'),
  body('*.eStatus').isIn(eVideoStatus.value).withMessage('Invalid status'),
  body('*.bFeature').optional().isBoolean().withMessage('bFeature must be a boolean')
];

// Validate update video
const validateUpdateVideo = [
  param('id').isMongoId().withMessage('Invalid video ID'),
  check('iGradeId').optional().isMongoId().withMessage('Valid grade ID is required'),
  check('iSubjectId').optional().isMongoId().withMessage('Valid subject ID is required'),
  check('iTermId').optional().isMongoId().withMessage('Valid term ID is required'),
  check('sTitle').optional().notEmpty().withMessage('Video title cannot be empty').trim(),
  check('iDuration').optional().custom(validateDurationFormat),
  check('sDescription').optional().isString().withMessage('Description must be a string'),
  check('sUrl').optional().notEmpty().withMessage('Video URL cannot be empty').trim(),
  check('sThumbnailUrl').optional().isString().withMessage('Thumbnail URL must be a string').trim(),
  check('iOrder').optional().isInt({ min: 0 }).withMessage('iOrder must be a non-negative integer'),
  check('eStatus').optional().isIn(eVideoStatus.value).withMessage('Invalid status'),
  check('bFeature').optional().isBoolean().withMessage('bFeature must be a boolean')
];

// Validate get video by ID
const validateGetVideo = [
  param('id').isMongoId().withMessage('Invalid video ID')
];

// Validate delete video
const validateDeleteVideo = [
  param('id').isMongoId().withMessage('Invalid video ID')
];

// Validate list videos
const validateListVideos = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }),
  query('search').optional().isString(),
  query('onlyBookmarked').optional().isBoolean(),
  query('gradeId').optional().isMongoId().withMessage('Invalid grade ID'),
  query('subjectId')
    .optional()
    .isMongoId().withMessage('Invalid subject ID')
    .bail()
    .custom((value, { req }) => {
      if (value && !req.query.gradeId) {
        throw new Error('gradeId is required when subjectId is provided');
      }
      return true;
    }),
  query('termId')
    .optional()
    .isMongoId().withMessage('Invalid term ID')
    .bail()
    .custom((value, { req }) => {
      if (value && (!req.query.gradeId || !req.query.subjectId)) {
        throw new Error('gradeId and subjectId are required when termId is provided');
      }
      return true;
    }),
  query('status').optional().isIn(eVideoStatus.value),
  query('sortBy').optional().isIn(['sTitle', 'iDuration', 'dCreatedAt', 'likes', 'views']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
];

const validateMultipartInitiate = [
  body('sFileName').notEmpty().withMessage('File name is required'),
  body('sContentType').notEmpty().withMessage('Content type is required'),
  body('sPath').optional().isString().withMessage('Path must be a string')
];

const validateMultipartPartUrls = [
  body('sKey').notEmpty().withMessage('Key is required'),
  body('iUploadId').notEmpty().withMessage('Upload ID is required'),
  body('nStartPartNumber').optional().isInt({ min: 1 }).withMessage('Start part number must be a positive integer'),
  body('nEndPartNumber').optional().isInt({ min: 1 }).withMessage('End part number must be a positive integer')
];

const validateMultipartComplete = [
  body('sKey').notEmpty().withMessage('Key is required'),
  body('iUploadId').notEmpty().withMessage('Upload ID is required'),
  body('aPart').optional().isArray().withMessage('Part must be an array')
];

const validateMultipartAbort = [
  body('sKey').notEmpty().withMessage('Key is required'),
  body('iUploadId').notEmpty().withMessage('Upload ID is required')
];

const validateGetVideoStatus = [
  param('videoId').notEmpty().withMessage('video ID is required'),
  param('libraryId').notEmpty().withMessage('library id is required')
];

module.exports = {
  validateCreateVideo,
  validateBulkCreateVideos,
  validateUpdateVideo,
  validateGetVideo,
  validateDeleteVideo,
  validateListVideos,
  validateMultipartInitiate,
  validateMultipartPartUrls,
  validateMultipartComplete,
  validateMultipartAbort,
  validateGetVideoStatus
};
