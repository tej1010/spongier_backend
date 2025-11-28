// subscription.routes.js
const express = require('express');
const router = express.Router();
const { unifiedSubscriptionValidation, premiumSubscriptionValidation } = require('./validators');
const { handleValidation } = require('../../helper/utilities.services');
const { isUserAuthenticated } = require('../../middlewares/middleware');
const { handleUnifiedSubscription, premiumSubscription, userSubscription, getUserSubscription, cancelUserSubscription } = require('./services');

// Unified subscription route that handles all subscription operations (admin-only, write)
router.post('/subscription/v1', unifiedSubscriptionValidation, handleValidation, handleUnifiedSubscription);
// router.post('/subscription/v1', validateAdmin('SUBSCRIPTION', data.eAdminPermission.map.WRITE), unifiedSubscriptionValidation, handleValidation, handleUnifiedSubscription);
router.post('/user/subscription/premium/v1', isUserAuthenticated, premiumSubscriptionValidation, handleValidation, premiumSubscription);

router.post('/user/subscription/v1', isUserAuthenticated, userSubscription);
router.get('/user/subscription/v1', isUserAuthenticated, getUserSubscription);
router.post('/user/subscription/cancel/v1', isUserAuthenticated, cancelUserSubscription);

module.exports = router;
