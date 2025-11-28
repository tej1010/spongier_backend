// videoLike.validators.js
const { param } = require('express-validator');

// Validate like video
const validateLikeVideo = [
  param('id').isMongoId().withMessage('Invalid video ID')
];

module.exports = {
  validateLikeVideo
};
