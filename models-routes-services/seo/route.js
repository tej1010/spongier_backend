const express = require('express');
const router = express.Router();
const seoService = require('./services');
const { handleValidation } = require('../../helper/utilities.services');
const {
  createSEOValidator,
  updateSEOValidator,
  idValidator,
  getSeosBySlugValidator
} = require('./validators');

// Frontend route to get SEO data
router.get('/page-seo/v1', seoService.getPageSEO);

// Get SEOs by slug(s)
router.get('/get-seos-by-slug/v1', getSeosBySlugValidator, handleValidation, seoService.getSeosBySlug);
// router.post('/get-seos-by-slug/v1', getSeosBySlugValidator, handleValidation, seoService.getSeosBySlug);

// Admin routes
router.post('/create-seo/v1', createSEOValidator, handleValidation, seoService.createSEO);
router.get('/seos-list/v1', seoService.getAllSEOs);
router.get('/seo/:id/v1', idValidator, handleValidation, seoService.getSEOById);
router.put(
  '/update-seo/:id/v1',
  idValidator.concat(updateSEOValidator),
  handleValidation,
  seoService.updateSEO
);
router.delete('/delete-seo/:id/v1', idValidator, handleValidation, seoService.deleteSEO);

module.exports = router;
