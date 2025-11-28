// term.routes.js
const express = require('express');
const router = express.Router();
const { createTerm, getTerm, updateTerm, deleteTerm, listTerms } = require('./services');
const { handleValidation } = require('../../../helper/utilities.services');
const { 
  validateCreateTerm, 
  validateUpdateTerm, 
  validateGetTerm, 
  validateDeleteTerm, 
  validateListTerms 
} = require('./validators');
const { validateAdmin, isUserAuthenticated } = require('../../../middlewares/middleware');
const data = require('../../../data');
const { validateCourseUserAccess } = require('../../../middlewares/courseAuth');

// Admin routes - Create, Update, Delete operations (Admin/Super Admin only)
router.post('/admin/term/create/v1', validateAdmin('TERMS', data.eAdminPermission.map.WRITE), validateCreateTerm, handleValidation, createTerm);
router.put('/admin/term/:id/v1', validateAdmin('TERMS', data.eAdminPermission.map.WRITE), validateUpdateTerm, handleValidation, updateTerm);
router.delete('/admin/term/:id/v1', validateAdmin('TERMS', data.eAdminPermission.map.WRITE), validateDeleteTerm, handleValidation, deleteTerm);

// Admin view routes - Read operations (Admin/Super Admin)
router.get('/admin/term/:id/v1', validateAdmin('TERMS', data.eAdminPermission.map.READ), validateGetTerm, handleValidation, getTerm);
router.get('/admin/terms/v1', validateAdmin('TERMS', data.eAdminPermission.map.READ), validateListTerms, handleValidation, listTerms);

module.exports = router;
