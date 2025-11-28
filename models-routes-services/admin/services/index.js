/**
 * Admin Services Index
 * Aggregates all admin-related services for backward compatibility
 */

const authServices = require('./auth.services');
const adminManagementServices = require('./admin-management.services');
const userManagementServices = require('./user-management.services');
const exportServices = require('./export.services');
const uploadServices = require('./upload.services');

module.exports = {
  // Auth services
  ...authServices,
  // Admin management services
  ...adminManagementServices,
  // User management services
  ...userManagementServices,
  // Export services
  ...exportServices,
  // Upload services
  ...uploadServices
};
