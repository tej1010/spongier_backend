// subscription.validators.js
const { check } = require('express-validator');
const { eSubscriptionPlan, ePaymentStatus, ePaymentMethod } = require('../../data');

// Unified validation for subscription route
const unifiedSubscriptionValidation = [
  check('iUserId').isMongoId().withMessage('Please provide a valid user ID'),
  check('ePlan').isIn(eSubscriptionPlan.value).withMessage('Please select a valid subscription plan'),
  check('nSeats').optional().isInt({ min: 1 }).withMessage('Please select at least 1 seat'),
  // Payment fields only required for premium plan
  check('eStatus').if(check('ePlan').equals('premium')).isIn(ePaymentStatus.value).isString().withMessage('Please provide a valid payment status for premium plan'),
  check('ePaymentMethod').if(check('ePlan').equals('premium')).isIn(ePaymentMethod.value).isString().withMessage('Please provide a valid payment method for premium plan'),
  check('sTransactionId').if(check('ePlan').equals('premium')).isString().withMessage('Please provide a valid transaction ID for premium plan'),
  check('nAmount').if(check('ePlan').equals('premium')).isInt({ min: 1 }).withMessage('Please provide a valid amount for premium plan')
];

const premiumSubscriptionValidation = [
  // Payment fields only required for premium plan
  check('eStatus').if(check('ePlan').equals('premium')).isIn(ePaymentStatus.value).isString().withMessage('Please provide a valid payment status for premium plan'),
  check('ePaymentMethod').if(check('ePlan').equals('premium')).isIn(ePaymentMethod.value).isString().withMessage('Please provide a valid payment method for premium plan'),
  check('sTransactionId').if(check('ePlan').equals('premium')).isString().withMessage('Please provide a valid transaction ID for premium plan'),
  check('nAmount').if(check('ePlan').equals('premium')).isInt({ min: 1 }).withMessage('Please provide a valid amount for premium plan')
];

module.exports = { unifiedSubscriptionValidation, premiumSubscriptionValidation };
