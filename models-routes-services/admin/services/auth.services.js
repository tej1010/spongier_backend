const jwt = require('jsonwebtoken');
const useragent = require('useragent');
const { messages, status } = require('../../../helper/api.responses');
const { handleServiceError, getCountryFromIP } = require('../../../helper/utilities.services');
const AdminModel = require('../model');
const AdminLoginHistoryModel = require('../loginHistory/model');
const { signRefreshToken, verifyRefreshToken } = require('../../../helper/token.util');
const { sendMailNodeMailer } = require('../../../helper/mail.services');
const { FRONTEND_HOST_URL } = require('../../../config/defaultConfig');

/**
 * Admin Authentication Services
 * Handles admin login, token management, password reset
 */

/**
 * Admin login
 */
const login = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { sEmailOrUsername, sPassword } = req.body;

    if (!sEmailOrUsername || !sPassword) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'emailOrUsernameRequired' });
    }

    const admin = await AdminModel.findByCredentials(sEmailOrUsername, sPassword);
    if (!admin) {
      try {
        const agent = useragent.parse(req.headers['user-agent'] || '');
        await AdminLoginHistoryModel.create({
          iAdminId: null,
          sIp: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null,
          sUserAgent: req.headers['user-agent'] || null,
          sBrowser: agent.family || null,
          sOs: agent.os?.family || null,
          sDevice: agent.device?.family || null,
          sCountry: getCountryFromIP((req.headers['x-forwarded-for'] || req.ip || '').split(',')[0]) || null,
          eStatus: 'failed'
        });
      } catch (_) { }
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'incorrectCredentials' });
    }

    // Check if admin is active
    if (admin.eStatus !== 'Y') {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'accountDeactivated' });
    }

    // Issue access/refresh tokens
    const accessToken = admin.generateAuthToken();
    const refreshToken = signRefreshToken({ _id: admin._id.toString(), eType: admin.eType });

    // Persist refresh
    let decodedRefresh;
    try { decodedRefresh = verifyRefreshToken(refreshToken); } catch (_) { }
    const dExpiresAt = decodedRefresh?.exp ? new Date(decodedRefresh.exp * 1000) : undefined;
    await AdminModel.updateOne(
      { _id: admin._id },
      {
        $push: {
          aRefreshTokens: {
            sToken: refreshToken,
            dExpiresAt,
            sUserAgent: req.headers['user-agent'] || null,
            sIp: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null
          }
        }
      }
    );

    // Return admin data without sensitive information
    const adminData = admin.toObject();
    delete adminData.sPassword;
    delete adminData.sResetToken;

    try {
      const agent = useragent.parse(req.headers['user-agent'] || '');
      await AdminLoginHistoryModel.create({
        iAdminId: admin._id,
        sIp: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null,
        sUserAgent: req.headers['user-agent'] || null,
        sBrowser: agent.family || null,
        sOs: agent.os?.family || null,
        sDevice: agent.device?.family || null,
        sCountry: getCountryFromIP((req.headers['x-forwarded-for'] || req.ip || '').split(',')[0]) || null,
        eStatus: 'success'
      });
    } catch (_) { }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].loginSuccessful,
      data: { accessToken, refreshToken, admin: adminData },
      error: {}
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return handleServiceError(error, req, res, { messageKey: 'failedToLogin' });
  }
};

/**
 * Refresh admin token
 */
const refreshToken = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const token = req.body.refreshToken || req.header('x-refresh-token');
    if (!token) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'refreshTokenRequired' });
    }
    let decoded;
    try { decoded = verifyRefreshToken(token); } catch (e) {
      return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
    }
    const admin = await AdminModel.findById(decoded._id, null, { readPreference: 'primary' }).select('+aRefreshTokens.sToken').exec();
    if (!admin) {
      return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
    }
    const exists = (admin.aRefreshTokens || []).some(rt => rt.sToken === token);
    if (!exists) {
      return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
    }
    const newAccess = admin.generateAuthToken();
    const newRefresh = signRefreshToken({ _id: admin._id.toString(), eType: admin.eType });
    let dec;
    try { dec = verifyRefreshToken(newRefresh); } catch (_) { }
    const dExpiresAt = dec?.exp ? new Date(dec.exp * 1000) : undefined;
    await AdminModel.updateOne({ _id: admin._id }, { $pull: { aRefreshTokens: { sToken: token } } });
    await AdminModel.updateOne({ _id: admin._id }, {
      $push: {
        aRefreshTokens: {
          sToken: newRefresh,
          dExpiresAt,
          sUserAgent: req.headers['user-agent'] || null,
          sIp: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null
        }
      }
    });
    return res.status(status.OK).json({
      success: true,
      message: messages[lang].tokenRefreshed,
      data: { accessToken: newAccess, refreshToken: newRefresh },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRefreshToken' });
  }
};

/**
 * Issue new access token for admin using a valid refresh token (no rotation)
 */
const accessToken = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const token = req.body.refreshToken || req.header('x-refresh-token');
    if (!token) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'refreshTokenRequired' });
    }
    let decoded;
    try { decoded = verifyRefreshToken(token); } catch (_) {
      return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
    }
    const admin = await AdminModel.findById(decoded._id, null, { readPreference: 'primary' }).select('+aRefreshTokens.sToken').exec();
    if (!admin) {
      return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
    }
    const exists = (admin.aRefreshTokens || []).some(rt => rt.sToken === token);
    if (!exists) {
      return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
    }
    const newAccess = admin.generateAuthToken();
    return res.status(status.OK).json({
      success: true,
      message: messages[lang].tokenRefreshed,
      data: { accessToken: newAccess },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToGenerateAccessToken' });
  }
};

/**
 * Logout admin (invalidate refresh)
 */
const logout = async (req, res) => {
  const lang = req.userLanguage;
  const token = req.body.refreshToken || req.header('x-refresh-token');
  try {
    if (!token) return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'refreshTokenRequired' });
    let decoded;
    try { decoded = verifyRefreshToken(token); } catch (_) { decoded = null; }
    if (!decoded || !decoded._id) return res.status(status.OK).json({ success: true, message: messages[lang].loggedOut, data: {}, error: {} });
    await AdminModel.updateOne({ _id: decoded._id }, { $pull: { aRefreshTokens: { sToken: token } } });
    return res.status(status.OK).json({ success: true, message: messages[lang].loggedOut, data: {}, error: {} });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'internalServerError' });
  }
};

/**
 * Forgot password -> email link
 */
const forgotPassword = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { sEmail } = req.body;

    if (!sEmail) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'emailRequired' });
    }

    const admin = await AdminModel.findOne({
      sEmail: sEmail.toLowerCase().trim()
    }).exec();

    if (!admin) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'userNotFound' });
    }

    const resetToken = jwt.sign({ _id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    admin.sResetToken = resetToken;
    await admin.save();

    const baseResetUrl = (process.env.ADMIN_APP_URL ||
      process.env.ADMIN_PORTAL_URL ||
      process.env.APP_URL ||
      process.env.FRONTEND_URL ||
      FRONTEND_HOST_URL || '').replace(/\/$/, '');
    const resetLink = `${baseResetUrl || FRONTEND_HOST_URL}/admin/reset-password/${resetToken}`;

    await sendMailNodeMailer({
      aTo: [admin.sEmail],
      sSubject: messages[lang].passwordResetSubject || 'Reset your administrator password',
      sTemplate: 'forgot-password',
      oTemplateBody: {
        name: admin.sName,
        content: resetLink
      }
    });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].passwordResetLinkSent,
      data: {},
      error: {}
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return handleServiceError(error, req, res, { messageKey: 'passwordResetFailed' });
  }
};

/**
 * Reset password
 */
const resetPassword = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { token, sNewPassword } = req.body;

    if (!token || !sNewPassword) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'tokenAndPasswordRequired' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await AdminModel.findById(decoded._id, null, { readPreference: 'primary' }).select('+sPassword +sResetToken').exec();

    if (!admin || admin.sResetToken !== token) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'invalidOrExpiredToken' });
    }

    admin.sPassword = sNewPassword;
    admin.sResetToken = undefined;
    await admin.save();

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].passwordUpdated,
      data: {},
      error: {}
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return handleServiceError(error, req, res, { messageKey: 'passwordUpdateFailed' });
  }
};

module.exports = {
  login,
  refreshToken,
  accessToken,
  logout,
  forgotPassword,
  resetPassword
};
