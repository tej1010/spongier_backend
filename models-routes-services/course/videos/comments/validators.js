// videoComment.validators.js
const { body, param, query } = require('express-validator');

const validateAddComment = [
  body('iVideoId')
    .notEmpty()
    .withMessage('Video ID is required')
    .isMongoId()
    .withMessage('Invalid Video ID format'),

  body('sComment')
    .notEmpty()
    .withMessage('Comment text is required')
    .isString()
    .withMessage('Comment must be a string')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters'),

  body('iParentCommentId')
    .optional()
    .isMongoId()
    .withMessage('Invalid Parent Comment ID format')
];

const validateLikeComment = [
  param('id')
    .notEmpty()
    .withMessage('Comment ID is required')
    .isMongoId()
    .withMessage('Invalid Comment ID format')
];

const validateGetComments = [
  query('videoId')
    .notEmpty()
    .withMessage('Video ID is required')
    .isMongoId()
    .withMessage('Invalid Video ID format'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('start')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Start must be a non-negative integer'),

  query('sortBy')
    .optional()
    .isIn(['dCreatedAt', 'nLikeCount'])
    .withMessage('Sort by must be either dCreatedAt or nLikeCount'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be either asc or desc')
];

const validateGetReplies = [
  param('commentId')
    .notEmpty()
    .withMessage('Comment ID is required')
    .isMongoId()
    .withMessage('Invalid Comment ID format'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),

  query('start')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Start must be a non-negative integer')
];

const validateDeleteComment = [
  param('id')
    .notEmpty()
    .withMessage('Comment ID is required')
    .isMongoId()
    .withMessage('Invalid Comment ID format')
];

module.exports = {
  validateAddComment,
  validateLikeComment,
  validateGetComments,
  validateGetReplies,
  validateDeleteComment
};
