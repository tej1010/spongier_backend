// videoView.validators.js
const { param, body } = require('express-validator');

// Validate record view
const validateRecordView = [
  param('id').isMongoId().withMessage('Invalid video ID'),
  body('sDeviceType').optional().isString().withMessage('Device type must be a string'),
  body('sDeviceOS').optional().isString().withMessage('Device OS must be a string'),
  body('sBrowser').optional().isString().withMessage('Browser must be a string')
];

module.exports = {
  validateRecordView
};
