const express = require('express');
const router = express.Router();
const { stripWebhook, checkUserPaymentStatus } = require('./services');
const { isUserAuthenticated } = require('../../middlewares/middleware');

router.all('/user/payment/stripe-webhook/v1', express.raw({ type: 'application/json' }), stripWebhook);

router.get('/user/payment/check-status/:id/v1', isUserAuthenticated, checkUserPaymentStatus);

module.exports = router;
