// videoView.routes.js
const express = require('express');
const router = express.Router();
const { recordVideoView } = require('./services');
const { validateRecordView } = require('./validators');
const { handleValidation } = require('../../../../helper/utilities.services');
const { optionalUserAuthChecking } = require('../../../../middlewares/middleware');

// Record a view for a video (allows anonymous users)
router.post('/user/video/:id/view/v1',
  optionalUserAuthChecking,
  validateRecordView,
  handleValidation,
  recordVideoView
);

module.exports = router;
