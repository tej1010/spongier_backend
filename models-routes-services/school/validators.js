const { query } = require('express-validator');
const { PAGINATION_LIMIT } = require('../../config/common');

const validateGetSchoolsList = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }),
  query('start').optional().isInt({ min: 0 }),
  query('search').optional().isString()
];

module.exports = {
  validateGetSchoolsList
};
