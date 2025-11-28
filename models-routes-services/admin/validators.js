// admin.validators.js
const { check, body, query, param } = require('express-validator');
const { eUserRoles } = require('../../data');
const { PAGINATION_LIMIT } = require('../../config/common');

// Validate user creation by admin
const validateCreateUser = [
  check('sName').notEmpty().withMessage('Please enter user name'),
  check('sEmail').isEmail().withMessage('Please enter a valid email address'),
  check('sPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  check('sPhone').notEmpty().withMessage('Please enter phone number'),
  check('eRole').notEmpty().isIn(eUserRoles.value).withMessage('Please select a valid role'),

  // Optional user details and address
  body('oUserDetails').optional().isObject().withMessage('oUserDetails must be an object'),
  body('oAddress').optional().isObject().withMessage('oAddress must be an object'),

  // aParents: only for students; optional but if provided, must be an array of Mongo IDs
  body('aParents')
    .optional()
    .isArray().withMessage('aParents must be an array'),
  body('aParents.*')
    .optional()
    .isMongoId().withMessage('Each parent id must be a valid MongoID'),

  // aChildren: only for parents; optional but if provided, must be an array of Mongo IDs
  body('aChildren')
    .optional()
    .isArray().withMessage('aChildren must be an array'),
  body('aChildren.*')
    .optional()
    .isMongoId().withMessage('Each child id must be a valid MongoID'),

  // Terms and Conditions must be accepted
  body('bTermsAndConditions')
    .isBoolean()
    .custom(val => val === true)
    .withMessage('Please agree to the terms and conditions'),

  // Conditional validation for Teacher
  body('iSchool')
    .optional()
    .isMongoId()
    .withMessage('School ID must be a valid MongoID'),

  // Custom school name (when "Other" is selected)
  body('sSchool')
    .optional()
    .isString()
    .trim()
    .withMessage('Custom school name must be a string'),

  // Conditional validation for Grade (mandatory for students)
  body('iGradeId')
    .if(body('eRole').equals(eUserRoles.map.STUDENT))
    .notEmpty()
    .withMessage('Grade ID is required for students')
    .isMongoId()
    .withMessage('Grade ID must be a valid MongoID')
];

// Validate user update by admin
const validateUpdateUser = [
  param('id').isMongoId().withMessage('Invalid user ID'),

  // Optional fields for update
  body('sName').optional().notEmpty().withMessage('Please enter user name'),
  body('sEmail').optional().isEmail().withMessage('Please enter a valid email address'),
  body('sPassword').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('sPhone').optional().notEmpty().withMessage('Please enter phone number'),
  body('eRole').optional().isIn(eUserRoles.value).withMessage('Please select a valid role'),
  body('iSchool').optional().isMongoId().withMessage('School ID must be a valid MongoID'),
  body('sSchool').optional().isString().trim().withMessage('Custom school name must be a string'),
  body('oUserDetails').optional().isObject().withMessage('oUserDetails must be an object'),
  body('oAddress').optional().isObject().withMessage('oAddress must be an object'),
  body('bTermsAndConditions').optional().isBoolean().withMessage('Terms and conditions must be boolean'),

  // aParents: only for students; optional but if provided, must be an array of Mongo IDs
  body('aParents')
    .optional()
    .isArray().withMessage('aParents must be an array'),
  body('aParents.*')
    .optional()
    .isMongoId().withMessage('Each parent id must be a valid MongoID'),

  // aChildren: only for parents; optional but if provided, must be an array of Mongo IDs
  body('aChildren')
    .optional()
    .isArray().withMessage('aChildren must be an array'),
  body('aChildren.*')
    .optional()
    .isMongoId().withMessage('Each child id must be a valid MongoID')
];

// Validate user ID parameter
const validateUserId = [
  param('id').isMongoId().withMessage('Invalid user ID')
];

// Validate user list query parameters
const validateUserList = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: PAGINATION_LIMIT }).withMessage(`Limit must be between 1 and ${PAGINATION_LIMIT}`),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('role').optional().isIn([...eUserRoles.value, 'all']).withMessage('Invalid role'),
  query('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive')
];

// Validate user status change
const validateUserStatus = [
  param('id').isMongoId().withMessage('Invalid user ID'),
  param('status').isIn(['active', 'inactive']).withMessage('Status must be active, inactive, or delete')
];

// Validate change password payload
const validateChangePassword = [
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('sCurrentPassword').notEmpty().withMessage('Please enter current password'),
  body('sNewPassword')
    .isString()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
];

// Validate course export parameters
const validateCourseExport = [
  query('module').notEmpty().withMessage('Module parameter is required')
    .isIn(['grade', 'terms', 'subject', 'video', 'resource']).withMessage('Module must be one of: grade, terms, subject, video, resource'),

  // Optional filter parameters - validate as MongoDB ObjectId if provided
  query('gradeId').optional().isMongoId().withMessage('Invalid grade ID format'),
  query('termId').optional().isMongoId().withMessage('Invalid term ID format'),
  query('subjectId').optional().isMongoId().withMessage('Invalid subject ID format'),
  query('videoId').optional().isMongoId().withMessage('Invalid video ID format'),
  query('resourceId').optional().isMongoId().withMessage('Invalid resource ID format')
];

// Validate signed URL request for image upload
const validateSignedUrlRequest = [
  body('sFileName').notEmpty().withMessage('File name is required'),
  body('sPath').notEmpty().withMessage('Path is required'),
  body('sContentType').notEmpty().withMessage('Content type is required')
    .isIn(['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/heic', 'image/heif'])
    .withMessage('Invalid content type. Supported types: jpeg, png, gif, svg, heic, heif')
];

module.exports = {
  validateCreateUser,
  validateUpdateUser,
  validateUserId,
  validateUserList,
  validateUserStatus,
  validateCourseExport,
  validateChangePassword,
  validateSignedUrlRequest
};
