const { messages, status } = require('../../../helper/api.responses');
const { handleServiceError, getPaginationValues2 } = require('../../../helper/utilities.services');
const UserModel = require('../model');
const SubscriptionModel = require('../../subscription/model');
const GradeModel = require('../../course/grades/model');
const { eUserRoles } = require('../../../data');
const { signedUrl } = require('../../../helper/s3config');

/**
 * Helper functions for user ID resolution
 */
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

function coerceIdList (input) {
  if (Array.isArray(input)) return input;
  if (input == null) return [];
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return [];
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === 'object' && parsed._id) return [String(parsed._id)];
      } catch (_) { /* fall through to comma split */ }
    }
    return trimmed.split(',').map(s => s.replace(/^["'[]+|["'\]]+$/g, '').trim()).filter(Boolean);
  }
  if (typeof input === 'object') {
    if (input._id) return [String(input._id)];
    return [];
  }
  return [];
}

/**
 * User Profile Services
 * Handles profile viewing, updating, and user list management
 */

/**
 * Update user profile
 */
const updateProfile = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const userId = req.user._id;
    let { sName, sPhone, iSchool, sSchool, iGradeId, aParents, aChildren, oAddress, oUserDetails, oSponsorDashboard, sImage, bTwoFactorAuthentication, oNotificationPreference } = req.body;

    // Extract children/parents from oUserDetails if present
    let childrenFromDetails = null;
    let parentsFromDetails = null;
    if (oUserDetails && typeof oUserDetails === 'object') {
      if (oUserDetails.children !== undefined) {
        childrenFromDetails = coerceIdList(oUserDetails.children);
      }
      if (oUserDetails.parents !== undefined || oUserDetails.aParents !== undefined) {
        parentsFromDetails = coerceIdList(oUserDetails.parents || oUserDetails.aParents);
      }
    }

    // Merge children/parents from oUserDetails with top-level arrays
    if (childrenFromDetails !== null && aChildren === undefined) {
      aChildren = childrenFromDetails;
    }
    if (parentsFromDetails !== null && aParents === undefined) {
      aParents = parentsFromDetails;
    }

    // Normalize from top-level only
    const normalizedParents = await resolveUserIds(Array.isArray(aParents) ? aParents : (typeof aParents === 'string' ? aParents.split(',').map(s => s.trim()).filter(Boolean) : []), 'parent');
    const normalizedChildren = await resolveUserIds(Array.isArray(aChildren) ? aChildren : (typeof aChildren === 'string' ? aChildren.split(',').map(s => s.trim()).filter(Boolean) : []), 'student');

    // Update allowed fields
    const updateData = {};
    if (sName !== undefined) updateData.sName = sName.trim();
    if (sPhone !== undefined) updateData.sPhone = sPhone.trim();
    if (iSchool !== undefined) updateData.iSchool = iSchool;
    if (sSchool !== undefined) updateData.sSchool = sSchool;
    if (iGradeId !== undefined) updateData.iGradeId = iGradeId;
    if (aParents !== undefined && normalizedParents) updateData.aParents = normalizedParents;
    if (aChildren !== undefined && normalizedChildren) updateData.aChildren = normalizedChildren;
    if (oAddress !== undefined) updateData.oAddress = oAddress;
    if (oUserDetails !== undefined) {
      const d = { ...oUserDetails };
      delete d.aParents; delete d.parents; delete d.aChildren; delete d.children;
      updateData.oUserDetails = d;
    }
    if (sImage !== undefined) updateData.sImage = sImage;
    if (bTwoFactorAuthentication !== undefined) updateData.bTwoFactorAuthentication = Boolean(bTwoFactorAuthentication);
    if (oNotificationPreference !== undefined && typeof oNotificationPreference === 'object') {
      updateData['oNotificationPreference.bEmail'] = typeof oNotificationPreference.bEmail === 'boolean' ? oNotificationPreference.bEmail : undefined;
      updateData['oNotificationPreference.bPush'] = typeof oNotificationPreference.bPush === 'boolean' ? oNotificationPreference.bPush : undefined;
      updateData['oNotificationPreference.bPhone'] = typeof oNotificationPreference.bPhone === 'boolean' ? oNotificationPreference.bPhone : undefined;
    }
    if (oSponsorDashboard !== undefined) {
      updateData.oSponsorDashboard = oSponsorDashboard;
    }

    // Compute inverse sync diffs if relationship fields are provided
    const existing = await UserModel.findById(userId, 'aParents aChildren eRole', { readPreference: 'primary' }).lean();
    const oldParents = Array.isArray(existing?.aParents) ? existing.aParents.map(String) : [];
    const oldChildren = Array.isArray(existing?.aChildren) ? existing.aChildren.map(String) : [];

    const parentsProvided = aParents !== undefined;
    const childrenProvided = aChildren !== undefined;

    const newParents = parentsProvided ? normalizedParents : oldParents;
    const newChildren = childrenProvided ? normalizedChildren : oldChildren;

    const parentsToAdd = parentsProvided ? newParents.filter(id => !oldParents.includes(id)) : [];
    const parentsToRemove = parentsProvided ? oldParents.filter(id => !newParents.includes(id)) : [];
    const childrenToAdd = childrenProvided ? newChildren.filter(id => !oldChildren.includes(id)) : [];
    const childrenToRemove = childrenProvided ? oldChildren.filter(id => !newChildren.includes(id)) : [];

    // Update the user
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true, readPreference: 'primary' }
    )
      .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
      .populate('aParents', 'sName sEmail sPhone eRole')
      .populate('aChildren', 'sName sEmail sPhone eRole')
      .populate('iSchool', 'sName sAddress sCity sState sCountry')
      .populate('iSubscriptionId');

    if (!updatedUser) {
      return res.status(status.NotFound).json({
        success: false,
        message: messages[lang].userNotFound,
        data: {},
        error: {}
      });
    }

    // Apply inverse sync operations after successful update
    try {
      if (parentsProvided) {
        if (parentsToAdd.length) {
          await UserModel.updateMany({ _id: { $in: parentsToAdd } }, { $addToSet: { aChildren: userId } });
        }
        if (parentsToRemove.length) {
          await UserModel.updateMany({ _id: { $in: parentsToRemove } }, { $pull: { aChildren: userId } });
        }
      }

      if (childrenProvided) {
        if (childrenToAdd.length) {
          await UserModel.updateMany({ _id: { $in: childrenToAdd } }, { $addToSet: { aParents: userId } });
        }
        if (childrenToRemove.length) {
          await UserModel.updateMany({ _id: { $in: childrenToRemove } }, { $pull: { aParents: userId } });
        }
      }
    } catch (_) { }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].profileUpdated || 'Profile updated successfully',
      data: { user: updatedUser },
      error: {}
    });
  } catch (error) {
    console.log('error', error);
    return handleServiceError(error, req, res, { messageKey: 'profileUpdateFailed' });
  }
};

/**
 * Get authenticated user details
 */
const getUserDetails = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(status.Unauthorized).json({ success: false, message: messages[lang].userNotFound, data: {}, error: {} });
    }

    const user = await UserModel.findById(userId, null, { readPreference: 'primary' })
      .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
      .populate('aParents', 'sName sEmail sPhone eRole')
      .populate('aChildren', 'sName sEmail sPhone eRole')
      .populate('iSchool', 'sName sAddress sCity sState sCountry')
      .populate({ path: 'iGradeId', model: GradeModel, select: '_id sName' })
      .populate('oAiTutorLanguage', 'sName sLocalName sFlagImage')
      .lean();

    if (!user) {
      return res.status(status.NotFound).json({ success: false, message: messages[lang].userNotFound, data: {}, error: {} });
    }

    const sponsorDashboard = user.eRole === eUserRoles.map.SPONSOR ? (user.oSponsorDashboard || null) : null;
    return res.status(status.OK).json({
      success: true,
      message: messages[lang].success || 'Success',
      data: { user, sponsorDashboard },
      error: {}
    });
  } catch (error) {
    console.log('getUserDetails error:', error);
    return handleServiceError(error, req, res, { messageKey: 'internalServerError' });
  }
};

/**
 * Admin List Users
 */
const getUsersList = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { search, limit, start } = getPaginationValues2(req.query);
    const { isEmailVerified, isFullResponse, role, datefrom, dateto, eStatus, ePlan, includeDeleted = false } = req.query;
    let query = {};

    // Include deleted users only if explicitly requested (for admin to see deleted students)
    if (![true, 'true', '1'].includes(includeDeleted)) {
      query.bDelete = false;
    }

    if (search) {
      query = { ...query, sName: new RegExp('^.*' + search + '.*', 'i') };
    }
    if (isEmailVerified) {
      if (typeof isEmailVerified !== 'undefined') {
        query.bIsEmailVerified = isEmailVerified === 'verified';
      }
    }
    if (role) {
      query.eRole = role;
    }
    if (eStatus) {
      query.eStatus = eStatus;
    }
    // else {
    //   // Default filter: exclude inactive users (previously excluded deleted)
    //   query.eStatus = { $ne: 'inactive' };
    // }
    if (datefrom && dateto) {
      // assuming the date format is ISO string (YYYY-MM-DDTHH:MM:SSZ)
      query.dCreatedAt = { $gte: new Date(`${datefrom}T00:00:00Z`), $lte: new Date(`${dateto}T23:59:59Z`) };
    }

    // Filter by subscription type (ePlan) via Subscription collection
    const planToFilter = ePlan;
    if (planToFilter) {
      const subscriptions = await SubscriptionModel.find({ ePlan: planToFilter }, { _id: 1 }).lean();
      const subscriptionIds = subscriptions.map(s => s._id);
      // If no matching subscriptions, ensure no users are returned
      if (subscriptionIds.length === 0) {
        return res.status(status.OK).json({
          success: true,
          message: messages[lang].usersListSuccess,
          data: { total: 0, results: [] },
          error: {}
        });
      }
      query.iSubscriptionId = { $in: subscriptionIds };
    }

    let results = [];
    let total = 0;

    if ([true, 'true'].includes(isFullResponse)) {
      results = await UserModel.find(query, { sPassword: 0, sOtp: 0, dOtpExpiration: 0, aRefreshTokens: 0 })
        .populate('iSubscriptionId')
        .populate('aParents', 'sName sEmail sPhone eRole')
        .populate('aChildren', 'sName sEmail sPhone eRole')
        .sort({ dCreatedAt: -1 })
        .lean();
      total = results.length;
    } else {
      [total, results] = await Promise.all([
        UserModel.countDocuments(query),
        UserModel.find(query, { sPassword: 0, sOtp: 0, dOtpExpiration: 0, aRefreshTokens: 0 })
          .populate('iSubscriptionId')
          .populate('aParents', 'sName sEmail sPhone eRole')
          .populate('aChildren', 'sName sEmail sPhone eRole')
          .sort({ dCreatedAt: -1 })
          .skip(Number(start))
          .limit(Number(limit))
          .lean()
      ]);
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].usersListSuccess,
      data: {
        total,
        results,
        limit: [true, 'true'].includes(isFullResponse) ? null : Number(limit),
        start: [true, 'true'].includes(isFullResponse) ? null : Number(start)
      },
      error: {}
    });
  } catch (error) {
    console.log("error in 'getUsersList", error);
    return handleServiceError(error, req, res, { messageKey: 'errorGettingUsers' });
  }
};

/**
 * Generate S3 presigned URL for uploads
 */
const getPresignUrl = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(status.Unauthorized).json({ success: false, message: messages[lang].err_unauthorized, data: {}, error: {} });
    }

    let { sFileName, sContentType, sPath, eType } = req.body;

    // default path prefix per user
    if (!sPath) sPath = `uploads/users/${userId}/`;

    const result = await signedUrl(String(sFileName || 'file'), String(sContentType || 'application/octet-stream'), sPath, eType);

    if (!result?.sUrl || !result?.sPath) {
      return res.status(status.InternalServerError).json({ success: false, message: messages[lang].error, data: {}, error: {} });
    }

    return res.status(status.OK).json({ success: true, message: messages[lang].success || 'Success', data: { sUrl: result.sUrl, sPath: result.sPath }, error: {} });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToGeneratePresignedUrl' });
  }
};

module.exports = {
  updateProfile,
  getUserDetails,
  getUsersList,
  getPresignUrl
};
