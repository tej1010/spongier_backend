// subscriptionPlan.routes.js
const router = require('express').Router();
const {
  createSubscriptionPlan,
  getSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  listSubscriptionPlans,
  listUserSubscriptionPlans
} = require('./services');
const {
  validateCreateSubscriptionPlan,
  validateUpdateSubscriptionPlan,
  validateGetSubscriptionPlan,
  validateDeleteSubscriptionPlan,
  validateListSubscriptionPlans
} = require('./validators');
const { isAdminAuthenticated, isUserAuthenticated } = require('../../../middlewares/middleware');

// Admin routes for subscription plan management
router.post('/admin/subscription-plan/create/v1', validateCreateSubscriptionPlan, isAdminAuthenticated, createSubscriptionPlan);
router.get('/admin/subscription-plan/list/v1', validateListSubscriptionPlans, isAdminAuthenticated, listSubscriptionPlans);
router.get('/admin/subscription-plan/:id/v1', validateGetSubscriptionPlan, isAdminAuthenticated, getSubscriptionPlan);
router.put('/admin/subscription-plan/:id/v1', validateUpdateSubscriptionPlan, isAdminAuthenticated, updateSubscriptionPlan);
router.delete('/admin/subscription-plan/:id/v1', validateDeleteSubscriptionPlan, isAdminAuthenticated, deleteSubscriptionPlan);

router.get('/user/subscription-plan/list/v1', isUserAuthenticated, listUserSubscriptionPlans); // Pending List user plans

module.exports = router;
