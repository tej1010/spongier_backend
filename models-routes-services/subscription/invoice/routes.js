const express = require('express');
const router = express.Router();
const { isUserAuthenticated } = require('../../../middlewares/middleware');
const { userList } = require('./services');

router.get('/user/invoice/list/v1', isUserAuthenticated, userList);

module.exports = router;
