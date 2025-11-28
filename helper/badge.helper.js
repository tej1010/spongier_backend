const mongoose = require('mongoose');
const BadgeModel = require('../models-routes-services/badges/badge.model');
const UserBadgeModel = require('../models-routes-services/badges/userBadge.model');
const QuizAttemptModel = require('../models-routes-services/course/quiz/attempt.model');
const VideoWatchHistoryModel = require('../models-routes-services/course/videos/watchHistory/model');
const VideoModel = require('../models-routes-services/course/videos/model');
const UserModel = require('../models-routes-services/user/model');
const { eBadgeType, eStatus } = require('../data');
const { logBadgeEarnedActivity } = require('./activity.helper');

const toObjectId = (value) => mongoose.Types.ObjectId(value);

const matchesContext = (badge, attemptContext = {}) => {
  if (badge.iGradeId && badge.iGradeId.toString() !== attemptContext.iGradeId?.toString()) return false;
  if (badge.iSubjectId && badge.iSubjectId.toString() !== attemptContext.iSubjectId?.toString()) return false;
  if (badge.iTermId && badge.iTermId.toString() !== attemptContext.iTermId?.toString()) return false;
  return true;
};

const buildCompletedVideoQuery = (userId, badge) => {
  const query = { iUserId: toObjectId(userId), bCompleted: true, bDelete: false };
  if (badge?.iGradeId) query.iGradeId = badge.iGradeId;
  if (badge?.iSubjectId) query.iSubjectId = badge.iSubjectId;
  if (badge?.iTermId) query.iTermId = badge.iTermId;
  return query;
};

async function getTotalVideosForBadge (badge) {
  const query = { eStatus: eStatus.map.ACTIVE, bDelete: false };
  if (badge?.iGradeId) query.iGradeId = badge.iGradeId;
  if (badge?.iSubjectId) query.iSubjectId = badge.iSubjectId;
  if (badge?.iTermId) query.iTermId = badge.iTermId;
  return VideoModel.countDocuments(query);
}

async function awardBadgeIfEligible ({
  userId,
  badge,
  hasMetCriteria,
  videoIds = [],
  count = 0,
  context = {}
}) {
  if (!hasMetCriteria) return false;

  const alreadyEarned = await UserBadgeModel.findOne({
    iUserId: userId,
    iBadgeId: badge._id
  }).lean();

  if (alreadyEarned) {
    return false;
  }

  try {
    await UserBadgeModel.create({
      iUserId: userId,
      iBadgeId: badge._id,
      aVideoIds: videoIds,
      nVideoCount: count,
      oContext: context
    });
  } catch (err) {
    if (err?.code === 11000) {
      return false;
    }
    throw err;
  }

  await logBadgeEarnedActivity({
    userId,
    badgeId: badge._id.toString(),
    badgeName: badge.sName,
    badgeIcon: badge.sIcon,
    badgeDescription: badge.sDescription
  });

  return true;
}

async function getCompletedVideosSnapshot ({ userId, limit, badge }) {
  const query = buildCompletedVideoQuery(userId, badge);
  const [count, videos] = await Promise.all([
    VideoWatchHistoryModel.countDocuments(query),
    typeof limit === 'number' && limit > 0
      ? VideoWatchHistoryModel.find(query, 'iVideoId iGradeId iSubjectId iTermId dLastWatchedAt')
        .sort({ dLastWatchedAt: -1 })
        .limit(limit)
        .lean()
      : VideoWatchHistoryModel.find(query, 'iVideoId iGradeId iSubjectId iTermId dLastWatchedAt').lean()
  ]);

  return {
    count,
    videos: videos || []
  };
}

async function getUserCompletedSubjects (userId) {
  const completions = await VideoWatchHistoryModel.aggregate([
    {
      $match: {
        iUserId: toObjectId(userId),
        bCompleted: true,
        bDelete: false
      }
    },
    {
      $group: {
        _id: '$iSubjectId',
        completedVideos: { $sum: 1 },
        iGradeId: { $first: '$iGradeId' }
      }
    }
  ]);

  const subjectIds = completions.map((c) => c._id).filter(Boolean);
  if (!subjectIds.length) return [];

  const totals = await VideoModel.aggregate([
    {
      $match: {
        iSubjectId: { $in: subjectIds },
        eStatus: eStatus.map.ACTIVE,
        bDelete: false
      }
    },
    {
      $group: {
        _id: '$iSubjectId',
        totalVideos: { $sum: 1 }
      }
    }
  ]);

  const totalsMap = new Map(totals.map((t) => [t._id.toString(), t.totalVideos]));

  return completions
    .map((c) => {
      const totalVideos = totalsMap.get(c._id.toString()) || 0;
      return {
        iSubjectId: c._id,
        iGradeId: c.iGradeId,
        nCompletedVideos: c.completedVideos,
        nTotalVideos: totalVideos
      };
    })
    .filter((c) => c.nTotalVideos > 0 && c.nCompletedVideos >= c.nTotalVideos);
}

async function getUserStreakSnapshot (userId) {
  const user = await UserModel.findById(userId, { oStreak: 1 }).lean();
  return user?.oStreak || { nCurrent: 0, nBest: 0 };
}

async function getUserPerfectScoreVideos (userId) {
  const results = await QuizAttemptModel.aggregate([
    {
      $match: {
        iUserId: toObjectId(userId),
        nTotalMarks: { $gt: 0 }
      }
    },
    {
      $match: {
        $expr: { $eq: ['$nScoreEarned', '$nTotalMarks'] }
      }
    },
    {
      $group: {
        _id: '$iVideoId',
        attempt: { $first: '$$ROOT' }
      }
    },
    {
      $project: {
        iVideoId: '$_id',
        iGradeId: '$attempt.iGradeId',
        iSubjectId: '$attempt.iSubjectId',
        iTermId: '$attempt.iTermId',
        dCompletedAt: '$attempt.dCompletedAt'
      }
    }
  ]);

  return results;
}

async function evaluateQuizBadges ({ userId }) {
  try {
    const quizTypes = [eBadgeType.map.QUIZ_PERFORMANCE, eBadgeType.map.PERFECTIONIST].filter(Boolean);
    const [badges, perfectVideos] = await Promise.all([
      BadgeModel.find({ eType: { $in: quizTypes }, eStatus: eStatus.map.ACTIVE, bDelete: false }).lean(),
      getUserPerfectScoreVideos(userId)
    ]);

    if (!badges.length || !perfectVideos.length) {
      return;
    }

    for (const badge of badges) {
      const matchingVideos = perfectVideos.filter((video) => matchesContext(badge, video));

      let required = typeof badge.nMinimumVideos === 'number' && badge.nMinimumVideos > 0
        ? badge.nMinimumVideos
        : badge.oRule?.nMinimumVideos || 0;

      if (badge.eType === eBadgeType.map.PERFECTIONIST) {
        const percentage = badge.oRule?.nMinimumPercentage || 0;
        if (percentage > 0) {
          const totalVideos = await getTotalVideosForBadge(badge);
          const percentageRequired = Math.ceil((percentage / 100) * totalVideos);
          required = Math.max(required, percentageRequired);
        }
      }

      const hasMetCriteria = required > 0 && matchingVideos.length >= required;
      const selectedVideoIds = matchingVideos.slice(0, required).map((video) => video.iVideoId);

      await awardBadgeIfEligible({
        userId,
        badge,
        hasMetCriteria,
        videoIds: selectedVideoIds,
        count: matchingVideos.length,
        context: {
          iGradeId: badge.iGradeId,
          iSubjectId: badge.iSubjectId,
          iTermId: badge.iTermId
        }
      });
    }
  } catch (error) {
    console.error('evaluateQuizBadges error:', error);
  }
}

async function evaluateVideoCompletionBadges ({ userId }) {
  try {
    const badges = await BadgeModel.find({
      eType: eBadgeType.map.TERM_EXPLORER,
      eStatus: eStatus.map.ACTIVE,
      bDelete: false
    }).lean();

    if (!badges.length) return;

    for (const badge of badges) {
      const required = typeof badge.nMinimumVideos === 'number' && badge.nMinimumVideos > 0
        ? badge.nMinimumVideos
        : badge.oRule?.nMinimumVideos || 0;

      if (!required) continue;

      const { count, videos } = await getCompletedVideosSnapshot({ userId, limit: required, badge });
      const hasMetCriteria = count >= required;
      const selectedVideoIds = videos.slice(0, required).map((v) => v.iVideoId);

      await awardBadgeIfEligible({
        userId,
        badge,
        hasMetCriteria,
        videoIds: selectedVideoIds,
        count,
        context: {
          iGradeId: badge.iGradeId,
          iSubjectId: badge.iSubjectId,
          iTermId: badge.iTermId
        }
      });
    }
  } catch (error) {
    console.error('evaluateVideoCompletionBadges error:', error);
  }
}

async function evaluateSubjectCompletionBadges ({ userId }) {
  try {
    const badges = await BadgeModel.find({
      eType: eBadgeType.map.MASTER_SCHOLAR,
      eStatus: eStatus.map.ACTIVE,
      bDelete: false
    }).lean();

    if (!badges.length) return;

    const completedSubjects = await getUserCompletedSubjects(userId);
    if (!completedSubjects.length) return;

    for (const badge of badges) {
      const required = badge?.oRule?.nMinimumSubjects || 1;
      const matchingSubjects = completedSubjects.filter((subject) => matchesContext(badge, subject));
      const hasMetCriteria = matchingSubjects.length >= required;
      const subjectIds = matchingSubjects.slice(0, required).map((s) => s.iSubjectId);

      await awardBadgeIfEligible({
        userId,
        badge,
        hasMetCriteria,
        videoIds: [],
        count: matchingSubjects.length,
        context: {
          iGradeId: badge.iGradeId,
          iSubjectId: badge.iSubjectId,
          aSubjectIds: subjectIds
        }
      });
    }
  } catch (error) {
    console.error('evaluateSubjectCompletionBadges error:', error);
  }
}

async function evaluateStreakBadges ({ userId, streakCount }) {
  try {
    const badges = await BadgeModel.find({
      eType: eBadgeType.map.STREAK_MASTER,
      eStatus: eStatus.map.ACTIVE,
      bDelete: false
    }).lean();

    if (!badges.length) return;

    for (const badge of badges) {
      const required = badge?.oRule?.nMinimumStreakDays || badge?.nMinimumVideos || 0;
      const hasMetCriteria = required > 0 && streakCount >= required;

      await awardBadgeIfEligible({
        userId,
        badge,
        hasMetCriteria,
        videoIds: [],
        count: streakCount,
        context: {
          streakCount: streakCount,
          nRequired: required
        }
      });
    }
  } catch (error) {
    console.error('evaluateStreakBadges error:', error);
  }
}

module.exports = {
  getUserPerfectScoreVideos,
  getUserCompletedSubjects,
  getUserStreakSnapshot,
  evaluateQuizBadges,
  evaluateVideoCompletionBadges,
  evaluateSubjectCompletionBadges,
  evaluateStreakBadges,
  matchesContext,
  getCompletedVideosSnapshot,
  getTotalVideosForBadge
};
