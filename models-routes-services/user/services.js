module.exports = require('./services/index');
// // user.services.js
// const { eUserRoles } = require('../../data');
// const { messages, status } = require('../../helper/api.responses');
// const { generateOTP, validateEmail, handleServiceError } = require('../../helper/utilities.services');
// const UserModel = require('./model');
// const SubscriptionModel = require('../subscription/model');
// const OTPVerificationsModel = require('./otpVerification/model');
// const GradeModel = require('../course/grades/model');
// const SubjectModel = require('../course/subjects/model');
// const VideoModel = require('../course/videos/model');
// const VideoWatchHistoryModel = require('../course/videos/watchHistory/model');
// const jwt = require('jsonwebtoken');
// const { signRefreshToken, verifyRefreshToken } = require('../../helper/token.util');
// const bcrypt = require('bcrypt');
// const { sendMailNodeMailer, sendStudentInvitationEmail } = require('../../helper/mail.services');
// const { getPaginationValues2 } = require('../../helper/utilities.services');
// const data = require('../../data');
// const config = require('../../config/config');
// const { DEFAULT_STUDENT_PASSWORD } = require('../../config/defaultConfig');
// const { checkRateLimitOTP, getOTPExpiryStatus, getRateLimitStatus } = require('../../helper/redis');
// const { signedUrl } = require('../../helper/s3config');
// const { recordUserActivity } = require('./activity.services');

// async function resolveUserIds (candidates, roleFilter) {
//   if (!Array.isArray(candidates) || candidates.length === 0) return [];
//   const ids = [];
//   for (const c of candidates) {
//     if (!c) continue;
//     if (typeof c === 'string' && c.match(/^[0-9a-fA-F]{24}$/)) { ids.push(c); continue; }
//     if (typeof c === 'string' && c.includes('@')) {
//       const u = await UserModel.findOne({ sEmail: c.toLowerCase().trim(), ...(roleFilter ? { eRole: roleFilter } : {}) }, { _id: 1 }, { readPreference: 'primary' }).lean();
//       if (u?._id) ids.push(String(u._id));
//       continue;
//     }
//     if (typeof c === 'string' && c.replace(/\D/g, '').length >= 8) {
//       const u = await UserModel.findOne({ sPhone: c, ...(roleFilter ? { eRole: roleFilter } : {}) }, { _id: 1 }, { readPreference: 'primary' }).lean();
//       if (u?._id) ids.push(String(u._id));
//       continue;
//     }
//     if (typeof c === 'object') {
//       const email = c.sEmail || c.email;
//       const phone = c.sPhone || c.phone;
//       if (email) {
//         const u = await UserModel.findOne({ sEmail: String(email).toLowerCase().trim(), ...(roleFilter ? { eRole: roleFilter } : {}) }, { _id: 1 }, { readPreference: 'primary' }).lean();
//         if (u?._id) ids.push(String(u._id));
//         continue;
//       }
//       if (phone) {
//         const u = await UserModel.findOne({ sPhone: String(phone), ...(roleFilter ? { eRole: roleFilter } : {}) }, { _id: 1 }, { readPreference: 'primary' }).lean();
//         if (u?._id) ids.push(String(u._id));
//         continue;
//       }
//     }
//   }
//   return Array.from(new Set(ids));
// }

// function coerceIdList (input) {
//   if (Array.isArray(input)) return input;
//   if (input == null) return [];
//   if (typeof input === 'string') {
//     const trimmed = input.trim();
//     if (!trimmed) return [];
//     if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
//       try {
//         const parsed = JSON.parse(trimmed);
//         if (Array.isArray(parsed)) return parsed;
//         if (parsed && typeof parsed === 'object' && parsed._id) return [String(parsed._id)];
//       } catch (_) { /* fall through to comma split */ }
//     }
//     return trimmed.split(',').map(s => s.replace(/^["'\[]+|["'\]]+$/g, '').trim()).filter(Boolean);
//   }
//   if (typeof input === 'object') {
//     if (input._id) return [String(input._id)];
//     return [];
//   }
//   return [];
// }
// // Register
// const register = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { eRole, sName, sEmail, sPassword, sPhone, sSchool, iGradeId, aParents, aChildren, oAddress, oUserDetails, bTermsAndConditions, sCode, sType = data.eOtpType.map.MOBILE } = req.body;

//     // Normalize relationship data ONLY from top-level arrays
//     const normalizedParents = [eUserRoles.map.STUDENT].includes(eRole)
//       ? await resolveUserIds(Array.isArray(aParents) ? aParents : (typeof aParents === 'string' ? aParents.split(',').map(s => s.trim()).filter(Boolean) : []), 'parent')
//       : [];
//     const normalizedChildren = [eUserRoles.map.PARENT].includes(eRole)
//       ? await resolveUserIds(Array.isArray(aChildren) ? aChildren : (typeof aChildren === 'string' ? aChildren.split(',').map(s => s.trim()).filter(Boolean) : []), 'student')
//       : [];

//     const sLogin = sType === data.eOtpType.map.MOBILE ? sPhone : sEmail;
//     const isOTPExist = await OTPVerificationsModel.findOne({ sLogin, sType, sAuth: data.eOtpAuth.map.REGISTER, sCode, bIsVerify: true }, null, { readPreference: 'primary' }).sort({ dCreatedAt: -1 }).lean();

//     if (!isOTPExist || isOTPExist.sCode !== parseInt(sCode)) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'otpDoesNotMatch' });
//     }

//     // Check if the user already exists
//     const email = sEmail.toLowerCase().trim();
//     const existing = await UserModel.findOne({ sEmail: email, eStatus: data.eStatus.map.ACTIVE, bIsEmailVerified: true, bDelete: false }, null, { readPreference: 'primary' }).lean().exec();

//     if (existing) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'emailExists' });
//     }

//     const user = new UserModel({
//       eRole,
//       sName,
//       sEmail: email,
//       sPassword,
//       sPhone,
//       sSchool: [eUserRoles.map.TEACHER].includes(eRole) ? sSchool : undefined,
//       iGradeId: [eUserRoles.map.STUDENT].includes(eRole) ? iGradeId : undefined,
//       aParents: [eUserRoles.map.STUDENT].includes(eRole) ? (normalizedParents.length ? normalizedParents : undefined) : undefined,
//       aChildren: [eUserRoles.map.PARENT].includes(eRole) ? (normalizedChildren.length ? normalizedChildren : undefined) : undefined,
//       oAddress: oAddress || undefined,
//       oUserDetails: (function stripRelationKeysFromDetails (details) { if (!details || typeof details !== 'object') return details; const cloned = { ...details }; delete cloned.aParents; delete cloned.parents; delete cloned.aChildren; delete cloned.children; return cloned; })(oUserDetails) || undefined,
//       bIsEmailVerified: false,
//       bTermsAndConditions: Boolean(bTermsAndConditions) === true
//     });

//     const accessToken = user.generateAuthToken();
//     const refreshToken = signRefreshToken({ _id: user._id.toString(), eType: user.eType });

//     // persist refresh token (multi-session)
//     let decodedRefresh;
//     try { decodedRefresh = verifyRefreshToken(refreshToken); } catch (_) { }
//     const dExpiresAt = decodedRefresh?.exp ? new Date(decodedRefresh.exp * 1000) : undefined;
//     user.aRefreshTokens.push({
//       sToken: refreshToken,
//       dExpiresAt,
//       sUserAgent: req.headers['user-agent'] || null,
//       sIp: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null
//     });

//     // Generate OTP for email verification
//     // const otp = generateOTP(6);
//     // const otp = 123456;
//     // console.log('otp--------->', otp);
//     // user.sOtp = otp;
//     // user.dOtpExpiration = new Date(Date.now() + 15 * 60 * 1000); // 15 min

//     await user.save();

//     // Sync inverse links for parents/children on registration
//     try {
//       if ([eUserRoles.map.STUDENT].includes(eRole) && Array.isArray(aParents) && aParents.length) {
//         await UserModel.updateMany({ _id: { $in: aParents } }, { $addToSet: { aChildren: user._id } });
//       }
//       if ([eUserRoles.map.PARENT].includes(eRole) && Array.isArray(aChildren) && aChildren.length) {
//         await UserModel.updateMany({ _id: { $in: aChildren } }, { $addToSet: { aParents: user._id } });
//       }
//     } catch (_) { }

//     // Populate relations for response
//     const populatedUser = await UserModel.findById(user._id)
//       .select('-sPassword -sOtp -dOtpExpiration')
//       .populate('aParents', 'sName sEmail sPhone eRole')
//       .populate('aChildren', 'sName sEmail sPhone eRole')
//       .populate('iSubscriptionId')
//       .lean();

//     // send email (non-blocking)
//     // sendMailNodeMailer({ aTo: [user.sEmail], sSubject: messages[lang].emailVerificationSubject, sTemplate: 'otp-email', oTemplateBody: { content: `Your OTP code is: ${otp}` } });

//     const safe = {
//       _id: populatedUser?._id || user._id,
//       role: populatedUser?.eRole || user.eRole,
//       name: populatedUser?.sName || user.sName,
//       email: populatedUser?.sEmail || user.sEmail,
//       phone: populatedUser?.sPhone || user.sPhone,
//       school: populatedUser?.sSchool || user.sSchool || null,
//       aParents: populatedUser?.aParents || [],
//       aChildren: populatedUser?.aChildren || [],
//       bIsEmailVerified: populatedUser?.bIsEmailVerified ?? user.bIsEmailVerified,
//       bTermsAndConditions: populatedUser?.bTermsAndConditions ?? user.bTermsAndConditions,
//       oAddress: populatedUser?.oAddress || user.oAddress || null,
//       sImage: populatedUser?.sImage || user.sImage || '',
//       oUserDetails: populatedUser?.oUserDetails || user.oUserDetails || null,
//       iSubscriptionId: populatedUser?.iSubscriptionId || null
//     };
//     let redirectUrl = '';
//     switch (user.eRole) {
//       case 'student':
//         redirectUrl = '/student-portal';
//         break;
//       case 'parent':
//         redirectUrl = '/parent-dashboard';
//         break;
//       case 'teacher':
//         redirectUrl = '/school-admin-portal';
//         break;
//     }

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].registrationSuccess,
//       data: { accessToken, redirectUrl, user: safe },
//       error: {}
//     });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'registrationFailed' });
//   }
// };

// // Verify email
// const verifyEmail = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { sEmail, sOtp } = req.body;
//     const email = (sEmail || '').toLowerCase().trim();

//     const user = await UserModel.findOne({ sEmail: email }, null, { readPreference: 'primary' }).select('+sOtp +dOtpExpiration').exec();
//     if (!user) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'userNotFound' });
//     }

//     if (!user.sOtp || !user.dOtpExpiration || new Date() > user.dOtpExpiration) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'otpExpired' });
//     }

//     if (String(user.sOtp) !== String(sOtp)) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'otpInvalid', data: { message: messages[lang].otpDoesNotMatch } });
//     }

//     user.bIsEmailVerified = true;
//     user.sOtp = undefined;
//     user.dOtpExpiration = undefined;
//     await user.save();

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].emailVerified,
//       data: {},
//       error: {}
//     });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'verificationFailed' });
//   }
// };

// // Resend OTP
// const resendOtp = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { sEmail } = req.body;
//     const email = (sEmail || '').toLowerCase().trim();
//     const user = await UserModel.findOne({ sEmail: email }, null, { readPreference: 'primary' }).select('+sOtp +dOtpExpiration').exec();

//     if (!user) {
//       console.log('user not found');
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'userNotFound' });
//     }

//     if (user.bIsEmailVerified) {
//       console.log('user already verified');
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'alreadyVerified' });
//     }

//     const otp = generateOTP(6);
//     user.sOtp = otp;
//     user.dOtpExpiration = new Date(Date.now() + 15 * 60 * 1000);
//     await user.save();

//     // TODO: send email (non-blocking)
//     // await sendEmail(user.sEmail, messages[lang].emailVerificationSubject, renderOtpTemplate({ otp, lang }));

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].otpResent,
//       data: {},
//       error: {}
//     });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'otpResendFailed' });
//   }
// };

// // Handle subscription selection and payment logic
// const handleSubscriptionAndPayment = async (req, res) => {
//   const lang = req.userLanguage;
//   const { sEmail, eSubscriptionPlan, ePaymentStatus, seats, transactionId } = req.body;

//   try {
//     // Check if email is verified
//     const user = await UserModel.findOne({ sEmail: sEmail.toLowerCase().trim() }, null, { readPreference: 'primary' }).exec();
//     if (!user || !user.bIsEmailVerified) {
//       return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'emailNotVerified' });
//     }

//     // Create or update the subscription
//     const subscriptionData = {
//       userId: user._id,
//       plan: eSubscriptionPlan,
//       seats: seats || 0, // Default to 0 seats if not provided (e.g., for Freemium)
//       status: ePaymentStatus === 'success' ? ePaymentStatus : ePaymentStatus.PENDING,
//       paymentDetails: {
//         transactionId: transactionId,
//         paymentDate: new Date()
//       },
//       trialEndDate: eSubscriptionPlan === 'freemium' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null, // 7-day trial for Freemium
//       renewalDate: eSubscriptionPlan === 'premium' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null // 30-day renewal for Premium
//     };

//     const existingSubscription = await SubscriptionModel.findOne({ userId: user._id }).exec();

//     if (existingSubscription) {
//       // Update existing subscription
//       await SubscriptionModel.updateOne({ userId: user._id }, subscriptionData);
//     } else {
//       // Create new subscription
//       const subscription = new SubscriptionModel(subscriptionData);
//       await subscription.save();
//     }

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].subscriptionSuccess,
//       data: {},
//       error: {}
//     });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'subscriptionOrPaymentFailed' });
//   }
// };

// // Login
// const login = async (req, res) => {
//   try {
//     const { sEmail, sPassword } = req.body;

//     // input presence/format validations are handled by validators
//     const user = await UserModel.findByCredentials(sEmail, sPassword);

//     if (!user) {
//       return res.status(status.BadRequest).json({
//         success: false,
//         message: messages[req.userLanguage].incorrectCredentials,
//         error: {}
//       });
//     }

//     // issue tokens
//     const accessToken = user.generateAuthToken();
//     const refreshToken = signRefreshToken({ _id: user._id.toString(), eType: user.eType });

//     // persist refresh token (multi-session)
//     let decodedRefresh;
//     try { decodedRefresh = verifyRefreshToken(refreshToken); } catch (_) { }
//     const dExpiresAt = decodedRefresh?.exp ? new Date(decodedRefresh.exp * 1000) : undefined;
//     await UserModel.updateOne(
//       { _id: user._id },
//       {
//         $push: {
//           aRefreshTokens: {
//             sToken: refreshToken,
//             dExpiresAt,
//             sUserAgent: req.headers['user-agent'] || null,
//             sIp: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null
//           }
//         }
//       }
//     );
//     let redirectUrl = '';
//     switch (user.eRole) {
//       // case 'superadmin':
//       //   redirectUrl = '/admin-portal';
//       //   break;
//       case 'student':
//         redirectUrl = '/student-portal';
//         break;
//       case 'parent':
//         redirectUrl = '/parent-dashboard';
//         break;
//       // case 'schooladmin':
//       case 'teacher':
//         redirectUrl = '/school-admin-portal';
//         break;
//     }

//     // Record login activity (await to ensure first day counts immediately)
//     try { await recordUserActivity(user._id, 'login'); } catch (_) { }

//     // Populate relations for response
//     const populatedUser = await UserModel.findById(user._id)
//       // .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
//       .populate('aParents', 'sName sEmail sPhone eRole')
//       .populate('aChildren', 'sName sEmail sPhone eRole')
//       .populate('iSubscriptionId');

//     const userData = populatedUser.toObject({ getters: true, virtuals: true });

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[req.userLanguage].loginSuccessful,
//       data: { accessToken, refreshToken, redirectUrl, user: userData },
//       error: {}
//     });
//   } catch (err) {
//     return handleServiceError(err, req, res, { messageKey: 'internalServerError' });
//   }
// };

// const refreshToken = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const token = req.body.refreshToken || req.header('x-refresh-token');
//     if (!token) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'refreshTokenRequired' });
//     }
//     let decoded;
//     try {
//       decoded = verifyRefreshToken(token);
//     } catch (e) {
//       return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
//     }
//     const user = await UserModel.findById(decoded._id, null, { readPreference: 'primary' }).select('+aRefreshTokens').exec();
//     if (!user) {
//       return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
//     }
//     const exists = (user.aRefreshTokens || []).some(rt => rt.sToken === token);
//     if (!exists) {
//       return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
//     }
//     // rotate refresh token
//     const newAccess = user.generateAuthToken();
//     const newRefresh = signRefreshToken({ _id: user._id.toString(), eType: user.eType });

//     let dec;
//     try { dec = verifyRefreshToken(newRefresh); } catch (_) { }
//     const dExpiresAt = dec?.exp ? new Date(dec.exp * 1000) : undefined;
//     await UserModel.updateOne(
//       { _id: user._id, 'aRefreshTokens.sToken': { $ne: token } },
//       {
//         $push: {
//           aRefreshTokens: {
//             sToken: newRefresh,
//             dExpiresAt,
//             sUserAgent: req.headers['user-agent'] || null,
//             sIp: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null
//           }
//         }
//       }
//     );
//     return res.status(status.OK).json({ success: true, message: messages[lang].tokenRefreshed, data: { accessToken: newAccess, refreshToken: newRefresh }, error: {} });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'internalServerError' });
//   }
// };

// // Issue new access token using a valid refresh token (do not rotate refresh)
// const accessToken = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const token = req.body.refreshToken || req.header('x-refresh-token');
//     if (!token) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'refreshTokenRequired' });
//     }
//     let decoded;
//     try {
//       decoded = verifyRefreshToken(token);
//     } catch (e) {
//       return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
//     }
//     const user = await UserModel.findById(decoded._id, null, { readPreference: 'primary' }).select('+aRefreshTokens').exec();
//     if (!user) {
//       return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
//     }
//     const exists = (user.aRefreshTokens || []).some(rt => rt.sToken === token);
//     if (!exists) {
//       return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
//     }
//     const newAccess = user.generateAuthToken();
//     return res.status(status.OK).json({ success: true, message: messages[lang].tokenRefreshed, data: { accessToken: newAccess }, error: {} });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'internalServerError' });
//   }
// };

// // Logout -> invalidate a refresh token
// const logout = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const token = req.body.refreshToken || req.header('x-refresh-token');
//     if (!token) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'refreshTokenRequired' });
//     }
//     let decoded;
//     try { decoded = verifyRefreshToken(token); } catch (e) { decoded = null; }
//     if (!decoded || !decoded._id) {
//       return res.status(status.OK).json({ success: true, message: messages[lang].loggedOut, data: {}, error: {} });
//     }
//     await UserModel.updateOne({ _id: decoded._id }, { $pull: { aRefreshTokens: { sToken: token } } });
//     return res.status(status.OK).json({ success: true, message: messages[lang].loggedOut, data: {}, error: {} });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'internalServerError' });
//   }
// };
// // Forgot Password - Generate Reset Token and Send Email
// const forgotPassword = async (req, res) => {
//   const lang = req.userLanguage;
//   const { sEmail } = req.body;

//   try {
//     // Check if the email exists
//     const user = await UserModel.findOne({ sEmail: sEmail.toLowerCase().trim() }, null, { readPreference: 'primary' }).exec();
//     if (!user) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'userNotFound' });
//     }

//     // Generate a unique reset token (JWT)
//     const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
//     const resetLink = `${process.env.APP_URL}/reset-password/${resetToken}`; // need to add frontend url in env

//     sendMailNodeMailer({ aTo: [user.sEmail], sSubject: messages[lang].passwordResetSubject, sTemplate: 'forgot-password', oTemplateBody: { content: `Please click this link to reset your password: ${resetLink}` } });

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].passwordResetLinkSent,
//       data: {},
//       error: {}
//     });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'passwordResetFailed' });
//   }
// };

// // Reset Password
// const resetPassword = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     // Extract relevant fields from the request body
//     // input validations are handled by validators and middleware
//     let { sLogin, sType, sAuth, sCode, sNewPassword } = req.body;
//     sCode = parseInt(sCode);

//     const isOTPExist = await OTPVerificationsModel.findOne({ sLogin, sType, sAuth, sCode, bIsVerify: true }, null, { readPreference: 'primary' }).sort({ dCreatedAt: -1 });
//     if (!isOTPExist || isOTPExist.sCode !== parseInt(sCode)) {
//       return res.status(status.BadRequest).json({
//         success: false,
//         message: messages[lang].otpDoesNotMatch,
//         data: {},
//         error: {}
//       });
//     }

//     const isEmail = validateEmail(sLogin);
//     const query = isEmail ? { sEmail: sLogin } : { sMobNum: sLogin };

//     const user = await UserModel.findOne(query);
//     if (!user) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'userNotFound' });
//     }

//     user.sPassword = sNewPassword;
//     await user.save();

//     await isOTPExist.remove();

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].passwordUpdated,
//       data: {},
//       error: {}
//     });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'passwordUpdateFailed' });
//   }
// };

// // Admin List Users
// const getUsersList = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { search, limit, start } = getPaginationValues2(req.query);
//     const { isEmailVerified, isFullResponse, role, datefrom, dateto, eStatus, ePlan } = req.query;
//     let query = {};

//     if (search) {
//       query = { ...query, sName: new RegExp('^.*' + search + '.*', 'i') };
//     }
//     if (isEmailVerified) {
//       if (typeof isEmailVerified !== 'undefined') {
//         query.bIsEmailVerified = isEmailVerified === 'verified';
//       }
//     }
//     if (role) {
//       query.eRole = role;
//     }
//     if (eStatus) {
//       query.eStatus = eStatus;
//     }
//     // else {
//     //   // Default filter: exclude inactive users (previously excluded deleted)
//     //   query.eStatus = { $ne: 'inactive' };
//     // }
//     if (datefrom && dateto) {
//       // assuming the date format is ISO string (YYYY-MM-DDTHH:MM:SSZ)
//       query.dCreatedAt = { $gte: new Date(`${datefrom}T00:00:00Z`), $lte: new Date(`${dateto}T23:59:59Z`) };
//     }

//     // Filter by subscription type (ePlan) via Subscription collection
//     const planToFilter = ePlan;
//     if (planToFilter) {
//       const subscriptions = await SubscriptionModel.find({ ePlan: planToFilter }, { _id: 1 }).lean();
//       const subscriptionIds = subscriptions.map(s => s._id);
//       // If no matching subscriptions, ensure no users are returned
//       if (subscriptionIds.length === 0) {
//         return res.status(status.OK).json({
//           success: true,
//           message: messages[lang].usersListSuccess,
//           data: { total: 0, results: [] },
//           error: {}
//         });
//       }
//       query.iSubscriptionId = { $in: subscriptionIds };
//     }

//     let results = [];
//     let total = 0;

//     if ([true, 'true'].includes(isFullResponse)) {
//       results = await UserModel.find(query, { sPassword: 0, sOtp: 0, dOtpExpiration: 0 })
//         .populate('iSubscriptionId')
//         .populate('aParents', 'sName sEmail sPhone eRole')
//         .populate('aChildren', 'sName sEmail sPhone eRole')
//         .sort({ dCreatedAt: -1 })
//         .lean();
//     } else {
//       [total, results] = await Promise.all([
//         UserModel.countDocuments(query),
//         UserModel.find(query, { sPassword: 0, sOtp: 0, dOtpExpiration: 0 })
//           .populate('iSubscriptionId')
//           .populate('aParents', 'sName sEmail sPhone eRole')
//           .populate('aChildren', 'sName sEmail sPhone eRole')
//           .sort({ dCreatedAt: -1 })
//           .skip(Number(start))
//           .limit(Number(limit))
//           .lean()
//       ]);
//     }

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].usersListSuccess,
//       data: { total, results },
//       error: {}
//     });
//   } catch (error) {
//     console.log("error in 'getUsersList", error);
//     return handleServiceError(error, req, res, { messageKey: 'errorGettingUsers' });
//   }
// };

// const sendOTP = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { sLogin, sAuth, sType } = req.body;

//     if (sAuth === data.eOtpAuth.map.REGISTER || sAuth === data.eOtpAuth.map.FORGOT_PASS) {
//       const query = {};
//       if (sType === data.eOtpType.map.EMAIL) query.sEmail = sLogin;
//       else query.sPhone = sLogin;

//       const user = await UserModel.findOne(query, null, { readPreference: 'primary' }).lean();
//       if (user && sAuth === data.eOtpAuth.map.REGISTER) {
//         return res.status(status.BadRequest).json({
//           success: false,
//           message: messages[lang].emailExists,
//           data: {},
//           error: {}
//         });
//       }

//       if (!user && sAuth === data.eOtpAuth.map.FORGOT_PASS) {
//         return res.status(status.BadRequest).json({
//           success: false,
//           message: messages[lang].accountNotFound,
//           data: {},
//           error: {}
//         });
//       }
//     }

//     if (config.NODE_ENV !== data.eEnv.map.DEVELOPMENT) {
//       const [rateLimit, verifyRateLimit] = await Promise.all([
//         checkRateLimitOTP(sLogin, sType, sAuth),
//         getRateLimitStatus(sLogin, sType, `${sAuth}-V`) // check verify rate limit because if verification limit reached we can not send OTP
//       ]);
//       if (rateLimit === 'LIMIT_REACHED') {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'OtpSendLimitReached' });
//       }

//       if (verifyRateLimit === 'LIMIT_REACHED') {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'OtpSendLimitReached' });
//       }
//     }

//     const d = new Date();
//     d.setSeconds(d.getSeconds() - 30);
//     const exist = await OTPVerificationsModel.findOne({ ...req.body, sLogin, dCreatedAt: { $gt: d } }, null, { readPreference: 'primary' }).sort({ dCreatedAt: -1 }).lean();

//     if (exist) return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'err_resend_otp' });

//     let sCode = 123456;
//     if (config.NODE_ENV !== data.eEnv.map.DEVELOPMENT) sCode = generateOTP(6);

//     await OTPVerificationsModel.create({ ...req.body, sLogin, sCode });

//     // TODO: Add to redis queue
//     // TODO: Template for register and forgot password
//     if (sType === data.eOtpType.map.EMAIL) {
//       sendMailNodeMailer({ aTo: [sLogin], sSubject: messages[lang].emailVerificationSubject, sTemplate: 'otp-email', oTemplateBody: { content: `Your OTP code is: ${sCode}` } });
//     } else {
//       // Send SMS
//     }

//     return res.status(status.OK).json({ success: true, message: messages[lang].OTP_sent_success, data: {}, error: {} });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'failedToSendOTP' });
//   }
// };

// const verifyOTP = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { sLogin, sAuth, sType, sCode } = req.body;
//     const parsedCode = parseInt(sCode);

//     if (config.NODE_ENV !== data.eEnv.map.DEVELOPMENT) {
//       const [rateLimit, expiredOTP] = await Promise.all([
//         checkRateLimitOTP(sLogin, sType, `${sAuth}-V`),
//         getOTPExpiryStatus(sLogin, sType, sAuth) // check verify rate limit because if verification limit reached we can not send OTP
//       ]);

//       if (rateLimit === 'LIMIT_REACHED') {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'OtpVerifyLimitReached' });
//       }

//       if (expiredOTP === 'EXPIRED') {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'OtpExpired' });
//       }
//     }

//     const verificationQuery = { sLogin, sAuth, sType, bIsVerify: false, sCode: parsedCode };
//     const exist = await OTPVerificationsModel.findOne(verificationQuery, null, { readPreference: 'primary' }).sort({ dCreatedAt: -1 }).lean();
//     if (!exist) return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'invalidOTP' });

//     await OTPVerificationsModel.findByIdAndUpdate(exist._id, { bIsVerify: true }, { runValidators: true, readPreference: 'primary' }).lean();

//     return res.status(status.OK).json({ success: true, message: messages[lang].emailVerified, data: {}, error: {} });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'passwordUpdateFailed' });
//   }
// };

// const checkExist = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     // Destructure request body properties
//     const { sType, sValue } = req.body;
//     let exist;
//     let message;

//     // Check user existence based on the provided type (Email, Mobile, Username) with additional validation
//     if (sType === data.eOtpType.map.EMAIL) {
//       // Validate email address
//       if (!validateEmail(sValue.toLowerCase())) {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'invalidEmail' });
//       }
//       exist = await UserModel.findOne({ sEmail: (sValue.toLowerCase()) }, { _id: 0, sEmail: 1 }, { readPreference: 'primary' }).lean();
//       message = exist ? messages[lang].emailExists : messages[lang].emailNotExists;
//     } else if (sType === data.eOtpType.map.MOBILE) {
//       exist = await UserModel.findOne({ sPhone: sValue }, { _id: 0, sPhone: 1 }, { readPreference: 'primary' }).lean();
//       message = exist ? messages[lang].mobileExists : messages[lang].mobileNotExists;
//     }

//     // Handle the response based on whether the user exists or not
//     if (exist) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: Object.is(message, messages[lang].emailExists) ? 'emailExists' : 'mobileExists', data: { bExist: true } });
//     } else {
//       return res.status(status.OK).json({
//         success: true,
//         message: message,
//         data: { bExist: false },
//         error: {}
//       });
//     }
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'failedToCheckExistence' });
//   }
// };

// // Update user profile
// const updateProfile = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const userId = req.user._id;
//     let { sName, sPhone, sSchool, iGradeId, aParents, aChildren, oAddress, oUserDetails, sImage, bTwoFactorAuthentication, oNotificaitonPreference } = req.body;

//     // Extract children/parents from oUserDetails if present
//     let childrenFromDetails = null;
//     let parentsFromDetails = null;
//     if (oUserDetails && typeof oUserDetails === 'object') {
//       if (oUserDetails.children !== undefined) {
//         childrenFromDetails = coerceIdList(oUserDetails.children);
//       }
//       if (oUserDetails.parents !== undefined || oUserDetails.aParents !== undefined) {
//         parentsFromDetails = coerceIdList(oUserDetails.parents || oUserDetails.aParents);
//       }
//     }

//     // Merge children/parents from oUserDetails with top-level arrays
//     // Priority: top-level aChildren/aParents > oUserDetails.children/parents
//     if (childrenFromDetails !== null && aChildren === undefined) {
//       aChildren = childrenFromDetails;
//     }
//     if (parentsFromDetails !== null && aParents === undefined) {
//       aParents = parentsFromDetails;
//     }

//     // Normalize from top-level only
//     const normalizedParents = await resolveUserIds(Array.isArray(aParents) ? aParents : (typeof aParents === 'string' ? aParents.split(',').map(s => s.trim()).filter(Boolean) : []), 'parent');
//     const normalizedChildren = await resolveUserIds(Array.isArray(aChildren) ? aChildren : (typeof aChildren === 'string' ? aChildren.split(',').map(s => s.trim()).filter(Boolean) : []), 'student');

//     // Update allowed fields
//     const updateData = {};
//     if (sName !== undefined) updateData.sName = sName.trim();
//     if (sPhone !== undefined) updateData.sPhone = sPhone.trim();
//     if (sSchool !== undefined) updateData.sSchool = sSchool.trim();
//     if (iGradeId !== undefined) updateData.iGradeId = iGradeId;
//     if (aParents !== undefined && normalizedParents) updateData.aParents = normalizedParents;
//     if (aChildren !== undefined && normalizedChildren) updateData.aChildren = normalizedChildren;
//     if (oAddress !== undefined) updateData.oAddress = oAddress;
//     if (oUserDetails !== undefined) {
//       const d = { ...oUserDetails };
//       delete d.aParents; delete d.parents; delete d.aChildren; delete d.children;
//       updateData.oUserDetails = d;
//     }
//     if (sImage !== undefined) updateData.sImage = sImage;
//     if (bTwoFactorAuthentication !== undefined) updateData.bTwoFactorAuthentication = Boolean(bTwoFactorAuthentication);
//     if (oNotificaitonPreference !== undefined && typeof oNotificaitonPreference === 'object') {
//       updateData['oNotificaitonPreference.bEmail'] = typeof oNotificaitonPreference.bEmail === 'boolean' ? oNotificaitonPreference.bEmail : undefined;
//       updateData['oNotificaitonPreference.bPush'] = typeof oNotificaitonPreference.bPush === 'boolean' ? oNotificaitonPreference.bPush : undefined;
//       updateData['oNotificaitonPreference.bPhone'] = typeof oNotificaitonPreference.bPhone === 'boolean' ? oNotificaitonPreference.bPhone : undefined;
//     }

//     // Compute inverse sync diffs if relationship fields are provided
//     const existing = await UserModel.findById(userId, 'aParents aChildren eRole', { readPreference: 'primary' }).lean();
//     const oldParents = Array.isArray(existing?.aParents) ? existing.aParents.map(String) : [];
//     const oldChildren = Array.isArray(existing?.aChildren) ? existing.aChildren.map(String) : [];

//     const parentsProvided = aParents !== undefined;
//     const childrenProvided = aChildren !== undefined;

//     const newParents = parentsProvided ? normalizedParents : oldParents;
//     const newChildren = childrenProvided ? normalizedChildren : oldChildren;

//     const parentsToAdd = parentsProvided ? newParents.filter(id => !oldParents.includes(id)) : [];
//     const parentsToRemove = parentsProvided ? oldParents.filter(id => !newParents.includes(id)) : [];
//     const childrenToAdd = childrenProvided ? newChildren.filter(id => !oldChildren.includes(id)) : [];
//     const childrenToRemove = childrenProvided ? oldChildren.filter(id => !newChildren.includes(id)) : [];

//     // Update the user
//     const updatedUser = await UserModel.findByIdAndUpdate(
//       userId,
//       { $set: updateData },
//       { new: true, runValidators: true, readPreference: 'primary' }
//     )
//       .select('-sPassword -sOtp -dOtpExpiration')
//       .populate('aParents', 'sName sEmail sPhone eRole')
//       .populate('aChildren', 'sName sEmail sPhone eRole')
//       .populate('iSubscriptionId');

//     if (!updatedUser) {
//       return res.status(status.NotFound).json({
//         success: false,
//         message: messages[lang].userNotFound,
//         data: {},
//         error: {}
//       });
//     }

//     // Apply inverse sync operations after successful update
//     try {
//       if (parentsProvided) {
//         if (parentsToAdd.length) {
//           await UserModel.updateMany({ _id: { $in: parentsToAdd } }, { $addToSet: { aChildren: userId } });
//         }
//         if (parentsToRemove.length) {
//           await UserModel.updateMany({ _id: { $in: parentsToRemove } }, { $pull: { aChildren: userId } });
//         }
//       }

//       if (childrenProvided) {
//         if (childrenToAdd.length) {
//           await UserModel.updateMany({ _id: { $in: childrenToAdd } }, { $addToSet: { aParents: userId } });
//         }
//         if (childrenToRemove.length) {
//           await UserModel.updateMany({ _id: { $in: childrenToRemove } }, { $pull: { aParents: userId } });
//         }
//       }
//     } catch (_) { }

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].profileUpdated || 'Profile updated successfully',
//       data: { user: updatedUser },
//       error: {}
//     });
//   } catch (error) {
//     console.log('error', error);
//     return handleServiceError(error, req, res, { messageKey: 'profileUpdateFailed' });
//   }
// };

// // Update Two Factor Authentication flag
// const updateTwoFactorAuthentication = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const userId = req.user._id;
//     const { bTwoFactorAuthentication } = req.body;

//     const updated = await UserModel.findByIdAndUpdate(
//       userId,
//       { $set: { bTwoFactorAuthentication: Boolean(bTwoFactorAuthentication) } },
//       { new: true, runValidators: true, readPreference: 'primary' }
//     ).select('-sPassword -sOtp -dOtpExpiration');

//     if (!updated) {
//       return res.status(status.NotFound).json({ success: false, message: messages[lang].userNotFound, data: {}, error: {} });
//     }

//     return res.status(status.OK).json({ success: true, message: messages[lang].twoFactorUpdated || 'Updated successfully', data: { bTwoFactorAuthentication: updated.bTwoFactorAuthentication }, error: {} });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'twoFactorUpdatedFailed' });
//   }
// };

// // Update Notification Preferences
// const updateNotificationPreference = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const userId = req.user._id;
//     const { oNotificaitonPreference } = req.body;

//     const setObj = {};
//     if (oNotificaitonPreference && typeof oNotificaitonPreference === 'object') {
//       if (typeof oNotificaitonPreference.bEmail === 'boolean') setObj['oNotificaitonPreference.bEmail'] = oNotificaitonPreference.bEmail;
//       if (typeof oNotificaitonPreference.bPush === 'boolean') setObj['oNotificaitonPreference.bPush'] = oNotificaitonPreference.bPush;
//       if (typeof oNotificaitonPreference.bPhone === 'boolean') setObj['oNotificaitonPreference.bPhone'] = oNotificaitonPreference.bPhone;
//     }

//     const updated = await UserModel.findByIdAndUpdate(
//       userId,
//       { $set: setObj },
//       { new: true, runValidators: true, readPreference: 'primary' }
//     ).select('oNotificaitonPreference');

//     if (!updated) {
//       return res.status(status.NotFound).json({ success: false, message: messages[lang].userNotFound, data: {}, error: {} });
//     }

//     return res.status(status.OK).json({ success: true, message: messages[lang].notificationPreferenceUpdated || 'Updated successfully', data: { oNotificaitonPreference: updated.oNotificaitonPreference }, error: {} });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'notificationPreferenceUpdatedFailed' });
//   }
// };

// // Change password for authenticated user
// const changePassword = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const userId = req.user._id;
//     const { sCurrentPassword, sNewPassword } = req.body;

//     const user = await UserModel.findById(userId, null, { readPreference: 'primary' }).select('+sPassword');
//     if (!user) {
//       return res.status(status.NotFound).json({ success: false, message: messages[lang].userNotFound, data: {}, error: {} });
//     }

//     const isMatch = await bcrypt.compare(sCurrentPassword, user.sPassword);
//     if (!isMatch) {
//       return res.status(status.BadRequest).json({ success: false, message: messages[lang].currentPasswordIncorrect, data: {}, error: {} });
//     }

//     user.sPassword = sNewPassword;
//     await user.save();

//     return res.status(status.OK).json({ success: true, message: messages[lang].passwordChanged, data: {}, error: {} });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'errorChangingPassword' });
//   }
// };

// // Get authenticated user details
// const getUserDetails = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const userId = req.user?._id;
//     if (!userId) {
//       return res.status(status.Unauthorized).json({ success: false, message: messages[lang].userNotFound, data: {}, error: {} });
//     }

//     const user = await UserModel.findById(userId, null, { readPreference: 'primary' })
//       .select('-sPassword -sOtp -dOtpExpiration')
//       .populate('aParents', 'sName sEmail sPhone eRole')
//       .populate('aChildren', 'sName sEmail sPhone eRole')
//       .populate('iSubscriptionId')
//       .populate({ path: 'iGradeId', model: GradeModel, select: '_id sName' })
//       .lean();

//     if (!user) {
//       return res.status(status.NotFound).json({ success: false, message: messages[lang].userNotFound, data: {}, error: {} });
//     }

//     return res.status(status.OK).json({ success: true, message: messages[lang].success || 'Success', data: { user }, error: {} });
//   } catch (error) {
//     console.log('getUserDetails error:', error);
//     return handleServiceError(error, req, res, { messageKey: 'internalServerError' });
//   }
// };

// // Generate S3 presigned URL for uploads
// const getPresignUrl = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const userId = req.user?._id;
//     if (!userId) {
//       return res.status(status.Unauthorized).json({ success: false, message: messages[lang].err_unauthorized, data: {}, error: {} });
//     }

//     let { sFileName, sContentType, sPath, eType } = req.body;

//     // default path prefix per user
//     if (!sPath) sPath = `uploads/users/${userId}/`;

//     const result = await signedUrl(String(sFileName || 'file'), String(sContentType || 'application/octet-stream'), sPath, eType);

//     if (!result?.sUrl || !result?.sPath) {
//       return res.status(status.InternalServerError).json({ success: false, message: messages[lang].error, data: {}, error: {} });
//     }

//     return res.status(status.OK).json({ success: true, message: messages[lang].success || 'Success', data: { sUrl: result.sUrl, sPath: result.sPath }, error: {} });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'failedToGeneratePresignedUrl' });
//   }
// };

// // Link parent to the authenticated student
// const linkParent = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const studentId = req.user._id;
//     const { iParentId, sEmail, sPhone } = req.body;

//     const student = await UserModel.findById(studentId, null, { readPreference: 'primary' });
//     if (!student) {
//       return res.status(status.NotFound).json({ success: false, message: messages[lang].userNotFound, data: {}, error: {} });
//     }

//     if (student.eRole !== 'student') {
//       return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'access_denied' });
//     }

//     let parent;
//     if (iParentId) {
//       parent = await UserModel.findById(iParentId, null, { readPreference: 'primary' });
//     } else if (sEmail) {
//       parent = await UserModel.findOne({ sEmail: sEmail.toLowerCase().trim() }, null, { readPreference: 'primary' });
//     } else if (sPhone) {
//       parent = await UserModel.findOne({ sPhone }, null, { readPreference: 'primary' });
//     }

//     if (!parent) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'userNotFound' });
//     }

//     if (parent._id.equals(student._id)) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'cannotLinkSelfAsParent' });
//     }

//     if (parent.eRole !== 'parent') {
//       return res.status(status.BadRequest).json({ success: false, message: messages[lang].invalidUserRole || 'Invalid user role. Allowed values: teacher, parent, student', data: {}, error: {} });
//     }

//     await Promise.all([
//       UserModel.updateOne({ _id: student._id }, { $addToSet: { aParents: parent._id } }),
//       UserModel.updateOne({ _id: parent._id }, { $addToSet: { aChildren: student._id } })
//     ]);

//     const updated = await UserModel.findById(student._id, null, { readPreference: 'primary' })
//       .select('-sPassword -sOtp -dOtpExpiration')
//       .populate('aParents', 'sName sEmail sPhone eRole');

//     return res.status(status.OK).json({ success: true, message: messages[lang].parentLinked, data: { aParents: updated.aParents }, error: {} });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'internalServerError' });
//   }
// };

// // Unlink parent from the authenticated student
// const unlinkParent = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const studentId = req.user._id;
//     const { parentId } = req.params;

//     const student = await UserModel.findById(studentId, null, { readPreference: 'primary' });
//     if (!student) {
//       return res.status(status.NotFound).json({ success: false, message: messages[lang].userNotFound, data: {}, error: {} });
//     }

//     await Promise.all([
//       UserModel.updateOne({ _id: student._id }, { $pull: { aParents: parentId } }),
//       UserModel.updateOne({ _id: parentId }, { $pull: { aChildren: student._id } })
//     ]);

//     const updated = await UserModel.findById(student._id, null, { readPreference: 'primary' })
//       .select('-sPassword -sOtp -dOtpExpiration')
//       .populate('aParents', 'sName sEmail sPhone eRole');

//     return res.status(status.OK).json({ success: true, message: messages[lang].parentUnlinked, data: { aParents: updated.aParents }, error: {} });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'internalServerError' });
//   }
// };

// // List linked parents for authenticated student
// const listLinkedParents = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const studentId = req.user._id;

//     const user = await UserModel.findById(studentId, null, { readPreference: 'primary' })
//       .select('_id aParents')
//       .populate('aParents', 'sName sEmail sPhone eRole');

//     if (!user) {
//       return res.status(status.NotFound).json({ success: false, message: messages[lang].userNotFound, data: {}, error: {} });
//     }

//     return res.status(status.OK).json({ success: true, message: messages[lang].parentsListSuccess, data: { aParents: user?.aParents || [] } });
//   } catch (error) {
//     console.log('listLinkedParents error:', error);
//     return handleServiceError(error, req, res, { messageKey: 'internalServerError' });
//   }
// };

// // Get user streak
// const getUserStreak = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const userId = req.user?._id;
//     if (!userId) {
//       return res.status(status.Unauthorized).json({ success: false, message: messages[lang].err_unauthorized, data: {}, error: {} });
//     }
//     const user = await UserModel.findById(userId, { oStreak: 1, dLastSeen: 1, aParents: 1, aChildren: 1 }, { readPreference: 'primary' })
//       .populate('aParents', 'sName sEmail sPhone eRole')
//       .populate('aChildren', 'sName sEmail sPhone eRole')
//       .lean();
//     return res.status(status.OK).json({ success: true, message: messages[lang].success || 'Success', data: { oStreak: user?.oStreak || {}, dLastSeen: user?.dLastSeen || null, aParents: user?.aParents || [], aChildren: user?.aChildren || [] }, error: {} });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'internalServerError' });
//   }
// };

// // Add Student by Parent
// const addStudentByParent = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const parentId = req.user._id;
//     const { sName, sEmail, sPhone, sGender, iGradeId, nAge, sSchool, oAddress, oUserDetails, sImage } = req.body;

//     // Verify the logged-in user is a parent
//     const parent = await UserModel.findById(parentId, null, { readPreference: 'primary' });
//     if (!parent || parent.eRole !== data.eUserRoles.map.PARENT) {
//       return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'accessDenied' });
//     }

//     // Check if student email already exists
//     const email = sEmail.toLowerCase().trim();
//     const existingStudent = await UserModel.findOne({
//       sEmail: email,
//       eStatus: data.eStatus.map.ACTIVE,
//       bDelete: false
//     }, null, { readPreference: 'primary' }).lean();

//     if (existingStudent) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'emailExists' });
//     }

//     // Get default password from environment config
//     const defaultPassword = DEFAULT_STUDENT_PASSWORD;

//     // Create freemium subscription for the student
//     let studentSubscription = null;
//     try {
//       studentSubscription = new SubscriptionModel({
//         iUserId: null, // Will be set after student creation
//         ePlan: data.eSubscriptionPlan.map.FREEMIUM,
//         nSeats: 1,
//         eStatus: data.ePaymentStatus.map.SUCCESS,
//         dTrialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30-day trial
//       });
//       await studentSubscription.save();
//     } catch (error) {
//       console.error('Error creating subscription:', error);
//     }

//     // Create the student user
//     const student = new UserModel({
//       eRole: data.eUserRoles.map.STUDENT,
//       sName: sName.trim(),
//       sEmail: email,
//       sPassword: defaultPassword,
//       sPhone: sPhone.trim(),
//       sImage: sImage,
//       sSchool: sSchool ? sSchool.trim() : undefined,
//       iGradeId: iGradeId || undefined,
//       aParents: [parentId],
//       oAddress: oAddress || {},
//       oUserDetails: {
//         ...oUserDetails,
//         sGender: sGender,
//         nAge: nAge
//       },
//       iSubscriptionId: studentSubscription ? studentSubscription._id : undefined,
//       bIsEmailVerified: true, // Auto-verify since added by parent
//       bTermsAndConditions: true,
//       eStatus: data.eStatus.map.ACTIVE
//     });

//     await student.save();

//     // Update subscription with student ID
//     if (studentSubscription) {
//       studentSubscription.iUserId = student._id;
//       studentSubscription.aAllocatedStudents = [student._id];
//       await studentSubscription.save();
//     }

//     // Add student to parent's children array
//     await UserModel.updateOne(
//       { _id: parentId },
//       { $addToSet: { aChildren: student._id } }
//     );

//     // Send invitation email to student (non-blocking)
//     sendStudentInvitationEmail({
//       studentName: sName.trim(),
//       studentEmail: email,
//       password: defaultPassword,
//       addedBy: 'parent'
//     }).catch(err => console.error('Failed to send student invitation email:', err));

//     // Populate the created student for response
//     const populatedStudent = await UserModel.findById(student._id)
//       .select('-sPassword -sOtp -dOtpExpiration')
//       .populate('aParents', 'sName sEmail sPhone eRole')
//       .populate('aChildren', 'sName sEmail sPhone eRole')
//       .populate({ path: 'iGradeId', model: GradeModel, select: 'sName sDescription' })
//       .populate('iSubscriptionId')
//       .lean();

//     // Add default password to response (not stored in DB)
//     const studentData = {
//       ...populatedStudent,
//       defaultPassword: defaultPassword
//     };

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].studentAddedSuccess || 'Student added successfully. Invitation email sent.',
//       data: { student: studentData },
//       error: {}
//     });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'studentAddFailed' });
//   }
// };

// // Update Student by Parent
// const updateStudentByParent = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const parentId = req.user._id;
//     const { childId } = req.params;
//     const { sName, sEmail, sPhone, sGender, iGradeId, nAge, sSchool, oAddress, oUserDetails, sImage } = req.body;

//     // Verify the logged-in user is a parent
//     const parent = await UserModel.findById(parentId, null, { readPreference: 'primary' });
//     if (!parent || parent.eRole !== data.eUserRoles.map.PARENT) {
//       return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'accessDenied' });
//     }

//     // Find the student and verify it belongs to this parent
//     const student = await UserModel.findById(childId, null, { readPreference: 'primary' });
//     if (!student) {
//       return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'userNotFound' });
//     }

//     // Check if student belongs to this parent
//     if (!student.aParents.includes(parentId)) {
//       return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'accessDenied' });
//     }

//     // If email is being updated, check for uniqueness
//     if (sEmail && sEmail.toLowerCase().trim() !== student.sEmail) {
//       const email = sEmail.toLowerCase().trim();
//       const existingStudent = await UserModel.findOne({
//         sEmail: email,
//         _id: { $ne: childId },
//         eStatus: data.eStatus.map.ACTIVE,
//         bDelete: false
//       }, null, { readPreference: 'primary' }).lean();

//       if (existingStudent) {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'emailExists' });
//       }
//     }

//     // Prepare update data
//     const updateData = {};
//     if (sName !== undefined) updateData.sName = sName.trim();
//     if (sEmail !== undefined) updateData.sEmail = sEmail.toLowerCase().trim();
//     if (sPhone !== undefined) updateData.sPhone = sPhone.trim();
//     if (sSchool !== undefined) updateData.sSchool = sSchool.trim();
//     if (iGradeId !== undefined) updateData.iGradeId = iGradeId;
//     if (oAddress !== undefined) updateData.oAddress = oAddress;
//     if (sImage !== undefined) updateData.sImage = sImage;

//     // Handle user details update
//     if (oUserDetails !== undefined || sGender !== undefined || nAge !== undefined) {
//       const currentUserDetails = student.oUserDetails || {};
//       updateData.oUserDetails = {
//         ...currentUserDetails,
//         ...oUserDetails
//       };

//       if (sGender !== undefined) updateData.oUserDetails.sGender = sGender;
//       if (nAge !== undefined) updateData.oUserDetails.nAge = nAge;
//     }

//     // Update the student
//     const updatedStudent = await UserModel.findByIdAndUpdate(
//       childId,
//       updateData,
//       { new: true, runValidators: true, readPreference: 'primary' }
//     )
//       .select('-sPassword -sOtp -dOtpExpiration')
//       .populate('aParents', 'sName sEmail sPhone eRole')
//       .populate('aChildren', 'sName sEmail sPhone eRole')
//       .populate({ path: 'iGradeId', model: GradeModel, select: 'sName sDescription' })
//       .populate('iSubscriptionId')
//       .lean();

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].studentUpdatedSuccess || 'Student updated successfully',
//       data: { student: updatedStudent },
//       error: {}
//     });
//   } catch (error) {
//     console.log('updateStudentByParent error:', error);
//     return handleServiceError(error, req, res, { messageKey: 'studentUpdateFailed' });
//   }
// };

// // Get Children List by Parent
// const getChildrenByParent = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const parentId = req.user._id;
//     const { childId, search, limit = 10, start = 0, grade, school, status: userStatus, filter = 'daily', isFullResponse } = req.query;

//     // Verify the logged-in user is a parent
//     const parent = await UserModel.findById(parentId, null, { readPreference: 'primary' });
//     if (!parent || parent.eRole !== data.eUserRoles.map.PARENT) {
//       return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'accessDenied' });
//     }

//     // Calculate date range based on filter (daily, weekly, monthly)
//     const now = new Date();
//     let startDate;
//     switch (filter.toLowerCase()) {
//       case 'weekly':
//         startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
//         break;
//       case 'monthly':
//         startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
//         break;
//       case 'daily':
//       default:
//         startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
//         break;
//     }

//     // Get children IDs from parent's aChildren array
//     const parentChildrenIds = Array.isArray(parent.aChildren) ? parent.aChildren : [];

//     // If parent has no children, return empty result
//     if (parentChildrenIds.length === 0) {
//       const responseData = {
//         total: 0,
//         children: [],
//         filter: {
//           type: filter.toLowerCase(),
//           startDate: startDate,
//           endDate: now
//         }
//       };

//       // Only include pagination if isFullResponse is not true
//       if (![true, 'true'].includes(isFullResponse)) {
//         responseData.pagination = {
//           limit: Number(limit),
//           start: Number(start),
//           hasMore: false
//         };
//       }

//       return res.status(status.OK).json({
//         success: true,
//         message: messages[lang].childrenListSuccess || 'Children list retrieved successfully',
//         data: responseData,
//         error: {}
//       });
//     }

//     // If childId is provided, verify it belongs to this parent
//     if (childId) {
//       const isChildLinked = parentChildrenIds.some(id => id.toString() === childId.toString());
//       if (!isChildLinked) {
//         return handleServiceError(null, req, res, {
//           statusCode: status.Forbidden,
//           messageKey: 'childNotLinkedToParent'
//         });
//       }
//     }

//     // Build query to find ONLY children in parent's aChildren array
//     const query = {
//       _id: childId || { $in: parentChildrenIds },
//       eRole: data.eUserRoles.map.STUDENT,
//       bDelete: false
//     };

//     // Add search filter if provided
//     if (search) {
//       const { searchRegExp } = require('../../helper/utilities.services');
//       const safe = searchRegExp(search);
//       query.$and = query.$and || [];
//       query.$and.push({
//         $or: [
//           { sName: safe },
//           { sEmail: safe },
//           { sPhone: safe }
//         ]
//       });
//     }

//     // Add grade filter if provided
//     if (grade) {
//       query.iGradeId = grade;
//     }

//     // Add school filter if provided
//     if (school) {
//       query.sSchool = new RegExp(school, 'i');
//     }

//     // Add status filter if provided
//     if (userStatus) {
//       query.eStatus = userStatus;
//     }

//     // Get total count and paginated results
//     let total = 0;
//     let children = [];

//     if ([true, 'true'].includes(isFullResponse)) {
//       children = await UserModel.find(query)
//         .select('-sPassword -sOtp -dOtpExpiration')
//         .populate({ path: 'iGradeId', model: GradeModel, select: 'sName sDescription' })
//         .populate('iSubscriptionId', 'ePlan nSeats eStatus dTrialEndDate dTenewalDate')
//         .populate('aParents', 'sName sEmail sPhone eRole')
//         .populate('aChildren', 'sName sEmail sPhone eRole') // Populate siblings
//         .sort({ dCreatedAt: -1 })
//         .lean();
//       total = children.length;
//     } else {
//       [total, children] = await Promise.all([
//         UserModel.countDocuments(query),
//         UserModel.find(query)
//           .select('-sPassword -sOtp -dOtpExpiration')
//           .populate({ path: 'iGradeId', model: GradeModel, select: 'sName sDescription' })
//           .populate('iSubscriptionId', 'ePlan nSeats eStatus dTrialEndDate dTenewalDate')
//           .populate('aParents', 'sName sEmail sPhone eRole')
//           .populate('aChildren', 'sName sEmail sPhone eRole') // Populate siblings
//           .sort({ dCreatedAt: -1 })
//           .skip(Number(start))
//           .limit(Number(limit))
//           .lean()
//       ]);
//     }

//     // If no children found, return empty array
//     if (total === 0) {
//       const responseData = {
//         total: 0,
//         children: [],
//         filter: {
//           type: filter.toLowerCase(),
//           startDate: startDate,
//           endDate: now
//         }
//       };

//       // Only include pagination if isFullResponse is not true
//       if (![true, 'true'].includes(isFullResponse)) {
//         responseData.pagination = {
//           limit: Number(limit),
//           start: Number(start),
//           hasMore: false
//         };
//       }

//       return res.status(status.OK).json({
//         success: true,
//         message: messages[lang].childrenListSuccess || 'Children list retrieved successfully',
//         data: responseData,
//         error: {}
//       });
//     }

//     // Add active subjects and watch stats to each child individually
//     const childrenIds = children.map(c => c._id);

//     // Get watch history stats for each child (including completed videos) with date filter
//     const watchHistoryStats = await VideoWatchHistoryModel.aggregate([
//       {
//         $match: {
//           iUserId: { $in: childrenIds },
//           bDelete: { $ne: true },
//           dLastWatchedAt: { $gte: startDate }
//         }
//       },
//       {
//         $group: {
//           _id: {
//             userId: '$iUserId',
//             subjectId: '$iSubjectId'
//           },
//           nVideosWatched: { $sum: 1 },
//           nVideosCompleted: {
//             $sum: { $cond: ['$bCompleted', 1, 0] }
//           },
//           nTotalWatchTime: { $sum: { $toDouble: '$nWatchDuration' } }
//         }
//       },
//       {
//         $group: {
//           _id: '$_id.userId',
//           subjects: {
//             $push: {
//               subjectId: '$_id.subjectId',
//               nVideosWatched: '$nVideosWatched',
//               nVideosCompleted: '$nVideosCompleted',
//               nTotalWatchTime: '$nTotalWatchTime'
//             }
//           },
//           nTotalVideosWatched: { $sum: '$nVideosWatched' },
//           nTotalWatchTime: { $sum: '$nTotalWatchTime' }
//         }
//       }
//     ]);

//     // Create a map of child stats
//     const childStatsMap = new Map();
//     watchHistoryStats.forEach(stat => {
//       childStatsMap.set(stat._id.toString(), {
//         subjects: stat.subjects,
//         nTotalVideosWatched: stat.nTotalVideosWatched,
//         nTotalWatchTime: stat.nTotalWatchTime
//       });
//     });

//     // Get all unique subject IDs from all children's watch history
//     const allSubjectIds = [...new Set(
//       watchHistoryStats.flatMap(stat => stat.subjects.map(s => s.subjectId))
//     )];

//     // Fetch subject details
//     const subjectDetailsMap = new Map();
//     if (allSubjectIds.length > 0) {
//       const subjects = await SubjectModel.find({
//         _id: { $in: allSubjectIds },
//         eStatus: data.eStatus.map.ACTIVE
//       })
//         .sort({ iOrder: 1 })
//         .lean();

//       // Fetch grade details for subjects
//       const gradeIds = [...new Set(subjects.map(s => s.iGradeId))];
//       const grades = await GradeModel.find({ _id: { $in: gradeIds } }, 'sName').lean();
//       const gradeMap = new Map(grades.map(g => [g._id.toString(), g]));

//       subjects.forEach(subject => {
//         subjectDetailsMap.set(subject._id.toString(), {
//           ...subject,
//           iGradeId: gradeMap.get(subject.iGradeId.toString()) || subject.iGradeId
//         });
//       });

//       // Get video counts for all subjects
//       const videoCounts = await VideoModel.aggregate([
//         {
//           $match: {
//             iSubjectId: { $in: allSubjectIds },
//             eStatus: data.eStatus.map.ACTIVE,
//             bDelete: { $ne: true }
//           }
//         },
//         {
//           $group: {
//             _id: '$iSubjectId',
//             count: { $sum: 1 }
//           }
//         }
//       ]);

//       // Add video counts to subject details
//       videoCounts.forEach(vc => {
//         const subject = subjectDetailsMap.get(vc._id.toString());
//         if (subject) {
//           subject.nTotalVideos = vc.count;
//         }
//       });
//     }

//     // Get total videos per subject for each child's grade (optimized single query)
//     const uniqueGradeIds = [...new Set(
//       children
//         .filter(c => c.iGradeId && c.iGradeId._id)
//         .map(c => c.iGradeId._id)
//     )];

//     // Get video counts grouped by grade and subject
//     const gradeSubjectVideoCounts = uniqueGradeIds.length > 0
//       ? await VideoModel.aggregate([
//         {
//           $match: {
//             iGradeId: { $in: uniqueGradeIds },
//             iSubjectId: { $in: allSubjectIds },
//             eStatus: data.eStatus.map.ACTIVE,
//             bDelete: { $ne: true }
//           }
//         },
//         {
//           $group: {
//             _id: {
//               gradeId: '$iGradeId',
//               subjectId: '$iSubjectId'
//             },
//             count: { $sum: 1 }
//           }
//         }
//       ])
//       : [];

//     // Build a map: gradeId -> (subjectId -> videoCount)
//     const gradeSubjectVideoMap = new Map();
//     gradeSubjectVideoCounts.forEach(item => {
//       const gradeId = item._id.gradeId.toString();
//       const subjectId = item._id.subjectId.toString();

//       if (!gradeSubjectVideoMap.has(gradeId)) {
//         gradeSubjectVideoMap.set(gradeId, new Map());
//       }
//       gradeSubjectVideoMap.get(gradeId).set(subjectId, item.count);
//     });

//     // Build child-specific maps
//     const childGradeSubjectVideoCount = new Map();
//     children.forEach(child => {
//       if (child.iGradeId && child.iGradeId._id) {
//         const gradeId = child.iGradeId._id.toString();
//         const childId = child._id.toString();
//         childGradeSubjectVideoCount.set(childId, gradeSubjectVideoMap.get(gradeId) || new Map());
//       }
//     });

//     // Enhance each child with their active subjects and stats
//     const enhancedChildren = children.map(child => {
//       const childId = child._id.toString();
//       const stats = childStatsMap.get(childId);

//       if (!stats) {
//         // No watch history for this child
//         return {
//           ...child,
//           activeSubjects: [],
//           completedSubjects: [],
//           nTotalVideosWatched: 0,
//           nTotalWatchTime: 0
//         };
//       }

//       const childSubjectVideoMap = childGradeSubjectVideoCount.get(childId) || new Map();

//       // Build active subjects array and completed subjects array for this child
//       const activeSubjects = [];
//       const completedSubjects = [];

//       stats.subjects.forEach(subjectStat => {
//         const subjectId = subjectStat.subjectId.toString();
//         const subjectDetails = subjectDetailsMap.get(subjectId);
//         const totalVideosInSubject = childSubjectVideoMap.get(subjectId) || subjectDetails?.nTotalVideos || 0;

//         // Calculate overall progress
//         // Completed videos = 100% progress, Watched (not completed) = 50% progress
//         let nOverallProgress = 0;
//         if (totalVideosInSubject > 0) {
//           const nVideosInProgress = subjectStat.nVideosWatched - subjectStat.nVideosCompleted;
//           const completedProgress = subjectStat.nVideosCompleted * 100;
//           const inProgressContribution = nVideosInProgress * 50;
//           nOverallProgress = Math.round((completedProgress + inProgressContribution) / totalVideosInSubject);
//         }

//         const subjectData = {
//           ...(subjectDetails || { _id: subjectStat.subjectId }),
//           nVideosWatched: subjectStat.nVideosWatched,
//           nVideosCompleted: subjectStat.nVideosCompleted,
//           nTotalWatchTime: subjectStat.nTotalWatchTime,
//           nTotalVideos: totalVideosInSubject,
//           nOverallProgress
//         };

//         activeSubjects.push(subjectData);

//         // Check if subject is completed (all videos watched and completed)
//         if (totalVideosInSubject > 0 && subjectStat.nVideosCompleted >= totalVideosInSubject) {
//           completedSubjects.push({
//             ...subjectData,
//             bCompleted: true,
//             nCompletionPercentage: 100
//           });
//         }
//       });

//       return {
//         ...child,
//         activeSubjects,
//         completedSubjects,
//         nTotalVideosWatched: stats.nTotalVideosWatched,
//         nTotalWatchTime: stats.nTotalWatchTime
//       };
//     });

//     const responseData = {
//       total,
//       children: enhancedChildren,
//       filter: {
//         type: filter.toLowerCase(),
//         startDate: startDate,
//         endDate: now
//       }
//     };

//     // Only include pagination if isFullResponse is not true
//     if (![true, 'true'].includes(isFullResponse)) {
//       responseData.pagination = {
//         limit: Number(limit),
//         start: Number(start),
//         hasMore: (Number(start) + Number(limit)) < total
//       };
//     }

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].childrenListSuccess || 'Children list retrieved successfully',
//       data: responseData,
//       error: {}
//     });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'childrenListFailed' });
//   }
// };

// // Get recently watched videos by child (for parents)
// const getRecentVideosByChild = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const parentId = req.user._id;
//     const { childId } = req.query;
//     const { limit = 20, start = 0 } = getPaginationValues2(req.query);

//     // Verify that the requester is a parent
//     const parent = await UserModel.findById(parentId, 'eRole aChildren', { readPreference: 'primary' }).lean();

//     if (!parent) {
//       return handleServiceError(null, req, res, {
//         statusCode: status.NotFound,
//         messageKey: 'userNotFound'
//       });
//     }

//     if (parent.eRole !== data.eUserRoles.map.PARENT) {
//       return handleServiceError(null, req, res, {
//         statusCode: status.Forbidden,
//         messageKey: 'accessDenied'
//       });
//     }

//     // Get list of children IDs
//     const childrenIds = (parent.aChildren || []).map(id => id.toString());

//     if (childrenIds.length === 0) {
//       return res.status(status.OK).json({
//         success: true,
//         message: messages[lang].noChildrenFound || 'No children found',
//         data: {
//           total: 0,
//           recentVideos: [],
//           pagination: {
//             total: 0,
//             limit: Number(limit),
//             start: Number(start),
//             hasMore: false
//           }
//         },
//         error: {}
//       });
//     }

//     // If childId is provided, validate it belongs to parent
//     let targetChildrenIds = childrenIds;
//     if (childId) {
//       if (!childrenIds.includes(childId)) {
//         return handleServiceError(null, req, res, {
//           statusCode: status.Forbidden,
//           messageKey: 'accessDenied'
//         });
//       }
//       targetChildrenIds = [childId];
//     }

//     // Get recently watched videos for all children (or specific child)
//     const query = {
//       iUserId: { $in: targetChildrenIds },
//       bDelete: false
//     };

//     const [total, recentVideos] = await Promise.all([
//       VideoWatchHistoryModel.countDocuments(query),
//       VideoWatchHistoryModel.find(query)
//         .sort({ dLastWatchedAt: -1 })
//         .skip(Number(start))
//         .limit(Number(limit))
//         .lean()
//     ]);

//     // Manually populate for cross-database references
//     if (recentVideos.length > 0) {
//       const videoIds = [...new Set(recentVideos.map(r => r.iVideoId))];
//       const gradeIds = [...new Set(recentVideos.map(r => r.iGradeId))];
//       const subjectIds = [...new Set(recentVideos.map(r => r.iSubjectId))];
//       const userIds = [...new Set(recentVideos.map(r => r.iUserId.toString()))];

//       const [videos, grades, subjects, children] = await Promise.all([
//         VideoModel.find({ _id: { $in: videoIds } }, 'sTitle sThumbnailUrl iDuration sUrl sDescription').lean(),
//         GradeModel.find({ _id: { $in: gradeIds } }, 'sName').lean(),
//         SubjectModel.find({ _id: { $in: subjectIds } }, 'sName').lean(),
//         UserModel.find({ _id: { $in: userIds } }, 'sName sEmail sImage iGradeId').lean()
//       ]);

//       const videoMap = new Map(videos.map(v => [v._id.toString(), v]));
//       const gradeMap = new Map(grades.map(g => [g._id.toString(), g]));
//       const subjectMap = new Map(subjects.map(s => [s._id.toString(), s]));
//       const childMap = new Map(children.map(c => [c._id.toString(), c]));

//       recentVideos.forEach(watched => {
//         // Convert Decimal128 to regular numbers for response
//         watched.nWatchDuration = parseFloat(watched.nWatchDuration.toString());
//         watched.nTotalDuration = parseFloat(watched.nTotalDuration.toString());
//         watched.nLastPosition = parseFloat(watched.nLastPosition.toString());

//         // Populate references
//         watched.iVideoId = videoMap.get(watched.iVideoId.toString()) || watched.iVideoId;
//         watched.iGradeId = gradeMap.get(watched.iGradeId.toString()) || watched.iGradeId;
//         watched.iSubjectId = subjectMap.get(watched.iSubjectId.toString()) || watched.iSubjectId;

//         // Add child information
//         const childInfo = childMap.get(watched.iUserId.toString());
//         watched.child = childInfo ? {
//           _id: childInfo._id,
//           sName: childInfo.sName,
//           sEmail: childInfo.sEmail,
//           sImage: childInfo.sImage,
//           iGradeId: childInfo.iGradeId
//         } : null;
//       });
//     }

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].recentVideosRetrieved || 'Recent videos retrieved successfully',
//       data: {
//         total,
//         recentVideos,
//         pagination: {
//           total,
//           limit: Number(limit),
//           start: Number(start),
//           hasMore: (Number(start) + Number(limit)) < total
//         }
//       },
//       error: {}
//     });
//   } catch (error) {
//     console.log('getRecentVideosByChild error:', error);
//     return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveRecentVideos' });
//   }
// };

// module.exports = {
//   register,
//   verifyEmail,
//   resendOtp,
//   login,
//   forgotPassword,
//   resetPassword,
//   handleSubscriptionAndPayment,
//   getUsersList,
//   refreshToken,
//   accessToken,
//   logout,
//   sendOTP,
//   verifyOTP,
//   checkExist,
//   updateProfile,
//   changePassword,
//   linkParent,
//   unlinkParent,
//   listLinkedParents,
//   updateTwoFactorAuthentication,
//   updateNotificationPreference,
//   getUserDetails,
//   getPresignUrl,
//   getUserStreak,
//   addStudentByParent,
//   updateStudentByParent,
//   getChildrenByParent,
//   getRecentVideosByChild
// };
