// subject.validators.js
const { check, query, param } = require('express-validator');
const { eStatus } = require('../../../data');
const { PAGINATION_LIMIT } = require('../../../config/common');

const parseFeatureFlag = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase();
    if (['true', '1', 'yes'].includes(lowerValue)) return true;
    if (['false', '0', 'no'].includes(lowerValue)) return false;
  }
  return false;
};

const featureImageValidation = () => check('sFeatureImage').custom((value, { req }) => {
  const isFeature = parseFeatureFlag(req.body.bFeature);
  if (isFeature) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error('Feature image is required when subject is featured');
    }
  } else if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new Error('Feature image must be a string');
  }
  return true;
});

// Validate create subject
const validateCreateSubject = [
  check('sName').notEmpty().withMessage('Subject name is required').trim(),
  check('sDescription').notEmpty().withMessage('Description is required').isString().withMessage('Description must be a string'),
  check('iGradeId').isMongoId().withMessage('Valid grade ID is required'),
  check('iOrder').isInt({ min: 0 }).withMessage('Order must be a positive integer'),
  check('eStatus').isIn(eStatus.value).withMessage('Invalid status'),
  check('bFeature').optional().isBoolean().withMessage('bFeature must be a boolean'),
  check('sImage').optional().isString().withMessage('Image must be a string'),
  featureImageValidation(),
  check('sTeacher').optional().isString().withMessage('Teacher must be a string')
];

// Validate update subject
const validateUpdateSubject = [
  param('id').isMongoId().withMessage('Invalid subject ID'),
  check('sName').optional().notEmpty().withMessage('Subject name cannot be empty').trim(),
  check('sDescription').optional().isString().withMessage('Description must be a string'),
  check('iGradeId').optional().isMongoId().withMessage('Valid grade ID is required'),
  check('iOrder').optional().isInt({ min: 0 }).withMessage('Order must be a positive integer'),
  check('eStatus').optional().isIn(eStatus.value).withMessage('Invalid status'),
  check('bFeature').optional().isBoolean().withMessage('bFeature must be a boolean'),
  check('sImage').optional().isString().withMessage('Image must be a string'),
  featureImageValidation(),
  check('sTeacher').optional().isString().withMessage('Teacher must be a string')
];

// Validate get subject by ID
const validateGetSubject = [
  param('id').isMongoId().withMessage('Invalid subject ID')
];

// Validate delete subject
const validateDeleteSubject = [
  param('id').isMongoId().withMessage('Invalid subject ID')
];

// Validate list subjects
const validateListSubjects = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }),
  query('search').optional().isString(),
  query('gradeId').optional().isMongoId().withMessage('Invalid grade ID'),
  query('status').optional().isIn(eStatus.value),
  query('sortBy').optional().isIn(['sName', 'iOrder', 'dCreatedAt']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
];

// Validate get related subjects
const validateGetRelatedSubjects = [
  param('id').isMongoId().withMessage('Invalid subject ID'),
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20'),
  query('sortBy').optional().isIn(['sName', 'iOrder', 'dCreatedAt']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
];

module.exports = {
  validateCreateSubject,
  validateUpdateSubject,
  validateGetSubject,
  validateDeleteSubject,
  validateListSubjects,
  validateGetRelatedSubjects
};
