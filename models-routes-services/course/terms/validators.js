// term.validators.js
const { check, body, query, param } = require('express-validator');
const { eStatus } = require('../../../data');
const { PAGINATION_LIMIT } = require('../../../config/common');

// Validate create term
const validateCreateTerm = [
  check('sName').notEmpty().withMessage('Term name is required').trim(),
  check('iGradeId').isMongoId().withMessage('Valid grade ID is required'),
  check('iSubjectId').isMongoId().withMessage('Valid subject ID is required'),
  check('sDescription').notEmpty().withMessage('Description is required').isString().withMessage('Description must be a string'),
  check('iOrder').isInt({ min: 0 }).withMessage('Order must be a positive integer'),
  check('eStatus').isIn(eStatus.value).withMessage('Invalid status'),
  check('bFeature').optional().isBoolean().withMessage('bFeature must be a boolean'),
  check('sImage').optional().isString().withMessage('Image must be a string')
];

// Validate update term
const validateUpdateTerm = [
  param('id').isMongoId().withMessage('Invalid term ID'),
  check('sName').optional().notEmpty().withMessage('Term name cannot be empty').trim(),
  check('iGradeId').optional().isMongoId().withMessage('Valid grade ID is required'),
  check('iSubjectId').optional().isMongoId().withMessage('Valid subject ID is required'),
  check('sDescription').optional().isString().withMessage('Description must be a string'),
  check('iOrder').optional().isInt({ min: 0 }).withMessage('Order must be a positive integer'),
  check('eStatus').optional().isIn(eStatus.value).withMessage('Invalid status'),
  check('bFeature').optional().isBoolean().withMessage('bFeature must be a boolean'),
  check('sImage').optional().isString().withMessage('Image must be a string')
];

// Validate get term by ID
const validateGetTerm = [
  param('id').isMongoId().withMessage('Invalid term ID')
];

// Validate delete term
const validateDeleteTerm = [
  param('id').isMongoId().withMessage('Invalid term ID')
];

// Validate list terms
const validateListTerms = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }),
  query('search').optional().isString(),
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
  query('status').optional().isIn(eStatus.value),
  query('sortBy').optional().isIn(['sName', 'iOrder', 'dCreatedAt']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
];

module.exports = {
  validateCreateTerm,
  validateUpdateTerm,
  validateGetTerm,
  validateDeleteTerm,
  validateListTerms
};
