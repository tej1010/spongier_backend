const { messages, status } = require('../../../helper/api.responses');
const { handleServiceError } = require('../../../helper/utilities.services');
const UserModel = require('../model');

/**
 * User Settings Services
 * Handles 2FA, notification preferences, and streak management
 */

/**
 * Update Two Factor Authentication flag
 */
const updateTwoFactorAuthentication = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const userId = req.user._id;
    const { bTwoFactorAuthentication } = req.body;

    const updated = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { bTwoFactorAuthentication: Boolean(bTwoFactorAuthentication) } },
      { new: true, runValidators: true, readPreference: 'primary' }
    ).select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens');

    if (!updated) {
      return res.status(status.NotFound).json({ success: false, message: messages[lang].userNotFound, data: {}, error: {} });
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].twoFactorUpdated || 'Updated successfully',
      data: { bTwoFactorAuthentication: updated.bTwoFactorAuthentication },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'twoFactorUpdatedFailed' });
  }
};

/**
 * Update Notification Preferences
 */
const updateNotificationPreference = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const userId = req.user._id;
    const { oNotificationPreference } = req.body;

    const setObj = {};
    if (oNotificationPreference && typeof oNotificationPreference === 'object') {
      if (typeof oNotificationPreference.bEmail === 'boolean') setObj['oNotificationPreference.bEmail'] = oNotificationPreference.bEmail;
      if (typeof oNotificationPreference.bPush === 'boolean') setObj['oNotificationPreference.bPush'] = oNotificationPreference.bPush;
      if (typeof oNotificationPreference.bPhone === 'boolean') setObj['oNotificationPreference.bPhone'] = oNotificationPreference.bPhone;
    }

    const updated = await UserModel.findByIdAndUpdate(
      userId,
      { $set: setObj },
      { new: true, runValidators: true, readPreference: 'primary' }
    ).select('oNotificationPreference');

    if (!updated) {
      return res.status(status.NotFound).json({ success: false, message: messages[lang].userNotFound, data: {}, error: {} });
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].notificationPreferenceUpdated || 'Updated successfully',
      data: { oNotificationPreference: updated.oNotificationPreference },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'notificationPreferenceUpdatedFailed' });
  }
};

/**
 * Get user streak
 */
const getUserStreak = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(status.Unauthorized).json({ success: false, message: messages[lang].err_unauthorized, data: {}, error: {} });
    }

    const user = await UserModel.findById(userId, { oStreak: 1, dLastSeen: 1, aParents: 1, aChildren: 1 }, { readPreference: 'primary' })
      .populate('aParents', 'sName sEmail sPhone eRole')
      .populate('aChildren', 'sName sEmail sPhone eRole')
      .lean();

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].success || 'Success',
      data: {
        oStreak: user?.oStreak || {},
        dLastSeen: user?.dLastSeen || null,
        aParents: user?.aParents || [],
        aChildren: user?.aChildren || []
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'internalServerError' });
  }
};

module.exports = {
  updateTwoFactorAuthentication,
  updateNotificationPreference,
  getUserStreak
};
