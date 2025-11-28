// video.list.services.js
const mongoose = require('mongoose');
const { status, messages } = require('../../../../helper/api.responses');
const { handleServiceError, ObjectId, getPaginationValues2 } = require('../../../../helper/utilities.services');
const VideoModel = require('../model');
const GradeModel = require('../../grades/model');
const SubjectModel = require('../../subjects/model');
const TermModel = require('../../terms/model');
const { getSeoDataForRecords } = require('../../../../helper/seo.helper');
const data = require('../../../../data');
const BookmarkModel = require('../../bookmarks/model');
const VideoLikeModel = require('../likes/model');
const VideoWatchHistoryModel = require('../watchHistory/model');

const parseDurationToSeconds = duration => {
  if (!duration || typeof duration !== 'string') {
    return 0;
  }

  const parts = duration.split(':').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return 0;
  }

  const [hours, minutes, seconds] = parts;
  return hours * 3600 + minutes * 60 + seconds;
};

// const formatSecondsToDuration = totalSeconds => {
//   if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
//     return '00:00:00';
//   }

//   const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
//   const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
//   const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');

//   return `${hours}:${minutes}:${seconds}`;
// };

/**
 * Video List Services
 * Handles listing and filtering videos
 */

// List videos
const listVideos = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { limit, start } = getPaginationValues2(req.query);
    const { search, gradeId, subjectId, termId, status: videoStatus, bFeature, sortBy = 'dCreatedAt', sortOrder = 'desc', isFullResponse } = req.query;

    const query = {};
    if (req?.admin?.eType && ['SUPER', 'SUB'].includes(req.admin.eType)) {
      // query.eStatus = { $in: ['active', 'inactive'] };
    } else if (req?.user) {
      query.eStatus = 'active';
    } else {
      query.eStatus = 'active';
    }

    // Search filter
    if (search) {
      query.$or = [
        { sTitle: new RegExp('^.*' + search + '.*', 'i') },
        { sDescription: new RegExp('^.*' + search + '.*', 'i') }
      ];
    }

    // Grade filter
    if (gradeId) {
      query.iGradeId = mongoose.Types.ObjectId(gradeId);
    }

    // Subject filter
    if (subjectId) {
      query.iSubjectId = mongoose.Types.ObjectId(subjectId);
    }

    // Term filter
    if (termId) {
      query.iTermId = mongoose.Types.ObjectId(termId);
    }

    // Status filter
    if (videoStatus) {
      query.eStatus = videoStatus;
    }

    // Feature filter
    if (bFeature !== undefined) {
      query.bFeature = bFeature === 'true' || bFeature === true || bFeature === '1' || bFeature === 1;
    }

    // Sort options
    const sortOptions = {};
    // Support sorting by likes and views
    if (sortBy === 'likes') {
      sortOptions.nLikeCount = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'views') {
      sortOptions.nViewCount = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    let results = [];
    let total = 0;

    if ([true, 'true'].includes(isFullResponse)) {
      results = await VideoModel.find(query)
        .sort(sortOptions)
        .populate('iGradeId', 'sName iOrder')
        .lean();
      total = results.length;
    } else {
      [total, results] = await Promise.all([
        VideoModel.countDocuments(query),
        VideoModel.find(query)
          .sort(sortOptions)
          .skip(Number(start))
          .limit(Number(limit))
          .populate('iGradeId', 'sName iOrder')
          .lean()
      ]);
    }

    // Get term details if termId filter is applied
    let termDetails = null;
    if (termId) {
      const term = await TermModel.findOne({ _id: termId }, { sName: 1 }).lean();
      termDetails = term ? { id: term._id, sName: term.sName } : null;
    }

    // Get subject details if subjectId filter is applied
    let subjectDetails = null;
    if (subjectId) {
      const subject = await SubjectModel.findOne({ _id: subjectId }, { sName: 1 }).lean();
      subjectDetails = subject ? { id: subject._id, sName: subject.sName } : null;
    }

    // Get grade details if gradeId filter is applied
    let gradeDetails = null;
    if (gradeId) {
      const grade = await GradeModel.findOne({ _id: gradeId }, { sName: 1, iOrder: 1 }).lean();
      gradeDetails = grade ? { id: grade._id, sName: grade.sName, iOrder: grade.iOrder, nVideoCount: total } : null;
    }

    // Annotate bookmark/like flags plus watch progress for authenticated users
    if (req?.user?._id && Array.isArray(results) && results.length) {
      const videoIds = results.map(v => ObjectId(v._id));
      const userId = ObjectId(req.user._id);

      // Get bookmarks, likes, and watch history in parallel
      const [bookmarks, likes, watchHistories] = await Promise.all([
        BookmarkModel.find({ iUserId: userId, iVideoId: { $in: videoIds }, bDelete: false }, { iVideoId: 1 }, { readPreference: 'primary' }).lean(),
        VideoLikeModel.find({ iUserId: userId, iVideoId: { $in: videoIds }, bDelete: false }, { iVideoId: 1 }, { readPreference: 'primary' }).lean(),
        VideoWatchHistoryModel.find(
          { iUserId: userId, iVideoId: { $in: videoIds }, bDelete: false },
          { iVideoId: 1, nLastPosition: 1 },
          { readPreference: 'primary' }
        ).lean()
      ]);

      const bookmarkedSet = new Set(bookmarks.map(b => String(b.iVideoId)));
      const likedSet = new Set(likes.map(l => String(l.iVideoId)));
      const watchMap = new Map(watchHistories.map(h => [String(h.iVideoId), h.nLastPosition || '00:00:00']));

      results = results.map(v => ({
        ...v,
        isBookmarked: bookmarkedSet.has(String(v._id)),
        isLiked: likedSet.has(String(v._id)),
        nLikeCount: v.nLikeCount || 0,
        nViewCount: v.nViewCount || 0,
        lastPosition: watchMap.get(String(v._id)) || '00:00:00'
      }));
    } else if (Array.isArray(results)) {
      results = results.map(v => ({
        ...v,
        isBookmarked: false,
        isLiked: false,
        nLikeCount: v.nLikeCount || 0,
        nViewCount: v.nViewCount || 0,
        lastPosition: '00:00:00'
      }));
    }

    results = Array.isArray(results)
      ? results.map(video => ({
        ...video,
        videoId: video._id,
        libraryId: video.iLibraryId || '',
        externalId: video.iExternalVideoId || ''
      }))
      : results;

    const totalDurationSeconds = Array.isArray(results)
      ? results.reduce((sum, video) => sum + parseDurationToSeconds(video?.iDuration), 0)
      : 0;

    const totalDuration = Number((totalDurationSeconds / 3600).toFixed(2));
    // const totalDuration = formatSecondsToDuration(totalDurationSeconds);

    // Add SEO data to all results
    const resultsWithSeo = await getSeoDataForRecords(results, data.eSeoType.map.VIDEO);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].videosRetrieved,
      data: {
        total,
        results: resultsWithSeo,
        limit: [true, 'true'].includes(isFullResponse) ? null : Number(limit),
        start: [true, 'true'].includes(isFullResponse) ? null : Number(start),
        termDetails,
        subjectDetails,
        gradeDetails,
        totalDuration
        // durationSummary: {
        //   totalDurationHours,
        //   totalDuration
        // }
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveVideos' });
  }
};

module.exports = {
  listVideos
};
