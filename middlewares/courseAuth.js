// courseAuth.js - Course-specific authorization middleware
const jwt = require('jsonwebtoken');
const { messages, status, jsonStatus } = require('../helper/api.responses');
const config = require('../config/config');
const { ObjectId } = require('../helper/utilities.services');
const UserModel = require('../models-routes-services/user/model');
const AdminsModel = require('../models-routes-services/admin/model');

/**
 * Middleware to validate admin access for course management (Create, Update, Delete operations)
 * Only SUPER admin or SUB admin with proper permissions can perform these operations
 */
const validateCourseAdminAccess = (operation) => {
  return async (req, res, next) => {
    try {
      const token = req.header('Authorization');

      if (!token) {
        return res.status(status.Unauthorized).jsonp({
          status: jsonStatus.Unauthorized,
          message: messages[req.userLanguage].err_unauthorized
        });
      }

      let admin;

      try {
        admin = await AdminsModel.findByToken(token, req?.sTokenTypeProvider);
      } catch (err) {
        return res.status(status.Unauthorized).jsonp({
          status: jsonStatus.Unauthorized,
          message: messages[req.userLanguage].err_unauthorized
        });
      }

      if (!admin) {
        return res.status(status.Unauthorized).jsonp({
          status: jsonStatus.Unauthorized,
          message: messages[req.userLanguage].err_unauthorized
        });
      }

      // Set admin in request
      req.admin = admin;

      // SUPER admin has full access
      if (admin.eType === 'SUPER') {
        return next();
      }

      // SUB admin needs specific permissions
      if (admin.eType === 'SUB') {
        if (!admin.aRole || admin.aRole.length === 0) {
          return res.status(status.Forbidden).jsonp({
            status: jsonStatus.Forbidden,
            message: messages[req.userLanguage].accessDenied
          });
        }

        // Check if admin has course management permissions
        // You can customize this based on your permission structure
        const hasCoursePermission = true; // Placeholder - implement based on your permission system

        if (!hasCoursePermission) {
          return res.status(status.Forbidden).jsonp({
            status: jsonStatus.Forbidden,
            message: messages[req.userLanguage].accessDeniedForOperation.replace('{operation}', operation)
          });
        }

        return next();
      }

      return res.status(status.Forbidden).jsonp({
        status: jsonStatus.Forbidden,
        message: messages[req.userLanguage].accessDenied
      });
    } catch (error) {
      console.log('Course admin auth error:', error);
      return res.status(status.InternalServerError).jsonp({
        status: jsonStatus.InternalServerError,
        message: messages[req.userLanguage].error
      });
    }
  };
};

/**
 * Middleware to validate user access for course viewing (Read operations)
 * Students, Parents, and Teachers can view content within their subscription period
 */
const validateCourseUserAccess = async (req, res, next) => {
  try {
    const token = req.header('Authorization');

    if (!token) {
      return res.status(status.Unauthorized).jsonp({
        status: jsonStatus.Unauthorized,
        message: messages[req.userLanguage].err_unauthorized
      });
    }

    let user;

    try {
      // Verify JWT token for user
      user = jwt.verify(token, config.JWT_SECRET_USER);
    } catch (err) {
      return res.status(status.Unauthorized).jsonp({
        status: jsonStatus.Unauthorized,
        message: messages[req.userLanguage].err_unauthorized
      });
    }

    if (!user) {
      return res.status(status.Unauthorized).jsonp({
        status: jsonStatus.Unauthorized,
        message: messages[req.userLanguage].err_unauthorized
      });
    }

    // Check if user is blocked
    if (user.eType === '2' || user.eType === 'B') {
      return res.status(status.NotFound).jsonp({
        status: jsonStatus.NotFound,
        message: messages[req.userLanguage].user_blocked
      });
    }

    // Set user in request
    req.user = user;
    req.user._id = ObjectId(user._id);
    req.user.eUserType = 'U';

    // Validate user role (student, parent, teacher)
    const allowedRoles = ['student', 'parent', 'teacher'];
    if (!allowedRoles.includes(user.eRole)) {
      return res.status(status.Forbidden).jsonp({
        status: jsonStatus.Forbidden,
        message: messages[req.userLanguage].accessDeniedInvalidRole
      });
    }

    // Check subscription status
    const userWithSubscription = await UserModel.findById(user._id)
      .populate('iSubscriptionId')
      .lean();

    if (!userWithSubscription) {
      return res.status(status.NotFound).jsonp({
        status: jsonStatus.NotFound,
        message: messages[req.userLanguage].userNotFound
      });
    }

    // If user has no subscription, check if they're a teacher (might have different access)
    if (!userWithSubscription.iSubscriptionId) {
      if (user.eRole === 'teacher') {
        // Teachers might have different access rules - implement as needed
        return next();
      }
      return res.status(status.Forbidden).jsonp({
        status: jsonStatus.Forbidden,
        message: messages[req.userLanguage].noActiveSubscriptionFound
      });
    }

    const subscription = userWithSubscription.iSubscriptionId;

    // Check subscription status
    if (subscription.eStatus !== 'success') {
      return res.status(status.Forbidden).jsonp({
        status: jsonStatus.Forbidden,
        message: messages[req.userLanguage].subscriptionPaymentPending
      });
    }

    // Check subscription expiration
    const now = new Date();

    // Check trial end date
    if (subscription.dTrialEndDate && now > subscription.dTrialEndDate) {
      return res.status(status.Forbidden).jsonp({
        status: jsonStatus.Forbidden,
        message: messages[req.userLanguage].trialPeriodExpired
      });
    }

    // Check renewal date
    if (subscription.dTenewalDate && now > subscription.dTenewalDate) {
      return res.status(status.Forbidden).jsonp({
        status: jsonStatus.Forbidden,
        message: messages[req.userLanguage].subscriptionExpired
      });
    }

    // Set subscription info in request for potential use in controllers
    req.userSubscription = subscription;

    return next();
  } catch (error) {
    console.log('Course user auth error:', error);
    return res.status(status.InternalServerError).jsonp({
      status: jsonStatus.InternalServerError,
      message: messages[req.userLanguage].error
    });
  }
};

/**
 * Middleware to validate both admin and user access
 * Used for routes that can be accessed by both admins and authenticated users
 */
const validateCourseAccess = async (req, res, next) => {
  try {
    const token = req.header('Authorization');

    if (!token) {
      return res.status(status.Unauthorized).jsonp({
        status: jsonStatus.Unauthorized,
        message: messages[req.userLanguage].err_unauthorized
      });
    }

    // Try admin authentication first
    try {
      const admin = await AdminsModel.findByToken(token, req?.sTokenTypeProvider);
      if (admin) {
        req.admin = admin;
        req.isAdmin = true;
        return next();
      }
    } catch (err) {
      // Continue to user authentication
    }

    // Try user authentication
    try {
      const user = jwt.verify(token, config.JWT_SECRET_USER);
      if (user) {
        // Check if user is blocked
        if (user.eType === '2' || user.eType === 'B') {
          return res.status(status.NotFound).jsonp({
            status: jsonStatus.NotFound,
            message: messages[req.userLanguage].user_blocked
          });
        }

        req.user = user;
        req.user._id = ObjectId(user._id);
        req.user.eUserType = 'U';
        req.isUser = true;

        // Validate user role
        const allowedRoles = ['student', 'parent', 'teacher'];
        if (!allowedRoles.includes(user.eRole)) {
          return res.status(status.Forbidden).jsonp({
            status: jsonStatus.Forbidden,
            message: messages[req.userLanguage].accessDeniedInvalidRole
          });
        }

        // Check subscription for non-teachers
        if (user.eRole !== 'teacher') {
          const userWithSubscription = await UserModel.findById(user._id)
            .populate('iSubscriptionId')
            .lean();

          if (!userWithSubscription || !userWithSubscription.iSubscriptionId) {
            return res.status(status.Forbidden).jsonp({
              status: jsonStatus.Forbidden,
              message: messages[req.userLanguage].noActiveSubscriptionFound
            });
          }

          const subscription = userWithSubscription.iSubscriptionId;

          if (subscription.eStatus !== 'success') {
            return res.status(status.Forbidden).jsonp({
              status: jsonStatus.Forbidden,
              message: messages[req.userLanguage].subscriptionPaymentPending
            });
          }

          const now = new Date();

          if (subscription.dTrialEndDate && now > subscription.dTrialEndDate) {
            return res.status(status.Forbidden).jsonp({
              status: jsonStatus.Forbidden,
              message: messages[req.userLanguage].trialPeriodExpired
            });
          }

          if (subscription.dTenewalDate && now > subscription.dTenewalDate) {
            return res.status(status.Forbidden).jsonp({
              status: jsonStatus.Forbidden,
              message: messages[req.userLanguage].subscriptionExpired
            });
          }

          req.userSubscription = subscription;
        }

        return next();
      }
    } catch (err) {
      return res.status(status.Unauthorized).jsonp({
        status: jsonStatus.Unauthorized,
        message: messages[req.userLanguage].err_unauthorized
      });
    }

    return res.status(status.Unauthorized).jsonp({
      status: jsonStatus.Unauthorized,
      message: messages[req.userLanguage].err_unauthorized
    });
  } catch (error) {
    console.log('Course access error:', error);
    return res.status(status.InternalServerError).jsonp({
      status: jsonStatus.InternalServerError,
      message: messages[req.userLanguage].error
    });
  }
};

module.exports = {
  validateCourseAdminAccess,
  validateCourseUserAccess,
  validateCourseAccess
};
