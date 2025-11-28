const bcrypt = require('bcrypt');
const { messages, status } = require('../../../helper/api.responses');
const { handleServiceError, getPaginationValues2 } = require('../../../helper/utilities.services');
const AdminModel = require('../model');

/**
 * Admin Management Services
 * Handles CRUD operations for admin accounts
 */

/**
 * Create subadmin (SUPER or role-based admin only)
 */
const create = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { sName, sUsername, sEmail, sMobNum, sPassword, aRole } = req.body;

    // Check if admin already exists
    const exists = await AdminModel.findOne({
      $or: [
        { sEmail: sEmail.toLowerCase().trim() },
        { sUsername: sUsername.trim() }
      ]
    }, null, { readPreference: 'primary' }).lean();

    if (exists) {
      return handleServiceError(null, req, res, {
        statusCode: status.BadRequest,
        messageKey: exists.sEmail === sEmail.toLowerCase().trim() ? 'emailExists' : 'usernameExists'
      });
    }

    // Create new admin
    const admin = new AdminModel({
      sName,
      sUsername,
      sEmail: sEmail.toLowerCase().trim(),
      sMobNum,
      sPassword,
      eType: 'SUB',
      aRole: aRole || []
    });

    await admin.save();

    // Return admin data without password
    const adminData = admin.toObject();
    delete adminData.sPassword;

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].adminCreated,
      data: adminData,
      error: {}
    });
  } catch (error) {
    console.error('Admin creation error:', error);
    return handleServiceError(error, req, res, { messageKey: 'errorCreatingAdmin' });
  }
};

/**
 * Get all admins (with pagination and filtering)
 */
const getAllAdmins = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { search, limit, start, sorting } = getPaginationValues2(req.query);
    const { eType, eStatus, role } = req.query;

    const query = {};

    // Add search filter
    if (search) {
      query.$or = [
        { sName: { $regex: search, $options: 'i' } },
        { sUsername: { $regex: search, $options: 'i' } },
        { sEmail: { $regex: search, $options: 'i' } }
      ];
    }

    // Add type filter
    if (eType) {
      query.eType = eType;
    }

    // Add status filter
    if (eStatus) {
      query.eStatus = eStatus;
    }

    // Add role filter
    if (role) {
      query.aRole = { $in: [role] };
    }

    const [total, admins] = await Promise.all([
      AdminModel.countDocuments(query),
      AdminModel.find(query)
        .select('-sPassword -sResetToken')
        .sort(sorting)
        .skip(Number(start))
        .limit(Number(limit))
        .lean()
    ]);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].adminListRetrieved,
      data: {
        total,
        results: admins,
        limit: Number(limit),
        start: Number(start)
      },
      error: {}
    });
  } catch (error) {
    console.error('Get admins error:', error);
    return handleServiceError(error, req, res, { messageKey: 'errorGettingAdmins' });
  }
};

/**
 * Get admin by ID
 */
const getAdminById = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;

    const admin = await AdminModel.findById(id, null, { readPreference: 'primary' })
      .select('-sPassword -sResetToken')
      .populate('aRole', 'sName sKey')
      .lean();

    if (!admin) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'adminNotFound' });
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].adminProfileRetrieved,
      data: admin,
      error: {}
    });
  } catch (error) {
    console.error('Get admin by ID error:', error);
    return handleServiceError(error, req, res, { messageKey: 'errorGettingAdmin' });
  }
};

/**
 * Update admin
 */
const updateAdmin = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const { sName, sUsername, sEmail, sMobNum, aRole, eStatus } = req.body;

    // Check if admin exists
    const admin = await AdminModel.findById(id, null, { readPreference: 'primary' });
    if (!admin) {
      return res.status(status.NotFound).json({
        success: false,
        message: messages[lang].adminNotFound,
        data: {},
        error: {}
      });
    }

    // Check if trying to update super admin type
    if (req.body.eType && admin.eType === 'SUPER' && req.body.eType !== 'SUPER') {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'cannotChangeSuperAdminType' });
    }

    // Check for duplicate email/username if changing
    if (sEmail && sEmail !== admin.sEmail) {
      const emailExists = await AdminModel.findOne({
        sEmail: sEmail.toLowerCase().trim(),
        _id: { $ne: id }
      });
      if (emailExists) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'emailExists' });
      }
    }

    if (sUsername && sUsername !== admin.sUsername) {
      const usernameExists = await AdminModel.findOne({
        sUsername: sUsername.trim(),
        _id: { $ne: id }
      });
      if (usernameExists) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'usernameExists' });
      }
    }

    // Update admin
    const updateData = {};
    if (sName) updateData.sName = sName;
    if (sUsername) updateData.sUsername = sUsername;
    if (sEmail) updateData.sEmail = sEmail.toLowerCase().trim();
    if (sMobNum) updateData.sMobNum = sMobNum;
    if (aRole) updateData.aRole = aRole;
    if (eStatus) updateData.eStatus = eStatus;

    const updatedAdmin = await AdminModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true, readPreference: 'primary' }
    ).select('-sPassword -sResetToken');

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].adminUpdated,
      data: updatedAdmin,
      error: {}
    });
  } catch (error) {
    console.error('Update admin error:', error);
    return handleServiceError(error, req, res, { messageKey: 'errorUpdatingAdmin' });
  }
};

/**
 * Delete admin
 */
const deleteAdmin = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;

    const admin = await AdminModel.findById(id);
    if (!admin) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'adminNotFound' });
    }

    // Prevent deletion of super admin
    if (admin.eType === 'SUPER') {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'cannotDeleteSuperAdmin' });
    }

    await AdminModel.findByIdAndDelete(id);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].adminDeleted,
      data: {},
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'errorDeletingAdmin' });
  }
};

/**
 * Change admin password
 */
const changePassword = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const { sCurrentPassword, sOldPassword, sNewPassword } = req.body;

    // Normalize current password name
    const currentPassword = sCurrentPassword || sOldPassword;
    if (!currentPassword || !sNewPassword) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'tokenAndPasswordRequired' });
    }

    // Only allow an authenticated admin to change their own password
    if (req.admin && String(req.admin._id) !== String(id)) {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'forbidden' });
    }

    // Basic password policy validation (aligns with UI hint)
    if (!sNewPassword || typeof sNewPassword !== 'string' || sNewPassword.length < 8) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'passwordPolicy' });
    }

    const admin = await AdminModel.findById(id, null, { readPreference: 'primary' }).select('+sPassword');
    if (!admin) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'adminNotFound' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, admin.sPassword);
    if (!isMatch) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'currentPasswordIncorrect' });
    }

    // Update password (pre-save hook hashes it)
    admin.sPassword = sNewPassword;
    await admin.save();

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].passwordChanged,
      data: {},
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'errorChangingPassword' });
  }
};

/**
 * Get admin profile
 */
const getProfile = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const admin = await AdminModel.findById(req.admin._id, null, { readPreference: 'primary' })
      .select('-sPassword -sResetToken')
      .populate({ path: 'aRole', model: 'roles', select: 'sName sKey' })
      .lean();

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].adminProfileRetrieved,
      data: admin,
      error: {}
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return handleServiceError(error, req, res, { messageKey: 'errorGettingProfile' });
  }
};

/**
 * Update admin profile
 */
const updateProfile = async (req, res) => {
  const lang = req.userLanguage;
  try {
    // Do not allow password updates from this endpoint
    const forbiddenPasswordKeys = ['sPassword', 'password', 'sNewPassword', 'sCurrentPassword'];
    if (forbiddenPasswordKeys.some(key => Object.prototype.hasOwnProperty.call(req.body, key))) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'passwordUpdateNotAllowedInProfile' });
    }

    const { sName, sMobNum, sEmail, sLocation } = req.body;

    // If changing email, ensure uniqueness
    if (sEmail) {
      const current = await AdminModel.findById(req.admin._id, null, { readPreference: 'primary' });
      if (current && sEmail.toLowerCase().trim() !== current.sEmail) {
        const emailExists = await AdminModel.findOne({
          sEmail: sEmail.toLowerCase().trim(),
          _id: { $ne: req.admin._id }
        }).lean();
        if (emailExists) {
          return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'emailExists' });
        }
      }
    }

    const updateData = {};
    if (sName) updateData.sName = sName;
    if (sMobNum) updateData.sMobNum = sMobNum;
    if (sEmail) updateData.sEmail = sEmail.toLowerCase().trim();
    if (sLocation) updateData.sLocation = sLocation;

    const updatedAdmin = await AdminModel.findByIdAndUpdate(
      req.admin._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-sPassword -sResetToken');

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].adminProfileUpdated,
      data: updatedAdmin,
      error: {}
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return handleServiceError(error, req, res, { messageKey: 'errorUpdatingProfile' });
  }
};

/**
 * Get admin dashboard statistics
 */
const getDashboard = async (req, res) => {
  const lang = req.userLanguage;
  try {
    // Get basic counts
    const totalAdmins = await AdminModel.countDocuments();
    const activeAdmins = await AdminModel.countDocuments({ eStatus: 'Y' });
    const superAdmins = await AdminModel.countDocuments({ eType: 'SUPER' });
    const subAdmins = await AdminModel.countDocuments({ eType: 'SUB' });

    // Get recent admins
    const recentAdmins = await AdminModel.find()
      .sort({ dCreatedAt: -1 })
      .limit(5)
      .select('sName sUsername sEmail eType eStatus dCreatedAt')
      .lean();

    // Get admin types distribution
    const adminTypes = await AdminModel.aggregate([
      {
        $group: {
          _id: '$eType',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get admin status distribution
    const adminStatus = await AdminModel.aggregate([
      {
        $group: {
          _id: '$eStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const dashboardData = {
      counts: {
        total: totalAdmins,
        active: activeAdmins,
        super: superAdmins,
        sub: subAdmins
      },
      recentAdmins,
      distributions: {
        types: adminTypes,
        status: adminStatus
      }
    };

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].dashboardRetrieved,
      data: dashboardData,
      error: {}
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    return handleServiceError(error, req, res, { messageKey: 'errorGettingDashboard' });
  }
};

/**
 * Fetch current admin details (token-based)
 */
const getAdminSelf = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const admin = req.admin;
    return res.status(status.OK).json({
      status: status.OK,
      message: messages[lang].adminFetchedSuccessfully,
      data: admin
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'errorGettingProfile' });
  }
};

/**
 * Get current admin's login history
 */
const getAdminLoginHistory = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { limit = 10, start = 0 } = req.query;
    const AdminLoginHistoryModel = require('../loginHistory/model');
    const query = { iAdminId: req.admin?._id };
    const [total, results] = await Promise.all([
      AdminLoginHistoryModel.countDocuments(query),
      AdminLoginHistoryModel.find(query)
        .sort({ dCreatedAt: -1 })
        .skip(Number(start))
        .limit(Number(limit))
        .lean()
    ]);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].success,
      data: { total, results },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToChangeUserStatus' });
  }
};

module.exports = {
  create,
  getAllAdmins,
  getAdminById,
  updateAdmin,
  deleteAdmin,
  changePassword,
  getProfile,
  updateProfile,
  getDashboard,
  getAdminSelf,
  getAdminLoginHistory
};
