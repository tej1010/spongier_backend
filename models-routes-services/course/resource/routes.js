// resource.routes.js
const express = require('express');
const router = express.Router();
const { createResource, getResource, updateResource, deleteResource, listResources } = require('./services');
const { handleValidation } = require('../../../helper/utilities.services');
const {
  validateCreateResource,
  validateUpdateResource,
  validateGetResource,
  validateDeleteResource,
  validateListResources
} = require('./validators');
const { validateAdmin } = require('../../../middlewares/middleware');
const data = require('../../../data');

// Admin routes - Create, Update, Delete operations (Admin/Super Admin only)
router.post('/admin/resource/create/v1', validateAdmin('RESOURCES', data.eAdminPermission.map.WRITE), validateCreateResource, handleValidation, createResource);
router.put('/admin/resource/:id/v1', validateAdmin('RESOURCES', data.eAdminPermission.map.WRITE), validateUpdateResource, handleValidation, updateResource);
router.delete('/admin/resource/:id/v1', validateAdmin('RESOURCES', data.eAdminPermission.map.WRITE), validateDeleteResource, handleValidation, deleteResource);

// Admin view routes - Read operations (Admin/Super Admin)
router.get('/admin/resource/:id/v1', validateAdmin('RESOURCES', data.eAdminPermission.map.READ), validateGetResource, handleValidation, getResource);
router.get('/admin/resources/v1', validateAdmin('RESOURCES', data.eAdminPermission.map.READ), validateListResources, handleValidation, listResources);

module.exports = router;
