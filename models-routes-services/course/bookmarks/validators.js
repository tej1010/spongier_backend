// bookmarks.validators.js
const { body, query } = require('express-validator');
const { PAGINATION_LIMIT } = require('../../../config/common');

const validateAddBookmark = [
  body('iVideoId').notEmpty().isMongoId().withMessage('iVideoId must be a valid MongoID')
];

const validateRemoveBookmark = [
  body('iVideoId').notEmpty().isMongoId().withMessage('iVideoId must be a valid MongoID')
];

const validateListBookmarks = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: PAGINATION_LIMIT }).toInt()
];

module.exports = { validateAddBookmark, validateRemoveBookmark, validateListBookmarks };
