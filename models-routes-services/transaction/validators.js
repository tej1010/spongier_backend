// transaction.validators.js
const { check, body } = require('express-validator');
const { ePaymentMethod } = require('../../data');

const validateCreateIntent = [
  check('eContext').optional().isIn(['subscription']).withMessage('Invalid context'),
  check('nAmount').isInt({ min: 1 }).withMessage('Amount must be positive integer'),
  check('sCurrency').optional().isString().isLength({ min: 3, max: 3 }).withMessage('Currency must be ISO code'),
  check('sReferenceId').isString().withMessage('ReferenceId is required'),
  check('ePaymentMethod').optional().isIn(ePaymentMethod.value).withMessage('Invalid payment method')
];

// Generic webhook validator for gateway events
const validateWebhook = [
  body('sProvider').isString().withMessage('Provider is required'),
  body('type').isString().withMessage('Webhook type is required'),
  body('data').isObject().withMessage('Webhook data must be object')
];

module.exports = { validateCreateIntent, validateWebhook };
