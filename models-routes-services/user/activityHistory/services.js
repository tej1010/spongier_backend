// activityHistory.services.js
const mongoose = require('mongoose');
const { status, messages } = require('../../../helper/api.responses');
const { handleServiceError, getPaginationValues2 } = require('../../../helper/utilities.services');
const ActivityHistoryModel = require('./model');
const UserModel = require('../model');
const SubjectModel = require('../../course/subjects/model');
const GradeModel = require('../../course/grades/model');
const VideoModel = require('../../course/videos/model');
const VideoWatchHistoryModel = require('../../course/videos/watchHistory/model');
const data = require('../../../data');
const { sendAchievementEmail } = require('../../../helper/mail.services');

/**
 * Helper function to record activity
 * Can be called from anywhere in the application
 */
async function recordActivity ({
  iUserId,
  eActivityType,
  sTitle,
  sDescription = '',
  oMetadata = {},
  iGradeId = null,
  iSubjectId = null,
  iTermId = null,
  iVideoId = null,
  bHighlight = false,
  dActivityDate = new Date()
}) {
  try {
    const activity = new ActivityHistoryModel({
      iUserId,
      eActivityType,
      sTitle,
      sDescription,
      oMetadata,
      iGradeId,
      iSubjectId,
      iTermId,
      iVideoId,
      bHighlight,
      dActivityDate
    });

    await activity.save();

    if ([data.eActivityType.map.BADGE_EARNED, data.eActivityType.map.QUIZ_COMPLETED].includes(eActivityType)) {
      setImmediate(async () => {
        try {
          const user = await UserModel.findById(iUserId, 'sName sEmail', { readPreference: 'primary' }).lean();
          if (!user?.sEmail) return;
          await sendAchievementEmail({
            userName: user.sName || 'Learner',
            userEmail: user.sEmail,
            achievementTitle: sTitle,
            achievementDescription: sDescription,
            achievementType: eActivityType,
            metadata: oMetadata
          });
        } catch (err) {
          console.error('Error sending achievement notification email:', err);
        }
      });
    }
    return { success: true, activity };
  } catch (error) {
    console.error('Error recording activity:', error);
    return { success: false, error };
  }
}

/**
 * Get activity history for parent's children
 * Supports filtering by child, activity type, date range, etc.
 */
const getChildrenActivityHistory = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const parentId = req.user._id;
    const { limit, start } = getPaginationValues2(req.query);
    const {
      childId,
      activityType,
      subjectId,
      gradeId,
      dateFrom,
      dateTo,
      unseenOnly,
      highlightedOnly,
      sortBy = 'dActivityDate',
      sortOrder = 'desc'
    } = req.query;

    // Verify the logged-in user is a parent
    const parent = await UserModel.findById(parentId, 'eRole aChildren', { readPreference: 'primary' }).lean();

    if (!parent || parent.eRole !== data.eUserRoles.map.PARENT) {
      return handleServiceError(null, req, res, {
        statusCode: status.Forbidden,
        messageKey: 'accessDenied'
      });
    }

    const childrenIds = (parent.aChildren || []).map(id => id.toString());

    if (childrenIds.length === 0) {
      return res.status(status.OK).json({
        success: true,
        message: messages[lang].activityHistoryRetrieved || 'Activity history retrieved successfully',
        data: {
          total: 0,
          results: [],
          limit: Number(limit),
          start: Number(start)
        },
        error: {}
      });
    }

    // Build query
    const query = {
      bDelete: false
    };

    // Filter by specific child or all children
    if (childId) {
      if (!childrenIds.includes(childId)) {
        return handleServiceError(null, req, res, {
          statusCode: status.Forbidden,
          messageKey: 'accessDenied'
        });
      }
      query.iUserId = mongoose.Types.ObjectId(childId);
    } else {
      query.iUserId = { $in: childrenIds.map(id => mongoose.Types.ObjectId(id)) };
    }

    // Filter by activity type
    if (activityType) {
      const types = Array.isArray(activityType) ? activityType : activityType.split(',');
      query.eActivityType = { $in: types };
    }

    // Filter by subject
    if (subjectId) {
      query.iSubjectId = mongoose.Types.ObjectId(subjectId);
    }

    // Filter by grade
    if (gradeId) {
      query.iGradeId = mongoose.Types.ObjectId(gradeId);
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      query.dActivityDate = {};
      if (dateFrom) {
        query.dActivityDate.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.dActivityDate.$lte = endDate;
      }
    }

    // Filter unseen activities
    if (unseenOnly === 'true' || unseenOnly === true) {
      query.bSeenByParent = false;
    }

    // Filter highlighted activities
    if (highlightedOnly === 'true' || highlightedOnly === true) {
      query.bHighlight = true;
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get activities with pagination
    const [total, activities] = await Promise.all([
      ActivityHistoryModel.countDocuments(query),
      ActivityHistoryModel.find(query)
        .sort(sortOptions)
        .skip(Number(start))
        .limit(Number(limit))
        .lean()
    ]);

    // Get unique user IDs to fetch child details
    const userIds = [...new Set(activities.map(a => a.iUserId.toString()))];

    // Fetch child details
    const children = userIds.length > 0
      ? await UserModel.find(
        { _id: { $in: userIds } },
        'sName sEmail sImage iGradeId oStreak'
      )
        .populate({ path: 'iGradeId', model: GradeModel, select: 'sName' })
        .lean()
      : [];

    const childMap = new Map(children.map(c => [c._id.toString(), c]));

    // Enhance activities with child information
    const enhancedActivities = activities.map(activity => {
      const child = childMap.get(activity.iUserId.toString());

      return {
        ...activity,
        child: child ? {
          _id: child._id,
          sName: child.sName,
          sEmail: child.sEmail,
          sImage: child.sImage || '',
          iGradeId: child.iGradeId,
          oStreak: child.oStreak
        } : null
      };
    });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].activityHistoryRetrieved || 'Activity history retrieved successfully',
      data: {
        total,
        results: enhancedActivities,
        limit: Number(limit),
        start: Number(start)
      },
      error: {}
    });
  } catch (error) {
    console.error('getChildrenActivityHistory error:', error);
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveActivityHistory' });
  }
};

/**
 * Get activity statistics and summary for a specific child
 */
const getChildActivitySummary = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const parentId = req.user._id;
    const { childId } = req.params;
    const { days = 7 } = req.query; // Default to last 7 days

    // Verify parent and child relationship
    const parent = await UserModel.findById(parentId, 'eRole aChildren', { readPreference: 'primary' }).lean();

    if (!parent || parent.eRole !== data.eUserRoles.map.PARENT) {
      return handleServiceError(null, req, res, {
        statusCode: status.Forbidden,
        messageKey: 'accessDenied'
      });
    }

    const childrenIds = (parent.aChildren || []).map(id => id.toString());

    if (!childrenIds.includes(childId)) {
      return handleServiceError(null, req, res, {
        statusCode: status.Forbidden,
        messageKey: 'accessDenied'
      });
    }

    // Calculate date range
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - Number(days));

    // Get child details
    const child = await UserModel.findById(childId, 'sName sEmail sImage iGradeId oStreak dLastSeen')
      .populate({ path: 'iGradeId', model: GradeModel, select: 'sName' })
      .lean();

    if (!child) {
      return handleServiceError(null, req, res, {
        statusCode: status.NotFound,
        messageKey: 'userNotFound'
      });
    }

    // Get activity statistics
    const activities = await ActivityHistoryModel.find({
      iUserId: mongoose.Types.ObjectId(childId),
      dActivityDate: { $gte: startDate, $lte: now },
      bDelete: false
    }).lean();

    // Calculate statistics by activity type
    const activityTypeStats = {};
    activities.forEach(activity => {
      if (!activityTypeStats[activity.eActivityType]) {
        activityTypeStats[activity.eActivityType] = {
          count: 0,
          activities: []
        };
      }
      activityTypeStats[activity.eActivityType].count++;
      activityTypeStats[activity.eActivityType].activities.push({
        _id: activity._id,
        sTitle: activity.sTitle,
        dActivityDate: activity.dActivityDate
      });
    });

    // Get daily activity breakdown
    const dailyActivityMap = {};
    for (let i = 0; i < Number(days); i++) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      dailyActivityMap[dateKey] = {
        date: dateKey,
        count: 0,
        activities: []
      };
    }

    activities.forEach(activity => {
      const dateKey = new Date(activity.dActivityDate).toISOString().split('T')[0];
      if (dailyActivityMap[dateKey]) {
        dailyActivityMap[dateKey].count++;
        dailyActivityMap[dateKey].activities.push(activity.eActivityType);
      }
    });

    const dailyActivity = Object.values(dailyActivityMap).reverse();

    // Get subject-wise activity
    const subjectActivityStats = await ActivityHistoryModel.aggregate([
      {
        $match: {
          iUserId: mongoose.Types.ObjectId(childId),
          dActivityDate: { $gte: startDate, $lte: now },
          iSubjectId: { $exists: true, $ne: null },
          bDelete: false
        }
      },
      {
        $group: {
          _id: '$iSubjectId',
          count: { $sum: 1 }
        }
      }
    ]);

    // Fetch subject details
    const subjectIds = subjectActivityStats.map(s => s._id);
    const subjects = subjectIds.length > 0
      ? await SubjectModel.find({ _id: { $in: subjectIds } }, 'sName').lean()
      : [];
    const subjectMap = new Map(subjects.map(s => [s._id.toString(), s]));

    const subjectActivity = subjectActivityStats.map(stat => ({
      subject: subjectMap.get(stat._id.toString()) || { _id: stat._id },
      count: stat.count,
      totalPoints: stat.totalPoints
    }));

    // Get recent achievements (highlighted activities)
    const recentAchievements = await ActivityHistoryModel.find({
      iUserId: mongoose.Types.ObjectId(childId),
      bHighlight: true,
      bDelete: false
    })
      .sort({ dActivityDate: -1 })
      .limit(5)
      .lean();

    // Calculate total statistics
    const totalActivities = activities.length;
    const unseenActivities = activities.filter(a => !a.bSeenByParent).length;

    // Get learning time from video watch history
    const watchHistory = await VideoWatchHistoryModel.aggregate([
      {
        $match: {
          iUserId: mongoose.Types.ObjectId(childId),
          dLastWatchedAt: { $gte: startDate, $lte: now },
          bDelete: false
        }
      },
      {
        $group: {
          _id: null,
          totalWatchTime: { $sum: { $toDouble: '$nWatchDuration' } },
          videosWatched: { $sum: 1 },
          videosCompleted: {
            $sum: { $cond: ['$bCompleted', 1, 0] }
          }
        }
      }
    ]);

    const learningStats = watchHistory.length > 0 ? {
      totalWatchTimeSeconds: Math.floor(watchHistory[0].totalWatchTime || 0),
      totalWatchTimeFormatted: formatDuration(watchHistory[0].totalWatchTime || 0),
      videosWatched: watchHistory[0].videosWatched || 0,
      videosCompleted: watchHistory[0].videosCompleted || 0
    } : {
      totalWatchTimeSeconds: 0,
      totalWatchTimeFormatted: '0s',
      videosWatched: 0,
      videosCompleted: 0
    };

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].activitySummaryRetrieved || 'Activity summary retrieved successfully',
      data: {
        child: {
          _id: child._id,
          sName: child.sName,
          sEmail: child.sEmail,
          sImage: child.sImage || '',
          iGradeId: child.iGradeId,
          oStreak: child.oStreak,
          dLastSeen: child.dLastSeen
        },
        dateRange: {
          from: startDate,
          to: now,
          days: Number(days)
        },
        summary: {
          totalActivities,
          unseenActivities,
          ...learningStats
        },
        activityTypeStats,
        dailyActivity,
        subjectActivity,
        recentAchievements
      },
      error: {}
    });
  } catch (error) {
    console.error('getChildActivitySummary error:', error);
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveActivitySummary' });
  }
};

/**
 * Mark activities as seen by parent
 */
const markActivitiesAsSeen = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const parentId = req.user._id;
    const { activityIds, childId, markAllForChild } = req.body;

    // Verify parent
    const parent = await UserModel.findById(parentId, 'eRole aChildren', { readPreference: 'primary' }).lean();

    if (!parent || parent.eRole !== data.eUserRoles.map.PARENT) {
      return handleServiceError(null, req, res, {
        statusCode: status.Forbidden,
        messageKey: 'accessDenied'
      });
    }

    const childrenIds = (parent.aChildren || []).map(id => id.toString());

    const updateQuery = { bDelete: false };

    if (markAllForChild && childId) {
      // Mark all activities for a specific child
      if (!childrenIds.includes(childId)) {
        return handleServiceError(null, req, res, {
          statusCode: status.Forbidden,
          messageKey: 'accessDenied'
        });
      }
      updateQuery.iUserId = mongoose.Types.ObjectId(childId);
      updateQuery.bSeenByParent = false;
    } else if (activityIds && Array.isArray(activityIds)) {
      // Mark specific activities
      updateQuery._id = { $in: activityIds.map(id => mongoose.Types.ObjectId(id)) };
      updateQuery.iUserId = { $in: childrenIds.map(id => mongoose.Types.ObjectId(id)) };
    } else {
      return handleServiceError(null, req, res, {
        statusCode: status.BadRequest,
        messageKey: 'invalidRequestParameters'
      });
    }

    const result = await ActivityHistoryModel.updateMany(
      updateQuery,
      { $set: { bSeenByParent: true } }
    );

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].activitiesMarkedAsSeen || 'Activities marked as seen',
      data: {
        modifiedCount: result.modifiedCount
      },
      error: {}
    });
  } catch (error) {
    console.error('markActivitiesAsSeen error:', error);
    return handleServiceError(error, req, res, { messageKey: 'failedToMarkActivities' });
  }
};

/**
 * Get activity timeline - grouped by date
 */
const getActivityTimeline = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const parentId = req.user._id;
    const { childId } = req.query;
    const { limit = 30, start = 0 } = getPaginationValues2(req.query);

    // Verify parent
    const parent = await UserModel.findById(parentId, 'eRole aChildren', { readPreference: 'primary' }).lean();

    if (!parent || parent.eRole !== data.eUserRoles.map.PARENT) {
      return handleServiceError(null, req, res, {
        statusCode: status.Forbidden,
        messageKey: 'accessDenied'
      });
    }

    const childrenIds = (parent.aChildren || []).map(id => id.toString());

    if (childrenIds.length === 0) {
      return res.status(status.OK).json({
        success: true,
        message: messages[lang].timelineRetrieved || 'Timeline retrieved successfully',
        data: { timeline: [] },
        error: {}
      });
    }

    const query = {
      iUserId: childId
        ? mongoose.Types.ObjectId(childId)
        : { $in: childrenIds.map(id => mongoose.Types.ObjectId(id)) },
      bDelete: false
    };

    // Verify child belongs to parent if childId specified
    if (childId && !childrenIds.includes(childId)) {
      return handleServiceError(null, req, res, {
        statusCode: status.Forbidden,
        messageKey: 'accessDenied'
      });
    }

    // Get activities grouped by date
    const activities = await ActivityHistoryModel.aggregate([
      { $match: query },
      { $sort: { dActivityDate: -1 } },
      { $skip: Number(start) },
      { $limit: Number(limit) },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$dActivityDate'
            }
          },
          activities: { $push: '$$ROOT' }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    // Fetch user details for activities
    const allActivities = activities.flatMap(group => group.activities);
    const userIds = [...new Set(allActivities.map(a => a.iUserId.toString()))];

    const children = userIds.length > 0
      ? await UserModel.find(
        { _id: { $in: userIds } },
        'sName sEmail sImage'
      ).lean()
      : [];

    const childMap = new Map(children.map(c => [c._id.toString(), c]));

    // Format timeline
    const timeline = activities.map(group => ({
      date: group._id,
      activities: group.activities.map(activity => ({
        ...activity,
        child: childMap.get(activity.iUserId.toString()) || null
      }))
    }));

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].timelineRetrieved || 'Timeline retrieved successfully',
      data: { timeline },
      error: {}
    });
  } catch (error) {
    console.error('getActivityTimeline error:', error);
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveTimeline' });
  }
};

/**
 * Get unseen activity count for parent
 */
const getUnseenActivityCount = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const parentId = req.user._id;
    const { childId } = req.query;

    // Verify parent
    const parent = await UserModel.findById(parentId, 'eRole aChildren', { readPreference: 'primary' }).lean();

    if (!parent || parent.eRole !== data.eUserRoles.map.PARENT) {
      return handleServiceError(null, req, res, {
        statusCode: status.Forbidden,
        messageKey: 'accessDenied'
      });
    }

    const childrenIds = (parent.aChildren || []).map(id => id.toString());

    if (childrenIds.length === 0) {
      return res.status(status.OK).json({
        success: true,
        message: messages[lang].success || 'Success',
        data: { unseenCount: 0 },
        error: {}
      });
    }

    const query = {
      iUserId: childId
        ? mongoose.Types.ObjectId(childId)
        : { $in: childrenIds.map(id => mongoose.Types.ObjectId(id)) },
      bSeenByParent: false,
      bDelete: false
    };

    // Verify child belongs to parent if childId specified
    if (childId && !childrenIds.includes(childId)) {
      return handleServiceError(null, req, res, {
        statusCode: status.Forbidden,
        messageKey: 'accessDenied'
      });
    }

    const unseenCount = await ActivityHistoryModel.countDocuments(query);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].success || 'Success',
      data: { unseenCount },
      error: {}
    });
  } catch (error) {
    console.error('getUnseenActivityCount error:', error);
    return handleServiceError(error, req, res, { messageKey: 'failedToGetUnseenCount' });
  }
};

/**
 * Get recent 24 hour activity for parent's children
 * Dedicated API for last 24hr activity tracking
 */
const getRecentChildrenActivity = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const parentId = req.user._id;
    const { limit, start } = getPaginationValues2(req.query);
    const {
      childId,
      activityType,
      sortBy = 'dActivityDate',
      sortOrder = 'desc'
    } = req.query;

    // Verify the logged-in user is a parent
    const parent = await UserModel.findById(parentId, 'eRole aChildren', { readPreference: 'primary' }).lean();

    if (!parent || parent.eRole !== data.eUserRoles.map.PARENT) {
      return handleServiceError(null, req, res, {
        statusCode: status.Forbidden,
        messageKey: 'accessDenied'
      });
    }

    const childrenIds = (parent.aChildren || []).map(id => id.toString());

    if (childrenIds.length === 0) {
      return res.status(status.OK).json({
        success: true,
        message: messages[lang].recentActivityRetrieved || 'Recent activity retrieved successfully',
        data: {
          total: 0,
          results: [],
          limit: Number(limit),
          start: Number(start),
          dateRange: {
            from: new Date(Date.now() - 24 * 60 * 60 * 1000),
            to: new Date()
          }
        },
        error: {}
      });
    }

    // Calculate last 24 hours timestamp
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Build query for last 24 hours
    const query = {
      bDelete: false,
      dActivityDate: {
        $gte: last24Hours,
        $lte: now
      }
    };

    // Filter by specific child or all children
    if (childId) {
      if (!childrenIds.includes(childId)) {
        return handleServiceError(null, req, res, {
          statusCode: status.Forbidden,
          messageKey: 'accessDenied'
        });
      }
      query.iUserId = mongoose.Types.ObjectId(childId);
    } else {
      query.iUserId = { $in: childrenIds.map(id => mongoose.Types.ObjectId(id)) };
    }

    // Filter by activity type
    if (activityType) {
      const types = Array.isArray(activityType) ? activityType : activityType.split(',');
      query.eActivityType = { $in: types };
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get activities with pagination
    const [total, activities] = await Promise.all([
      ActivityHistoryModel.countDocuments(query),
      ActivityHistoryModel.find(query)
        .sort(sortOptions)
        .skip(Number(start))
        .limit(Number(limit))
        .lean()
    ]);

    // Collate IDs for manual cross-database lookups
    const userIds = new Set();
    const videoIds = new Set();
    const gradeIds = new Set();
    const subjectIds = new Set();

    activities.forEach(activity => {
      if (activity.iUserId) userIds.add(activity.iUserId.toString());
      if (activity.iVideoId) videoIds.add(activity.iVideoId.toString());
      if (activity.iGradeId) gradeIds.add(activity.iGradeId.toString());
      if (activity.iSubjectId) subjectIds.add(activity.iSubjectId.toString());
    });

    const [
      children,
      videos,
      grades,
      subjects
    ] = await Promise.all([
      userIds.size
        ? UserModel.find(
          { _id: { $in: [...userIds] } },
          'sName sEmail sImage iGradeId oStreak dLastSeen'
        )
          .populate({ path: 'iGradeId', model: GradeModel, select: 'sName' })
          .lean()
        : [],
      videoIds.size
        ? VideoModel.find(
          { _id: { $in: [...videoIds] } },
          'sTitle sThumbnailUrl sThumbnail nDuration iDuration'
        ).lean()
        : [],
      gradeIds.size
        ? GradeModel.find(
          { _id: { $in: [...gradeIds] } },
          'sName'
        ).lean()
        : [],
      subjectIds.size
        ? SubjectModel.find(
          { _id: { $in: [...subjectIds] } },
          'sName sIcon'
        ).lean()
        : []
    ]);

    // Fetch child details
    const childMap = new Map(children.map(c => [c._id.toString(), c]));
    const gradeMap = new Map(grades.map(g => [g._id.toString(), g]));
    const subjectMap = new Map(subjects.map(s => [s._id.toString(), s]));
    const videoMap = new Map(
      videos.map(v => [
        v._id.toString(),
        {
          _id: v._id,
          sTitle: v.sTitle,
          sThumbnail: v.sThumbnail || v.sThumbnailUrl || '',
          nDuration: typeof v.nDuration !== 'undefined' ? v.nDuration : (v.iDuration || null)
        }
      ])
    );

    // Enhance activities with child information
    const enhancedActivities = activities.map(activity => {
      const child = childMap.get(activity.iUserId.toString());

      return {
        _id: activity._id,
        eActivityType: activity.eActivityType,
        sTitle: activity.sTitle,
        sDescription: activity.sDescription,
        oMetadata: activity.oMetadata,
        bHighlight: activity.bHighlight,
        bSeenByParent: activity.bSeenByParent,
        dActivityDate: activity.dActivityDate,
        dCreatedAt: activity.dCreatedAt,
        iVideoId: activity.iVideoId ? videoMap.get(activity.iVideoId.toString()) || activity.iVideoId : null,
        iSubjectId: activity.iSubjectId ? subjectMap.get(activity.iSubjectId.toString()) || activity.iSubjectId : null,
        iGradeId: activity.iGradeId ? gradeMap.get(activity.iGradeId.toString()) || activity.iGradeId : null,
        child: child ? {
          _id: child._id,
          sName: child.sName,
          sEmail: child.sEmail,
          sImage: child.sImage || '',
          iGradeId: child.iGradeId,
          oStreak: child.oStreak,
          dLastSeen: child.dLastSeen
        } : null
      };
    });

    // Group activities by child for summary
    const childrenSummary = {};
    enhancedActivities.forEach(activity => {
      if (activity.child) {
        const childIdStr = activity.child._id.toString();
        if (!childrenSummary[childIdStr]) {
          childrenSummary[childIdStr] = {
            child: activity.child,
            activityCount: 0,
            activities: []
          };
        }
        childrenSummary[childIdStr].activityCount++;
        childrenSummary[childIdStr].activities.push({
          _id: activity._id,
          eActivityType: activity.eActivityType,
          dActivityDate: activity.dActivityDate
        });
      }
    });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].recentActivityRetrieved || 'Recent activity retrieved successfully',
      data: {
        total,
        results: enhancedActivities,
        limit: Number(limit),
        start: Number(start),
        childrenSummary: Object.values(childrenSummary),
        dateRange: {
          from: last24Hours,
          to: now,
          hours: 24
        }
      },
      error: {}
    });
  } catch (error) {
    console.error('getRecentChildrenActivity error:', error);
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveRecentActivity' });
  }
};

// Helper function to format duration
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

module.exports = {
  recordActivity,
  getChildrenActivityHistory,
  getChildActivitySummary,
  markActivitiesAsSeen,
  getActivityTimeline,
  getUnseenActivityCount,
  getRecentChildrenActivity
};
