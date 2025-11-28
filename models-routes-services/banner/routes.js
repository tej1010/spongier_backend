// banner.routes.js
const express = require('express');
const router = express.Router();

const { createBanner, getBanner, updateBanner, deleteBanner, listBanners } = require('./services');
const { handleValidation } = require('../../helper/utilities.services');
const { validateAdmin } = require('../../middlewares/middleware');
const data = require('../../data');

const {
  validateCreateBanner,
  validateUpdateBanner,
  validateGetBanner,
  validateDeleteBanner,
  validateListBanners
} = require('./validators');

// Admin routes
router.post('/admin/banner/create/v1', validateAdmin('BANNERS', data.eAdminPermission.map.WRITE), validateCreateBanner, handleValidation, createBanner);
router.put('/admin/banner/:id/v1', validateAdmin('BANNERS', data.eAdminPermission.map.WRITE), validateUpdateBanner, handleValidation, updateBanner);
router.delete('/admin/banner/:id/v1', validateAdmin('BANNERS', data.eAdminPermission.map.WRITE), validateDeleteBanner, handleValidation, deleteBanner);
router.get('/admin/banners/v1', validateAdmin('BANNERS', data.eAdminPermission.map.READ), validateListBanners, handleValidation, listBanners);
router.get('/admin/banner/:id/v1', validateAdmin('BANNERS', data.eAdminPermission.map.READ), validateGetBanner, handleValidation, getBanner);

// User routes
router.get('/user/banners/v1', validateListBanners, handleValidation, listBanners);
router.get('/user/banner/:id/v1', validateGetBanner, handleValidation, getBanner);

module.exports = router;
