/**
 * User Services Index
 * Aggregates all user-related services for backward compatibility
 */

const authServices = require('./auth.services');
const passwordServices = require('./password.services');
const profileServices = require('./profile.services');
const relationshipServices = require('./relationship.services');
const settingsServices = require('./settings.services');
const parentServices = require('./parent.services');
const schoolServices = require('./school.services');
// Re-export all services for backward compatibility
module.exports = {
  // Auth services
  register: authServices.register,
  verifyEmail: authServices.verifyEmail,
  resendOtp: authServices.resendOtp,
  login: authServices.login,
  handleSubscriptionAndPayment: authServices.handleSubscriptionAndPayment,
  refreshToken: authServices.refreshToken,
  accessToken: authServices.accessToken,
  logout: authServices.logout,
  sendOTP: authServices.sendOTP,
  verifyOTP: authServices.verifyOTP,
  checkExist: authServices.checkExist,

  // Password services
  forgotPassword: passwordServices.forgotPassword,
  resetPassword: passwordServices.resetPassword,
  changePassword: passwordServices.changePassword,

  // Profile services
  updateProfile: profileServices.updateProfile,
  getUserDetails: profileServices.getUserDetails,
  getUsersList: profileServices.getUsersList,
  getPresignUrl: profileServices.getPresignUrl,

  // Relationship services
  linkParent: relationshipServices.linkParent,
  unlinkParent: relationshipServices.unlinkParent,
  listLinkedParents: relationshipServices.listLinkedParents,

  // Settings services
  updateTwoFactorAuthentication: settingsServices.updateTwoFactorAuthentication,
  updateNotificationPreference: settingsServices.updateNotificationPreference,
  getUserStreak: settingsServices.getUserStreak,

  // Parent services
  addStudentByParent: parentServices.addStudentByParent,
  updateStudentByParent: parentServices.updateStudentByParent,
  getChildrenByParent: parentServices.getChildrenByParent,
  deleteStudentByParent: parentServices.deleteStudentByParent,
  getRecentVideosByChild: parentServices.getRecentVideosByChild,

  // School services
  addStudentBySchool: schoolServices.addStudentBySchool,
  updateStudentBySchool: schoolServices.updateStudentBySchool,
  getChildrenBySchool: schoolServices.getChildrenBySchool,
  // getRecentVideosByChild: schoolServices.getRecentVideosByChild,
  getRecentActivityByStudent: schoolServices.getRecentActivityByStudent,
  getBadgesAndAchievementsByStudent: schoolServices.getBadgesAndAchievementsByStudent,
  getCompletedCoursesByStudent: schoolServices.getCompletedCoursesByStudent,
  bulkAddStudentsBySchool: schoolServices.bulkAddStudentsBySchool,
  changeSingleStudentStatusBySchool: schoolServices.changeSingleStudentStatusBySchool,
  deleteUser: schoolServices.deleteUser
};
