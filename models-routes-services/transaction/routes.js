// transaction.routes.js
const express = require('express');
const router = express.Router();
const { handleValidation } = require('../../helper/utilities.services');
const { isUserAuthenticated } = require('../../middlewares/middleware');
const { validateCreateIntent, validateWebhook } = require('./validators');
const { createIntent, webhook } = require('./services');

// Create a pending transaction intent for premium subscription
router.post('/user/transaction/intent/v1', isUserAuthenticated, validateCreateIntent, handleValidation, createIntent);

// Payment gateway webhook to confirm transaction and provision subscription
router.post('/webhook/transaction/v1', validateWebhook, handleValidation, webhook);

module.exports = router;
