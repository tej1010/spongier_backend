// resource.validators.js
const { check, query, param } = require('express-validator');
const { eStatus, eDocumentType } = require('../../../data');
const { PAGINATION_LIMIT } = require('../../../config/common');

const validateCreateResource = [
  check('sTitle').notEmpty().withMessage('Resource title is required').trim(),
  check('eType').isIn(eDocumentType.value).withMessage('Invalid resource type'),
  check('sDescription').optional().isString().withMessage('Description must be a string'),
  check('iGradeId').isMongoId().withMessage('Valid grade ID is required'),
  check('iSubjectId').isMongoId().withMessage('Valid subject ID is required'),
  check('iTermId').isMongoId().withMessage('Valid term ID is required'),
  check('iVideoId').optional().isMongoId().withMessage('Invalid video ID'),
  check('sFileUrl').isURL({ require_protocol: true }).withMessage('Valid file URL is required'),
  check('iFileSizeBytes').isInt({ min: 0 }).withMessage('File size must be >= 0'),
  check('iOrder').isInt({ min: 0 }).withMessage('Order must be a positive integer'),
  check('eStatus').isIn(eStatus.value).withMessage('Invalid status'),
  check('bFeature').optional().isBoolean().withMessage('bFeature must be a boolean')
];

const validateUpdateResource = [
  param('id').isMongoId().withMessage('Invalid resource ID'),
  check('sTitle').optional().notEmpty().withMessage('Title cannot be empty').trim(),
  check('eType').optional().isIn(eDocumentType.value).withMessage('Invalid resource type'),
  check('sDescription').optional().isString().withMessage('Description must be a string'),
  check('iGradeId').optional().isMongoId().withMessage('Valid grade ID is required'),
  check('iSubjectId').optional().isMongoId().withMessage('Valid subject ID is required'),
  check('iTermId').optional().isMongoId().withMessage('Valid term ID is required'),
  check('iVideoId').optional().isMongoId().withMessage('Invalid video ID'),
  check('sFileUrl').optional().isURL({ require_protocol: true }).withMessage('Valid file URL is required'),
  check('iFileSizeBytes').optional().isInt({ min: 0 }).withMessage('File size must be >= 0'),
  check('iOrder').optional().isInt({ min: 0 }).withMessage('iOrder must be a non-negative integer'),
  check('eStatus').optional().isIn(eStatus.value).withMessage('Invalid status'),
  check('bFeature').optional().isBoolean().withMessage('bFeature must be a boolean')
];

const validateGetResource = [
  param('id').isMongoId().withMessage('Invalid resource ID')
];

const validateDeleteResource = [
  param('id').isMongoId().withMessage('Invalid resource ID')
];

const validateListResources = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }),
  query('search').optional().isString(),
  query('gradeId').optional().isMongoId(),
  query('subjectId')
    .optional()
    .isMongoId()
    .bail()
    .custom((value, { req }) => {
      if (value && !req.query.gradeId) {
        throw new Error('gradeId is required when subjectId is provided');
      }
      return true;
    }),
  query('termId')
    .optional()
    .isMongoId()
    .bail()
    .custom((value, { req }) => {
      if (value && (!req.query.gradeId || !req.query.subjectId)) {
        throw new Error('gradeId and subjectId are required when termId is provided');
      }
      return true;
    }),
  query('videoId')
    .optional()
    .isMongoId()
    .bail()
    .custom((value, { req }) => {
      if (value && (!req.query.gradeId || !req.query.subjectId || !req.query.termId)) {
        throw new Error('gradeId, subjectId and termId are required when videoId is provided');
      }
      return true;
    }),
  query('status').optional().isIn(eStatus.value),
  query('sortBy').optional().isIn(['sTitle', 'dCreatedAt']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
];

module.exports = {
  validateCreateResource,
  validateUpdateResource,
  validateGetResource,
  validateDeleteResource,
  validateListResources
};
