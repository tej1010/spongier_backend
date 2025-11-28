// grade.validators.js
const { check, query, param } = require('express-validator');
const { eStatus } = require('../../../data');
const { PAGINATION_LIMIT } = require('../../../config/common');

// Validate create grade
const validateCreateGrade = [
  check('sName').notEmpty().withMessage('Grade name is required').trim(),
  check('iOrder').isInt({ min: 0 }).withMessage('Order must be a positive integer'),
  check('eStatus').isIn(eStatus.value).withMessage('Invalid status'),
  check('sDescription').notEmpty().withMessage('Description is required').isString().withMessage('Description must be a string'),
  check('bFeature').optional().isBoolean().withMessage('bFeature must be a boolean'),
  check('sImage').optional().isString().withMessage('Image must be a string')
];

// Validate update grade
const validateUpdateGrade = [
  param('id').isMongoId().withMessage('Invalid grade ID'),
  check('sName').optional().notEmpty().withMessage('Grade name cannot be empty').trim(),
  check('iOrder').optional().isInt({ min: 0 }).withMessage('Order must be a positive integer'),
  check('eStatus').optional().isIn(eStatus.value).withMessage('Invalid status'),
  check('sDescription').optional().isString().withMessage('Description must be a string'),
  check('bFeature').optional().isBoolean().withMessage('bFeature must be a boolean'),
  check('sImage').optional().isString().withMessage('Image must be a string')
];

// Validate get grade by ID
const validateGetGrade = [
  param('id').isMongoId().withMessage('Invalid grade ID')
];

// Validate delete grade
const validateDeleteGrade = [
  param('id').isMongoId().withMessage('Invalid grade ID')
];

// Validate list grades
const validateListGrades = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }),
  query('search').optional().isString(),
  query('status').optional().isIn(eStatus.value),
  query('sortBy').optional().isIn(['sName', 'iOrder', 'dCreatedAt']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
];

// Validate featured grades
const validateFeaturedGrades = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }),
  query('start').optional().isInt({ min: 0 }),
  query('sortBy').optional().isIn(['sName', 'iOrder', 'dCreatedAt']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
];

module.exports = {
  validateCreateGrade,
  validateUpdateGrade,
  validateGetGrade,
  validateDeleteGrade,
  validateListGrades,
  validateFeaturedGrades
};
