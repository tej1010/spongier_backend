// video.routes.js
const express = require('express');
const router = express.Router();
const {
  createVideo, bulkCreateVideos, getVideo, updateVideo, deleteVideo, listVideos, getVideoDetail, initiateMultipart, getMultipartPartUrls, completeMultipart, abortMultipart, getVideoStatus, bunnyWebhook
} = require('./services');
const { handleValidation } = require('../../../helper/utilities.services');
const {
  validateCreateVideo,
  validateBulkCreateVideos,
  validateUpdateVideo,
  validateGetVideo,
  validateDeleteVideo,
  validateListVideos,
  validateMultipartInitiate,
  validateMultipartPartUrls,
  validateMultipartComplete,
  validateMultipartAbort,
  validateGetVideoStatus
} = require('./validators');
const { validateAdmin, optionalUserAuthChecking } = require('../../../middlewares/middleware');
const data = require('../../../data');
const watchHistoryRouter = require('./watchHistory/routes');
const commentRouter = require('./comments/routes');
const likeRouter = require('./likes/routes');
const viewRouter = require('./views/routes');

// Admin routes - Create, Update, Delete operations (Admin/Super Admin only)
router.use('/', watchHistoryRouter);
router.use('/', commentRouter);
router.use('/', likeRouter);
router.use('/', viewRouter);

// User routes - Video detail page
router.get('/user/video/:id/detail/v1', optionalUserAuthChecking, validateGetVideo, handleValidation, getVideoDetail);

router.post('/admin/video/create/v1', validateAdmin('VIDEOS', data.eAdminPermission.map.WRITE), validateCreateVideo, handleValidation, createVideo);
router.post('/admin/video/bulk-create/v1', validateAdmin('VIDEOS', data.eAdminPermission.map.WRITE), validateBulkCreateVideos, handleValidation, bulkCreateVideos);
router.put('/admin/video/:id/v1', validateAdmin('VIDEOS', data.eAdminPermission.map.WRITE), validateUpdateVideo, handleValidation, updateVideo);
router.delete('/admin/video/:id/v1', validateAdmin('VIDEOS', data.eAdminPermission.map.WRITE), validateDeleteVideo, handleValidation, deleteVideo);
// Admin view routes - Read operations (Admin/Super Admin)
router.get('/admin/video/:id/v1', validateAdmin('VIDEOS', data.eAdminPermission.map.READ), validateGetVideo, handleValidation, getVideo);
router.get('/admin/videos/v1', validateAdmin('VIDEOS', data.eAdminPermission.map.READ), validateListVideos, handleValidation, listVideos);

// Video upload routes
router.post('/admin/video/multipart/initiate/v1', validateMultipartInitiate, validateAdmin('VIDEOS', data.eAdminPermission.map.WRITE), initiateMultipart);
router.post('/admin/video/multipart/part-urls/v1', validateMultipartPartUrls, validateAdmin('VIDEOS', data.eAdminPermission.map.WRITE), getMultipartPartUrls);
router.post('/admin/video/multipart/complete/v1', validateMultipartComplete, validateAdmin('VIDEOS', data.eAdminPermission.map.WRITE), completeMultipart);
router.post('/admin/video/multipart/abort/v1', validateMultipartAbort, validateAdmin('VIDEOS', data.eAdminPermission.map.WRITE), abortMultipart);
router.post('/admin/video/bunny/fetch-status/v1', validateGetVideoStatus, validateAdmin('VIDEOS', data.eAdminPermission.map.WRITE), getVideoStatus);
router.all('/admin/video/bunny/webhook/v1', bunnyWebhook);

module.exports = router;
