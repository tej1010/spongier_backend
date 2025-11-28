const express = require('express');
const router = express.Router();
const redirectService = require('./redirect.services');
const { validate } = require('../../middlewares/middleware');
const {
  createRedirectValidator,
  updateRedirectValidator,
  idValidator
} = require('./redirect.validators');

// Create new redirection
router.post('/create-seo-redirect/v1', createRedirectValidator, validate, redirectService.createRedirect);

// Get all redirections with filters and pagination
router.get('/list-seo-redirects/v1', redirectService.getAllRedirects);

// Get redirection by ID
router.get('/seo-redirect/:id/v1', idValidator, validate, redirectService.getRedirectById);

// Update redirection
router.put('/update-seo-redirect/:id/v1', idValidator.concat(updateRedirectValidator), validate, redirectService.updateRedirect);

// Delete redirection
router.delete('/delete-seo-redirect/:id/v1', idValidator, validate, redirectService.deleteRedirect);

// Check redirection - This will be used by frontend to check if a URL needs redirection
router.get('/check-redirect/:slug/v1', redirectService.checkRedirect);

module.exports = router;
