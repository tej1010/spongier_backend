// videoLike.routes.js
const express = require('express');
const router = express.Router();
const { likeVideo } = require('./services');
const { validateLikeVideo } = require('./validators');
const { handleValidation } = require('../../../../helper/utilities.services');
const { isUserAuthenticated } = require('../../../../middlewares/middleware');

// Like/Unlike a video (toggle)
router.post('/user/video/:id/like/v1',
  isUserAuthenticated,
  validateLikeVideo,
  handleValidation,
  likeVideo
);

module.exports = router;
