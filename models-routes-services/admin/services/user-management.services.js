const { messages, status } = require('../../../helper/api.responses');
const { handleServiceError, getPaginationValues2 } = require('../../../helper/utilities.services');
const UserModel = require('../../user/model');
const GradeModel = require('../../course/grades/model');
const { eUserRoles } = require('../../../data');
const { DEFAULT_STUDENT_PASSWORD } = require('../../../config/defaultConfig');
const { sendUserInvitationEmail } = require('../../../helper/mail.services');
const { createFreemiumUserSubscription } = require('../../subscription/common');

/**
 * Admin User Management Services
 * Handles admin operations on user accounts
 */

async function resolveUserIds (candidates, roleFilter) {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  const ids = [];
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === 'string' && c.match(/^[0-9a-fA-F]{24}$/)) { ids.push(c); continue; }
    if (typeof c === 'string' && c.includes('@')) {
      const u = await UserModel.findOne({ sEmail: c.toLowerCase().trim(), ...(roleFilter ? { eRole: roleFilter } : {}) }, { _id: 1 }).lean();
      if (u?._id) ids.push(String(u._id));
      continue;
    }
    if (typeof c === 'string' && c.replace(/\D/g, '').length >= 8) {
      const u = await UserModel.findOne({ sPhone: c, ...(roleFilter ? { eRole: roleFilter } : {}) }, { _id: 1 }).lean();
      if (u?._id) ids.push(String(u._id));
      continue;
    }
    if (typeof c === 'object') {
      const email = c.sEmail || c.email;
      const phone = c.sPhone || c.phone;
      if (email) {
        const u = await UserModel.findOne({ sEmail: String(email).toLowerCase().trim(), ...(roleFilter ? { eRole: roleFilter } : {}) }, { _id: 1 }).lean();
        if (u?._id) ids.push(String(u._id));
        continue;
      }
      if (phone) {
        const u = await UserModel.findOne({ sPhone: String(phone), ...(roleFilter ? { eRole: roleFilter } : {}) }, { _id: 1 }).lean();
        if (u?._id) ids.push(String(u._id));
        continue;
      }
    }
  }
  return Array.from(new Set(ids));
}

function stripRelationKeysFromDetails (details) {
  if (!details || typeof details !== 'object') return details;
  const cloned = { ...details };
  delete cloned.aParents;
  delete cloned.parents;
  delete cloned.aChildren;
  delete cloned.children;
  return cloned;
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

const changeBulkUserStatus = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const statusParam = (req.params.status || '').toLowerCase();
    const { search, limit, start, sorting } = getPaginationValues2(req.query);
    const { role, eType, eStatus } = req.query;
    const ids = Array.isArray(req.body?.ids) ? Array.from(new Set(req.body.ids.map(String))) : [];

    if (!ids.length) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'provideIdsArray' });
    }

    // Map accepted flags to operations
    // Accept: active | inactive | deleted
    if (!['active', 'inactive', 'deleted'].includes(statusParam)) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'invalidStatus' });
    }

    // Build query for filtering
    const query = {
      _id: { $in: ids }
    };

    // Add role filter if provided
    if (role) {
      query.aRole = { $in: [role] };
    }

    // Add type filter if provided
    if (eType) {
      query.eType = eType;
    }

    // Add status filter if provided
    if (eStatus) {
      query.eStatus = eStatus;
    }

    // Add search filter if provided
    if (search) {
      query.$or = [
        { sName: { $regex: search, $options: 'i' } },
        { sUsername: { $regex: search, $options: 'i' } },
        { sEmail: { $regex: search, $options: 'i' } }
      ];
    }

    // Never modify SUPER admins
    const result = { modifiedCount: 0, deletedCount: 0 };
    if (statusParam === 'active') {
      const r = await UserModel.updateMany(
        query,
        { $set: { eStatus: 'active' } },
        { sort: sorting, lean: true }
      );
      result.modifiedCount = r.modifiedCount || 0;
    } else if (statusParam === 'inactive') {
      const r = await UserModel.updateMany(
        query,
        { $set: { eStatus: 'inactive' } },
        { sort: sorting, lean: true }
      );
      result.modifiedCount = r.modifiedCount || 0;
    } else if (statusParam === 'deleted') {
      const r = await UserModel.updateMany(
        query,
        { $set: { eStatus: 'deleted' } },
        { sort: sorting, lean: true }
      );
      result.modifiedCount = r.modifiedCount || 0;
      // const r = await UserModel.deleteMany(query, { sort: sorting, lean: true });
      // result.deletedCount = r.deletedCount || 0;
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].bulkAdminProcessed || 'Bulk admin operations processed successfully.',
      data: {
        status: statusParam,
        idsProvided: ids.length,
        modified: result.modifiedCount,
        deleted: result.deletedCount,
        role: role || 'all',
        eType: eType || 'all',
        eStatus: eStatus || 'all',
        search: search || '',
        pagination: {
          start,
          limit,
          sorting
        }
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'errorProcessingBulkAdmin' });
  }
};

const changeSingleUserStatus = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const statusParam = (req.params.status || '').toLowerCase();

    if (!['active', 'inactive'].includes(statusParam)) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'invalidStatus' });
    }

    const user = await UserModel.findById(id);
    if (!user) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'userNotFound' });
    }

    if (statusParam === 'active') {
      user.eStatus = 'active';
    } else if (statusParam === 'inactive') {
      user.eStatus = 'inactive';
    }
    // else if (status === 'delete') {
    //   user.eStatus = 'deleted';
    //   // user.bDelete = true;
    // }

    await user.save();

    const userData = user.toObject();
    delete userData.sPassword;
    delete userData.sOtp;
    delete userData.dOtpExpiration;
    delete userData.aRefreshTokens;

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].userStatusUpdated,
      data: userData,
      error: {}
    });
  } catch (error) {
    console.error('Error changing user status:', error);
    return handleServiceError(error, req, res, { messageKey: 'errorUpdatingUser' });
  }
};

// Get all users with pagination and filtering
const getAllUsers = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { page = 1, limit = 10, search = '', role = '', status = '', includeDeleted = false } = req.query;
    const { skip } = getPaginationValues2(page, limit);

    const query = {};

    // Include deleted users only if explicitly requested (for admin to see deleted students)
    if (![true, 'true', '1'].includes(includeDeleted)) {
      query.bDelete = false;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { sName: { $regex: search, $options: 'i' } },
        { sEmail: { $regex: search, $options: 'i' } },
        { sPhone: { $regex: search, $options: 'i' } }
      ];
    }

    // Role filter
    if (role && role.toLowerCase() !== 'all') {
      query.eRole = role;
    }

    // Status filter
    // if (status) {
    //   query.eStatus = status === 'active';
    // }
    if (status && ['active', 'inactive', 'deleted'].includes(status)) {
      query.eStatus = status;
    }

    const users = await UserModel.find(query)
      .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
      .populate('iSubscriptionId')
      .populate('iSchool', 'sName sAddress sCity sState sCountry')
      .populate('aParents', 'sName sEmail sPhone eRole')
      .populate('aChildren', 'sName sEmail sPhone eRole')
      .populate({ path: 'iGradeId', model: GradeModel, select: 'sName sDescription' })
      .sort({ dCreatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Remove refresh tokens from each user
    users.forEach(user => delete user.aRefreshTokens);

    const total = await UserModel.countDocuments(query);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].usersListSuccess,
      data: {
        total,
        results: users,
        limit: parseInt(limit),
        start: skip
      },
      error: {}
    });
  } catch (error) {
    console.log('Error getting users:', error);
    return handleServiceError(error, req, res, { messageKey: 'errorGettingUsers' });
  }
};

// Get user by ID
const getUserById = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;

    const user = await UserModel.findById(id)
      .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
      .populate('iSubscriptionId')
      .populate('iSchool', 'sName sAddress sCity sState sCountry')
      .populate('aParents', 'sName sEmail sPhone eRole')
      .populate('aChildren', 'sName sEmail sPhone eRole')
      .lean();

    if (!user) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'userNotFound' });
    }

    // Remove refresh tokens from response
    delete user.aRefreshTokens;

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].userFound,
      data: user,
      error: {}
    });
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return handleServiceError(error, req, res, { messageKey: 'errorGettingUser' });
  }
};

// Create new user (admin only)
const createUser = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { eRole, sName, sEmail, sPassword, sPhone, iSchool, sSchool, aParents, aChildren, bTermsAndConditions, oAddress, oUserDetails, iGradeId } = req.body;

    const normalizedParents = [eUserRoles.map.STUDENT].includes(eRole)
      ? await resolveUserIds(Array.isArray(aParents) ? aParents : (typeof aParents === 'string' ? aParents.split(',').map(s => s.trim()).filter(Boolean) : []), 'parent')
      : [];
    const normalizedChildren = [eUserRoles.map.PARENT].includes(eRole)
      ? await resolveUserIds(Array.isArray(aChildren) ? aChildren : (typeof aChildren === 'string' ? aChildren.split(',').map(s => s.trim()).filter(Boolean) : []), 'student')
      : [];

    // Role-aware guard for iSchool
    // if ([eUserRoles.map.TEACHER].includes(eRole) && !iSchool) {
    //   return res.status(status.BadRequest).json({
    //     success: false,
    //     message: messages[lang].schoolRequired,
    //     data: {},
    //     error: {}
    //   });
    // }

    // Check if the user already exists
    const email = sEmail.toLowerCase().trim();
    const existing = await UserModel.findOne({
      sEmail: email,
      bDelete: false
    }).lean().exec();

    if (existing) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang].emailExists,
        data: {},
        error: {}
      });
    }

    // For students, use default password if not provided
    const isStudent = eRole === eUserRoles.map.STUDENT;
    const userPassword = isStudent && !sPassword ? DEFAULT_STUDENT_PASSWORD : sPassword;

    const user = new UserModel({
      eRole,
      sName,
      sEmail: email,
      sPassword: userPassword,
      sPhone,
      iSchool: iSchool || undefined,
      sSchool: sSchool || undefined,
      iGradeId: [eUserRoles.map.STUDENT].includes(eRole) ? iGradeId : undefined,
      aParents: [eUserRoles.map.STUDENT].includes(eRole) ? (normalizedParents.length ? normalizedParents : undefined) : undefined,
      aChildren: [eUserRoles.map.PARENT].includes(eRole) ? (normalizedChildren.length ? normalizedChildren : undefined) : undefined,
      bIsEmailVerified: true,
      bTermsAndConditions: Boolean(bTermsAndConditions) === true,
      oAddress,
      oUserDetails: stripRelationKeysFromDetails(oUserDetails)
    });

    await user.save();

    // Sync inverse links for parents/children when admin creates user
    try {
      const parentsForSync = [eUserRoles.map.STUDENT].includes(eRole) ? normalizedParents : [];
      const childrenForSync = [eUserRoles.map.PARENT].includes(eRole) ? normalizedChildren : [];
      if (parentsForSync.length) {
        await UserModel.updateMany({ _id: { $in: parentsForSync } }, { $addToSet: { aChildren: user._id } });
      }
      if (childrenForSync.length) {
        await UserModel.updateMany({ _id: { $in: childrenForSync } }, { $addToSet: { aParents: user._id } });
      }
    } catch (_) { }

    // Create freemium subscription for the user
    const subscription = await createFreemiumUserSubscription({ iUserId: user._id });
    if (subscription) {
      user.iSubscriptionId = subscription?._id;
      await user.save();
    }

    sendUserInvitationEmail({
      name: sName,
      email,
      role: eRole,
      temporaryPassword: userPassword,
      addedBy: 'admin'
    }).catch(err => console.error('Failed to send invitation email:', err));

    const populatedUser = await UserModel.findById(user._id)
      .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
      .populate('iSubscriptionId')
      .populate('iSchool', 'sName sAddress sCity sState sCountry')
      .populate('aParents', 'sName sEmail sPhone eRole')
      .populate('aChildren', 'sName sEmail sPhone eRole')
      .populate({ path: 'iGradeId', model: GradeModel, select: 'sName sDescription' })
      .lean();

    // Remove refresh tokens from response
    delete populatedUser.aRefreshTokens;

    // Add password to response for students (only in response, not stored in DB)
    const responseData = isStudent
      ? { ...populatedUser, defaultPassword: userPassword }
      : populatedUser;

    return res.status(status.OK).json({
      success: true,
      message: isStudent
        ? (messages[lang].studentCreatedWithInvite || 'Student created successfully. Invitation email sent.')
        : messages[lang].userCreated,
      data: responseData,
      error: {}
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return handleServiceError(error, req, res, { messageKey: 'errorCreatingUser' });
  }
};

// Update user (admin only)
const updateUser = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    let { eRole, sName, sEmail, sPassword, sPhone, iSchool, sSchool, aParents, aChildren, bTermsAndConditions, oAddress, oUserDetails, eStatus, iGradeId } = req.body;

    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(status.NotFound).json({
        success: false,
        message: messages[lang].userNotFound,
        data: {},
        error: {}
      });
    }

    // Check if email is being changed and already exists
    if (sEmail && sEmail.toLowerCase() !== user.sEmail.toLowerCase()) {
      const existing = await UserModel.findOne({
        sEmail: sEmail.toLowerCase(),
        bDelete: false,
        _id: { $ne: id }
      }).lean().exec();

      if (existing) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'emailExists' });
      }
    }

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
    // Priority: top-level aChildren/aParents > oUserDetails.children/parents
    if (childrenFromDetails !== null && aChildren === undefined) {
      aChildren = childrenFromDetails;
    }
    if (parentsFromDetails !== null && aParents === undefined) {
      aParents = parentsFromDetails;
    }

    // Capture old relations for diffing
    const oldParents = Array.isArray(user.aParents) ? user.aParents.map(String) : [];
    const oldChildren = Array.isArray(user.aChildren) ? user.aChildren.map(String) : [];

    // Update user fields
    if (eRole) user.eRole = eRole;
    if (sName) user.sName = sName;
    if (sEmail) user.sEmail = sEmail.toLowerCase();
    if (sPassword) user.sPassword = sPassword;
    if (sPhone) user.sPhone = sPhone;
    if (iSchool !== undefined) user.iSchool = iSchool;
    if (sSchool !== undefined) user.sSchool = sSchool;
    if (iGradeId !== undefined) user.iGradeId = iGradeId;
    if (eStatus !== undefined) user.eStatus = eStatus;
    if (aParents !== undefined) user.aParents = await resolveUserIds(Array.isArray(aParents) ? aParents : (typeof aParents === 'string' ? aParents.split(',').map(s => s.trim()).filter(Boolean) : []), 'parent');
    if (aChildren !== undefined) user.aChildren = await resolveUserIds(Array.isArray(aChildren) ? aChildren : (typeof aChildren === 'string' ? aChildren.split(',').map(s => s.trim()).filter(Boolean) : []), 'student');
    if (bTermsAndConditions !== undefined) user.bTermsAndConditions = Boolean(bTermsAndConditions);
    if (oAddress) user.oAddress = oAddress;
    if (oUserDetails) user.oUserDetails = stripRelationKeysFromDetails(oUserDetails);

    await user.save();

    // Inverse sync based on diffs (treat inputs from body or oUserDetails as provided)
    try {
      const newParents = Array.isArray(user.aParents) ? user.aParents.map(String) : [];
      const newChildren = Array.isArray(user.aChildren) ? user.aChildren.map(String) : [];

      const parentsProvided = aParents !== undefined;
      const childrenProvided = aChildren !== undefined;

      if (parentsProvided) {
        const toAdd = newParents.filter(id => !oldParents.includes(id));
        const toRemove = oldParents.filter(id => !newParents.includes(id));
        if (toAdd.length) await UserModel.updateMany({ _id: { $in: toAdd } }, { $addToSet: { aChildren: user._id } });
        if (toRemove.length) await UserModel.updateMany({ _id: { $in: toRemove } }, { $pull: { aChildren: user._id } });
      }

      if (childrenProvided) {
        const toAdd = newChildren.filter(id => !oldChildren.includes(id));
        const toRemove = oldChildren.filter(id => !newChildren.includes(id));
        if (toAdd.length) await UserModel.updateMany({ _id: { $in: toAdd } }, { $addToSet: { aParents: user._id } });
        if (toRemove.length) await UserModel.updateMany({ _id: { $in: toRemove } }, { $pull: { aParents: user._id } });
      }
    } catch (_) { }

    const populatedUser = await UserModel.findById(user._id)
      .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
      .populate('iSubscriptionId')
      .populate('iSchool', 'sName sAddress sCity sState sCountry')
      .populate('aParents', 'sName sEmail sPhone eRole')
      .populate('aChildren', 'sName sEmail sPhone eRole')
      .lean();

    // Remove refresh tokens from response
    delete populatedUser.aRefreshTokens;

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].userUpdated,
      data: populatedUser,
      error: {}
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return handleServiceError(error, req, res, { messageKey: 'errorUpdatingUser' });
  }
};

// Delete user (admin only) - soft delete
const deleteUser = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;

    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(status.NotFound).json({
        success: false,
        message: messages[lang].userNotFound,
        data: {},
        error: {}
      });
    }

    user.bDelete = true;
    await user.save();
    return res.status(status.OK).json({
      success: true,
      message: messages[lang].userDeleted,
      data: {},
      error: {}
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return handleServiceError(error, req, res, { messageKey: 'errorDeletingUser' });
  }
};

module.exports = {
  changeBulkUserStatus,
  changeSingleUserStatus,
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};
