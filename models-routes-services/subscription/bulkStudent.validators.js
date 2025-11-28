// bulkStudent.validators.js
const { check, body } = require('express-validator');
const { eUserRoles } = require('../../data');

// Validation for individual email addition
const validateIndividualStudent = [
  check('sEmail')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  check('iSubscriptionId')
    .isMongoId()
    .withMessage('Please provide a valid subscription ID'),
  check('sName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
];

// Validation for bulk CSV upload
const validateBulkCSV = [
  check('iSubscriptionId')
    .isMongoId()
    .withMessage('Please provide a valid subscription ID'),
  body('emails')
    .isArray({ min: 1, max: 100 })
    .withMessage('Please provide at least 1 email and maximum 100 emails'),
  body('emails.*.sEmail')
    .isEmail()
    .withMessage('Each email must be a valid email address')
    .normalizeEmail(),
  body('emails.*.sName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Each name must be between 2 and 50 characters')
];

// Validation for invitation acceptance
const validateInvitationAcceptance = [
  check('sInvitationToken')
    .isString()
    .trim()
    .isLength({ min: 32, max: 64 })
    .withMessage('Invalid invitation token'),
  check('sName')
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  check('sPassword')
    .isString()
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be between 6 and 128 characters'),
  check('sPhone')
    .isString()
    .trim()
    .isLength({ min: 10, max: 15 })
    .withMessage('Phone number must be between 10 and 15 characters'),
  check('iGradeId')
    .notEmpty()
    .withMessage('Grade ID is required for students')
    .isMongoId()
    .withMessage('Grade ID must be a valid MongoID'),
  check('iSchool')
    .optional()
    .isMongoId()
    .withMessage('School ID must be a valid MongoID'),
  check('sSchool')
    .optional()
    .isString()
    .trim()
    .withMessage('Custom school name must be a string')
];

// Validation for resending invitations
const validateResendInvitation = [
  check('sInvitationId')
    .isMongoId()
    .withMessage('Please provide a valid invitation ID')
];

// Validation for getting invitation status
const validateGetInvitationStatus = [
  check('iSubscriptionId')
    .isMongoId()
    .withMessage('Please provide a valid subscription ID'),
  check('sBatchId')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Batch ID must be between 1 and 50 characters')
];

module.exports = {
  validateIndividualStudent,
  validateBulkCSV,
  validateInvitationAcceptance,
  validateResendInvitation,
  validateGetInvitationStatus
};
