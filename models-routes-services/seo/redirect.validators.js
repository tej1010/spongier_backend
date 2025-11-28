const { body, param } = require('express-validator');
const enums = require('../../data');

const createRedirectValidator = [
  body('sOldSlug')
    .trim()
    .notEmpty()
    .withMessage('Old slug is required')
    .isString()
    .withMessage('Old slug must be a string'),

  body('sNewSlug')
    .trim()
    .notEmpty()
    .withMessage('New slug is required')
    .isString()
    .withMessage('New slug must be a string'),

  body('nStatusCode')
    .optional()
    .isIn(enums.eHttpStatusCode.value)
    .withMessage('Invalid HTTP status code'),

  body('eType')
    .optional()
    .isString()
    .withMessage('Invalid SEO type'),

  body('eSubType')
    .optional()
    .isString()
    .withMessage('Sub type must be a string'),

  body('eStatus')
    .optional()
    .isIn(enums.eStatus.value)
    .withMessage('Invalid status')
];

const updateRedirectValidator = [
  body('sOldSlug')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Old slug cannot be empty')
    .isString()
    .withMessage('Old slug must be a string'),

  body('sNewSlug')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('New slug cannot be empty')
    .isString()
    .withMessage('New slug must be a string'),

  body('nStatusCode')
    .optional()
    .isIn(enums.eHttpStatusCode.value)
    .withMessage('Invalid HTTP status code'),

  body('eType')
    .optional()
    .isString()
    .withMessage('Invalid SEO type'),

  body('eSubType')
    .optional()
    .isString()
    .withMessage('Sub type must be a string'),

  body('eStatus')
    .optional()
    .isIn(enums.eStatus.value)
    .withMessage('Invalid status')
];

const idValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID is required')
    .isMongoId()
    .withMessage('Invalid ID format')
];

module.exports = {
  createRedirectValidator,
  updateRedirectValidator,
  idValidator
};
