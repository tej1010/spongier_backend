const router = require('express').Router();
const { decrypt, isAdminAuthenticated } = require('../../middlewares/middleware');
const { status, jsonStatus, messages } = require('../../helper/api.responses');
const {
  login,
  refreshToken,
  accessToken,
  logout,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  getAdminSelf,
  create,
  getAllAdmins,
  getAdminById,
  updateAdmin,
  deleteAdmin,
  changePassword,
  // getDashboard,
  exportUsers,
  exportCourse,
  changeBulkUserStatus,
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changeSingleUserStatus,
  getAdminLoginHistory,
  getSignedUploadUrl
} = require('./services');
const { handleValidation } = require('../../helper/utilities.services');
const {
  validateCreateUser,
  validateUpdateUser,
  validateUserId,
  validateUserList,
  validateCourseExport,
  validateChangePassword,
  validateSignedUrlRequest
} = require('./validators');

// Public admin routes (no authentication required)
router.post('/admin/login/v1', decrypt, login);
router.post('/admin/refresh/v1', refreshToken);
router.post('/admin/access/v1', accessToken);
router.post('/admin/logout/v1', logout);
router.post('/admin/forgot-password/v1', forgotPassword);
router.post('/admin/reset-password/v1', resetPassword);

// Test route: always return 401 Unauthorized (for token refresh testing)
router.get('/admin/test-unauthorized/v1', (req, res) => {
  return res
    .status(status.Unauthorized)
    .jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].unauthorized });
});

// Protected admin routes (require authentication)
// Profile management (any authenticated admin with SUBADMIN read/write)
router.get('/admin/profile/v1', isAdminAuthenticated, getProfile);
router.put('/admin/profile/v1', isAdminAuthenticated, updateProfile);
router.get('/admin/get/v1', isAdminAuthenticated, getAdminSelf);

// Admin login history
router.get('/admin/login-history/v1', isAdminAuthenticated, getAdminLoginHistory);

// Admin management (SUPER admin or admin with SUBADMIN permissions)
router.post('/admin/create/v1', validateCreateUser, handleValidation, decrypt, create);
router.get('/admin/list/v1', validateUserList, handleValidation, getAllAdmins);
router.get('/admin/:id/v1', validateUserId, handleValidation, getAdminById);
router.put('/admin/:id/v1', validateUpdateUser, handleValidation, decrypt, updateAdmin);
router.delete('/admin/:id/v1', validateUserId, handleValidation, deleteAdmin);
router.put('/admin/:id/change-password/v1', isAdminAuthenticated, validateChangePassword, handleValidation, decrypt, changePassword);

// User CRUD operations (admin with USERS permission)
router.post('/admin/users/v1', isAdminAuthenticated, validateCreateUser, handleValidation, decrypt, createUser);
router.put('/admin/users/:id/v1', isAdminAuthenticated, validateUpdateUser, handleValidation, decrypt, updateUser);
router.delete('/admin/users/:id/v1', isAdminAuthenticated, validateUserId, handleValidation, deleteUser);
router.get('/admin/users/v1', isAdminAuthenticated, validateUserList, handleValidation, getAllUsers);
router.get('/admin/users/:id/v1', isAdminAuthenticated, validateUserId, handleValidation, getUserById);

// User status management (admin with USERS permission)
// router.post('/admin/users/:id/:status/v1', validateAdmin('USERS', data.eAdminPermission.map.WRITE), validateUserStatus, handleValidation, changeSingleUserStatus);

// Dashboard and statistics (any authenticated admin with DASHBOARD read)
// router.get('/admin/dashboard/v1', validateAdmin('DASHBOARD', data.eAdminPermission.map.READ), getDashboard);

// Export bulk user data
router.get('/admin/export/users/v1', isAdminAuthenticated, exportUsers);

// Export course module data
router.get('/admin/export/course/v1', isAdminAuthenticated, validateCourseExport, handleValidation, exportCourse);

// Bulk operations via flag (ACTIVE | INACTIVE)
// Constrain status in the path to avoid hijacking other /admin/* routes (e.g., quiz/create)
router.post('/admin/bulk/:status(active|inactive)/v1', isAdminAuthenticated, changeBulkUserStatus);

// Single operations via flag (ACTIVE | INACTIVE)
router.post('/admin/:id/:status(active|inactive)/v1', isAdminAuthenticated, changeSingleUserStatus);

// Get pre-signed URL for image upload
router.post('/admin/signed-url/v1', isAdminAuthenticated, validateSignedUrlRequest, handleValidation, getSignedUploadUrl);

module.exports = router;
