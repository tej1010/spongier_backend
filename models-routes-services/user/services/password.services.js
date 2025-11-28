const jwt = require('jsonwebtoken');
const { messages, status } = require('../../../helper/api.responses');
const { handleServiceError, validateEmail } = require('../../../helper/utilities.services');
const UserModel = require('../model');
const OTPVerificationsModel = require('../otpVerification/model');
const { sendMailNodeMailer } = require('../../../helper/mail.services');

/**
 * Password Management Services
 * Handles password reset, change, and validation
 */

/**
 * Forgot Password - Generate Reset Token and Send Email
 */
const forgotPassword = async (req, res) => {
  const lang = req.userLanguage;
  const { sEmail } = req.body;

  try {
    // Check if the email exists
    const user = await UserModel.findOne({ sEmail: sEmail.toLowerCase().trim() }, null, { readPreference: 'primary' }).exec();
    if (!user) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'userNotFound' });
    }

    // Generate a unique reset token (JWT)
    const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const resetLink = `${process.env.APP_URL}/reset-password/${resetToken}`;

    sendMailNodeMailer({
      aTo: [user.sEmail],
      sSubject: messages[lang].passwordResetSubject,
      sTemplate: 'forgot-password',
      oTemplateBody: { name: user.sName, content: resetLink }
    });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].passwordResetLinkSent,
      data: {},
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'passwordResetFailed' });
  }
};

/**
 * Reset Password
 */
const resetPassword = async (req, res) => {
  const lang = req.userLanguage;
  try {
    let { sLogin, sType, sAuth, sCode, sNewPassword } = req.body;
    sCode = parseInt(sCode);

    const isOTPExist = await OTPVerificationsModel.findOne({ sLogin, sType, sAuth, sCode, bIsVerify: true }, null, { readPreference: 'primary' }).sort({ dCreatedAt: -1 });
    if (!isOTPExist || isOTPExist.sCode !== parseInt(sCode)) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang].otpDoesNotMatch,
        data: {},
        error: {}
      });
    }

    const isEmail = validateEmail(sLogin);
    const query = isEmail ? { sEmail: sLogin } : { sMobNum: sLogin };

    const user = await UserModel.findOne(query);
    if (!user) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'userNotFound' });
    }

    user.sPassword = sNewPassword;
    await user.save();

    await isOTPExist.remove();

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].passwordUpdated,
      data: {},
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'passwordUpdateFailed' });
  }
};

/**
 * Change password for authenticated user
 */
const changePassword = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const userId = req.user._id;
    const { sCurrentPassword, sNewPassword } = req.body;

    const user = await UserModel.findById(userId, null, { readPreference: 'primary' }).select('+sPassword');
    if (!user) {
      return res.status(status.NotFound).json({ success: false, message: messages[lang].userNotFound, data: {}, error: {} });
    }

    const bcrypt = require('bcrypt');
    const isMatch = await bcrypt.compare(sCurrentPassword, user.sPassword);
    if (!isMatch) {
      return res.status(status.BadRequest).json({ success: false, message: messages[lang].currentPasswordIncorrect, data: {}, error: {} });
    }

    user.sPassword = sNewPassword;
    await user.save();

    return res.status(status.OK).json({ success: true, message: messages[lang].passwordChanged, data: {}, error: {} });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'errorChangingPassword' });
  }
};

module.exports = {
  forgotPassword,
  resetPassword,
  changePassword
};
