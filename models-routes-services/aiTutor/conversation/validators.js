const { body, query } = require('express-validator');
const { PAGINATION_LIMIT } = require('../../../config/common');

const validateCreateConversation = [
  body('iSessionId').not().isEmpty(),
  body('sMessage').not().isEmpty()
];

const validateListConversation = [
  query('iSessionId').not().isEmpty(),
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
];

module.exports = {
  validateCreateConversation,
  validateListConversation
};
