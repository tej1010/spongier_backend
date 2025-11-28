const { body, query } = require('express-validator');
const { PAGINATION_LIMIT } = require('../../config/common');
const { eStatus, eBadgeTier, eBadgeType } = require('../../data');

const badgeTiers = eBadgeTier.value;
const badgeTypes = eBadgeType.value;

const optionalContextValidators = [
  body('iGradeId').optional().isMongoId(),
  body('iSubjectId').optional().isMongoId(),
  body('iTermId').optional().isMongoId()
];

const queryContextValidators = [
  query('gradeId').optional().isMongoId(),
  query('subjectId').optional().isMongoId(),
  query('termId').optional().isMongoId()
];

const validateCreateBadge = [
  body('sName').notEmpty().withMessage('Badge name is required').trim(),
  body('sDescription').notEmpty().withMessage('Badge description is required').trim(),
  body('sIcon').optional().isString(),
  body('eTier').optional().isIn(badgeTiers),
  body('eType').optional().isIn(badgeTypes),
  body('nMinimumVideos').optional().isInt({ min: 0 }).withMessage('nMinimumVideos must be at least 0'),
  body('oRule').optional().isObject(),
  body('oRule.nMinimumVideos').optional().isInt({ min: 0 }).withMessage('oRule.nMinimumVideos must be at least 0'),
  body('oRule.nMinimumSubjects').optional().isInt({ min: 1 }).withMessage('oRule.nMinimumSubjects must be at least 1'),
  body('oRule.nMinimumStreakDays').optional().isInt({ min: 1 }).withMessage('oRule.nMinimumStreakDays must be at least 1'),
  body('oRule.nMinimumPercentage').optional().isInt({ min: 1, max: 100 }).withMessage('oRule.nMinimumPercentage must be between 1 and 100'),
  body('eStatus').optional().isIn(eStatus.value),
  ...optionalContextValidators
];

const validateListBadges = [
  query('limit').optional().isInt({ min: 1, max: PAGINATION_LIMIT }),
  query('start').optional().isInt({ min: 0 }),
  query('sortBy').optional().isIn(['dCreatedAt', 'sName', 'nMinimumVideos']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
  query('eStatus').optional().isIn(eStatus.value),
  query('eType').optional().isIn(badgeTypes),
  ...queryContextValidators
];

const validateGetUserBadges = [
  query('type').optional().isIn(badgeTypes)
];

module.exports = {
  validateCreateBadge,
  validateListBadges,
  validateGetUserBadges
};
