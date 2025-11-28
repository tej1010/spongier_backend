// subscriptionPlan.validators.js
const { check, query, param } = require('express-validator');
const { eActiveStatus, eBillingType, eBillingCycle, eSubscriptionType } = require('../../../data');
const { PAGINATION_LIMIT } = require('../../../config/common');

// Validation for creating subscription plan
const validateCreateSubscriptionPlan = [
  check('sName')
    .isString()
    .withMessage('Plan name must be a string')
    .isLength({ min: 1, max: 100 })
    .withMessage('Plan name must be between 1 and 100 characters')
    .trim(),
  check('eType')
    .isIn(eSubscriptionType.value)
    .withMessage(`Type must be one of: ${eSubscriptionType.value.join(', ')}`),

  check('sDescription')
    .optional()
    .isString()
    .withMessage('Description must be a string')
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
    .trim(),

  check('nPrice')
    .isNumeric()
    .withMessage('Price must be a number')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),

  check('nDiscount')
    .optional()
    .isNumeric()
    .withMessage('Discount must be a number')
    .trim(),

  check('bRecommended')
    .optional()
    .isBoolean()
    .withMessage('Recommended must be a boolean'),

  check('aBaseFeature')
    .optional()
    .isArray()
    .withMessage('Base features must be an array'),

  check('aBaseFeature.*')
    .optional()
    .isString()
    .withMessage('Each base feature must be a string'),

  check('aPremiumFeature')
    .optional()
    .isArray()
    .withMessage('Premium features must be an array'),

  check('aPremiumFeature.*')
    .optional()
    .isString()
    .withMessage('Each premium feature must be a string'),

  check('eStatus')
    .optional()
    .isIn(eActiveStatus.value)
    .withMessage(`Status must be one of: ${eActiveStatus.value.join(', ')}`),

  check('bDefault')
    .optional()
    .isBoolean()
    .withMessage('Default must be a boolean'),

  check('sCountry')
    .optional()
    .isString()
    .withMessage('Country must be a string')
    .trim(),

  check('sCountryCode')
    .optional()
    .isString()
    .withMessage('Country code must be a string')
    .trim(),

  check('sCurrency')
    .optional()
    .isString()
    .withMessage('Currency must be a string')
    .trim(),

  check('sCurrencySymbol')
    .optional()
    .isString()
    .withMessage('Currency symbol must be a string')
    .trim(),

  check('eBillingType')
    .optional()
    .isIn(eBillingType.value)
    .withMessage(`Billing type must be one of: ${eBillingType.value.join(', ')}`),

  check('eBillingCycle')
    .optional()
    .isIn(eBillingCycle.value)
    .withMessage(`Billing cycle must be one of: ${eBillingCycle.value.join(', ')}`),

  check('nBillingInterval')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Billing interval must be a positive integer')
];

// Validation for updating subscription plan
const validateUpdateSubscriptionPlan = [
  param('id')
    .isMongoId()
    .withMessage('Invalid subscription plan ID'),

  ...validateCreateSubscriptionPlan.map(validation => {
    // Make all fields optional for update
    if (validation.builder && validation.builder.fields) {
      validation.builder.fields.forEach(field => {
        if (field !== 'id') {
          validation.optional();
        }
      });
    }
    return validation;
  })
];

// Validation for getting subscription plan by ID
const validateGetSubscriptionPlan = [
  param('id')
    .isMongoId()
    .withMessage('Invalid subscription plan ID')
];

// Validation for deleting subscription plan
const validateDeleteSubscriptionPlan = [
  param('id')
    .isMongoId()
    .withMessage('Invalid subscription plan ID')
];

// Validation for listing subscription plans
const validateListSubscriptionPlans = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: PAGINATION_LIMIT })
    .withMessage(`Limit must be between 1 and ${PAGINATION_LIMIT}`)
    .toInt(),

  query('start')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Start must be a non-negative integer')
    .toInt(),

  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
    .trim(),

  query('eStatus')
    .optional()
    .isIn(eActiveStatus.value)
    .withMessage(`Status must be one of: ${eActiveStatus.value.join(', ')}`),

  query('eBillingType')
    .optional()
    .isIn(eBillingType.value)
    .withMessage(`Billing type must be one of: ${eBillingType.value.join(', ')}`),

  query('eBillingCycle')
    .optional()
    .isIn(eBillingCycle.value)
    .withMessage(`Billing cycle must be one of: ${eBillingCycle.value.join(', ')}`),

  query('bRecommended')
    .optional()
    .isBoolean()
    .withMessage('Recommended must be a boolean')
    .toBoolean(),

  query('bDefault')
    .optional()
    .isBoolean()
    .withMessage('Default must be a boolean')
    .toBoolean(),

  query('sCountry')
    .optional()
    .isString()
    .withMessage('Country must be a string')
    .trim(),

  query('sortBy')
    .optional()
    .isIn(['sName', 'nPrice', 'dCreatedAt', 'dUpdatedAt'])
    .withMessage('Sort by must be one of: sName, nPrice, dCreatedAt, dUpdatedAt'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

module.exports = {
  validateCreateSubscriptionPlan,
  validateUpdateSubscriptionPlan,
  validateGetSubscriptionPlan,
  validateDeleteSubscriptionPlan,
  validateListSubscriptionPlans
};
