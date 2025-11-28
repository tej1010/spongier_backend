// user.validators.js
const { check, body, query, param } = require('express-validator');
const { eUserRoles, eSubscriptionPlan, eOtpType } = require('../../data');
const { PAGINATION_LIMIT } = require('../../config/common');

// Validate registration input
const validateRegistration = [
  check('sName').notEmpty().withMessage('Please enter your name'),
  check('sEmail').isEmail().withMessage('Please enter a valid email address'),
  check('sPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  check('sPhone').notEmpty().withMessage('Please enter your phone number'),
  check('eRole').notEmpty().isIn(eUserRoles.value).withMessage('Please select a valid role'),
  body('nAge').optional().isInt({ min: 3, max: 150 }).withMessage('Age must be between 3 and 150'),
  body('oUserDetails').optional().isObject().withMessage('oUserDetails must be an object'),
  body('oSponsorDashboard').optional().isObject().withMessage('oSponsorDashboard must be an object'),
  body('oAddress').optional().isObject().withMessage('oAddress must be an object'),
  body('sImage').optional().isString().withMessage('sImage must be a string'),
  body('bTwoFactorAuthentication').optional().isBoolean().withMessage('bTwoFactorAuthentication must be a boolean'),
  body('oNotificationPreference').optional().isObject().withMessage('oNotificationPreference must be an object'),
  body('oNotificationPreference.bEmail').optional().isBoolean().withMessage('bEmail must be a boolean'),
  body('oNotificationPreference.bPush').optional().isBoolean().withMessage('bPush must be a boolean'),
  body('oNotificationPreference.bPhone').optional().isBoolean().withMessage('bPhone must be a boolean'),
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

  // Conditional validation for School Admin/Teacher
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

// Validate login input
const validateLogin = [
  check('sEmail').isEmail().withMessage('Please enter a valid email address'),
  check('sPassword').not().isEmpty().withMessage('Please enter your password')
];

// Validate forgot password input
const validateForgotPassword = [
  check('sEmail').isEmail().withMessage('Please enter a valid email address')
];

// Validate reset password input
const validateResetPassword = [
  body('sLogin').not().isEmpty(),
  body('sAuth').not().isEmpty(),
  body('sType').not().isEmpty(),
  body('sCode').isNumeric(),
  body('sNewPassword').not().isEmpty()
];

const getUserList = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }),
  query('search').optional().isString(),
  // Optional subscription type filters
  query('ePlan').optional().isIn(eSubscriptionPlan.value)
];

const validateSendOTP = [
  body('sLogin').not().isEmpty(),
  body('sAuth').not().isEmpty(),
  body('sType').not().isEmpty()
];

const validateVerifyOTP = [
  body('sLogin').not().isEmpty(),
  body('sAuth').not().isEmpty(),
  body('sType').not().isEmpty(),
  body('sCode').isNumeric()
];

const validateCheckExist = [
  body('sType').not().isEmpty().isIn(eOtpType.value),
  body('sValue').not().isEmpty(),
  body('sValue')
    .if(body('sType').equals(eOtpType.map.EMAIL))
    .isEmail()
];

// Validate update profile input
const validateUpdateProfile = [
  body('sName').optional().isLength({ min: 1 }).withMessage('Name cannot be empty'),
  body('sPhone').optional().isLength({ min: 10 }).withMessage('Phone number must be at least 10 characters'),
  body('nAge').optional().isInt({ min: 3, max: 150 }).withMessage('Age must be between 3 and 150'),
  body('iSchool').optional().isMongoId().withMessage('School ID must be a valid MongoID'),
  body('sSchool').optional().isString().trim().withMessage('Custom school name must be a string'),
  body('iGradeId').optional().isMongoId().withMessage('Grade ID must be a valid MongoID'),
  body('oAddress').optional().isObject().withMessage('oAddress must be an object'),
  body('oUserDetails').optional().isObject().withMessage('oUserDetails must be an object'),
  body('oSponsorDashboard').optional().isObject().withMessage('oSponsorDashboard must be an object'),
  body('sImage').optional().isString().withMessage('sImage must be a string'),
  body('bTwoFactorAuthentication').optional().isBoolean().withMessage('bTwoFactorAuthentication must be a boolean'),
  body('oNotificationPreference').optional().isObject().withMessage('oNotificationPreference must be an object'),
  body('oNotificationPreference.bEmail').optional().isBoolean().withMessage('bEmail must be a boolean'),
  body('oNotificationPreference.bPush').optional().isBoolean().withMessage('bPush must be a boolean'),
  body('oNotificationPreference.bPhone').optional().isBoolean().withMessage('bPhone must be a boolean'),
  // aParents: optional but if provided, must be an array of Mongo IDs
  body('aParents')
    .optional()
    .isArray().withMessage('aParents must be an array'),
  body('aParents.*')
    .optional()
    .isMongoId().withMessage('Each parent id must be a valid MongoID'),
  // aChildren: optional but if provided, must be an array of Mongo IDs
  body('aChildren')
    .optional()
    .isArray().withMessage('aChildren must be an array'),
  body('aChildren.*')
    .optional()
    .isMongoId().withMessage('Each child id must be a valid MongoID')
];

// Validators for linking/unlinking/listing parent accounts
const validateLinkParent = [
  body('iParentId').optional().isMongoId().withMessage('Parent ID must be a valid MongoID'),
  body('sEmail').optional().isEmail().withMessage('Please enter a valid email address'),
  body('sPhone').optional().isString().notEmpty().withMessage('Please enter phone number'),
  body().custom((value, { req }) => {
    if (!req.body.iParentId && !req.body.sEmail && !req.body.sPhone) {
      throw new Error('Provide iParentId or sEmail or sPhone');
    }
    return true;
  })
];

const validateUnlinkParent = [
  param('parentId').isMongoId().withMessage('Invalid parent ID')
];

const validateListParents = [
  // No specific validation needed for listing parents - it's a simple GET request
];

// Change Password validator
const validateChangePassword = [
  body('sCurrentPassword').not().isEmpty().withMessage('Current password is required'),
  body('sNewPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

// Validators for updating individual settings
const validateTwoFactor = [
  body('bTwoFactorAuthentication').isBoolean().withMessage('bTwoFactorAuthentication must be a boolean')
];

const validateNotificationPreference = [
  body('oNotificationPreference').isObject().withMessage('oNotificationPreference must be an object'),
  body('oNotificationPreference.email').optional().isBoolean().withMessage('email must be a boolean'),
  body('oNotificationPreference.push').optional().isBoolean().withMessage('push must be a boolean'),
  body('oNotificationPreference.sms').optional().isBoolean().withMessage('sms must be a boolean')
];

// Presign URL validator
const validatePresignUrl = [
  body('sFileName').not().isEmpty().withMessage('sFileName is required'),
  body('sContentType').optional().isString().withMessage('sContentType must be a string'),
  body('sPath').optional().isString().withMessage('sPath must be a string'),
  body('eType').optional().isString().withMessage('eType must be a string')
];

// Validate add student by parent input
const validateAddStudentByParent = [
  body('sName').notEmpty().withMessage('Student name is required'),
  body('sEmail').isEmail().withMessage('Please enter a valid email address'),
  body('sPhone').notEmpty().withMessage('Phone number is required'),
  body('sGender').optional().isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
  body('iGradeId').notEmpty().withMessage('Grade ID is required for students').isMongoId().withMessage('Grade ID must be a valid MongoID'),
  body('nAge').optional().isInt({ min: 3, max: 150 }).withMessage('Age must be between 3 and 150'),
  body('iSchool').optional().isMongoId().withMessage('School ID must be a valid MongoID'),
  body('sSchool').optional().isString().trim().withMessage('Custom school name must be a string'),
  body('oAddress').optional().isObject().withMessage('Address must be an object'),
  body('oUserDetails').optional().isObject().withMessage('User details must be an object')
];

// Validate update student by parent input
const validateUpdateStudentByParent = [
  param('childId').isMongoId().withMessage('Student ID must be a valid MongoID'),
  body('sName').optional().notEmpty().withMessage('Student name cannot be empty'),
  body('sEmail').optional().isEmail().withMessage('Please enter a valid email address'),
  body('sPhone').optional().notEmpty().withMessage('Phone number cannot be empty'),
  body('sGender').optional().isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
  body('iGradeId').optional().isMongoId().withMessage('Grade ID must be a valid MongoID'),
  body('nAge').optional().isInt({ min: 3, max: 150 }).withMessage('Age must be between 3 and 150'),
  body('iSchool').optional().isMongoId().withMessage('School ID must be a valid MongoID'),
  body('sSchool').optional().isString().trim().withMessage('Custom school name must be a string'),
  body('oAddress').optional().isObject().withMessage('Address must be an object'),
  body('oUserDetails').optional().isObject().withMessage('User details must be an object')
];

// Validate get children by parent input
const validateGetChildrenByParent = [
  query('childId').optional().isMongoId().withMessage('Child ID must be a valid MongoID'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('start').optional().isInt({ min: 0 }).withMessage('Start must be a non-negative integer'),
  query('grade').optional().isMongoId().withMessage('Grade must be a valid MongoID'),
  query('school').optional().isString().withMessage('School must be a string'),
  query('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
  query('filter').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Filter must be daily, weekly, or monthly')
];

// Validate get recent videos by child input
const validateGetRecentVideosByChild = [
  query('childId').optional().isMongoId().withMessage('Child ID must be a valid MongoID'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('start').optional().isInt({ min: 0 }).withMessage('Start must be a non-negative integer')
];

// Validate bulk add students by school input
const validateBulkAddStudentsBySchool = [
  body('students').isArray({ min: 1 }).withMessage('Students must be a non-empty array'),
  body('students.*.sName').notEmpty().withMessage('Student name is required for each student'),
  body('students.*.sEmail').isEmail().withMessage('Please enter a valid email address for each student'),
  body('students.*.sPhone').notEmpty().withMessage('Phone number is required for each student'),
  body('students.*.sGrade').notEmpty().withMessage('Grade name is required for each student').isString().trim().withMessage('Grade name must be a string'),
  body('students.*.sGender').optional().isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
  body('students.*.nAge').optional().isInt({ min: 3, max: 150 }).withMessage('Age must be between 3 and 150'),
  body('students.*.iSchool').optional().isMongoId().withMessage('School ID must be a valid MongoID'),
  body('students.*.sSchool').optional().isString().trim().withMessage('Custom school name must be a string'),
  body('students.*.oAddress').optional().isObject().withMessage('Address must be an object'),
  body('students.*.oUserDetails').optional().isObject().withMessage('User details must be an object'),
  body('students.*.sImage').optional().isString().withMessage('sImage must be a string')
];

// Validate update student by school input
const validateUpdateStudentBySchool = [
  param('studentId').isMongoId().withMessage('Student ID must be a valid MongoID'),
  body('sName').optional().notEmpty().withMessage('Student name cannot be empty'),
  body('sEmail').optional().isEmail().withMessage('Please enter a valid email address'),
  body('sPhone').optional().notEmpty().withMessage('Phone number cannot be empty'),
  body('sGender').optional().isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
  body('iGradeId').optional().isMongoId().withMessage('Grade ID must be a valid MongoID'),
  body('nAge').optional().isInt({ min: 3, max: 150 }).withMessage('Age must be between 3 and 150'),
  body('iSchool').optional().isMongoId().withMessage('School ID must be a valid MongoID'),
  body('sSchool').optional().isString().trim().withMessage('Custom school name must be a string'),
  body('oAddress').optional().isObject().withMessage('Address must be an object'),
  body('oUserDetails').optional().isObject().withMessage('User details must be an object')
];

// Validate change single student status by school input
const validateChangeSingleStudentStatusBySchool = [
  param('studentId').isMongoId().withMessage('Student ID must be a valid MongoID'),
  param('status').isIn(['active', 'inactive']).withMessage('Status must be active or inactive')
];

// Validate delete user (student) by school input
const validateDeleteUser = [
  param('id').isMongoId().withMessage('Student ID must be a valid MongoID')
];

module.exports = {
  validateRegistration,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  getUserList,
  validateSendOTP,
  validateVerifyOTP,
  validateCheckExist,
  validateUpdateProfile,
  validateAddStudentByParent,
  validateUpdateStudentByParent,
  validateGetChildrenByParent,
  validateGetRecentVideosByChild,
  validateBulkAddStudentsBySchool,
  validateChangeSingleStudentStatusBySchool,
  validateDeleteUser,
  validatePresignUrl,
  validateLinkParent,
  validateUnlinkParent,
  validateListParents,
  validateTwoFactor,
  validateUpdateStudentBySchool,
  validateNotificationPreference,
  validateChangePassword
};
