// videoLike.services.js
const { status, messages } = require('../../../../helper/api.responses');
const { handleServiceError, ObjectId } = require('../../../../helper/utilities.services');
const VideoLikeModel = require('./model');
const VideoModel = require('../model');

/**
 * Video Like Services
 * Handles like/unlike functionality with duplicate prevention
 */

// Toggle like/unlike for a video
const likeVideo = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params; // video ID
    const userId = req.user._id;

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

    // Check if user already liked this video
    const existingLike = await VideoLikeModel.findOne({
      iUserId: ObjectId(userId),
      iVideoId: ObjectId(id),
      bDelete: false
    }, null, { readPreference: 'primary' });

    let action = '';
    let newLikeCount = 0;

    if (existingLike) {
      // Unlike: Soft delete the like record
      existingLike.bDelete = true;
      await existingLike.save();

      // Decrement like count atomically (ensure it doesn't go below 0)
      const updatedVideo = await VideoModel.findOneAndUpdate(
        { _id: id },
        { $inc: { nLikeCount: -1 } },
        { new: true, readPreference: 'primary' }
      ).lean();

      newLikeCount = Math.max(0, updatedVideo.nLikeCount || 0);
      action = 'unliked';
    } else {
      // Like: Create new like record or restore soft-deleted one
      const softDeletedLike = await VideoLikeModel.findOne({
        iUserId: ObjectId(userId),
        iVideoId: ObjectId(id),
        bDelete: true
      });

      if (softDeletedLike) {
        // Restore soft-deleted like
        softDeletedLike.bDelete = false;
        await softDeletedLike.save();
      } else {
        // Create new like record
        // Use findOneAndUpdate with upsert to handle race conditions
        await VideoLikeModel.findOneAndUpdate(
          { iUserId: ObjectId(userId), iVideoId: ObjectId(id) },
          {
            iUserId: ObjectId(userId),
            iVideoId: ObjectId(id),
            bDelete: false
          },
          { upsert: true, setDefaultsOnInsert: true, new: true }
        );
      }

      // Increment like count atomically
      const updatedVideo = await VideoModel.findOneAndUpdate(
        { _id: id },
        { $inc: { nLikeCount: 1 } },
        { new: true, readPreference: 'primary' }
      ).lean();

      newLikeCount = updatedVideo.nLikeCount || 0;
      action = 'liked';
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang][`video${action.charAt(0).toUpperCase() + action.slice(1)}`] || `Video ${action} successfully`,
      data: {
        videoId: id,
        nLikeCount: newLikeCount,
        isLiked: action === 'liked'
      },
      error: {}
    });
  } catch (error) {
    // Handle duplicate key error (shouldn't happen due to unique index, but just in case)
    if (error.code === 11000) {
      return handleServiceError(null, req, res, {
        statusCode: status.BadRequest,
        messageKey: 'duplicateLike'
      });
    }
    return handleServiceError(error, req, res, { messageKey: 'failedToLikeVideo' });
  }
};

module.exports = {
  likeVideo
};
