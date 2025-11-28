const router = require('express').Router();
const { updateStatusAITutorSession, updatePaymentStatus } = require('./services');

router.post('/admin/cron/update-status-ai-tutor-session/v1', updateStatusAITutorSession);
router.post('/admin/cron/update-payment-status/v1', updatePaymentStatus);

module.exports = router;
