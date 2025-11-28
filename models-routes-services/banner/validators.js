// banner.validators.js
const { check, query, param } = require('express-validator');
const { eStatus, eBannerKey } = require('../../data');
const { PAGINATION_LIMIT } = require('../../config/common');

const validateCreateBanner = [
  check('sTitle').notEmpty().withMessage('Title is required').trim(),
  check('sImageUrl').notEmpty().withMessage('Image URL is required').trim(),
  check('sSubtitle').optional().isString(),
  check('eKey').optional().isIn(eBannerKey.value),
  check('sRedirectUrl').optional().isString(),
  check('iOrder').isInt({ min: 0 }).withMessage('Order must be a positive integer'),
  check('eStatus').optional().isIn(eStatus.value),
  check('bFeature').optional().isBoolean()
];

const validateUpdateBanner = [
  param('id').isMongoId().withMessage('Invalid banner ID'),
  check('sTitle').optional().notEmpty().trim(),
  check('sImageUrl').optional().notEmpty().trim(),
  check('sSubtitle').optional().isString(),
  check('eKey').optional().isIn(eBannerKey.value),
  check('sRedirectUrl').optional().isString(),
  check('iOrder').optional().isInt({ min: 0 }),
  check('eStatus').optional().isIn(eStatus.value),
  check('bFeature').optional().isBoolean()
];

const validateGetBanner = [
  param('id').isMongoId().withMessage('Invalid banner ID')
];

const validateDeleteBanner = [
  param('id').isMongoId().withMessage('Invalid banner ID')
];

const validateListBanners = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }),
  query('search').optional().isString(),
  query('status').optional().isIn(eStatus.value),
  query('key').optional().isString(),
  query('sortBy').optional().isIn(['sTitle', 'eKey', 'iOrder', 'dCreatedAt']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
];

module.exports = {
  validateCreateBanner,
  validateUpdateBanner,
  validateGetBanner,
  validateDeleteBanner,
  validateListBanners
};
