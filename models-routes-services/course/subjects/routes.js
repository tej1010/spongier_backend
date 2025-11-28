// subject.routes.js
const express = require('express');
const router = express.Router();
const { createSubject, getSubject, updateSubject, deleteSubject, listSubjects } = require('./services');
const { handleValidation } = require('../../../helper/utilities.services');
const {
  validateCreateSubject,
  validateUpdateSubject,
  validateGetSubject,
  validateDeleteSubject,
  validateListSubjects
} = require('./validators');
const { validateAdmin } = require('../../../middlewares/middleware');
const data = require('../../../data');

// Admin routes - Create, Update, Delete operations (Admin/Super Admin only)
router.post('/admin/subject/create/v1', validateAdmin('SUBJECTS', data.eAdminPermission.map.WRITE), validateCreateSubject, handleValidation, createSubject);
router.put('/admin/subject/:id/v1', validateAdmin('SUBJECTS', data.eAdminPermission.map.WRITE), validateUpdateSubject, handleValidation, updateSubject);
router.delete('/admin/subject/:id/v1', validateAdmin('SUBJECTS', data.eAdminPermission.map.WRITE), validateDeleteSubject, handleValidation, deleteSubject);

// Admin view routes - Read operations (Admin/Super Admin)
router.get('/admin/subject/:id/v1', validateAdmin('SUBJECTS', data.eAdminPermission.map.READ), validateGetSubject, handleValidation, getSubject);
router.get('/admin/subjects/v1', validateAdmin('SUBJECTS', data.eAdminPermission.map.READ), validateListSubjects, handleValidation, listSubjects);

module.exports = router;
