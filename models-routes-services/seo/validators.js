const { body, param, query } = require('express-validator');
const enums = require('../../data');

const createSEOValidator = [
  body('iId')
    .notEmpty()
    .withMessage('Reference ID is required.')
    .isMongoId()
    .withMessage('Invalid reference ID.'),
  body('eType')
    .notEmpty()
    .withMessage('Type is required.')
    .withMessage('Invalid SEO type.'),
  body('eSubType').optional().isString().withMessage('Invalid subtype.'),
  body('sTitle').optional().isString(),
  body('sDescription')
    .notEmpty()
    .withMessage('Description is required.')
    .isString(),
  body('sSlug').optional().isString(),
  body('aKeywords').optional().isArray(),
  body('oFB').optional().isObject(),
  body('oTwitter').optional().isObject(),
  body('eStatus').optional().isIn(enums.eStatus.value)
];

const updateSEOValidator = createSEOValidator.map((v) => v.optional());

const idValidator = [param('id').isMongoId().withMessage('Invalid ID format.')];

// Validator for GetSeosBySlug: accept from query or body
const getSeosBySlugValidator = [
  query('slug').optional().isString().trim().notEmpty().withMessage('Invalid slug.'),
  query('slugs')
    .optional()
    .custom((value) => {
      if (Array.isArray(value)) return value.every((s) => typeof s === 'string' && s.trim().length > 0);
      if (typeof value === 'string') return value.split(',').every((s) => s.trim().length > 0);
      return false;
    })
    .withMessage('Invalid slugs list.'),
  body('slug').optional().isString().trim().notEmpty().withMessage('Invalid slug.'),
  body('slugs')
    .optional()
    .custom((value) => {
      if (Array.isArray(value)) return value.every((s) => typeof s === 'string' && s.trim().length > 0);
      if (typeof value === 'string') return value.split(',').every((s) => s.trim().length > 0);
      return false;
    })
    .withMessage('Invalid slugs list.')
];

module.exports = {
  createSEOValidator,
  updateSEOValidator,
  idValidator,
  getSeosBySlugValidator
};
