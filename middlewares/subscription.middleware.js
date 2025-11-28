const { status, messages } = require('../helper/api.responses');
const SubscriptionModel = require('../models-routes-services/subscription/model');
const { eSubscriptionPlan } = require('../data');

/**
 * Middleware to check if user has an active subscription
 * Allows access if:
 * - User has a premium subscription that hasn't expired
 * - User has a freemium subscription within trial period
 */
const checkSubscription = async (req, res, next) => {
  try {
    const user = req.user; // Assuming user is attached to request by auth middleware

    // Skip check for admin users
    if (user.eType === 'SUPER' || user.eType === 'SUB') {
      return next();
    }

    console.log('Checking subscription for user:', user);

    // Get user's subscription
    const subscription = await SubscriptionModel.findOne({ iUserId: user._id });

    if (!subscription) {
      return res.status(status.Forbidden).json({
        success: false,
        message: messages[req.userLanguage].noActiveSubscription,
        error: {}
      });
    }

    const now = new Date();
    let hasAccess = false;
    let message = '';

    // Check subscription type and validity
    if (subscription.ePlan === eSubscriptionPlan.map.PREMIUM) {
      // For premium, check renewal date
      if (subscription.dRenewalDate && subscription.dRenewalDate > now) {
        hasAccess = true;
      } else {
        message = 'Your premium subscription has expired. Please renew to continue accessing the content.';
      }
    } else if (subscription.ePlan === eSubscriptionPlan.map.FREEMIUM) {
      // For freemium, check trial end date
      if (subscription.dTrialEndDate && subscription.dTrialEndDate > now) {
        hasAccess = true;
      } else {
        message = 'Your free trial has ended. Please upgrade to a premium plan to continue accessing the content.';
      }
    }

    if (!hasAccess) {
      return res.status(status.Forbidden).json({
        success: false,
        message: message || 'Your subscription does not provide access to this content.',
        error: {}
      });
    }

    // Attach subscription info to request for use in controllers
    req.subscription = subscription;
    next();
  } catch (error) {
    console.error('Subscription check error:', error);
    return res.status(status.InternalServerError).json({
      success: false,
      message: messages[req.userLanguage].errorVerifyingSubscription,
      error: {}
    });
  }
};

module.exports = {
  checkSubscription
};
