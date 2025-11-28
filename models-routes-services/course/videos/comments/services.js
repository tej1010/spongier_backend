// videoComment.services.js
const { status, messages } = require('../../../../helper/api.responses');
const { handleServiceError, getPaginationValues2 } = require('../../../../helper/utilities.services');
const VideoCommentModel = require('./model');
const VideoModel = require('../model');
const UserModel = require('../../../user/model');

// Add a comment to a video
const addComment = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { iVideoId, sComment, iParentCommentId } = req.body;
    const iUserId = req.user._id;

    // Check if video exists
    const video = await VideoModel.findOne({ _id: iVideoId, eStatus: 'active', bDelete: false }).lean();
    if (!video) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'videoNotFound' });
    }

    // If it's a reply, check if parent comment exists
    if (iParentCommentId) {
      const parentComment = await VideoCommentModel.findOne({
        _id: iParentCommentId,
        iVideoId,
        eStatus: 'active',
        bDelete: false
      }).lean();

      if (!parentComment) {
        return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'commentNotFound' });
      }

      // Don't allow replies to replies (only 1 level deep)
      if (parentComment.iParentCommentId) {
        return res.status(status.BadRequest).json({
          success: false,
          message: messages[lang].nestedRepliesNotAllowed || 'Nested replies are not allowed',
          data: {},
          error: {}
        });
      }
    }

    // Create comment
    const comment = new VideoCommentModel({
      iVideoId,
      iUserId,
      sComment: sComment.trim(),
      iParentCommentId: iParentCommentId || null
    });

    await comment.save();

    // Update parent comment reply count if it's a reply
    if (iParentCommentId) {
      await VideoCommentModel.findByIdAndUpdate(
        iParentCommentId,
        { $inc: { nReplyCount: 1 } }
      );
    }

    // Populate user details
    const populatedComment = await VideoCommentModel.findById(comment._id)
      .populate({ path: 'iUserId', model: UserModel, select: 'sName sEmail sImage' })
      .lean();

    // Add isLiked flag for the current user
    populatedComment.isLiked = false;

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].commentAdded || 'Comment added successfully',
      data: { comment: populatedComment },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToAddComment' });
  }
};

// Like/Unlike a comment (toggle)
const likeComment = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const iUserId = req.user._id;

    // Find the comment
    const comment = await VideoCommentModel.findOne({
      _id: id,
      eStatus: 'active',
      bDelete: false
    });

    if (!comment) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'commentNotFound' });
    }

    // Check if user already liked the comment
    const likeIndex = comment.aLikes.findIndex(userId => userId.toString() === iUserId.toString());
    let action = '';

    if (likeIndex > -1) {
      // Unlike: Remove user from likes array
      comment.aLikes.splice(likeIndex, 1);
      comment.nLikeCount = Math.max(0, comment.nLikeCount - 1);
      action = 'unliked';
    } else {
      // Like: Add user to likes array
      comment.aLikes.push(iUserId);
      comment.nLikeCount += 1;
      action = 'liked';
    }

    await comment.save();

    return res.status(status.OK).json({
      success: true,
      message: messages[lang][`comment${action.charAt(0).toUpperCase() + action.slice(1)}`] || `Comment ${action} successfully`,
      data: {
        commentId: comment._id,
        nLikeCount: comment.nLikeCount,
        isLiked: action === 'liked'
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToLikeComment' });
  }
};

// Get comments for a video (parent comments only)
const getComments = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { videoId } = req.query;
    const { limit, start } = getPaginationValues2(req.query);
    const { sortBy = 'dCreatedAt', sortOrder = 'desc' } = req.query;

    // Check if video exists
    const video = await VideoModel.findOne({ _id: videoId, eStatus: 'active', bDelete: false }).lean();
    if (!video) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'videoNotFound' });
    }

    const query = {
      iVideoId: videoId,
      iParentCommentId: null, // Only get parent comments
      eStatus: 'active',
      bDelete: false
    };

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [total, comments] = await Promise.all([
      VideoCommentModel.countDocuments(query),
      VideoCommentModel.find(query)
        .sort(sortOptions)
        .skip(Number(start))
        .limit(Number(limit))
        .populate({ path: 'iUserId', model: UserModel, select: 'sName sEmail sImage' })
        .lean()
    ]);

    // Add isLiked flag for authenticated user
    const userId = req?.user?._id;
    const enrichedComments = comments.map(comment => ({
      ...comment,
      isLiked: userId ? comment.aLikes.some(likeId => likeId.toString() === userId.toString()) : false,
      // Don't expose the full aLikes array to client
      aLikes: undefined
    }));

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].commentsRetrieved || 'Comments retrieved successfully',
      data: {
        total,
        results: enrichedComments,
        limit: Number(limit),
        start: Number(start)
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveComments' });
  }
};

// Get replies for a specific comment
const getReplies = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { commentId } = req.params;
    const { limit, start } = getPaginationValues2(req.query);

    // Check if parent comment exists
    const parentComment = await VideoCommentModel.findOne({
      _id: commentId,
      eStatus: 'active',
      bDelete: false
    }).lean();

    if (!parentComment) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'commentNotFound' });
    }

    const query = {
      iParentCommentId: commentId,
      eStatus: 'active',
      bDelete: false
    };

    const [total, replies] = await Promise.all([
      VideoCommentModel.countDocuments(query),
      VideoCommentModel.find(query)
        .sort({ dCreatedAt: 1 }) // Oldest first for replies
        .skip(Number(start))
        .limit(Number(limit))
        .populate({ path: 'iUserId', model: UserModel, select: 'sName sEmail sImage' })
        .lean()
    ]);

    // Add isLiked flag for authenticated user
    const userId = req?.user?._id;
    const enrichedReplies = replies.map(reply => ({
      ...reply,
      isLiked: userId ? reply.aLikes.some(likeId => likeId.toString() === userId.toString()) : false,
      // Don't expose the full aLikes array to client
      aLikes: undefined
    }));

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].repliesRetrieved || 'Replies retrieved successfully',
      data: {
        total,
        results: enrichedReplies,
        limit: Number(limit),
        start: Number(start)
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveReplies' });
  }
};

// Delete a comment (soft delete)
const deleteComment = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const iUserId = req.user._id;

    // Find the comment
    const comment = await VideoCommentModel.findOne({
      _id: id,
      eStatus: 'active',
      bDelete: false
    });

    if (!comment) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'commentNotFound' });
    }

    // Check if user is the comment owner
    if (comment.iUserId.toString() !== iUserId.toString()) {
      return res.status(status.Forbidden).json({
        success: false,
        message: messages[lang].notAuthorized || 'You are not authorized to delete this comment',
        data: {},
        error: {}
      });
    }

    // Soft delete the comment
    comment.bDelete = true;
    comment.eStatus = 'inactive';
    await comment.save();

    // Update parent comment reply count if it's a reply
    if (comment.iParentCommentId) {
      await VideoCommentModel.findByIdAndUpdate(
        comment.iParentCommentId,
        { $inc: { nReplyCount: -1 } }
      );
    }

    // Also soft delete all replies to this comment
    if (!comment.iParentCommentId) {
      await VideoCommentModel.updateMany(
        { iParentCommentId: id },
        { $set: { bDelete: true, eStatus: 'inactive' } }
      );
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].commentDeleted || 'Comment deleted successfully',
      data: {},
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToDeleteComment' });
  }
};

module.exports = {
  addComment,
  likeComment,
  getComments,
  getReplies,
  deleteComment
};
