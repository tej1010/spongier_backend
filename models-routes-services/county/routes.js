const router = require('express').Router();
const { getCountries } = require('./services');
const { isAdminAuthenticated } = require('../../middlewares/middleware');

router.get('/admin/country/list/v1', isAdminAuthenticated, getCountries);

module.exports = router;
