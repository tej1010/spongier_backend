// videoComment.routes.js
const express = require('express');
const router = express.Router();
const {
  addComment,
  likeComment,
  getComments,
  getReplies,
  deleteComment
} = require('./services');
const { handleValidation } = require('../../../../helper/utilities.services');
const {
  validateAddComment,
  validateLikeComment,
  validateGetComments,
  validateGetReplies,
  validateDeleteComment
} = require('./validators');
const { isUserAuthenticated, optionalUserAuthChecking } = require('../../../../middlewares/middleware');

// User routes - Authenticated users can add comments, like, and delete their own comments
router.post('/user/video/comment/add/v1', isUserAuthenticated, validateAddComment, handleValidation, addComment);
router.post('/user/video/comment/:id/like/v1', isUserAuthenticated, validateLikeComment, handleValidation, likeComment);
router.delete('/user/video/comment/:id/v1', isUserAuthenticated, validateDeleteComment, handleValidation, deleteComment);

// Public routes - Anyone can view comments (with optional auth for isLiked flag)
router.get('/user/video/comments/v1', optionalUserAuthChecking, validateGetComments, handleValidation, getComments);
router.get('/user/video/comment/:commentId/replies/v1', optionalUserAuthChecking, validateGetReplies, handleValidation, getReplies);

module.exports = router;
