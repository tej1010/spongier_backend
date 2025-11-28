// videoView.services.js
const { status, messages } = require('../../../../helper/api.responses');
const { handleServiceError, ObjectId, getIp } = require('../../../../helper/utilities.services');
const VideoViewModel = require('./model');
const VideoModel = require('../model');

/**
 * Video View Services
 * Handles view tracking with duplicate prevention
 */

// Record a view for a video
const recordVideoView = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params; // video ID
    const userId = req?.user?._id || null; // Can be null for anonymous users
    const { sDeviceType, sDeviceOS, sBrowser } = req.body || {};

    // Validate video exists and is active
    const video = await VideoModel.findOne({
      _id: id,
      eStatus: { $ne: 'inactive' },
      bDelete: false
    }, null, { readPreference: 'primary' }).lean();

    if (!video) {
      return handleServiceError(null, req, res, {
        statusCode: status.NotFound,
        messageKey: 'videoNotFound'
      });
    }

    // Get IP address for anonymous users
    const ipAddress = getIp(req) || req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '';

    let viewRecord = null;
    let isNewView = false;

    if (userId) {
      // Authenticated user: Check if view already exists
      viewRecord = await VideoViewModel.findOne({
        iVideoId: ObjectId(id),
        iUserId: ObjectId(userId)
      }, null, { readPreference: 'primary' });

      if (!viewRecord) {
        // Create new view record for authenticated user
        // Use findOneAndUpdate with upsert to handle race conditions
        viewRecord = await VideoViewModel.findOneAndUpdate(
          { iVideoId: ObjectId(id), iUserId: ObjectId(userId) },
          {
            iVideoId: ObjectId(id),
            iUserId: ObjectId(userId),
            sDeviceType: sDeviceType || '',
            sDeviceOS: sDeviceOS || '',
            sBrowser: sBrowser || ''
          },
          { upsert: true, setDefaultsOnInsert: true, new: true }
        );
        isNewView = true;
      }
    } else {
      // Anonymous user: Check if view already exists for this IP
      if (ipAddress) {
        viewRecord = await VideoViewModel.findOne({
          iVideoId: ObjectId(id),
          iUserId: null,
          sIpAddress: ipAddress
        }, null, { readPreference: 'primary' });

        if (!viewRecord) {
          // Create new view record for anonymous user
          // Use findOneAndUpdate with upsert to handle race conditions
          viewRecord = await VideoViewModel.findOneAndUpdate(
            { iVideoId: ObjectId(id), iUserId: null, sIpAddress: ipAddress },
            {
              iVideoId: ObjectId(id),
              iUserId: null,
              sIpAddress: ipAddress,
              sDeviceType: sDeviceType || '',
              sDeviceOS: sDeviceOS || '',
              sBrowser: sBrowser || ''
            },
            { upsert: true, setDefaultsOnInsert: true, new: true }
          );
          isNewView = true;
        }
      }
    }

    // Only increment view count if this is a new view
    let newViewCount = video.nViewCount || 0;
    if (isNewView) {
      // Increment view count atomically
      const updatedVideo = await VideoModel.findOneAndUpdate(
        { _id: id },
        { $inc: { nViewCount: 1 } },
        { new: true, readPreference: 'primary' }
      ).lean();

      newViewCount = updatedVideo.nViewCount || 0;
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].viewRecorded || 'View recorded successfully',
      data: {
        videoId: id,
        nViewCount: newViewCount,
        isNewView: isNewView
      },
      error: {}
    });
  } catch (error) {
    // Handle duplicate key error (shouldn't happen due to unique index, but just in case)
    if (error.code === 11000) {
      // View already exists, return success without incrementing
      const { id } = req.params; // Get id from params in catch block
      const lang = req.userLanguage; // Get lang from req in catch block
      const video = await VideoModel.findOne({ _id: id }, { nViewCount: 1 }).lean();
      return res.status(status.OK).json({
        success: true,
        message: messages[lang].viewRecorded || 'View already recorded',
        data: {
          videoId: id,
          nViewCount: video?.nViewCount || 0,
          isNewView: false
        },
        error: {}
      });
    }
    return handleServiceError(error, req, res, { messageKey: 'failedToRecordView' });
  }
};

module.exports = {
  recordVideoView
};
