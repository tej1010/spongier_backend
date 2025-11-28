const express = require('express');
const router = express.Router();
const { getSchoolsList } = require('./services');
const { validateGetSchoolsList } = require('./validators');
const { isUserAuthenticated } = require('../../middlewares/middleware');
const { handleValidation } = require('../../helper/utilities.services');

// Get schools list (parent role only)
router.get('/user/schools/list/v1', isUserAuthenticated, validateGetSchoolsList, handleValidation, getSchoolsList);

module.exports = router;
