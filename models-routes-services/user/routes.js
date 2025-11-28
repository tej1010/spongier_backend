// user.routes.js
const express = require('express');
const router = express.Router();
const { register, login, verifyEmail, resendOtp, forgotPassword, resetPassword, getUsersList, refreshToken, accessToken, logout, sendOTP, verifyOTP, checkExist, updateProfile, changePassword, linkParent, unlinkParent, listLinkedParents, updateTwoFactorAuthentication, updateNotificationPreference, getUserDetails, getPresignUrl, getUserStreak, addStudentByParent, updateStudentByParent, getChildrenByParent, deleteStudentByParent, addStudentBySchool, updateStudentBySchool, getChildrenBySchool, getRecentVideosByChild, getRecentActivityByStudent, getCompletedCoursesByStudent, bulkAddStudentsBySchool, changeSingleStudentStatusBySchool, deleteUser } = require('./services');
const { handleValidation } = require('../../helper/utilities.services');
const { validateRegistration, validateLogin, validateForgotPassword, validateResetPassword, getUserList, validateSendOTP, validateVerifyOTP, validateCheckExist, validateUpdateProfile, validateLinkParent, validateUnlinkParent, validateListParents, validateChangePassword, validateTwoFactor, validateNotificationPreference, validatePresignUrl, validateAddStudentByParent, validateUpdateStudentByParent, validateGetChildrenByParent, validateGetRecentVideosByChild, validateBulkAddStudentsBySchool, validateChangeSingleStudentStatusBySchool, validateDeleteUser, validateUpdateStudentBySchool } = require('./validators');
const { validateAdmin, isUserAuthenticated } = require('../../middlewares/middleware');
const data = require('../../data');

// Send OTP
router.post('/user/send-otp/v1', validateSendOTP, handleValidation, sendOTP);

// Verify OTP
router.post('/user/verify-otp/v1', validateVerifyOTP, handleValidation, verifyOTP);

// Check Exist on register
router.post('/user/check-exist/v1', validateCheckExist, handleValidation, checkExist);

// Registration (account creation + OTP generation)
router.post('/user/register/v1', validateRegistration, handleValidation, register);

// Verify email using OTP
router.post('/user/verify-email/v1', verifyEmail);

// Resend OTP
router.post('/user/resend-otp/v1', resendOtp);

// Login using email and password
router.post('/user/login/v1', validateLogin, login);

// Refresh access token
router.post('/user/refresh/v1', refreshToken);

// Get new access token from refresh token (no rotation)
router.post('/user/access/v1', accessToken);

// Logout (invalidate refresh token)
router.post('/user/logout/v1', logout);

// Forgot-password using email
router.post('/user/forgot-password/v1', validateForgotPassword, forgotPassword);

// Reset-password using token
router.post('/user/reset-password/v1', validateResetPassword, handleValidation, resetPassword);

// Update user profile (authenticated user only)
router.put('/user/update-profile/v1', isUserAuthenticated, validateUpdateProfile, handleValidation, updateProfile);

// Get authenticated user details
router.get('/user/details/v1', isUserAuthenticated, getUserDetails);

// Get streak and last-seen for authenticated user
router.get('/user/streak/v1', isUserAuthenticated, getUserStreak);

// Change password (authenticated user only)
router.post('/user/change-password/v1', isUserAuthenticated, validateChangePassword, handleValidation, changePassword);

// Update Two Factor Authentication (authenticated user only)
router.put('/user/settings/two-factor/v1', isUserAuthenticated, validateTwoFactor, handleValidation, updateTwoFactorAuthentication);

// Update Notification Preference (authenticated user only)
router.put('/user/settings/notification-preference/v1', isUserAuthenticated, validateNotificationPreference, handleValidation, updateNotificationPreference);

// Generate S3 presigned URL for upload (authenticated user only)
router.post('/user/signed-url/v1', isUserAuthenticated, validatePresignUrl, handleValidation, getPresignUrl);

// Linked Parent Account APIs
router.post('/user/parents/link/v1', isUserAuthenticated, validateLinkParent, handleValidation, linkParent);
router.delete('/user/parents/:parentId/unlink/v1', isUserAuthenticated, validateUnlinkParent, handleValidation, unlinkParent);
router.get('/user/parents/list/v1', isUserAuthenticated, validateListParents, handleValidation, listLinkedParents);

// Parent Dashboard - Add Student
router.post('/user/parent/add-child/v1', isUserAuthenticated, validateAddStudentByParent, handleValidation, addStudentByParent);

// Parent Dashboard - Update Student
router.put('/user/parent/update-child/:childId/v1', isUserAuthenticated, validateUpdateStudentByParent, handleValidation, updateStudentByParent);

// Parent Dashboard - Get Children List
router.get('/user/parent/children/v1', isUserAuthenticated, validateGetChildrenByParent, handleValidation, getChildrenByParent);

// Parent Dashboard - Delete Student
router.delete('/user/parent/child/:id/v1', isUserAuthenticated, validateDeleteUser, handleValidation, deleteStudentByParent);

// Parent Dashboard - Get Recent Videos by Child
router.get('/user/parent/recent-video/v1', isUserAuthenticated, validateGetRecentVideosByChild, handleValidation, getRecentVideosByChild);

// School Dashboard - Get Recent Videos by Child
router.get('/user/school/recent-video/v1', isUserAuthenticated, validateGetRecentVideosByChild, handleValidation, getRecentVideosByChild);

// School Dashboard - Get Recent Activity by Student
router.get('/user/school/recent-activity/v1', isUserAuthenticated, getRecentActivityByStudent);

// School Dashboard - Get Badges and Achievements by Student
// router.get('/user/school/badges-achievements/v1', isUserAuthenticated, getBadgesAndAchievementsByStudent);

// School Dashboard - Get Completed Courses by Student
router.get('/user/school/completed-courses/v1', isUserAuthenticated, getCompletedCoursesByStudent);

// School Dashboard - Add Student
router.post('/user/school/add-student/v1', isUserAuthenticated, validateAddStudentByParent, handleValidation, addStudentBySchool);

// School Dashboard - Bulk Add Students
router.post('/user/school/bulk-add-students/v1', isUserAuthenticated, validateBulkAddStudentsBySchool, handleValidation, bulkAddStudentsBySchool);

// School Dashboard - Update Student
router.put('/user/school/update-student/:studentId/v1', isUserAuthenticated, validateUpdateStudentBySchool, handleValidation, updateStudentBySchool);

// School Dashboard - Get Student List
router.get('/user/school/students/v1', isUserAuthenticated, validateGetChildrenByParent, handleValidation, getChildrenBySchool);

// School Dashboard - Change Single Student Status
router.post('/user/school/student/:studentId/:status/v1', isUserAuthenticated, validateChangeSingleStudentStatusBySchool, handleValidation, changeSingleStudentStatusBySchool);

// School Dashboard - Delete Student
router.delete('/user/school/student/:id/v1', isUserAuthenticated, validateDeleteUser, handleValidation, deleteUser);

// Admin routes (secured by USERS read permission)
router.get('/admin/list/users/v1', validateAdmin('USERS', data.eAdminPermission.map.READ), getUserList, handleValidation, getUsersList);

module.exports = router;
