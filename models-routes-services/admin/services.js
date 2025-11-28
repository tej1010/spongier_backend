module.exports = require('./services/index');
// const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
// const jwt = require('jsonwebtoken');
// const AdminModel = require('./model');
// const { eUserRoles, eSubscriptionPlan, ePaymentStatus } = require('../../data');
// const { messages, status } = require('../../helper/api.responses');
// const { handleServiceError } = require('../../helper/utilities.services');
// const { signRefreshToken, verifyRefreshToken } = require('../../helper/token.util');
// const { getPaginationValues2 } = require('../../helper/utilities.services');
// const UserModel = require('../user/model');
// const GradeModel = require('../course/grades/model');
// const SubjectModel = require('../course/subjects/model');
// const TermModel = require('../course/terms/model');
// const VideoModel = require('../course/videos/model');
// const ResourceModel = require('../course/resource/model');
// const SubscriptionModel = require('../subscription/model');
// const AdminLoginHistoryModel = require('./loginHistory/model');
// const { getCountryFromIP } = require('../../helper/utilities.services');
// const useragent = require('useragent');
// const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
// const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
// const config = require('../../config/config');
// const { AWS_REGION } = require('../../config/thirdPartyConfig');
// const { DEFAULT_STUDENT_PASSWORD } = require('../../config/defaultConfig');
// const { sendStudentInvitationEmail } = require('../../helper/mail.services');

// // Initialize S3 client
// const s3Client = new S3Client({
//   endpoint: config.AWS_BUCKET_ENDPOINT,
//   region: AWS_REGION,
//   credentials: { accessKeyId: config.AWS_ACCESS_KEY, secretAccessKey: config.AWS_SECRET_KEY }
// });

// // Create subadmin (SUPER or role-based admin only)
// const create = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { sName, sUsername, sEmail, sMobNum, sPassword, aRole } = req.body;

//     // Check if admin already exists
//     const exists = await AdminModel.findOne({
//       $or: [
//         { sEmail: sEmail.toLowerCase().trim() },
//         { sUsername: sUsername.trim() }
//       ]
//     }, null, { readPreference: 'primary' }).lean();

//     if (exists) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: exists.sEmail === sEmail.toLowerCase().trim() ? 'emailExists' : 'usernameExists' });
//     }

//     // Create new admin
//     const admin = new AdminModel({
//       sName,
//       sUsername,
//       sEmail: sEmail.toLowerCase().trim(),
//       sMobNum,
//       sPassword,
//       eType: 'SUB',
//       aRole: aRole || []
//     });

//     await admin.save();

//     // Return admin data without password
//     const adminData = admin.toObject();
//     delete adminData.sPassword;

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].adminCreated,
//       data: adminData,
//       error: {}
//     });
//   } catch (error) {
//     console.error('Admin creation error:', error);
//     return handleServiceError(error, req, res, { messageKey: 'errorCreatingAdmin' });
//   }
// };

// // Export users for download (JSON, no pagination)
// const exportUsers = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const role = (req.query?.userRole || '').trim();

//     const query = {};
//     if (role && role.toLowerCase() !== 'all') {
//       query.eRole = role;
//     }

//     const users = await UserModel.find(query)
//       .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
//       .populate('iSubscriptionId')
//       .populate('aParents', 'sName sEmail sPhone eRole')
//       .populate('aChildren', 'sName sEmail sPhone eRole')
//       .sort({ dCreatedAt: -1 })
//       .lean();

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang]?.usersListSuccess || 'Users exported successfully.',
//       data: { count: users.length, results: users },
//       error: {}
//     });
//   } catch (error) {
//     console.log('Error exporting users:', error);
//     return handleServiceError(error, req, res, { messageKey: 'errorGettingUsers' });
//   }
// };

// // Export course modules for download (JSON, no pagination)
// const exportCourse = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { module, gradeId, termId, subjectId, videoId, resourceId } = req.query;

//     // Parameter format/presence validation is handled by validators

//     let dataQuery = {};
//     const query = { bDelete: false }; // Only fetch non-deleted records

//     // Set model based on module
//     switch (module) {
//       case 'grade':
//         dataQuery = GradeModel.find(query).sort({ dCreatedAt: -1 });
//         break;
//       case 'subject':
//         if (gradeId) query.iGradeId = mongoose.Types.ObjectId(gradeId);
//         dataQuery = SubjectModel.find(query).sort({ dCreatedAt: -1 }).populate('iGradeId');
//         break;
//       case 'term':
//         if (gradeId) query.iGradeId = mongoose.Types.ObjectId(gradeId);
//         if (subjectId) query.iSubjectId = mongoose.Types.ObjectId(subjectId);
//         dataQuery = TermModel.find(query).sort({ dCreatedAt: -1 }).populate('iGradeId iSubjectId');
//         break;
//       case 'video':
//         if (gradeId) query.iGradeId = mongoose.Types.ObjectId(gradeId);
//         if (subjectId) query.iSubjectId = mongoose.Types.ObjectId(subjectId);
//         if (termId) query.iTermId = mongoose.Types.ObjectId(termId);
//         dataQuery = VideoModel.find(query).sort({ dCreatedAt: -1 }).populate('iGradeId iSubjectId iTermId');
//         break;
//       case 'resource':
//         if (subjectId) query.iSubjectId = mongoose.Types.ObjectId(subjectId);
//         if (termId) query.iTermId = mongoose.Types.ObjectId(termId);
//         if (videoId) query.iVideoId = mongoose.Types.ObjectId(videoId);
//         dataQuery = ResourceModel.find(query).sort({ dCreatedAt: -1 }).populate('iGradeId iSubjectId iTermId iVideoId');
//         break;
//       default:
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'invalidModuleParameter', data: { message: messages[lang].moduleOptions } });
//     }

//     const results = await dataQuery.lean();

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang]?.dataExportSuccess || `${module} data exported successfully.`,
//       data: {
//         count: results.length,
//         module: module,
//         filters: { gradeId, termId, subjectId, videoId, resourceId },
//         results: results
//       },
//       error: {}
//     });
//   } catch (error) {
//     console.log('Error exporting course data:', error);
//     return handleServiceError(error, req, res, { messageKey: 'errorExportingData' });
//   }
// };

// // Get all admins (with pagination and filtering)
// const getAllAdmins = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { search, limit, start, sorting } = getPaginationValues2(req.query);
//     const { eType, eStatus, role } = req.query;

//     const query = {};

//     // Add search filter
//     if (search) {
//       query.$or = [
//         { sName: { $regex: search, $options: 'i' } },
//         { sUsername: { $regex: search, $options: 'i' } },
//         { sEmail: { $regex: search, $options: 'i' } }
//       ];
//     }

//     // Add type filter
//     if (eType) {
//       query.eType = eType;
//     }

//     // Add status filter
//     if (eStatus) {
//       query.eStatus = eStatus;
//     }

//     // Add role filter
//     if (role) {
//       query.aRole = { $in: [role] };
//     }

//     const options = {
//       page: Math.floor(start / limit) + 1,
//       limit: limit,
//       sort: sorting,
//       select: '-sPassword -sResetToken'
//     };

//     const admins = await AdminModel.paginate(query, options);

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].adminListRetrieved,
//       data: admins,
//       error: {}
//     });
//   } catch (error) {
//     console.error('Get admins error:', error);
//     return handleServiceError(error, req, res, { messageKey: 'errorGettingAdmins' });
//   }
// };

// // Get admin by ID
// const getAdminById = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { id } = req.params;

//     const admin = await AdminModel.findById(id, null, { readPreference: 'primary' })
//       .select('-sPassword -sResetToken')
//       .populate('aRole', 'sName sKey')
//       .lean();

//     if (!admin) {
//       return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'adminNotFound' });
//     }

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].adminProfileRetrieved,
//       data: admin,
//       error: {}
//     });
//   } catch (error) {
//     console.error('Get admin by ID error:', error);
//     return handleServiceError(error, req, res, { messageKey: 'errorGettingAdmin' });
//   }
// };

// // Update admin
// const updateAdmin = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { id } = req.params;
//     const { sName, sUsername, sEmail, sMobNum, aRole, eStatus } = req.body;

//     // Check if admin exists
//     const admin = await AdminModel.findById(id, null, { readPreference: 'primary' });
//     if (!admin) {
//       return res.status(status.NotFound).json({
//         success: false,
//         message: messages[lang].adminNotFound,
//         data: {},
//         error: {}
//       });
//     }

//     // Check if trying to update super admin type
//     if (req.body.eType && admin.eType === 'SUPER' && req.body.eType !== 'SUPER') {
//       return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'cannotChangeSuperAdminType' });
//     }

//     // Check for duplicate email/username if changing
//     if (sEmail && sEmail !== admin.sEmail) {
//       const emailExists = await AdminModel.findOne({
//         sEmail: sEmail.toLowerCase().trim(),
//         _id: { $ne: id }
//       });
//       if (emailExists) {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'emailExists' });
//       }
//     }

//     if (sUsername && sUsername !== admin.sUsername) {
//       const usernameExists = await AdminModel.findOne({
//         sUsername: sUsername.trim(),
//         _id: { $ne: id }
//       });
//       if (usernameExists) {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'usernameExists' });
//       }
//     }

//     // Update admin
//     const updateData = {};
//     if (sName) updateData.sName = sName;
//     if (sUsername) updateData.sUsername = sUsername;
//     if (sEmail) updateData.sEmail = sEmail.toLowerCase().trim();
//     if (sMobNum) updateData.sMobNum = sMobNum;
//     if (aRole) updateData.aRole = aRole;
//     if (eStatus) updateData.eStatus = eStatus;

//     const updatedAdmin = await AdminModel.findByIdAndUpdate(
//       id,
//       updateData,
//       { new: true, runValidators: true, readPreference: 'primary' }
//     ).select('-sPassword -sResetToken');

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].adminUpdated,
//       data: updatedAdmin,
//       error: {}
//     });
//   } catch (error) {
//     console.error('Update admin error:', error);
//     return handleServiceError(error, req, res, { messageKey: 'errorUpdatingAdmin' });
//   }
// };

// // Delete admin
// const deleteAdmin = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { id } = req.params;

//     const admin = await AdminModel.findById(id);
//     if (!admin) {
//       return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'adminNotFound' });
//     }

//     // Prevent deletion of super admin
//     if (admin.eType === 'SUPER') {
//       return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'cannotDeleteSuperAdmin' });
//     }

//     await AdminModel.findByIdAndDelete(id);

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].adminDeleted,
//       data: {},
//       error: {}
//     });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'errorDeletingAdmin' });
//   }
// };

// // Change admin password
// const changePassword = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { id } = req.params;
//     const { sCurrentPassword, sOldPassword, sNewPassword } = req.body;

//     // Normalize current password name
//     const currentPassword = sCurrentPassword || sOldPassword;
//     if (!currentPassword || !sNewPassword) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'tokenAndPasswordRequired' });
//     }

//     // Only allow an authenticated admin to change their own password
//     if (req.admin && String(req.admin._id) !== String(id)) {
//       return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'forbidden' });
//     }

//     // Basic password policy validation (aligns with UI hint)
//     if (!sNewPassword || typeof sNewPassword !== 'string' || sNewPassword.length < 8) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'passwordPolicy' });
//     }

//     const admin = await AdminModel.findById(id, null, { readPreference: 'primary' }).select('+sPassword');
//     if (!admin) {
//       return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'adminNotFound' });
//     }

//     // Verify current password
//     const isMatch = await bcrypt.compare(currentPassword, admin.sPassword);
//     if (!isMatch) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'currentPasswordIncorrect' });
//     }

//     // Update password (pre-save hook hashes it)
//     admin.sPassword = sNewPassword;
//     await admin.save();

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].passwordChanged,
//       data: {},
//       error: {}
//     });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'errorChangingPassword' });
//   }
// };

// // Admin login
// const login = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { sEmailOrUsername, sPassword } = req.body;

//     if (!sEmailOrUsername || !sPassword) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'emailOrUsernameRequired' });
//     }

//     const admin = await AdminModel.findByCredentials(sEmailOrUsername, sPassword);
//     if (!admin) {
//       try {
//         const agent = useragent.parse(req.headers['user-agent'] || '');
//         await AdminLoginHistoryModel.create({
//           iAdminId: null,
//           sIp: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null,
//           sUserAgent: req.headers['user-agent'] || null,
//           sBrowser: agent.family || null,
//           sOs: agent.os?.family || null,
//           sDevice: agent.device?.family || null,
//           sCountry: getCountryFromIP((req.headers['x-forwarded-for'] || req.ip || '').split(',')[0]) || null,
//           eStatus: 'failed'
//         });
//       } catch (_) { }
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'incorrectCredentials' });
//     }

//     // Check if admin is active
//     if (admin.eStatus !== 'Y') {
//       return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'accountDeactivated' });
//     }

//     // Issue access/refresh tokens
//     // Keep access token behavior compatible with AdminSchema.methods.generateAuthToken()
//     const accessToken = admin.generateAuthToken();
//     // Keep refresh token minimal (used only to look up admin by _id)
//     const refreshToken = signRefreshToken({ _id: admin._id.toString(), eType: admin.eType });

//     // Persist refresh
//     let decodedRefresh;
//     try { decodedRefresh = verifyRefreshToken(refreshToken); } catch (_) { }
//     const dExpiresAt = decodedRefresh?.exp ? new Date(decodedRefresh.exp * 1000) : undefined;
//     await AdminModel.updateOne(
//       { _id: admin._id },
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

//     // Return admin data without sensitive information
//     const adminData = admin.toObject();
//     delete adminData.sPassword;
//     delete adminData.sResetToken;

//     try {
//       const agent = useragent.parse(req.headers['user-agent'] || '');
//       await AdminLoginHistoryModel.create({
//         iAdminId: admin._id,
//         sIp: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null,
//         sUserAgent: req.headers['user-agent'] || null,
//         sBrowser: agent.family || null,
//         sOs: agent.os?.family || null,
//         sDevice: agent.device?.family || null,
//         sCountry: getCountryFromIP((req.headers['x-forwarded-for'] || req.ip || '').split(',')[0]) || null,
//         eStatus: 'success'
//       });
//     } catch (_) { }

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].loginSuccessful,
//       data: { accessToken, refreshToken, admin: adminData },
//       error: {}
//     });
//   } catch (error) {
//     console.error('Admin login error:', error);
//     return handleServiceError(error, req, res, { messageKey: 'failedToLogin' });
//   }
// };

// // Refresh admin token
// const refreshToken = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const token = req.body.refreshToken || req.header('x-refresh-token');
//     if (!token) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'refreshTokenRequired' });
//     }
//     let decoded;
//     try { decoded = verifyRefreshToken(token); } catch (e) {
//       return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
//     }
//     const admin = await AdminModel.findById(decoded._id, null, { readPreference: 'primary' }).select('+aRefreshTokens.sToken').exec();
//     if (!admin) {
//       return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
//     }
//     const exists = (admin.aRefreshTokens || []).some(rt => rt.sToken === token);
//     if (!exists) {
//       return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
//     }
//     const newAccess = admin.generateAuthToken();
//     const newRefresh = signRefreshToken({ _id: admin._id.toString(), eType: admin.eType });
//     let dec;
//     try { dec = verifyRefreshToken(newRefresh); } catch (_) { }
//     const dExpiresAt = dec?.exp ? new Date(dec.exp * 1000) : undefined;
//     await AdminModel.updateOne({ _id: admin._id }, { $pull: { aRefreshTokens: { sToken: token } } });
//     await AdminModel.updateOne({ _id: admin._id }, {
//       $push: {
//         aRefreshTokens: {
//           sToken: newRefresh,
//           dExpiresAt,
//           sUserAgent: req.headers['user-agent'] || null,
//           sIp: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null
//         }
//       }
//     });
//     // await AdminModel.updateOne(
//     //   { _id: admin._id },
//     //   {
//     //     $pull: { aRefreshTokens: { sToken: token } },
//     //     $push: {
//     //       aRefreshTokens: {
//     //         sToken: newRefresh,
//     //         dExpiresAt,
//     //         sUserAgent: req.headers['user-agent'] || null,
//     //         sIp: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null
//     //       }
//     //     }
//     //   }
//     // );
//     return res.status(status.OK).json({ success: true, message: messages[lang].tokenRefreshed, data: { accessToken: newAccess, refreshToken: newRefresh }, error: {} });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'failedToRefreshToken' });
//   }
// };

// // Issue new access token for admin using a valid refresh token (no rotation)
// const accessToken = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const token = req.body.refreshToken || req.header('x-refresh-token');
//     if (!token) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'refreshTokenRequired' });
//     }
//     let decoded;
//     try { decoded = verifyRefreshToken(token); } catch (_) {
//       return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
//     }
//     const admin = await AdminModel.findById(decoded._id, null, { readPreference: 'primary' }).select('+aRefreshTokens.sToken').exec();
//     if (!admin) {
//       return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
//     }
//     const exists = (admin.aRefreshTokens || []).some(rt => rt.sToken === token);
//     if (!exists) {
//       return handleServiceError(null, req, res, { statusCode: status.Unauthorized, messageKey: 'invalidRefreshToken' });
//     }
//     const newAccess = admin.generateAuthToken();
//     return res.status(status.OK).json({ success: true, message: messages[lang].tokenRefreshed, data: { accessToken: newAccess }, error: {} });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'failedToGenerateAccessToken' });
//   }
// };

// // Logout admin (invalidate refresh)
// const logout = async (req, res) => {
//   const lang = req.userLanguage;
//   const token = req.body.refreshToken || req.header('x-refresh-token');
//   try {
//     if (!token) return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'refreshTokenRequired' });
//     let decoded;
//     try { decoded = verifyRefreshToken(token); } catch (_) { decoded = null; }
//     if (!decoded || !decoded._id) return res.status(status.OK).json({ success: true, message: messages[lang].loggedOut, data: {}, error: {} });
//     await AdminModel.updateOne({ _id: decoded._id }, { $pull: { aRefreshTokens: { sToken: token } } });
//     return res.status(status.OK).json({ success: true, message: messages[lang].loggedOut, data: {}, error: {} });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'internalServerError' });
//   }
// };

// // Forgot password -> email link
// const forgotPassword = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { sEmail } = req.body;

//     if (!sEmail) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'emailRequired' });
//     }

//     const admin = await AdminModel.findOne({
//       sEmail: sEmail.toLowerCase().trim()
//     }).exec();

//     if (!admin) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'userNotFound' });
//     }

//     const resetToken = jwt.sign({ _id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
//     admin.sResetToken = resetToken;
//     await admin.save();

//     // TODO: send mail using existing mailer
//     console.log(`Password reset token for ${admin.sEmail}: ${resetToken}`);

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].passwordResetLinkSent,
//       data: {},
//       error: {}
//     });
//   } catch (error) {
//     console.error('Forgot password error:', error);
//     return handleServiceError(error, req, res, { messageKey: 'passwordResetFailed' });
//   }
// };

// // Reset password
// const resetPassword = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { token, sNewPassword } = req.body;

//     if (!token || !sNewPassword) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'tokenAndPasswordRequired' });
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const admin = await AdminModel.findById(decoded._id, null, { readPreference: 'primary' }).select('+sPassword +sResetToken').exec();

//     if (!admin || admin.sResetToken !== token) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'invalidOrExpiredToken' });
//     }

//     admin.sPassword = sNewPassword;
//     admin.sResetToken = undefined;
//     await admin.save();

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].passwordUpdated,
//       data: {},
//       error: {}
//     });
//   } catch (error) {
//     console.error('Reset password error:', error);
//     return handleServiceError(error, req, res, { messageKey: 'passwordUpdateFailed' });
//   }
// };

// // Get admin profile
// const getProfile = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const admin = await AdminModel.findById(req.admin._id, null, { readPreference: 'primary' })
//       .select('-sPassword -sResetToken')
//       .populate({ path: 'aRole', model: 'roles', select: 'sName sKey' })
//       .lean();

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].adminProfileRetrieved,
//       data: admin,
//       error: {}
//     });
//   } catch (error) {
//     console.error('Get profile error:', error);
//     return handleServiceError(error, req, res, { messageKey: 'errorGettingProfile' });
//   }
// };

// // Update admin profile
// const updateProfile = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     // Do not allow password updates from this endpoint
//     const forbiddenPasswordKeys = ['sPassword', 'password', 'sNewPassword', 'sCurrentPassword'];
//     if (forbiddenPasswordKeys.some(key => Object.prototype.hasOwnProperty.call(req.body, key))) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'passwordUpdateNotAllowedInProfile' });
//     }

//     const { sName, sMobNum, sEmail, sLocation } = req.body;

//     // If changing email, ensure uniqueness
//     if (sEmail) {
//       const current = await AdminModel.findById(req.admin._id, null, { readPreference: 'primary' });
//       if (current && sEmail.toLowerCase().trim() !== current.sEmail) {
//         const emailExists = await AdminModel.findOne({
//           sEmail: sEmail.toLowerCase().trim(),
//           _id: { $ne: req.admin._id }
//         }).lean();
//         if (emailExists) {
//           return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'emailExists' });
//         }
//       }
//     }

//     const updateData = {};
//     if (sName) updateData.sName = sName;
//     if (sMobNum) updateData.sMobNum = sMobNum;
//     if (sEmail) updateData.sEmail = sEmail.toLowerCase().trim();
//     if (sLocation) updateData.sLocation = sLocation;

//     const updatedAdmin = await AdminModel.findByIdAndUpdate(
//       req.admin._id,
//       updateData,
//       { new: true, runValidators: true }
//     ).select('-sPassword -sResetToken');

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].adminProfileUpdated,
//       data: updatedAdmin,
//       error: {}
//     });
//   } catch (error) {
//     console.error('Update profile error:', error);
//     return handleServiceError(error, req, res, { messageKey: 'errorUpdatingProfile' });
//   }
// };

// // Get admin dashboard statistics
// const getDashboard = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     // Get basic counts
//     const totalAdmins = await AdminModel.countDocuments();
//     const activeAdmins = await AdminModel.countDocuments({ eStatus: 'Y' });
//     const superAdmins = await AdminModel.countDocuments({ eType: 'SUPER' });
//     const subAdmins = await AdminModel.countDocuments({ eType: 'SUB' });

//     // Get recent admins
//     const recentAdmins = await AdminModel.find()
//       .sort({ dCreatedAt: -1 })
//       .limit(5)
//       .select('sName sUsername sEmail eType eStatus dCreatedAt')
//       .lean();

//     // Get admin types distribution
//     const adminTypes = await AdminModel.aggregate([
//       {
//         $group: {
//           _id: '$eType',
//           count: { $sum: 1 }
//         }
//       }
//     ]);

//     // Get admin status distribution
//     const adminStatus = await AdminModel.aggregate([
//       {
//         $group: {
//           _id: '$eStatus',
//           count: { $sum: 1 }
//         }
//       }
//     ]);

//     const dashboardData = {
//       counts: {
//         total: totalAdmins,
//         active: activeAdmins,
//         super: superAdmins,
//         sub: subAdmins
//       },
//       recentAdmins,
//       distributions: {
//         types: adminTypes,
//         status: adminStatus
//       }
//     };

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].dashboardRetrieved,
//       data: dashboardData,
//       error: {}
//     });
//   } catch (error) {
//     console.error('Get dashboard error:', error);
//     return handleServiceError(error, req, res, { messageKey: 'errorGettingDashboard' });
//   }
// };

// // Fetch current admin details (token-based)
// const getAdminSelf = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const admin = req.admin;
//     return res.status(status.OK).json({
//       status: status.OK,
//       message: messages[lang].adminFetchedSuccessfully,
//       data: admin
//     });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'errorGettingProfile' });
//   }
// };

// // Get current admin's login history
// const getAdminLoginHistory = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { limit = 10, start = 0 } = req.query;
//     const query = { iAdminId: req.admin?._id };
//     const [total, results] = await Promise.all([
//       AdminLoginHistoryModel.countDocuments(query),
//       AdminLoginHistoryModel.find(query)
//         .sort({ dCreatedAt: -1 })
//         .skip(Number(start))
//         .limit(Number(limit))
//         .lean()
//     ]);

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].success,
//       data: { total, results },
//       error: {}
//     });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'failedToChangeUserStatus' });
//   }
// };

// const changeBulkUserStatus = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const statusParam = (req.params.status || '').toLowerCase();
//     const { search, limit, start, sorting } = getPaginationValues2(req.query);
//     const { role, eType, eStatus } = req.query;
//     const ids = Array.isArray(req.body?.ids) ? Array.from(new Set(req.body.ids.map(String))) : [];

//     if (!ids.length) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'provideIdsArray' });
//     }

//     // Map accepted flags to operations
//     // Accept: active | inactive | deleted
//     if (!['active', 'inactive', 'deleted'].includes(statusParam)) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'invalidStatus' });
//     }

//     // Build query for filtering
//     const query = {
//       _id: { $in: ids }
//     };

//     // Add role filter if provided
//     if (role) {
//       query.aRole = { $in: [role] };
//     }

//     // Add type filter if provided
//     if (eType) {
//       query.eType = eType;
//     }

//     // Add status filter if provided
//     if (eStatus) {
//       query.eStatus = eStatus;
//     }

//     // Add search filter if provided
//     if (search) {
//       query.$or = [
//         { sName: { $regex: search, $options: 'i' } },
//         { sUsername: { $regex: search, $options: 'i' } },
//         { sEmail: { $regex: search, $options: 'i' } }
//       ];
//     }

//     // Never modify SUPER admins
//     const result = { modifiedCount: 0, deletedCount: 0 };
//     if (statusParam === 'active') {
//       const r = await UserModel.updateMany(
//         query,
//         { $set: { eStatus: 'active' } },
//         { sort: sorting, lean: true }
//       );
//       result.modifiedCount = r.modifiedCount || 0;
//     } else if (statusParam === 'inactive') {
//       const r = await UserModel.updateMany(
//         query,
//         { $set: { eStatus: 'inactive' } },
//         { sort: sorting, lean: true }
//       );
//       result.modifiedCount = r.modifiedCount || 0;
//     } else if (statusParam === 'deleted') {
//       const r = await UserModel.updateMany(
//         query,
//         { $set: { eStatus: 'deleted' } },
//         { sort: sorting, lean: true }
//       );
//       result.modifiedCount = r.modifiedCount || 0;
//       // const r = await UserModel.deleteMany(query, { sort: sorting, lean: true });
//       // result.deletedCount = r.deletedCount || 0;
//     }

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].bulkAdminProcessed || 'Bulk admin operations processed successfully.',
//       data: {
//         status: statusParam,
//         idsProvided: ids.length,
//         modified: result.modifiedCount,
//         deleted: result.deletedCount,
//         role: role || 'all',
//         eType: eType || 'all',
//         eStatus: eStatus || 'all',
//         search: search || '',
//         pagination: {
//           start,
//           limit,
//           sorting
//         }
//       },
//       error: {}
//     });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'errorProcessingBulkAdmin' });
//   }
// };

// const changeSingleUserStatus = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { id } = req.params;
//     const statusParam = (req.params.status || '').toLowerCase();

//     if (!['active', 'inactive'].includes(statusParam)) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'invalidStatus' });
//     }

//     const user = await UserModel.findById(id);
//     if (!user) {
//       return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'userNotFound' });
//     }

//     if (statusParam === 'active') {
//       user.eStatus = 'active';
//     } else if (statusParam === 'inactive') {
//       user.eStatus = 'inactive';
//     }
//     // else if (status === 'delete') {
//     //   user.eStatus = 'deleted';
//     //   // user.bDelete = true;
//     // }

//     await user.save();

//     const userData = user.toObject();
//     delete userData.sPassword;
//     delete userData.sOtp;
//     delete userData.dOtpExpiration;
//     delete userData.aRefreshTokens;

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].userStatusUpdated,
//       data: userData,
//       error: {}
//     });
//   } catch (error) {
//     console.error('Error changing user status:', error);
//     return handleServiceError(error, req, res, { messageKey: 'errorUpdatingUser' });
//   }
// };

// // Get all users with pagination and filtering
// const getAllUsers = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { page = 1, limit = 10, search = '', role = '', status = '' } = req.query;
//     const { skip, pagination } = getPaginationValues2(page, limit);

//     const query = { bDelete: false };

//     // Search functionality
//     if (search) {
//       query.$or = [
//         { sName: { $regex: search, $options: 'i' } },
//         { sEmail: { $regex: search, $options: 'i' } },
//         { sPhone: { $regex: search, $options: 'i' } }
//       ];
//     }

//     // Role filter
//     if (role && role.toLowerCase() !== 'all') {
//       query.eRole = role;
//     }

//     // Status filter
//     // if (status) {
//     //   query.eStatus = status === 'active';
//     // }
//     if (status && ['active', 'inactive', 'deleted'].includes(status)) {
//       query.eStatus = status;
//     }

//     const users = await UserModel.find(query)
//       .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
//       .populate('iSubscriptionId')
//       .populate('aParents', 'sName sEmail sPhone eRole')
//       .populate('aChildren', 'sName sEmail sPhone eRole')
//       .sort({ dCreatedAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .lean();

//     const total = await UserModel.countDocuments(query);

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].usersListSuccess,
//       data: {
//         count: users.length,
//         total,
//         pagination,
//         results: users
//       },
//       error: {}
//     });
//   } catch (error) {
//     console.log('Error getting users:', error);
//     return handleServiceError(error, req, res, { messageKey: 'errorGettingUsers' });
//   }
// };

// // Get user by ID
// const getUserById = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { id } = req.params;

//     const user = await UserModel.findById(id)
//       .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
//       .populate('iSubscriptionId')
//       .populate('aParents', 'sName sEmail sPhone eRole')
//       .populate('aChildren', 'sName sEmail sPhone eRole')
//       .lean();

//     if (!user) {
//       return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'userNotFound' });
//     }

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].userFound,
//       data: user,
//       error: {}
//     });
//   } catch (error) {
//     console.error('Error getting user by ID:', error);
//     return handleServiceError(error, req, res, { messageKey: 'errorGettingUser' });
//   }
// };

// async function resolveUserIds (candidates, roleFilter) {
//   if (!Array.isArray(candidates) || candidates.length === 0) return [];
//   const ids = [];
//   for (const c of candidates) {
//     if (!c) continue;
//     if (typeof c === 'string' && c.match(/^[0-9a-fA-F]{24}$/)) { ids.push(c); continue; }
//     if (typeof c === 'string' && c.includes('@')) {
//       const u = await UserModel.findOne({ sEmail: c.toLowerCase().trim(), ...(roleFilter ? { eRole: roleFilter } : {}) }, { _id: 1 }).lean();
//       if (u?._id) ids.push(String(u._id));
//       continue;
//     }
//     if (typeof c === 'string' && c.replace(/\D/g, '').length >= 8) {
//       const u = await UserModel.findOne({ sPhone: c, ...(roleFilter ? { eRole: roleFilter } : {}) }, { _id: 1 }).lean();
//       if (u?._id) ids.push(String(u._id));
//       continue;
//     }
//     if (typeof c === 'object') {
//       const email = c.sEmail || c.email;
//       const phone = c.sPhone || c.phone;
//       if (email) {
//         const u = await UserModel.findOne({ sEmail: String(email).toLowerCase().trim(), ...(roleFilter ? { eRole: roleFilter } : {}) }, { _id: 1 }).lean();
//         if (u?._id) ids.push(String(u._id));
//         continue;
//       }
//       if (phone) {
//         const u = await UserModel.findOne({ sPhone: String(phone), ...(roleFilter ? { eRole: roleFilter } : {}) }, { _id: 1 }).lean();
//         if (u?._id) ids.push(String(u._id));
//         continue;
//       }
//     }
//   }
//   return Array.from(new Set(ids));
// }

// // Create new user (admin only)
// const createUser = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { eRole, sName, sEmail, sPassword, sPhone, sSchool, aParents, aChildren, bTermsAndConditions, oAddress, oUserDetails, iGradeId } = req.body;

//     const normalizedParents = [eUserRoles.map.STUDENT].includes(eRole)
//       ? await resolveUserIds(Array.isArray(aParents) ? aParents : (typeof aParents === 'string' ? aParents.split(',').map(s => s.trim()).filter(Boolean) : []), 'parent')
//       : [];
//     const normalizedChildren = [eUserRoles.map.PARENT].includes(eRole)
//       ? await resolveUserIds(Array.isArray(aChildren) ? aChildren : (typeof aChildren === 'string' ? aChildren.split(',').map(s => s.trim()).filter(Boolean) : []), 'student')
//       : [];

//     // Role-aware guard for sSchool
//     if ([eUserRoles.map.TEACHER].includes(eRole) && !sSchool) {
//       return res.status(status.BadRequest).json({
//         success: false,
//         message: messages[lang].schoolRequired,
//         data: {},
//         error: {}
//       });
//     }

//     // Check if the user already exists
//     const email = sEmail.toLowerCase().trim();
//     const existing = await UserModel.findOne({
//       sEmail: email,
//       bDelete: false
//     }).lean().exec();

//     if (existing) {
//       return res.status(status.BadRequest).json({
//         success: false,
//         message: messages[lang].emailExists,
//         data: {},
//         error: {}
//       });
//     }

//     // For students, use default password if not provided
//     const isStudent = eRole === eUserRoles.map.STUDENT;
//     const userPassword = isStudent && !sPassword ? DEFAULT_STUDENT_PASSWORD : sPassword;

//     const user = new UserModel({
//       eRole,
//       sName,
//       sEmail: email,
//       sPassword: userPassword,
//       sPhone,
//       sSchool: [eUserRoles.map.TEACHER].includes(eRole) ? sSchool : undefined,
//       iGradeId: [eUserRoles.map.STUDENT].includes(eRole) ? iGradeId : undefined,
//       aParents: [eUserRoles.map.STUDENT].includes(eRole) ? (normalizedParents.length ? normalizedParents : undefined) : undefined,
//       aChildren: [eUserRoles.map.PARENT].includes(eRole) ? (normalizedChildren.length ? normalizedChildren : undefined) : undefined,
//       bIsEmailVerified: true,
//       bTermsAndConditions: Boolean(bTermsAndConditions) === true,
//       oAddress,
//       oUserDetails: stripRelationKeysFromDetails(oUserDetails)
//     });

//     await user.save();

//     // Sync inverse links for parents/children when admin creates user
//     try {
//       const parentsForSync = [eUserRoles.map.STUDENT].includes(eRole) ? normalizedParents : [];
//       const childrenForSync = [eUserRoles.map.PARENT].includes(eRole) ? normalizedChildren : [];
//       if (parentsForSync.length) {
//         await UserModel.updateMany({ _id: { $in: parentsForSync } }, { $addToSet: { aChildren: user._id } });
//       }
//       if (childrenForSync.length) {
//         await UserModel.updateMany({ _id: { $in: childrenForSync } }, { $addToSet: { aParents: user._id } });
//       }
//     } catch (_) { }

//     // Create freemium subscription with 7-day trial as default
//     const subscription = new SubscriptionModel({
//       iUserId: user._id,
//       ePlan: eSubscriptionPlan.map.FREEMIUM,
//       nSeats: 1, // Default 1 seat for freemium
//       eStatus: ePaymentStatus.map.PENDING,
//       dTrialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7-day trial
//       dTenewalDate: null // No renewal date for freemium
//     });

//     await subscription.save();

//     // Link subscriptionId with the user
//     user.iSubscriptionId = subscription._id;
//     await user.save();

//     // Send invitation email if user is a student (non-blocking)
//     if (isStudent) {
//       sendStudentInvitationEmail({
//         studentName: sName,
//         studentEmail: email,
//         password: userPassword,
//         addedBy: 'admin'
//       }).catch(err => console.error('Failed to send student invitation email:', err));
//     }

//     const populatedUser = await UserModel.findById(user._id)
//       .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
//       .populate('iSubscriptionId')
//       .populate('aParents', 'sName sEmail sPhone eRole')
//       .populate('aChildren', 'sName sEmail sPhone eRole')
//       .populate({ path: 'iGradeId', model: GradeModel, select: 'sName sDescription' })
//       .lean();

//     // Add password to response for students (only in response, not stored in DB)
//     const responseData = isStudent
//       ? { ...populatedUser, defaultPassword: userPassword }
//       : populatedUser;

//     return res.status(status.OK).json({
//       success: true,
//       message: isStudent
//         ? (messages[lang].studentCreatedWithInvite || 'Student created successfully. Invitation email sent.')
//         : messages[lang].userCreated,
//       data: responseData,
//       error: {}
//     });
//   } catch (error) {
//     console.error('Error creating user:', error);
//     return handleServiceError(error, req, res, { messageKey: 'errorCreatingUser' });
//   }
// };

// // Update user (admin only)
// const updateUser = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { id } = req.params;
//     let { eRole, sName, sEmail, sPassword, sPhone, sSchool, aParents, aChildren, bTermsAndConditions, oAddress, oUserDetails, eStatus, iGradeId } = req.body;

//     const user = await UserModel.findById(id);
//     if (!user) {
//       return res.status(status.NotFound).json({
//         success: false,
//         message: messages[lang].userNotFound,
//         data: {},
//         error: {}
//       });
//     }

//     // Check if email is being changed and already exists
//     if (sEmail && sEmail.toLowerCase() !== user.sEmail.toLowerCase()) {
//       const existing = await UserModel.findOne({
//         sEmail: sEmail.toLowerCase(),
//         bDelete: false,
//         _id: { $ne: id }
//       }).lean().exec();

//       if (existing) {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'emailExists' });
//       }
//     }

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

//     // Capture old relations for diffing
//     const oldParents = Array.isArray(user.aParents) ? user.aParents.map(String) : [];
//     const oldChildren = Array.isArray(user.aChildren) ? user.aChildren.map(String) : [];

//     // Update user fields
//     if (eRole) user.eRole = eRole;
//     if (sName) user.sName = sName;
//     if (sEmail) user.sEmail = sEmail.toLowerCase();
//     if (sPassword) user.sPassword = sPassword;
//     if (sPhone) user.sPhone = sPhone;
//     if (sSchool !== undefined) user.sSchool = sSchool;
//     if (iGradeId !== undefined) user.iGradeId = iGradeId;
//     if (eStatus !== undefined) user.eStatus = eStatus;
//     if (aParents !== undefined) user.aParents = await resolveUserIds(Array.isArray(aParents) ? aParents : (typeof aParents === 'string' ? aParents.split(',').map(s => s.trim()).filter(Boolean) : []), 'parent');
//     if (aChildren !== undefined) user.aChildren = await resolveUserIds(Array.isArray(aChildren) ? aChildren : (typeof aChildren === 'string' ? aChildren.split(',').map(s => s.trim()).filter(Boolean) : []), 'student');
//     if (bTermsAndConditions !== undefined) user.bTermsAndConditions = Boolean(bTermsAndConditions);
//     if (oAddress) user.oAddress = oAddress;
//     if (oUserDetails) user.oUserDetails = stripRelationKeysFromDetails(oUserDetails);

//     await user.save();

//     // Inverse sync based on diffs (treat inputs from body or oUserDetails as provided)
//     try {
//       const newParents = Array.isArray(user.aParents) ? user.aParents.map(String) : [];
//       const newChildren = Array.isArray(user.aChildren) ? user.aChildren.map(String) : [];

//       const parentsProvided = aParents !== undefined;
//       const childrenProvided = aChildren !== undefined;

//       if (parentsProvided) {
//         const toAdd = newParents.filter(id => !oldParents.includes(id));
//         const toRemove = oldParents.filter(id => !newParents.includes(id));
//         if (toAdd.length) await UserModel.updateMany({ _id: { $in: toAdd } }, { $addToSet: { aChildren: user._id } });
//         if (toRemove.length) await UserModel.updateMany({ _id: { $in: toRemove } }, { $pull: { aChildren: user._id } });
//       }

//       if (childrenProvided) {
//         const toAdd = newChildren.filter(id => !oldChildren.includes(id));
//         const toRemove = oldChildren.filter(id => !newChildren.includes(id));
//         if (toAdd.length) await UserModel.updateMany({ _id: { $in: toAdd } }, { $addToSet: { aParents: user._id } });
//         if (toRemove.length) await UserModel.updateMany({ _id: { $in: toRemove } }, { $pull: { aParents: user._id } });
//       }
//     } catch (_) { }

//     const populatedUser = await UserModel.findById(user._id)
//       .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
//       .populate('iSubscriptionId')
//       .populate('aParents', 'sName sEmail sPhone eRole')
//       .populate('aChildren', 'sName sEmail sPhone eRole')
//       .lean();

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].userUpdated,
//       data: populatedUser,
//       error: {}
//     });
//   } catch (error) {
//     console.error('Error updating user:', error);
//     return handleServiceError(error, req, res, { messageKey: 'errorUpdatingUser' });
//   }
// };

// // Delete user (admin only) - soft delete
// const deleteUser = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { id } = req.params;

//     const user = await UserModel.findById(id);
//     if (!user) {
//       return res.status(status.NotFound).json({
//         success: false,
//         message: messages[lang].userNotFound,
//         data: {},
//         error: {}
//       });
//     }

//     user.eStatus = 'deleted';
//     await user.save();
//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].userDeleted,
//       data: {},
//       error: {}
//     });
//   } catch (error) {
//     console.error('Error deleting user:', error);
//     return handleServiceError(error, req, res, { messageKey: 'errorDeletingUser' });
//   }
// };

// // Generate pre-signed URL for image upload
// async function generatePreSignedUrl ({ sFileName, sContentType, path }) {
//   // eslint-disable-next-line no-useless-catch
//   try {
//     console.log(sFileName, sContentType, path);
//     sFileName = sFileName.replace('/', '-');
//     sFileName = sFileName.replace(/\s/gi, '-');

//     const fileKey = `${Date.now()}_${sFileName}`;
//     const s3Path = path;

//     const params = {
//       Bucket: config.S3_BUCKET_NAME,
//       Key: s3Path + fileKey,
//       ContentType: sContentType
//     };

//     const expiresIn = 300;
//     const command = new PutObjectCommand(params);
//     const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });

//     return { sUrl: signedUrl, sPath: s3Path + fileKey };
//   } catch (error) {
//     console.log('Error generating pre-signed URL:', error);
//     // handleCatchError(error);
//     throw error; // Re-throw to be handled by the calling function
//   }
// }

// // Get signed URL for image upload
// const getSignedUploadUrl = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     // req.body = pick(req.body, ['sFileName', 'sContentType', 'sPath']);
//     console.log('req.body', req.body);
//     const { sFileName, sContentType, sPath } = req.body;
//     console.log('sFileName, sContentType, sPath', sFileName, sContentType, sPath);
//     // const valid = checkValidImageType(sFileName, sContentType);
//     // if (!valid) return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'invalidImage' });

//     // Generate a signed URL for the image upload
//     const path = process.env.S3_FOLDER_PATH || `images/${sPath}`;
//     console.log('path', path);
//     const data = await generatePreSignedUrl({ sFileName, sContentType, path: path });

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].presigned_succ || 'Pre-signed URL generated successfully',
//       data,
//       error: {}
//     });
//   } catch (error) {
//     console.error('Error generating pre-signed URL:', error);
//     return handleServiceError(error, req, res, { messageKey: 'errorGeneratingPreSignedUrl' });
//   }
// };

// function stripRelationKeysFromDetails (details) {
//   if (!details || typeof details !== 'object') return details;
//   const cloned = { ...details };
//   delete cloned.aParents;
//   delete cloned.parents;
//   delete cloned.aChildren;
//   delete cloned.children;
//   return cloned;
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

// module.exports = {
//   create,
//   getAllAdmins,
//   getAdminById,
//   updateAdmin,
//   deleteAdmin,
//   changePassword,
//   login,
//   refreshToken,
//   accessToken,
//   logout,
//   forgotPassword,
//   resetPassword,
//   getProfile,
//   updateProfile,
//   getDashboard,
//   getAdminSelf,
//   exportUsers,
//   exportCourse,
//   changeBulkUserStatus,
//   changeSingleUserStatus,
//   getAllUsers,
//   getUserById,
//   createUser,
//   updateUser,
//   deleteUser,
//   getAdminLoginHistory,
//   getSignedUploadUrl
// };
