const mongoose = require('mongoose');
const { messages, status } = require('../../../../helper/api.responses');
const { handleServiceError, ObjectId } = require('../../../../helper/utilities.services');
const VideoModel = require('../model');
const SubjectModel = require('../../subjects/model');
const QuizModel = require('../../quiz/model');
const VideoCommentModel = require('../comments/model');
const UserModel = require('../../../user/model');
const SubscriptionModel = require('../../../subscription/model');
const BookmarkModel = require('../../bookmarks/model');
const VideoWatchHistoryModel = require('../watchHistory/model');
const VideoLikeModel = require('../likes/model');
const { generateSecureUrl } = require('../common');
const { getSeoDataForRecord, getSeoDataForRecords } = require('../../../../helper/seo.helper');
const data = require('../../../../data');

/**
 * Video Detail Services
 * Handles comprehensive video detail page with related content
 */

// Get comprehensive video detail page
const getVideoDetail = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    // Properly extract userId - handle both string and ObjectId formats
    const userId = req?.user?._id ? (typeof req.user._id === 'string' ? ObjectId(req.user._id) : req.user._id) : null;

    // Get video details with populated references
    const video = await VideoModel.findOne({ _id: id, eStatus: 'active', bDelete: false })
      .populate('iGradeId', 'sName iOrder sImage sDescription')
      .populate('iSubjectId', 'sName sImage sTeacher sDescription iOrder')
      .populate('iTermId', 'sName iOrder')
      .lean();

    if (!video) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'videoNotFound' });
    }

    video.videoId = video._id;
    video.libraryId = video.iLibraryId || '';
    video.externalId = video.iExternalVideoId || '';

    // Duration is already in hh:mm:ss format, no conversion needed

    // Generate secure video URL if available
    if (video.iLibraryId && video.iExternalVideoId) {
      video.sWebUrl = generateSecureUrl(video.iLibraryId, video.iExternalVideoId);
    }

    // Determine if video is premium or freemium
    let ePlanType = 'freemium'; // Default to freemium
    if (userId) {
      const user = await UserModel.findById(userId).populate('iSubscriptionId').lean();
      if (user && user.iSubscriptionId) {
        const subscription = await SubscriptionModel.findById(user.iSubscriptionId).lean();
        if (subscription && subscription.ePlan === 'premium' && subscription.eStatus === 'success') {
          ePlanType = 'premium';
        }
      }
    }

    // Get up next videos (3 records with fallback logic)
    let upNextVideos = [];

    // Step 1: Try same grade, term, and subject
    upNextVideos = await VideoModel.find({
      iGradeId: video.iGradeId._id,
      iSubjectId: video.iSubjectId._id,
      iTermId: video.iTermId._id,
      _id: { $ne: id },
      eStatus: 'active',
      bDelete: false
    })
      .sort({ iOrder: 1 })
      .limit(3)
      .select('_id sTitle iDuration sThumbnailUrl sDescription iOrder nLikeCount nViewCount iLibraryId iExternalVideoId')
      .lean();

    // Step 2: If not enough, try same grade and subject but different term
    if (upNextVideos.length < 3) {
      const remainingCount = 3 - upNextVideos.length;
      const excludeIds = [...upNextVideos.map(v => v._id), mongoose.Types.ObjectId(id)];

      const otherTermVideos = await VideoModel.find({
        iGradeId: video.iGradeId._id,
        iSubjectId: video.iSubjectId._id,
        iTermId: { $ne: video.iTermId._id },
        _id: { $nin: excludeIds },
        eStatus: 'active',
        bDelete: false
      })
        .sort({ iOrder: 1 })
        .limit(remainingCount)
        .select('_id sTitle iDuration sThumbnailUrl sDescription iOrder nLikeCount nViewCount iLibraryId iExternalVideoId')
        .lean();

      upNextVideos = [...upNextVideos, ...otherTermVideos];
    }

    // Step 3: If still not enough, try different grade
    if (upNextVideos.length < 3) {
      const remainingCount = 3 - upNextVideos.length;
      const excludeIds = [...upNextVideos.map(v => v._id), mongoose.Types.ObjectId(id)];

      const otherGradeVideos = await VideoModel.find({
        iGradeId: { $ne: video.iGradeId._id },
        iSubjectId: video.iSubjectId._id,
        _id: { $nin: excludeIds },
        eStatus: 'active',
        bDelete: false
      })
        .sort({ iOrder: 1 })
        .limit(remainingCount)
        .select('_id sTitle iDuration sThumbnailUrl sDescription iOrder nLikeCount nViewCount iLibraryId iExternalVideoId')
        .lean();

      upNextVideos = [...upNextVideos, ...otherGradeVideos];
    }

    // Duration is already in hh:mm:ss format from database
    upNextVideos = upNextVideos.map(video => ({
      ...video,
      videoId: video._id,
      libraryId: video.iLibraryId || '',
      externalId: video.iExternalVideoId || ''
    }));

    // Get related courses (3 subjects with same grade, with total episodes count)
    const relatedCourses = [];

    // Step 1: Try same grade
    const sameGradeSubjects = await SubjectModel.find({
      iGradeId: video.iGradeId._id,
      _id: { $ne: video.iSubjectId._id },
      eStatus: 'active'
    })
      .populate('iGradeId', 'sName iOrder')
      .limit(3)
      .lean();

    for (const subject of sameGradeSubjects) {
      const episodeCount = await VideoModel.countDocuments({
        iSubjectId: subject._id,
        eStatus: 'active',
        bDelete: false
      });

      relatedCourses.push({
        _id: subject._id,
        sSubjectName: subject.sName,
        sImage: subject.sImage,
        sTeacher: subject.sTeacher,
        sDescription: subject.sDescription,
        iOrder: subject.iOrder,
        sGradeName: subject.iGradeId.sName,
        iGradeOrder: subject.iGradeId.iOrder,
        nEpisodeCount: episodeCount
      });
    }

    // Step 2: If not enough, get subjects from other grades
    if (relatedCourses.length < 3) {
      const remainingCount = 3 - relatedCourses.length;
      const excludeIds = relatedCourses.map(c => c._id);

      const otherGradeSubjects = await SubjectModel.find({
        iGradeId: { $ne: video.iGradeId._id },
        _id: { $nin: excludeIds },
        eStatus: 'active'
      })
        .populate('iGradeId', 'sName iOrder')
        .limit(remainingCount)
        .lean();

      for (const subject of otherGradeSubjects) {
        const episodeCount = await VideoModel.countDocuments({
          iSubjectId: subject._id,
          eStatus: 'active',
          bDelete: false
        });

        relatedCourses.push({
          _id: subject._id,
          sSubjectName: subject.sName,
          sImage: subject.sImage,
          sTeacher: subject.sTeacher,
          sDescription: subject.sDescription,
          iOrder: subject.iOrder,
          sGradeName: subject.iGradeId.sName,
          iGradeOrder: subject.iGradeId.iOrder,
          nEpisodeCount: episodeCount
        });
      }
    }

    // Get top 3 comments for this video
    const comments = await VideoCommentModel.find({
      iVideoId: id,
      iParentCommentId: null,
      eStatus: 'active',
      bDelete: false
    })
      .sort({ nLikeCount: -1, dCreatedAt: -1 })
      .limit(3)
      .populate({ path: 'iUserId', model: UserModel, select: 'sName sEmail sImage' })
      .lean();

    // Add isLiked flag for comments
    const enrichedComments = comments.map(comment => ({
      ...comment,
      isLiked: userId ? comment.aLikes.some(likeId => likeId.toString() === userId.toString()) : false,
      aLikes: undefined // Don't expose full likes array
    }));

    // Check if video is bookmarked
    let isBookmarked = false;
    if (userId) {
      const bookmarked = await BookmarkModel.findOne({
        iUserId: ObjectId(userId),
        iVideoId: ObjectId(video._id),
        bDelete: false
      }, { _id: 1 }).lean();
      isBookmarked = Boolean(bookmarked);
    }

    // Check if video is liked by user
    let isLiked = false;
    if (userId) {
      const liked = await VideoLikeModel.findOne({
        iUserId: ObjectId(userId),
        iVideoId: ObjectId(video._id),
        bDelete: false
      }, { _id: 1 }, { readPreference: 'primary' }).lean();
      isLiked = Boolean(liked);
    }

    // Get like and view counts (already in video model, but ensure they exist)
    const nLikeCount = video.nLikeCount || 0;
    const nViewCount = video.nViewCount || 0;

    // Add isLiked flag to upNext videos if user is authenticated
    if (userId && upNextVideos.length > 0) {
      const upNextVideoIds = upNextVideos.map(v => ObjectId(v._id));
      const upNextLikes = await VideoLikeModel.find({
        iUserId: ObjectId(userId),
        iVideoId: { $in: upNextVideoIds },
        bDelete: false
      }, { iVideoId: 1 }, { readPreference: 'primary' }).lean();
      const upNextLikedSet = new Set(upNextLikes.map(l => String(l.iVideoId)));
      upNextVideos = upNextVideos.map(v => ({
        ...v,
        isLiked: upNextLikedSet.has(String(v._id)),
        nLikeCount: v.nLikeCount || 0,
        nViewCount: v.nViewCount || 0
      }));
    } else {
      upNextVideos = upNextVideos.map(v => ({
        ...v,
        isLiked: false,
        nLikeCount: v.nLikeCount || 0,
        nViewCount: v.nViewCount || 0
      }));
    }

    // Get watch history for authenticated user
    let watchHistory = null;
    let nWatchedDuration = '00:00:00';
    let nWatchPercentage = 0;
    let nLastPosition = '00:00:00';
    let bCompleted = false;

    if (userId) {
      watchHistory = await VideoWatchHistoryModel.findOne({
        iUserId: ObjectId(userId),
        iVideoId: ObjectId(video._id),
        bDelete: false
      }).lean();

      if (watchHistory) {
        nWatchedDuration = watchHistory.nWatchDuration || '00:00:00';
        nWatchPercentage = watchHistory.nWatchPercentage || 0;
        nLastPosition = watchHistory.nLastPosition || '00:00:00';
        bCompleted = watchHistory.bCompleted || false;
      }
    }

    // Fetch single quiz mapped to this video (if any)
    const quizPromise = QuizModel.findOne({
      iVideoId: video._id,
      bDelete: false,
      eStatus: { $ne: data.eStatus.map.INACTIVE }
    })
      .select('_id sTitle sDescription nTotalMarks nTimeLimitInMinutes')
      .lean();

    // Add SEO data to all entities in parallel
    const [videoWithSeo, gradeWithSeo, subjectWithSeo, termWithSeo, upNextWithSeo, relatedCoursesWithSeo, quiz] = await Promise.all([
      // Main video SEO
      getSeoDataForRecord({
        _id: video._id,
        videoId: video.videoId,
        sTitle: video.sTitle,
        iDuration: video.iDuration,
        sDescription: video.sDescription,
        sUrl: video.sUrl,
        sWebUrl: video.sWebUrl,
        sThumbnailUrl: video.sThumbnailUrl,
        iOrder: video.iOrder,
        bFeature: video.bFeature,
        dCreatedAt: video.dCreatedAt,
        dUpdatedAt: video.dUpdatedAt,
        libraryId: video.libraryId,
        externalId: video.externalId
      }, data.eSeoType.map.VIDEO),

      // Grade SEO
      getSeoDataForRecord({
        _id: video.iGradeId._id,
        sName: video.iGradeId.sName,
        iOrder: video.iGradeId.iOrder,
        sImage: video.iGradeId.sImage,
        sDescription: video.iGradeId.sDescription
      }, data.eSeoType.map.GRADE),

      // Subject SEO
      getSeoDataForRecord({
        _id: video.iSubjectId._id,
        sName: video.iSubjectId.sName,
        sImage: video.iSubjectId.sImage,
        sTeacher: video.iSubjectId.sTeacher,
        sDescription: video.iSubjectId.sDescription,
        iOrder: video.iSubjectId.iOrder
      }, data.eSeoType.map.SUBJECT),

      // Term SEO
      getSeoDataForRecord({
        _id: video.iTermId._id,
        sName: video.iTermId.sName,
        iOrder: video.iTermId.iOrder
      }, data.eSeoType.map.TERM),

      // Up Next videos SEO
      getSeoDataForRecords(upNextVideos.map(v => ({
        _id: v._id,
        videoId: v.videoId,
        sTitle: v.sTitle,
        iDuration: v.iDuration,
        sThumbnailUrl: v.sThumbnailUrl,
        sDescription: v.sDescription,
        iOrder: v.iOrder,
        nLikeCount: v.nLikeCount || 0,
        nViewCount: v.nViewCount || 0,
        isLiked: v.isLiked || false,
        libraryId: v.libraryId,
        externalId: v.externalId
      })), data.eSeoType.map.VIDEO),

      // Related courses SEO
      getSeoDataForRecords(relatedCourses.map(c => ({
        _id: c._id,
        sSubjectName: c.sSubjectName,
        sImage: c.sImage,
        sTeacher: c.sTeacher,
        sDescription: c.sDescription,
        iOrder: c.iOrder,
        sGradeName: c.sGradeName,
        iGradeOrder: c.iGradeOrder,
        nEpisodeCount: c.nEpisodeCount
      })), data.eSeoType.map.SUBJECT),
      quizPromise
    ]);

    // Construct comprehensive response
    const videoDetail = {
      ...videoWithSeo,

      // Subject details with SEO
      oSubject: subjectWithSeo,

      // Grade details with SEO
      oGrade: gradeWithSeo,

      // Term details with SEO
      oTerm: termWithSeo,

      // Premium/Freemium status
      ePlanType: ePlanType,

      // Bookmarked status
      isBookmarked: isBookmarked,

      // Like and view counts
      nLikeCount: nLikeCount,
      nViewCount: nViewCount,

      // Liked status (for authenticated users)
      isLiked: isLiked,

      // Watch history (only for authenticated users)
      ...(userId ? {
        nWatchedDuration: nWatchedDuration,
        nWatchPercentage: nWatchPercentage,
        nLastPosition: nLastPosition,
        bCompleted: bCompleted
      } : {}),

      // Up next videos with SEO
      aUpNextVideos: upNextWithSeo,

      // Related courses with SEO
      aRelatedCourses: relatedCoursesWithSeo,

      // Quiz details mapped to this video (single object)
      oQuiz: quiz || null,

      // Top comments
      aComments: enrichedComments
    };

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].videoDetailRetrieved || 'Video details retrieved successfully',
      data: { video: videoDetail },
      error: {}
    });
  } catch (error) {
    console.log('Failed to get video detail', error);
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveVideo' });
  }
};

module.exports = {
  getVideoDetail
};
