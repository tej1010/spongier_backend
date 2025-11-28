// bulkStudent.routes.js
const express = require('express');
const router = express.Router();
const { 
  validateIndividualStudent, 
  validateBulkCSV, 
  validateInvitationAcceptance,
  validateResendInvitation,
  validateGetInvitationStatus
} = require('./bulkStudent.validators');
const { handleValidation } = require('../../helper/utilities.services');
const { 
  addIndividualStudent, 
  bulkAddStudents, 
  acceptStudentInvitation,
  resendInvitation,
  getInvitationStatus
} = require('./bulkStudent.services');

// Route to add individual student invitation
router.post('/student/invite/v1', validateIndividualStudent, handleValidation, addIndividualStudent);

// Route to bulk add students via CSV/array
router.post('/student/bulk-invite/v1', validateBulkCSV, handleValidation, bulkAddStudents);

// Route for students to accept invitation (public route - no auth required)
router.post('/student/accept-invitation/v1', validateInvitationAcceptance, handleValidation, acceptStudentInvitation);

// Route to resend invitation (for admins/teachers)
router.post('/student/resend-invitation/v1', validateResendInvitation, handleValidation, resendInvitation);

// Route to get invitation status and summary
router.get('/student/invitation-status/v1', validateGetInvitationStatus, handleValidation, getInvitationStatus);

module.exports = router;
