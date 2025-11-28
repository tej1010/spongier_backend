// grade.routes.js
const express = require('express');
const router = express.Router();
const { createGrade, getGrade, updateGrade, deleteGrade, listGrades } = require('./services');
const { handleValidation } = require('../../../helper/utilities.services');
const {
  validateCreateGrade,
  validateUpdateGrade,
  validateGetGrade,
  validateDeleteGrade,
  validateListGrades
} = require('./validators');
const { validateAdmin } = require('../../../middlewares/middleware');
const data = require('../../../data');

// Admin routes - Create, Update, Delete operations (Admin/Super Admin only)
router.post('/admin/grade/create/v1', validateAdmin('GRADES', data.eAdminPermission.map.WRITE), validateCreateGrade, handleValidation, createGrade);
router.put('/admin/grade/:id/v1', validateAdmin('GRADES', data.eAdminPermission.map.WRITE), validateUpdateGrade, handleValidation, updateGrade);
router.delete('/admin/grade/:id/v1', validateAdmin('GRADES', data.eAdminPermission.map.WRITE), validateDeleteGrade, handleValidation, deleteGrade);

// Admin view routes - Read operations (Admin/Super Admin)
router.get('/admin/grade/:id/v1', validateAdmin('GRADES', data.eAdminPermission.map.READ), validateGetGrade, handleValidation, getGrade);
router.get('/admin/grades/v1', validateAdmin('GRADES', data.eAdminPermission.map.READ), validateListGrades, handleValidation, listGrades);

module.exports = router;
