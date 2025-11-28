// user.services.js - Auth Services
const { eUserRoles } = require('../../../data');
const { messages, status } = require('../../../helper/api.responses');
const { generateOTP, validateEmail, handleServiceError, ObjectId } = require('../../../helper/utilities.services');
const UserModel = require('../model');
const SubscriptionModel = require('../../subscription/model');
const OTPVerificationsModel = require('../otpVerification/model');
const { signRefreshTokenUser, verifyRefreshTokenUser } = require('../../../helper/token.util');
const { sendMailNodeMailer } = require('../../../helper/mail.services');
const data = require('../../../data');
const config = require('../../../config/config');
const SPONSOR_STATIC_OTP = String(config.NEXT_PUBLIC_SPONSOR_STATIC_OTP || '').trim();
const { checkRateLimitOTP, getOTPExpiryStatus, getRateLimitStatus } = require('../../../helper/redis');
const { recordUserActivity } = require('../activity.services');
const { queueOTPSMS } = require('../../../helper/smsQueue.helper');
const { verifyMSG91OTP } = require('../../../helper/sms.service');

async function resolveUserIds (candidates, roleFilter) {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  const ids = [];
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === 'string' && c.match(/^[0-9a-fA-F]{24}$/)) { ids.push(c); continue; }
    if (typeof c === 'string' && c.includes('@')) {
      const u = await UserModel.findOne({ sEmail: c.toLowerCase().trim(), ...(roleFilter ? { eRole: roleFilter } : {}) }, { _id: 1 }, { readPreference: 'primary' }).lean();
      if (u?._id) ids.push(String(u._id));
      continue;
    }
    if (typeof c === 'string' && c.replace(/\D/g, '').length >= 8) {
      const u = await UserModel.findOne({ sPhone: c, ...(roleFilter ? { eRole: roleFilter } : {}) }, { _id: 1 }, { readPreference: 'primary' }).lean();
      if (u?._id) ids.push(String(u._id));
      continue;
    }
    if (typeof c === 'object') {
      const email = c.sEmail || c.email;
      const phone = c.sPhone || c.phone;
      if (email) {
        const u = await UserModel.findOne({ sEmail: String(email).toLowerCase().trim(), ...(roleFilter ? { eRole: roleFilter } : {}) }, { _id: 1 }, { readPreference: 'primary' }).lean();
        if (u?._id) ids.push(String(u._id));
        continue;
      }
      if (phone) {
        const u = await UserModel.findOne({ sPhone: String(phone), ...(roleFilter ? { eRole: roleFilter } : {}) }, { _id: 1 }, { readPreference: 'primary' }).lean();
        if (u?._id) ids.push(String(u._id));
        continue;
      }
    }
  }
  return Array.from(new Set(ids));
}

// Register
const register = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { eRole, sName, sEmail, sPassword, sPhone, iSchool, sSchool, iGradeId, aParents, aChildren, oAddress, oUserDetails, oSponsorDashboard, bTermsAndConditions, sCode, sType = data.eOtpType.map.MOBILE } = req.body;

    // Normalize relationship data ONLY from top-level arrays
    const normalizedParents = [eUserRoles.map.STUDENT].includes(eRole)
      ? await resolveUserIds(Array.isArray(aParents) ? aParents : (typeof aParents === 'string' ? aParents.split(',').map(s => s.trim()).filter(Boolean) : []), 'parent')
      : [];
    const normalizedChildren = [eUserRoles.map.PARENT].includes(eRole)
      ? await resolveUserIds(Array.isArray(aChildren) ? aChildren : (typeof aChildren === 'string' ? aChildren.split(',').map(s => s.trim()).filter(Boolean) : []), 'student')
      : [];

    const sLogin = sType === data.eOtpType.map.MOBILE ? sPhone : sEmail;
    const isOTPExist = await OTPVerificationsModel.findOne({ sLogin, sType, sAuth: data.eOtpAuth.map.REGISTER, sCode, bIsVerify: true }, null, { readPreference: 'primary' }).sort({ dCreatedAt: -1 }).lean();

    if (!isOTPExist || isOTPExist.sCode !== parseInt(sCode)) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'otpDoesNotMatch' });
    }

    // Check if the user already exists
    const email = sEmail.toLowerCase().trim();
    const existing = await UserModel.findOne({ sEmail: email, eStatus: data.eStatus.map.ACTIVE, bIsEmailVerified: true, bDelete: false }, null, { readPreference: 'primary' }).lean().exec();

    if (existing) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'emailExists' });
    }

    const mobileExists = await UserModel.findOne({ sPhone, bDelete: false }, null, { readPreference: 'primary' }).lean();
    if (mobileExists) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'mobileExists' });
    }

    const user = new UserModel({
      eRole,
      sName,
      sEmail: email,
      sPassword,
      sPhone,
      iSchool: iSchool || undefined,
      sSchool: sSchool || undefined,
      iGradeId: [eUserRoles.map.STUDENT].includes(eRole) ? iGradeId : undefined,
      aParents: [eUserRoles.map.STUDENT].includes(eRole) ? (normalizedParents.length ? normalizedParents : undefined) : undefined,
      aChildren: [eUserRoles.map.PARENT].includes(eRole) ? (normalizedChildren.length ? normalizedChildren : undefined) : undefined,
      oAddress: oAddress || undefined,
      oUserDetails: (function stripRelationKeysFromDetails (details) { if (!details || typeof details !== 'object') return details; const cloned = { ...details }; delete cloned.aParents; delete cloned.parents; delete cloned.aChildren; delete cloned.children; return cloned; })(oUserDetails) || undefined,
      oSponsorDashboard: oSponsorDashboard || undefined,
      bIsEmailVerified: false,
      bTermsAndConditions: Boolean(bTermsAndConditions) === true
    });

    const accessToken = user.generateAuthToken();
    const refreshToken = signRefreshTokenUser({ _id: user._id.toString(), eType: user.eType });

    // persist refresh token (multi-session)
    let decodedRefresh;
    try { decodedRefresh = verifyRefreshTokenUser(refreshToken); } catch (_) { }
    const dExpiresAt = decodedRefresh?.exp ? new Date(decodedRefresh.exp * 1000) : undefined;
    user.aRefreshTokens.push({
      sToken: refreshToken,
      dExpiresAt,
      sUserAgent: req.headers['user-agent'] || null,
      sIp: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null,
      sDeviceType: req.headers['x-device-type'] || data.eDeviceType.map.WEB
    });

    // Generate OTP for email verification
    // const otp = generateOTP(6);
    // const otp = 123456;
    // console.log('otp--------->', otp);
    // user.sOtp = otp;
    // user.dOtpExpiration = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await user.save();

    // Sync inverse links for parents/children on registration
    try {
      if ([eUserRoles.map.STUDENT].includes(eRole) && Array.isArray(aParents) && aParents.length) {
        await UserModel.updateMany({ _id: { $in: aParents } }, { $addToSet: { aChildren: user._id } });
      }
      if ([eUserRoles.map.PARENT].includes(eRole) && Array.isArray(aChildren) && aChildren.length) {
        await UserModel.updateMany({ _id: { $in: aChildren } }, { $addToSet: { aParents: user._id } });
      }
    } catch (_) { }

    // Populate relations for response
    const populatedUser = await UserModel.findById(user._id)
      .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
      .populate('aParents', 'sName sEmail sPhone eRole')
      .populate('aChildren', 'sName sEmail sPhone eRole')
      .populate('iSchool', 'sName sAddress sCity sState sCountry')
      .populate('iSubscriptionId')
      .lean();

    // send email (non-blocking)
    // sendMailNodeMailer({ aTo: [user.sEmail], sSubject: messages[lang].emailVerificationSubject, sTemplate: 'otp-email', oTemplateBody: { content: `Your OTP code is: ${otp}` } });

    const safe = {
      _id: populatedUser?._id || user._id,
      role: populatedUser?.eRole || user.eRole,
      name: populatedUser?.sName || user.sName,
      email: populatedUser?.sEmail || user.sEmail,
      phone: populatedUser?.sPhone || user.sPhone,
      school: populatedUser?.iSchool || user.iSchool || null,
      aParents: populatedUser?.aParents || [],
      aChildren: populatedUser?.aChildren || [],
      bIsEmailVerified: populatedUser?.bIsEmailVerified ?? user.bIsEmailVerified,
      bTermsAndConditions: populatedUser?.bTermsAndConditions ?? user.bTermsAndConditions,
      oAddress: populatedUser?.oAddress || user.oAddress || null,
      sImage: populatedUser?.sImage || user.sImage || '',
      oUserDetails: populatedUser?.oUserDetails || user.oUserDetails || null,
      oSponsorDashboard: populatedUser?.oSponsorDashboard || user.oSponsorDashboard || null,
      iSubscriptionId: populatedUser?.iSubscriptionId || null
    };
    let redirectUrl = '';
    switch (user.eRole) {
      case 'student':
        redirectUrl = '/student-portal';
        break;
      case 'parent':
        redirectUrl = '/parent-dashboard';
        break;
      case 'teacher':
        redirectUrl = '/school-admin-portal';
        break;
      case 'sponser':
        redirectUrl = '/sponsor-dashboard';
        break;
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].registrationSuccess,
      data: { accessToken, redirectUrl, user: safe },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'registrationFailed' });
  }
};

// Verify email
const verifyEmail = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { sEmail, sOtp } = req.body;
    const email = (sEmail || '').toLowerCase().trim();

    const user = await UserModel.findOne({ sEmail: email }, null, { readPreference: 'primary' }).select('+sOtp +dOtpExpiration').exec();
    if (!user) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'userNotFound' });
    }

    if (!user.sOtp || !user.dOtpExpiration || new Date() > user.dOtpExpiration) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'otpExpired' });
    }

    if (String(user.sOtp) !== String(sOtp)) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'otpInvalid', data: { message: messages[lang].otpDoesNotMatch } });
    }

    user.bIsEmailVerified = true;
    user.sOtp = undefined;
    user.dOtpExpiration = undefined;
    await user.save();

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].emailVerified,
      data: {},
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'verificationFailed' });
  }
};

// Resend OTP
const resendOtp = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { sEmail } = req.body;
    const email = (sEmail || '').toLowerCase().trim();
    const user = await UserModel.findOne({ sEmail: email }, null, { readPreference: 'primary' }).select('+sOtp +dOtpExpiration').exec();

    if (!user) {
      console.log('user not found');
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'userNotFound' });
    }

    if (user.bIsEmailVerified) {
      console.log('user already verified');
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'alreadyVerified' });
    }

    const otp = generateOTP(6);
    user.sOtp = otp;
    user.dOtpExpiration = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    // TODO: send email (non-blocking)
    // await sendEmail(user.sEmail, messages[lang].emailVerificationSubject, renderOtpTemplate({ otp, lang }));

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].otpResent,
      data: {},
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'otpResendFailed' });
  }
};

// Handle subscription selection and payment logic
const handleSubscriptionAndPayment = async (req, res) => {
  const lang = req.userLanguage;
  const { sEmail, eSubscriptionPlan, ePaymentStatus, seats, transactionId } = req.body;

  try {
    // Check if email is verified
    const user = await UserModel.findOne({ sEmail: sEmail.toLowerCase().trim() }, null, { readPreference: 'primary' }).exec();
    if (!user || !user.bIsEmailVerified) {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'emailNotVerified' });
    }

    // Create or update the subscription
    const subscriptionData = {
      userId: user._id,
      plan: eSubscriptionPlan,
      seats: seats || 0, // Default to 0 seats if not provided (e.g., for Freemium)
      status: ePaymentStatus === 'success' ? ePaymentStatus : ePaymentStatus.PENDING,
      paymentDetails: {
        transactionId: transactionId,
        paymentDate: new Date()
      },
      trialEndDate: eSubscriptionPlan === 'freemium' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null, // 7-day trial for Freemium
      renewalDate: eSubscriptionPlan === 'premium' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null // 30-day renewal for Premium
    };

    const existingSubscription = await SubscriptionModel.findOne({ userId: user._id }).exec();

    if (existingSubscription) {
      // Update existing subscription
      await SubscriptionModel.updateOne({ userId: user._id }, subscriptionData);
    } else {
      // Create new subscription
      const subscription = new SubscriptionModel(subscriptionData);
      await subscription.save();
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].subscriptionSuccess,
      data: {},
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'subscriptionOrPaymentFailed' });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { sEmail, sLogin, sPassword } = req.body; // TODO: Remove sEmail field from body

    // input presence/format validations are handled by validators
    const user = await UserModel.findByCredentials(sLogin || sEmail, sPassword);

    if (!user) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[req.userLanguage].incorrectCredentials,
        error: {}
      });
    }

    // issue tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = signRefreshTokenUser({ _id: user._id.toString(), eType: user.eType });

    // persist refresh token (multi-session)
    let decodedRefresh;
    try { decodedRefresh = verifyRefreshTokenUser(refreshToken); } catch (_) { }
    const dExpiresAt = decodedRefresh?.exp ? new Date(decodedRefresh.exp * 1000) : undefined;

    const aRefreshTokens = user?.aRefreshTokens?.filter(token => token.sDeviceType !== (req.headers['x-device-type'] || data.eDeviceType.map.WEB)) || [];
    aRefreshTokens.push({
      sToken: refreshToken,
      dExpiresAt,
      sUserAgent: req.headers['user-agent'] || null,
      sIp: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null,
      sDeviceType: req.headers['x-device-type'] || data.eDeviceType.map.WEB
    });

    await UserModel.updateOne({ _id: user._id }, { $set: { aRefreshTokens } });

    let redirectUrl = '';
    switch (user.eRole) {
      // case 'superadmin':
      //   redirectUrl = '/admin-portal';
      //   break;
      case 'student':
        redirectUrl = '/student-portal';
        break;
      case 'parent':
        redirectUrl = '/parent-dashboard';
        break;
      // case 'schooladmin':
      case 'teacher':
        redirectUrl = '/school-admin-portal';
        break;
    }

    // Record login activity (await to ensure first day counts immediately)
    try { await recordUserActivity(user._id, 'login'); } catch (_) { }

    // Populate relations for response
    const populatedUser = await UserModel.findById(user._id, { aRefreshTokens: 0 })
      // .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
      .populate({
        path: 'aParents',
        select: 'sName sEmail sPhone eRole',
        match: { bDelete: false }
      })
      .populate({
        path: 'aChildren',
        select: 'sName sEmail sPhone eRole',
        match: { bDelete: false }
      })
      .populate('iSchool', 'sName sAddress sCity sState sCountry')
      .populate('oAiTutorLanguage', 'sName sLocalName sFlagImage')
      .populate('iSubscriptionId');

    const userData = populatedUser.toObject({ getters: true, virtuals: true });

    // Filter out null values from populated arrays (deleted users)
    if (Array.isArray(userData.aChildren)) {
      userData.aChildren = userData.aChildren.filter(child => child !== null);
    }
    if (Array.isArray(userData.aParents)) {
      userData.aParents = userData.aParents.filter(parent => parent !== null);
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[req.userLanguage].loginSuccessful,
      data: { accessToken, refreshToken, redirectUrl, user: userData },
      error: {}
    });
  } catch (err) {
    return handleServiceError(err, req, res, { messageKey: 'internalServerError' });
  }
};

const refreshToken = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const token = req.body.refreshToken || req.header('x-refresh-token');
    if (!token) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'refreshTokenRequired' });
    }
    let decoded;
    try {
      decoded = verifyRefreshTokenUser(token);
    } catch (e) {
      return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
    }
    const user = await UserModel.findById(decoded._id, null, { readPreference: 'primary' }).select('+aRefreshTokens').exec();
    if (!user) {
      return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
    }
    const exists = (user.aRefreshTokens || []).some(rt => rt.sToken === token);
    if (!exists) {
      return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
    }
    // rotate refresh token
    const newAccess = user.generateAuthToken();
    const newRefresh = signRefreshTokenUser({ _id: user._id.toString(), eType: user.eType });

    let dec;
    try { dec = verifyRefreshTokenUser(newRefresh); } catch (_) { }
    const dExpiresAt = dec?.exp ? new Date(dec.exp * 1000) : undefined;

    const aRefreshTokens = user?.aRefreshTokens?.filter(oldToken => oldToken.sToken !== token) || [];
    aRefreshTokens.push({
      sToken: newRefresh,
      dExpiresAt,
      sUserAgent: req.headers['user-agent'] || null,
      sIp: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null,
      sDeviceType: req.headers['x-device-type'] || data.eDeviceType.map.WEB
    });

    await UserModel.updateOne({ _id: user._id }, { $set: { aRefreshTokens } }
    );
    return res.status(status.OK).json({ success: true, message: messages[lang].tokenRefreshed, data: { accessToken: newAccess, refreshToken: newRefresh }, error: {} });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'internalServerError' });
  }
};

// Issue new access token using a valid refresh token (do not rotate refresh)
const accessToken = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const token = req.body.refreshToken || req.header('x-refresh-token');
    if (!token) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'refreshTokenRequired' });
    }
    let decoded;
    try {
      decoded = verifyRefreshTokenUser(token);
    } catch (e) {
      return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
    }
    const user = await UserModel.findById(decoded._id, null, { readPreference: 'primary' }).select('+aRefreshTokens').exec();
    if (!user) {
      return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
    }
    const exists = (user.aRefreshTokens || []).some(rt => rt.sToken === token);
    if (!exists) {
      return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
    }
    const newAccess = user.generateAuthToken();
    return res.status(status.OK).json({ success: true, message: messages[lang].tokenRefreshed, data: { accessToken: newAccess }, error: {} });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'internalServerError' });
  }
};

// Logout -> invalidate refresh token and increment token version to invalidate all access tokens
const logout = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const token = req.body.refreshToken || req.header('x-refresh-token');
    if (!token) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'refreshTokenRequired' });
    }
    let decoded;
    try { decoded = verifyRefreshTokenUser(token); } catch (e) { decoded = null; }
    if (!decoded || !decoded._id) {
      return res.status(status.OK).json({ success: true, message: messages[lang].loggedOut, data: {}, error: {} });
    }
    // Remove refresh token and increment token version to invalidate all access tokens
    await UserModel.updateOne(
      { _id: decoded._id },
      {
        $pull: { aRefreshTokens: { $elemMatch: { sToken: token } } }
      }
    );
    return res.status(status.OK).json({ success: true, message: messages[lang].loggedOut, data: {}, error: {} });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'internalServerError' });
  }
};

const sendOTP = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { sLogin, sAuth, sType } = req.body;

    if (sAuth === data.eOtpAuth.map.REGISTER || sAuth === data.eOtpAuth.map.FORGOT_PASS) {
      const query = {};
      let message;
      if (sType === data.eOtpType.map.EMAIL) {
        query.sEmail = sLogin;
        message = messages[lang].emailExists;
      } else {
        query.sPhone = sLogin;
        message = messages[lang].mobileExists;
      }

      const user = await UserModel.findOne(query, null, { readPreference: 'primary' }).lean();
      if (user && sAuth === data.eOtpAuth.map.REGISTER) {
        return res.status(status.BadRequest).json({
          success: false,
          message,
          data: {},
          error: {}
        });
      }

      if (!user && sAuth === data.eOtpAuth.map.FORGOT_PASS) {
        return res.status(status.BadRequest).json({
          success: false,
          message: messages[lang].accountNotFound,
          data: {},
          error: {}
        });
      }
    }

    if (sAuth && sAuth === data.eOtpAuth.map.VERIFICATION && sType === data.eOtpType.map.EMAIL) {
      if (!req.header('Authorization')) {
        return res.status(status.Unauthorized).jsonp({ success: false, message: messages[req.userLanguage].err_unauthorized });
      }
      const oUser = await UserModel.findByToken(req.header('Authorization'));

      if (!oUser) return res.status(status.Unauthorized).jsonp({ success: false, message: messages[req.userLanguage].err_unauthorized });

      const isEmail = validateEmail(sLogin);
      if (!isEmail) return res.status(status.BadRequest).jsonp({ success: false, message: messages[req.userLanguage].invalidEmail });

      const query = { sEmail: sLogin };
      query._id = { $ne: oUser._id };

      const userExist = await UserModel.findOne(query, null, { readPreference: 'primary' });
      if (userExist) return res.status(status.ResourceExist).jsonp({ success: false, message: messages[req.userLanguage].userAlreadyExists });
    }

    if (config.NODE_ENV !== data.eEnv.map.DEVELOPMENT) {
      const [rateLimit, verifyRateLimit] = await Promise.all([
        checkRateLimitOTP(sLogin, sType, sAuth),
        getRateLimitStatus(sLogin, sType, `${sAuth}-V`) // check verify rate limit because if verification limit reached we can not send OTP
      ]);
      if (rateLimit === 'LIMIT_REACHED') {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'OtpSendLimitReached' });
      }

      if (verifyRateLimit === 'LIMIT_REACHED') {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'OtpSendLimitReached' });
      }
    }

    const d = new Date();
    d.setSeconds(d.getSeconds() - 30);
    const exist = await OTPVerificationsModel.findOne({ ...req.body, sLogin, dCreatedAt: { $gt: d } }, null, { readPreference: 'primary' }).sort({ dCreatedAt: -1 }).lean();

    if (exist) return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'err_resend_otp' });

    let sCode = 123456;
    if (config.NODE_ENV !== data.eEnv.map.DEVELOPMENT) sCode = generateOTP(6);

    await OTPVerificationsModel.create({ ...req.body, sLogin, sCode });

    // TODO: Template for register and forgot password
    if (sType === data.eOtpType.map.EMAIL) {
      sendMailNodeMailer({ aTo: [sLogin], sSubject: messages[lang].emailVerificationSubject, sTemplate: 'otp-email', oTemplateBody: { content: `${sCode}` } });
    } else {
      // Send SMS
      await queueOTPSMS({ sPhone: sLogin, OTP: sCode });
    }

    return res.status(status.OK).json({ success: true, message: messages[lang].OTP_sent_success, data: {}, error: {} });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToSendOTP' });
  }
};

const verifyOTP = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { sLogin, sAuth, sType, sCode } = req.body;
    const trimmedCode = String(sCode ?? '').trim();
    const parsedCode = parseInt(trimmedCode, 10);
    const isStaticSponsorOTP = SPONSOR_STATIC_OTP &&
      trimmedCode === SPONSOR_STATIC_OTP &&
      sAuth === data.eOtpAuth.map.REGISTER &&
      sType === data.eOtpType.map.MOBILE;

    if (isStaticSponsorOTP) {
      await OTPVerificationsModel.findOneAndUpdate(
        { sLogin, sAuth, sType },
        { sLogin, sAuth, sType, sCode: parsedCode, bIsVerify: true },
        { upsert: true, new: true, setDefaultsOnInsert: true, readPreference: 'primary' }
      );
      const message = messages[lang].mobileVerified;
      return res.status(status.OK).json({ success: true, message, data: {}, error: {} });
    }

    if (config.NODE_ENV !== data.eEnv.map.DEVELOPMENT) {
      const [rateLimit, expiredOTP] = await Promise.all([
        checkRateLimitOTP(sLogin, sType, `${sAuth}-V`),
        getOTPExpiryStatus(sLogin, sType, sAuth) // check verify rate limit because if verification limit reached we can not send OTP
      ]);

      if (rateLimit === 'LIMIT_REACHED') {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'OtpVerifyLimitReached' });
      }

      if (expiredOTP === 'EXPIRED') {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'OtpExpired' });
      }
    }

    const verificationQuery = { sLogin, sAuth, sType, bIsVerify: false, sCode: parsedCode };
    const exist = await OTPVerificationsModel.findOne(verificationQuery, null, { readPreference: 'primary' }).sort({ dCreatedAt: -1 }).lean();
    if (!exist) return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'invalidOTP' });

    if (sAuth && sAuth === data.eOtpAuth.map.VERIFICATION && sType === data.eOtpType.map.EMAIL) {
      if (!req.header('Authorization')) {
        return res.status(status.Unauthorized).jsonp({ success: false, message: messages[req.userLanguage].err_unauthorized });
      }

      const oUser = await UserModel.findByToken(req.header('Authorization'));

      if (!oUser) return res.status(status.Unauthorized).jsonp({ success: false, message: messages[req.userLanguage].err_unauthorized });

      const isEmail = validateEmail(sLogin);
      if (!isEmail) return res.status(status.BadRequest).jsonp({ success: false, message: messages[req.userLanguage].invalidEmail });

      const query = { sEmail: sLogin };
      query._id = { $ne: oUser._id };

      const userExist = await UserModel.findOne(query, null, { readPreference: 'primary' });
      if (userExist) return res.status(status.ResourceExist).jsonp({ success: false, message: messages[req.userLanguage].userAlreadyExists });

      await UserModel.updateOne({ _id: ObjectId(oUser._id) }, { sEmail: sLogin, bIsEmailVerified: true });
    }

    await OTPVerificationsModel.findByIdAndUpdate(exist._id, { bIsVerify: true }, { runValidators: true, readPreference: 'primary' }).lean();

    if (sType === data.eOtpType.map.MOBILE && config.NODE_ENV !== data.eEnv.map.DEVELOPMENT) {
      const msg91Sync = await verifyMSG91OTP({ sPhone: sLogin, OTP: parsedCode });
      if (!msg91Sync.success) {
        console.error('⚠️ Failed to sync OTP verification with MSG91:', msg91Sync.error || msg91Sync.message);
      }
    }

    const message = sType === data.eOtpType.map.EMAIL ? messages[lang].emailVerified : messages[lang].mobileVerified;
    return res.status(status.OK).json({ success: true, message, data: {}, error: {} });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'passwordUpdateFailed' });
  }
};

const checkExist = async (req, res) => {
  const lang = req.userLanguage;
  try {
    // Destructure request body properties
    const { sType, sValue } = req.body;
    let exist;
    let message;

    // Check user existence based on the provided type (Email, Mobile, Username) with additional validation
    if (sType === data.eOtpType.map.EMAIL) {
      // Validate email address
      if (!validateEmail(sValue.toLowerCase())) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'invalidEmail' });
      }
      exist = await UserModel.findOne({ sEmail: (sValue.toLowerCase()) }, { _id: 0, sEmail: 1 }, { readPreference: 'primary' }).lean();
      message = exist ? messages[lang].emailExists : messages[lang].emailNotExists;
    } else if (sType === data.eOtpType.map.MOBILE) {
      exist = await UserModel.findOne({ sPhone: sValue }, { _id: 0, sPhone: 1 }, { readPreference: 'primary' }).lean();
      message = exist ? messages[lang].mobileExists : messages[lang].mobileNotExists;
    }

    // Handle the response based on whether the user exists or not
    if (exist) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: Object.is(message, messages[lang].emailExists) ? 'emailExists' : 'mobileExists', data: { bExist: true } });
    } else {
      return res.status(status.OK).json({
        success: true,
        message: message,
        data: { bExist: false },
        error: {}
      });
    }
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToCheckExistence' });
  }
};

module.exports = {
  register,
  verifyEmail,
  resendOtp,
  login,
  handleSubscriptionAndPayment,
  refreshToken,
  accessToken,
  logout,
  sendOTP,
  verifyOTP,
  checkExist
};
