const router = require('express').Router();
const { listLanguage } = require('./services');
const { cacheRoute } = require('../../../helper/redis');

router.get('/user/ai-tutor/language/list/v1', cacheRoute(60), listLanguage);

module.exports = router;
