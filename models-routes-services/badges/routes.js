const express = require('express');
const router = express.Router();

const {
  createBadge,
  listBadges,
  listUserBadges,
  getUserBadgeProgress
} = require('./services');

const {
  validateCreateBadge,
  validateListBadges,
  validateGetUserBadges
} = require('./validators');

const { handleValidation } = require('../../helper/utilities.services');
const { validateAdmin, isUserAuthenticated } = require('../../middlewares/middleware');
const data = require('../../data');

router.post(
  '/admin/badge/create/v1',
  validateAdmin('QUIZ', data.eAdminPermission.map.WRITE),
  validateCreateBadge,
  handleValidation,
  createBadge
);

router.get(
  '/admin/badges/v1',
  validateAdmin('QUIZ', data.eAdminPermission.map.READ),
  validateListBadges,
  handleValidation,
  listBadges
);

router.get(
  '/user/badges/v1',
  isUserAuthenticated,
  validateGetUserBadges,
  handleValidation,
  listUserBadges
);

router.get(
  '/user/badge/progress/v1',
  isUserAuthenticated,
  handleValidation,
  getUserBadgeProgress
);

module.exports = router;
