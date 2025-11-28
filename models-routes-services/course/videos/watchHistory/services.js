// videoWatchHistory.services.js
const mongoose = require('mongoose');
const { status, messages } = require('../../../../helper/api.responses');
const { handleServiceError, getPaginationValues2, hhmmssToSeconds, secondsToHHMMSS } = require('../../../../helper/utilities.services');
const VideoWatchHistoryModel = require('./model');
const VideoModel = require('../model');
const UserModel = require('../../../user/model');
const GradeModel = require('../../grades/model');
const SubjectModel = require('../../subjects/model');
const TermModel = require('../../terms/model');
const BookmarkModel = require('../../bookmarks/model');
const data = require('../../../../data');
const {
  logVideoWatchActivity,
  logVideoCompleteActivity,
  logTermCompleteActivity,
  logSubjectCompleteActivity
} = require('../../../../helper/activity.helper');
const {
  evaluateVideoCompletionBadges,
  evaluateSubjectCompletionBadges
} = require('../../../../helper/badge.helper');
const { getSeoDataForRecords } = require('../../../../helper/seo.helper');

// Ensure any duration-like input is returned as strict HH:MM:SS
function toHHMMSS (value) {
  if (value === null || value === undefined || value === '') return '00:00:00';
  if (typeof value === 'number' && Number.isFinite(value)) return secondsToHHMMSS(Math.max(0, Math.floor(value)));
  // For strings, try to parse with existing utility then normalize back
  try {
    const secs = hhmmssToSeconds(String(value));
    return secondsToHHMMSS(Math.max(0, Math.floor(secs)));
  } catch (e) {
    return '00:00:00';
  }
}

// Record or update video watch history
const recordVideoWatch = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const userId = req.user._id;
    const {
      iVideoId,
      nWatchDuration,
      nLastPosition,
      sDeviceType,
      sDeviceOS,
      sBrowser
    } = req.body;

    // Validate video exists and get its details
    const video = await VideoModel.findOne({
      _id: iVideoId,
      eStatus: data.eStatus.map.ACTIVE
    }, null, { readPreference: 'primary' }).lean();

    if (!video) {
      return handleServiceError(null, req, res, {
        statusCode: status.NotFound,
        messageKey: 'videoNotFound'
      });
    }

    // Convert hh:mm:ss to seconds for calculations
    const totalDuration = hhmmssToSeconds(toHHMMSS(video.iDuration));
    // Normalize incoming request values to HH:MM:SS strictly first
    const normalizedIncomingWatchHHMMSS = toHHMMSS(nWatchDuration);
    const normalizedIncomingLastPosHHMMSS = toHHMMSS(nLastPosition);
    const incomingWatch = hhmmssToSeconds(normalizedIncomingWatchHHMMSS);
    // Never allow watched duration to exceed the actual video duration
    const normalizedIncomingWatch = Math.max(0, Math.min(incomingWatch, totalDuration));

    // Check if watch history already exists for this user-video combination
    const existingHistory = await VideoWatchHistoryModel.findOne({
      iUserId: userId,
      iVideoId: iVideoId,
      bDelete: false
    }, null, { readPreference: 'primary' });

    const sessionData = {
      sDeviceType: sDeviceType || '',
      sDeviceOS: sDeviceOS || '',
      sBrowser: sBrowser || '',
      sIpAddress: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || ''
    };

    let watchHistory;
    let wasNewVideo = false;
    let wasJustCompleted = false;
    let previousWasCompleted = false;
    let subjectCompleted = false;

    if (existingHistory) {
      // Update existing watch history
      const prevWatch = hhmmssToSeconds(existingHistory.nWatchDuration);
      previousWasCompleted = existingHistory.bCompleted;
      const mergedWatch = Math.max(normalizedIncomingWatch, prevWatch);
      const cappedWatch = Math.min(mergedWatch, totalDuration);
      const watchPercentage = totalDuration > 0 ? Math.min((cappedWatch / totalDuration) * 100, 100) : 0;
      const isCompleted = watchPercentage >= 90;

      existingHistory.nWatchDuration = secondsToHHMMSS(cappedWatch);
      existingHistory.nLastPosition = normalizedIncomingLastPosHHMMSS || '00:00:00';
      existingHistory.nTotalDuration = toHHMMSS(existingHistory.nTotalDuration || video.iDuration || '00:00:00');
      existingHistory.nWatchPercentage = watchPercentage;
      existingHistory.bCompleted = isCompleted;
      existingHistory.dLastWatchedAt = new Date();
      existingHistory.oSessionData = sessionData;

      await existingHistory.save();
      watchHistory = existingHistory;
      wasJustCompleted = isCompleted && !previousWasCompleted;
    } else {
      // Create new watch history record
      wasNewVideo = true;
      const cappedWatch = Math.min(normalizedIncomingWatch, totalDuration);
      const watchPercentage = totalDuration > 0 ? Math.min((cappedWatch / totalDuration) * 100, 100) : 0;
      const isCompleted = watchPercentage >= 90;

      watchHistory = new VideoWatchHistoryModel({
        iUserId: userId,
        iVideoId: iVideoId,
        iGradeId: video.iGradeId,
        iSubjectId: video.iSubjectId,
        iTermId: video.iTermId,
        nWatchDuration: secondsToHHMMSS(cappedWatch),
        nTotalDuration: toHHMMSS(video.iDuration),
        nWatchPercentage: watchPercentage,
        bCompleted: isCompleted,
        nLastPosition: normalizedIncomingLastPosHHMMSS || '00:00:00',
        oSessionData: sessionData,
        dLastWatchedAt: new Date()
      });

      await watchHistory.save();
      wasJustCompleted = isCompleted;
    }

    // Manually populate for response (cross-database references)
    const historyData = watchHistory.toObject ? watchHistory.toObject() : watchHistory;

    // Fetch related data manually
    const [videoData, gradeData, subjectData, termData] = await Promise.all([
      VideoModel.findById(historyData.iVideoId, 'sTitle sThumbnailUrl iDuration').lean(),
      GradeModel.findById(historyData.iGradeId, 'sName').lean(),
      SubjectModel.findById(historyData.iSubjectId, 'sName').lean(),
      TermModel.findById(historyData.iTermId, 'sName').lean()
    ]);

    // Log activity asynchronously (don't wait for it)
    setImmediate(async () => {
      try {
        // Check if this is user's first video
        let isFirstVideo = false;
        if (wasNewVideo) {
          const userVideoCount = await VideoWatchHistoryModel.countDocuments({
            iUserId: userId,
            bDelete: false
          });
          isFirstVideo = userVideoCount === 1;
        }

        // Log video watch activity
        if (wasNewVideo || watchHistory.nWatchPercentage > 10) {
          await logVideoWatchActivity({
            userId,
            videoId: iVideoId,
            videoTitle: videoData?.sTitle || 'Unknown Video',
            videoThumbnail: videoData?.sThumbnailUrl || '',
            videoDuration: totalDuration,
            watchDuration: hhmmssToSeconds(watchHistory.nWatchDuration),
            watchPercentage: watchHistory.nWatchPercentage,
            subjectId: video.iSubjectId,
            subjectName: subjectData?.sName || '',
            termId: video.iTermId,
            termName: termData?.sName || '',
            gradeId: video.iGradeId,
            gradeName: gradeData?.sName || '',
            isFirstVideo
          });
        }

        // Log video completion activity
        if (wasJustCompleted) {
          await logVideoCompleteActivity({
            userId,
            videoId: iVideoId,
            videoTitle: videoData?.sTitle || 'Unknown Video',
            videoThumbnail: videoData?.sThumbnailUrl || '',
            videoDuration: totalDuration,
            subjectId: video.iSubjectId,
            subjectName: subjectData?.sName || '',
            termId: video.iTermId,
            termName: termData?.sName || '',
            gradeId: video.iGradeId,
            gradeName: gradeData?.sName || ''
          });

          // Check if term is completed
          const termVideos = await VideoModel.countDocuments({
            iTermId: video.iTermId,
            eStatus: data.eStatus.map.ACTIVE,
            bDelete: false
          });

          const completedTermVideos = await VideoWatchHistoryModel.countDocuments({
            iUserId: userId,
            iTermId: video.iTermId,
            bCompleted: true,
            bDelete: false
          });

          if (termVideos > 0 && completedTermVideos >= termVideos) {
            await logTermCompleteActivity({
              userId,
              termId: video.iTermId,
              termName: termData?.sName || '',
              subjectId: video.iSubjectId,
              subjectName: subjectData?.sName || '',
              gradeId: video.iGradeId,
              gradeName: gradeData?.sName || '',
              totalVideos: termVideos,
              completedVideos: completedTermVideos
            });
          }

          // Check if subject is completed
          const subjectVideos = await VideoModel.countDocuments({
            iSubjectId: video.iSubjectId,
            eStatus: data.eStatus.map.ACTIVE,
            bDelete: false
          });

          const completedSubjectVideos = await VideoWatchHistoryModel.countDocuments({
            iUserId: userId,
            iSubjectId: video.iSubjectId,
            bCompleted: true,
            bDelete: false
          });

          if (subjectVideos > 0 && completedSubjectVideos >= subjectVideos) {
            const subjectTerms = await TermModel.countDocuments({
              iSubjectId: video.iSubjectId,
              eStatus: data.eStatus.map.ACTIVE
            });

            await logSubjectCompleteActivity({
              userId,
              subjectId: video.iSubjectId,
              subjectName: subjectData?.sName || '',
              gradeId: video.iGradeId,
              gradeName: gradeData?.sName || '',
              totalVideos: subjectVideos,
              completedVideos: completedSubjectVideos,
              totalTerms: subjectTerms
            });

            subjectCompleted = true;
          }
        }

        // Evaluate badges asynchronously after completion checks
        if (wasJustCompleted) {
          evaluateVideoCompletionBadges({ userId }).catch(err => console.error('Error evaluating video completion badges:', err));
        }

        if (subjectCompleted) {
          evaluateSubjectCompletionBadges({ userId }).catch(err => console.error('Error evaluating subject completion badges:', err));
        }
      } catch (activityError) {
        console.error('Error logging video watch activity:', activityError);
      }
    });

    const populatedHistory = {
      ...historyData,
      iVideoId: videoData,
      iGradeId: gradeData,
      iSubjectId: subjectData,
      iTermId: termData,
      // Ensure response durations are strictly HH:MM:SS
      nLastPosition: toHHMMSS(watchHistory.nLastPosition || '00:00:00'),
      nWatchDuration: toHHMMSS(watchHistory.nWatchDuration || '00:00:00'),
      nTotalDuration: toHHMMSS(watchHistory.nTotalDuration || video.iDuration || '00:00:00')
    };

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].watchHistoryRecorded || 'Watch history recorded successfully',
      data: { watchHistory: populatedHistory },
      error: {}
    });
  } catch (error) {
    console.log('recordVideoWatch error:', error);
    return handleServiceError(error, req, res, { messageKey: 'failedToRecordWatchHistory' });
  }
};

// Get user's watch history with pagination and filters
const getUserWatchHistory = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const userId = req.user._id;
    const { limit, start } = getPaginationValues2(req.query);
    const { gradeId, subjectId, termId, completed, watchStatus, sortBy = 'dLastWatchedAt', sortOrder = 'desc' } = req.query;

    const query = {
      iUserId: userId,
      bDelete: false
    };

    // Apply filters
    if (gradeId) query.iGradeId = mongoose.Types.ObjectId(gradeId);
    if (subjectId) query.iSubjectId = mongoose.Types.ObjectId(subjectId);
    if (termId) query.iTermId = mongoose.Types.ObjectId(termId);

    // Handle watch status filter (Pending or Fully Watched)
    if (watchStatus) {
      const normalizedStatus = watchStatus.toLowerCase();
      if (normalizedStatus === 'fully_watched' || normalizedStatus === 'fullywatched') {
        query.bCompleted = true;
      } else if (normalizedStatus === 'pending') {
        query.bCompleted = false;
      }
    } else if (completed !== undefined) {
      // Keep backward compatibility with 'completed' parameter
      query.bCompleted = completed === 'true' || completed === true;
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [total, results] = await Promise.all([
      VideoWatchHistoryModel.countDocuments(query),
      VideoWatchHistoryModel.find(query)
        .sort(sortOptions)
        .skip(Number(start))
        .limit(Number(limit))
        .lean()
    ]);

    // Manually populate for cross-database references
    if (results.length > 0) {
      const videoIds = [...new Set(results.map(r => r.iVideoId))];
      const gradeIds = [...new Set(results.map(r => r.iGradeId))];
      const subjectIds = [...new Set(results.map(r => r.iSubjectId))];
      const termIds = [...new Set(results.map(r => r.iTermId))];

      const [videos, grades, subjects, terms, bookmarks] = await Promise.all([
        VideoModel.find({ _id: { $in: videoIds } }, 'sTitle sThumbnailUrl iDuration sUrl iLibraryId iExternalVideoId').lean(),
        GradeModel.find({ _id: { $in: gradeIds } }, 'sName').lean(),
        SubjectModel.find({ _id: { $in: subjectIds } }, 'sName').lean(),
        TermModel.find({ _id: { $in: termIds } }, 'sName').lean(),
        BookmarkModel.find({ iUserId: userId, iVideoId: { $in: videoIds }, bDelete: false }, 'iVideoId').lean()
      ]);

      // Add SEO data to videos
      const videosWithSeo = await getSeoDataForRecords(videos, data.eSeoType.map.VIDEO);

      const videoMap = new Map(videosWithSeo.map(v => [v._id.toString(), v]));
      const gradeMap = new Map(grades.map(g => [g._id.toString(), g]));
      const subjectMap = new Map(subjects.map(s => [s._id.toString(), s]));
      const termMap = new Map(terms.map(t => [t._id.toString(), t]));

      const bookmarkedSet = new Set(bookmarks.map(b => b.iVideoId.toString()));

      results.forEach(result => {
        const rawVideoId = result.iVideoId;
        const videoIdStr = rawVideoId?.toString();
        const populatedVideo = videoIdStr ? videoMap.get(videoIdStr) : null;

        if (populatedVideo) {
          result.iVideoId = {
            ...populatedVideo,
            iLibraryId: populatedVideo.iLibraryId || '',
            iExternalVideoId: populatedVideo.iExternalVideoId || '',
            isBookmarked: videoIdStr ? bookmarkedSet.has(videoIdStr) : false
          };
        } else {
          result.iVideoId = {
            _id: rawVideoId,
            iLibraryId: '',
            iExternalVideoId: '',
            isBookmarked: videoIdStr ? bookmarkedSet.has(videoIdStr) : false
          };
        }
        result.iGradeId = gradeMap.get(result.iGradeId.toString()) || result.iGradeId;
        result.iSubjectId = subjectMap.get(result.iSubjectId.toString()) || result.iSubjectId;
        result.iTermId = termMap.get(result.iTermId.toString()) || result.iTermId;
        // Ensure duration fields are strings in HH:MM:SS format
        result.nWatchDuration = result.nWatchDuration || '00:00:00';
        result.nTotalDuration = result.nTotalDuration || '00:00:00';
        result.nLastPosition = result.nLastPosition || '00:00:00';
        // Ensure video duration is in HH:MM:SS format
        if (result.iVideoId && result.iVideoId.iDuration) {
          result.iVideoId.iDuration = result.iVideoId.iDuration || '00:00:00';
        }
      });
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].watchHistoryRetrieved || 'Watch history retrieved successfully',
      data: {
        total,
        results,
        limit: Number(limit),
        start: Number(start)
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveWatchHistory' });
  }
};

// Get watch statistics for a user (or child by parent)
const getWatchStatistics = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const requesterId = req.user._id;
    const { userId } = req.params; // Optional: for parents checking their children's stats

    let targetUserId = requesterId;

    // If userId is provided, verify the requester is a parent of that user
    if (userId && userId !== requesterId.toString()) {
      const requester = await UserModel.findById(requesterId, 'eRole aChildren', { readPreference: 'primary' }).lean();

      if (requester.eRole === data.eUserRoles.map.PARENT) {
        const childrenIds = (requester.aChildren || []).map(id => id.toString());
        if (!childrenIds.includes(userId)) {
          return handleServiceError(null, req, res, {
            statusCode: status.Forbidden,
            messageKey: 'accessDenied'
          });
        }
        targetUserId = userId;
      } else {
        return handleServiceError(null, req, res, {
          statusCode: status.Forbidden,
          messageKey: 'accessDenied'
        });
      }
    }

    // Get overall statistics
    const watchHistories = await VideoWatchHistoryModel.find({
      iUserId: targetUserId,
      bDelete: false
    }).lean();

    const totalVideosWatched = watchHistories.length;
    const totalVideosCompleted = watchHistories.filter(h => h.bCompleted).length;

    let totalWatchTime = 0;
    watchHistories.forEach(history => {
      totalWatchTime += hhmmssToSeconds(history.nWatchDuration);
    });

    // Get statistics by subject (without $lookup due to cross-database)
    const subjectStats = await VideoWatchHistoryModel.aggregate([
      {
        $match: {
          iUserId: mongoose.Types.ObjectId(targetUserId),
          bDelete: false
        }
      },
      {
        $group: {
          _id: '$iSubjectId',
          nVideosWatched: { $sum: 1 },
          nVideosCompleted: {
            $sum: { $cond: ['$bCompleted', 1, 0] }
          },
          nTotalWatchTime: {
            $sum: { $toDouble: '$nWatchDuration' }
          }
        }
      },
      {
        $sort: { nTotalWatchTime: -1 }
      }
    ]);

    // Manually fetch subject names
    const subjectIds = subjectStats.map(s => s._id);
    const subjects = subjectIds.length > 0
      ? await SubjectModel.find({ _id: { $in: subjectIds } }, 'sName').lean()
      : [];
    const subjectMap = new Map(subjects.map(s => [s._id.toString(), s.sName]));

    const statsBySubject = subjectStats.map(stat => {
      // Note: nTotalWatchTime from aggregation is a number (sum of durations as numbers)
      // We need to recalculate from actual watch history records
      const subjectWatchHistories = watchHistories.filter(h => String(h.iSubjectId) === String(stat._id));
      const totalSeconds = subjectWatchHistories.reduce((sum, h) => sum + hhmmssToSeconds(h.nWatchDuration || '00:00:00'), 0);
      return {
        _id: stat._id,
        iSubjectId: stat._id,
        sSubjectName: subjectMap.get(stat._id.toString()) || 'Unknown',
        nVideosWatched: stat.nVideosWatched,
        nVideosCompleted: stat.nVideosCompleted,
        nTotalWatchTime: secondsToHHMMSS(totalSeconds)
      };
    });

    // Get statistics by grade (without $lookup due to cross-database)
    const gradeStats = await VideoWatchHistoryModel.aggregate([
      {
        $match: {
          iUserId: mongoose.Types.ObjectId(targetUserId),
          bDelete: false
        }
      },
      {
        $group: {
          _id: '$iGradeId',
          nVideosWatched: { $sum: 1 },
          nVideosCompleted: {
            $sum: { $cond: ['$bCompleted', 1, 0] }
          },
          nTotalWatchTime: {
            $sum: { $toDouble: '$nWatchDuration' }
          }
        }
      }
    ]);

    // Manually fetch grade names
    const gradeIds = gradeStats.map(g => g._id);
    const grades = gradeIds.length > 0
      ? await GradeModel.find({ _id: { $in: gradeIds } }, 'sName').lean()
      : [];
    const gradeMap = new Map(grades.map(g => [g._id.toString(), g.sName]));

    const statsByGrade = gradeStats.map(stat => {
      // Note: nTotalWatchTime from aggregation is a number (sum of durations as numbers)
      // We need to recalculate from actual watch history records
      const gradeWatchHistories = watchHistories.filter(h => String(h.iGradeId) === String(stat._id));
      const totalSeconds = gradeWatchHistories.reduce((sum, h) => sum + hhmmssToSeconds(h.nWatchDuration || '00:00:00'), 0);
      return {
        _id: stat._id,
        iGradeId: stat._id,
        sGradeName: gradeMap.get(stat._id.toString()) || 'Unknown',
        nVideosWatched: stat.nVideosWatched,
        nVideosCompleted: stat.nVideosCompleted,
        nTotalWatchTime: secondsToHHMMSS(totalSeconds)
      };
    });

    // Get recently watched videos
    const recentlyWatched = await VideoWatchHistoryModel.find({
      iUserId: targetUserId,
      bDelete: false
    })
      .sort({ dLastWatchedAt: -1 })
      .limit(10)
      .lean();

    // Manually populate for cross-database references
    if (recentlyWatched.length > 0) {
      const recentVideoIds = [...new Set(recentlyWatched.map(r => r.iVideoId))];
      const recentSubjectIds = [...new Set(recentlyWatched.map(r => r.iSubjectId))];
      const recentTermIds = [...new Set(recentlyWatched.map(r => r.iTermId))];

      const [recentVideos, recentSubjects, recentTerms] = await Promise.all([
        VideoModel.find({ _id: { $in: recentVideoIds } }, 'sTitle sThumbnailUrl').lean(),
        SubjectModel.find({ _id: { $in: recentSubjectIds } }, 'sName').lean(),
        TermModel.find({ _id: { $in: recentTermIds } }, 'sName').lean()
      ]);

      const recentVideoMap = new Map(recentVideos.map(v => [v._id.toString(), v]));
      const recentSubjectMap = new Map(recentSubjects.map(s => [s._id.toString(), s]));
      const recentTermMap = new Map(recentTerms.map(t => [t._id.toString(), t]));

      recentlyWatched.forEach(watched => {
        watched.iVideoId = recentVideoMap.get(watched.iVideoId.toString()) || watched.iVideoId;
        watched.iSubjectId = recentSubjectMap.get(watched.iSubjectId.toString()) || watched.iSubjectId;
        watched.iTermId = recentTermMap.get(watched.iTermId.toString()) || watched.iTermId;
        // Ensure duration fields are strings in HH:MM:SS format
        watched.nWatchDuration = watched.nWatchDuration || '00:00:00';
        watched.nTotalDuration = watched.nTotalDuration || '00:00:00';
        watched.nLastPosition = watched.nLastPosition || '00:00:00';
      });
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].statisticsRetrieved || 'Statistics retrieved successfully',
      data: {
        overview: {
          nTotalVideosWatched: totalVideosWatched,
          nTotalVideosCompleted: totalVideosCompleted,
          nTotalWatchTime: secondsToHHMMSS(totalWatchTime),
          nTotalWatchTimeFormatted: formatDuration(totalWatchTime)
        },
        statsBySubject,
        statsByGrade,
        recentlyWatched
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveStatistics' });
  }
};

// Get "My Learning" list for the authenticated student
const getMyLearning = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const userId = req.user._id;
    const { limit, start } = getPaginationValues2(req.query);
    const { sort = 'recent' } = req.query; // recent | progress | title

    const baseQuery = { iUserId: userId, bDelete: false };

    const sortMap = {
      recent: { dLastWatchedAt: -1 },
      progress: { nWatchPercentage: -1, dLastWatchedAt: -1 },
      title: { 'iVideoId.sTitle': 1 }
    };
    const sortOptions = sortMap[sort] || sortMap.recent;

    const [total, histories] = await Promise.all([
      VideoWatchHistoryModel.countDocuments(baseQuery),
      VideoWatchHistoryModel.find(baseQuery)
        .sort(sortOptions)
        .skip(Number(start))
        .limit(Number(limit))
        .lean()
    ]);

    // Gather ids for manual population
    const videoIds = histories.map(h => h.iVideoId);
    const gradeIds = histories.map(h => h.iGradeId);
    const subjectIds = histories.map(h => h.iSubjectId);
    const termIds = histories.map(h => h.iTermId);

    const [videosRaw, grades, subjects, terms] = await Promise.all([
      videoIds.length ? VideoModel.find({ _id: { $in: videoIds } }, 'sTitle sThumbnailUrl iDuration sDescription').lean() : [],
      gradeIds.length ? GradeModel.find({ _id: { $in: gradeIds } }, 'sName').lean() : [],
      subjectIds.length ? SubjectModel.find({ _id: { $in: subjectIds } }, 'sName').lean() : [],
      termIds.length ? TermModel.find({ _id: { $in: termIds } }, 'sName').lean() : []
    ]);

    // Enrich videos with SEO slug for redirection
    const videos = await getSeoDataForRecords(videosRaw, data.eSeoType.map.VIDEO);

    const mVideo = new Map(videos.map(v => [String(v._id), v]));
    const mGrade = new Map(grades.map(g => [String(g._id), g]));
    const mSubject = new Map(subjects.map(s => [String(s._id), s]));
    const mTerm = new Map(terms.map(t => [String(t._id), t]));

    const results = histories.map(h => {
      const video = mVideo.get(String(h.iVideoId));
      // Durations are already in hh:mm:ss format, convert to seconds for calculations
      const totalDuration = video && video.iDuration
        ? hhmmssToSeconds(video.iDuration)
        : hhmmssToSeconds(h.nTotalDuration || '00:00:00');
      const rawWatch = hhmmssToSeconds(h.nWatchDuration || '00:00:00');
      // Cap watched to total to avoid >100%
      const watchDuration = Math.min(Math.max(rawWatch, 0), totalDuration || 0);
      const percent = totalDuration > 0
        ? Math.min(Math.round((watchDuration / totalDuration) * 100), 100)
        : 0;
      const statusLabel = h.bCompleted ? 'Complete' : 'In Progress';
      const action = h.bCompleted ? 'Rewatch' : 'Resume';

      return {
        _id: h._id,
        watchedAt: h.dLastWatchedAt,
        progressPercent: percent,
        lastPosition: h.nLastPosition || '00:00:00',
        isCompleted: Boolean(h.bCompleted),
        statusLabel,
        action,
        video: video ? {
          _id: video._id,
          title: video.sTitle,
          thumbnailUrl: video.sThumbnailUrl || '',
          description: video.sDescription || '',
          duration: video.iDuration || '00:00:00',
          seo: video.seo || null
        } : { _id: h.iVideoId },
        grade: mGrade.get(String(h.iGradeId)) || { _id: h.iGradeId },
        subject: mSubject.get(String(h.iSubjectId)) || { _id: h.iSubjectId },
        term: mTerm.get(String(h.iTermId)) || { _id: h.iTermId }
      };
    });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].watchHistoryRetrieved || 'My learning retrieved successfully',
      data: { total, results, limit: Number(limit), start: Number(start) },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveWatchHistory' });
  }
};

// Get weekly progress for a user (last 7 days)
const getWeeklyProgress = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const requesterId = req.user._id;
    const { userId } = req.params; // Optional child id for parents

    let targetUserId = requesterId;

    if (userId && userId !== requesterId.toString()) {
      const requester = await UserModel.findById(requesterId, 'eRole aChildren', { readPreference: 'primary' }).lean();
      if (requester?.eRole === data.eUserRoles.map.PARENT) {
        const childrenIds = (requester.aChildren || []).map(id => id.toString());
        if (!childrenIds.includes(userId)) {
          return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'accessDenied' });
        }
        targetUserId = userId;
      } else {
        return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'accessDenied' });
      }
    }

    const now = new Date();
    const rangeEnd = new Date(now);
    rangeEnd.setHours(23, 59, 59, 999);
    const rangeStart = new Date(rangeEnd);
    rangeStart.setDate(rangeEnd.getDate() - 6);
    rangeStart.setHours(0, 0, 0, 0);

    // Aggregate weekly stats
    const [aggregate] = await VideoWatchHistoryModel.aggregate([
      {
        $match: {
          iUserId: mongoose.Types.ObjectId(String(targetUserId)),
          bDelete: false,
          dLastWatchedAt: { $gte: rangeStart, $lte: rangeEnd }
        }
      },
      {
        $group: {
          _id: null,
          aWatchDurations: { $push: '$nWatchDuration' },
          nCompletedVideos: { $sum: { $cond: ['$bCompleted', 1, 0] } },
          nAverageScore: { $avg: '$nWatchPercentage' },
          nCount: { $sum: 1 }
        }
      }
    ]);

    const dailyStats = await VideoWatchHistoryModel.aggregate([
      {
        $match: {
          iUserId: mongoose.Types.ObjectId(String(targetUserId)),
          bDelete: false,
          dLastWatchedAt: { $gte: rangeStart, $lte: rangeEnd }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$dLastWatchedAt' },
            month: { $month: '$dLastWatchedAt' },
            day: { $dayOfMonth: '$dLastWatchedAt' }
          },
          aWatchDurations: { $push: '$nWatchDuration' },
          nCompletedVideos: { $sum: { $cond: ['$bCompleted', 1, 0] } },
          nAverageScore: { $avg: '$nWatchPercentage' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Calculate total seconds from all watch durations
    const totalSeconds = aggregate?.aWatchDurations
      ? aggregate.aWatchDurations.reduce((sum, duration) => sum + hhmmssToSeconds(duration), 0)
      : 0;
    const secondsToHours = seconds => Math.round((seconds / 3600) * 100) / 100;
    const totalHours = secondsToHours(totalSeconds);
    const completed = Math.floor(aggregate?.nCompletedVideos || 0);
    const averageScore = Number.isFinite(aggregate?.nAverageScore) ? Math.round(aggregate.nAverageScore) : 0;

    const pad = value => String(value).padStart(2, '0');
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyStatMap = new Map(
      dailyStats.map(item => {
        const key = `${item._id.year}-${pad(item._id.month)}-${pad(item._id.day)}`;
        return [key, item];
      })
    );

    const dailyBreakdown = Array.from({ length: 7 }, (_, index) => {
      const currentDate = new Date(rangeStart);
      currentDate.setDate(rangeStart.getDate() + index);
      currentDate.setHours(0, 0, 0, 0);
      const key = `${currentDate.getFullYear()}-${pad(currentDate.getMonth() + 1)}-${pad(currentDate.getDate())}`;
      const stats = dailyStatMap.get(key);
      const daySeconds = stats?.aWatchDurations
        ? stats.aWatchDurations.reduce((sum, duration) => sum + hhmmssToSeconds(duration), 0)
        : 0;

      return {
        dDate: currentDate,
        sDay: dayNames[currentDate.getDay()],
        nWatchTimeSeconds: daySeconds,
        nWatchTimeHours: secondsToHours(daySeconds),
        nCompletedVideos: Math.floor(stats?.nCompletedVideos || 0),
        nAverageScore: Number.isFinite(stats?.nAverageScore) ? Math.round(stats.nAverageScore) : 0
      };
    });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].weeklyProgressRetrieved || 'Weekly progress retrieved successfully',
      data: {
        range: { dFrom: rangeStart, dTo: rangeEnd },
        nTotalWatchTimeSeconds: totalSeconds,
        nTotalWatchTimeHours: totalHours,
        nCompletedVideos: completed,
        nAverageScore: averageScore,
        aDailyBreakdown: dailyBreakdown
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveWeeklyProgress' });
  }
};

// Helper function to format duration (legacy format with h, m, s)
function formatDuration (seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Get active subjects for a user (based on their grade)
const getActiveSubjects = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const userId = req.user._id;

    // Get user's grade
    const user = await UserModel.findById(userId, 'iGradeId eRole', { readPreference: 'primary' }).lean();

    if (!user) {
      return handleServiceError(null, req, res, {
        statusCode: status.NotFound,
        messageKey: 'userNotFound'
      });
    }

    if (!user.iGradeId) {
      return res.status(status.OK).json({
        success: true,
        message: messages[lang].activeSubjectsRetrieved || 'Active subjects retrieved successfully',
        data: { subjects: [] },
        error: {}
      });
    }

    // Get active subjects for user's grade
    const [subjects, grade] = await Promise.all([
      SubjectModel.find({
        iGradeId: user.iGradeId,
        eStatus: data.eStatus.map.ACTIVE
      })
        .sort({ iOrder: 1 })
        .lean(),
      GradeModel.findById(user.iGradeId, 'sName').lean()
    ]);

    // Manually add grade info to subjects (same database connection, but being consistent)
    subjects.forEach(subject => {
      subject.iGradeId = grade || subject.iGradeId;
    });

    // Get video counts for each subject
    const subjectIds = subjects.map(s => s._id);
    const videoCounts = await VideoModel.aggregate([
      {
        $match: {
          iSubjectId: { $in: subjectIds },
          eStatus: data.eStatus.map.ACTIVE,
          bDelete: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$iSubjectId',
          count: { $sum: 1 }
        }
      }
    ]);

    const videoCountMap = {};
    videoCounts.forEach(vc => {
      videoCountMap[vc._id.toString()] = vc.count;
    });

    // Add video counts to subjects
    const subjectsWithCounts = subjects.map(subject => ({
      ...subject,
      nVideoCount: videoCountMap[subject._id.toString()] || 0
    }));

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].activeSubjectsRetrieved || 'Active subjects retrieved successfully',
      data: { subjects: subjectsWithCounts },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveActiveSubjects' });
  }
};

module.exports = {
  recordVideoWatch,
  getUserWatchHistory,
  getWatchStatistics,
  getActiveSubjects,
  // Added below
  getMyLearning,
  getWeeklyProgress
};
