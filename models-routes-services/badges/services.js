const mongoose = require('mongoose');
const { status, messages } = require('../../helper/api.responses');
const { handleServiceError, getPaginationValues2 } = require('../../helper/utilities.services');
const BadgeModel = require('./badge.model');
const UserBadgeModel = require('./userBadge.model');
const {
  getUserPerfectScoreVideos,
  getCompletedVideosSnapshot,
  getUserCompletedSubjects,
  getUserStreakSnapshot,
  matchesContext,
  getTotalVideosForBadge
} = require('../../helper/badge.helper');
const { eBadgeTier, eBadgeType, eStatus } = require('../../data');

const objectId = (value) => mongoose.Types.ObjectId(value);

class ServiceError extends Error {
  constructor (messageKey, statusCode = status.BadRequest) {
    super(messageKey);
    this.messageKey = messageKey;
    this.statusCode = statusCode;
  }
}

const buildBadgeQuery = ({ eStatus, eType, gradeId, subjectId, termId }) => {
  const query = { bDelete: false };
  if (eStatus) query.eStatus = eStatus;
  if (eType) query.eType = eType;
  if (gradeId) query.iGradeId = objectId(gradeId);
  if (subjectId) query.iSubjectId = objectId(subjectId);
  if (termId) query.iTermId = objectId(termId);
  return query;
};

const createBadge = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const payload = req.body;
    const badgeType = payload.eType || eBadgeType.default || eBadgeType.map.QUIZ_PERFORMANCE;
    const badgeRule = (payload.oRule && typeof payload.oRule === 'object') ? { ...payload.oRule } : {};
    const videoCountTypes = [eBadgeType.map.TERM_EXPLORER, eBadgeType.map.QUIZ_PERFORMANCE, eBadgeType.map.PERFECTIONIST];

    if (videoCountTypes.includes(badgeType)) {
      const minimumVideos = typeof payload.nMinimumVideos === 'number' ? payload.nMinimumVideos : badgeRule.nMinimumVideos;
      badgeRule.nMinimumVideos = typeof minimumVideos === 'number' ? minimumVideos : 0;
    }

    if (badgeType === eBadgeType.map.MASTER_SCHOLAR && !badgeRule.nMinimumSubjects) {
      badgeRule.nMinimumSubjects = 1;
    }

    if (badgeType === eBadgeType.map.STREAK_MASTER && !badgeRule.nMinimumStreakDays) {
      badgeRule.nMinimumStreakDays = 7;
    }

    if (badgeRule.nMinimumPercentage && (badgeRule.nMinimumPercentage < 1 || badgeRule.nMinimumPercentage > 100)) {
      throw new ServiceError('invalidPercentageRule', status.BadRequest);
    }

    const duplicate = await BadgeModel.findOne({
      sName: payload.sName.trim(),
      eType: badgeType,
      bDelete: false
    }).lean();

    if (duplicate) {
      throw new ServiceError('badgeAlreadyExists', status.Conflict);
    }

    const badge = await BadgeModel.create({
      sName: payload.sName.trim(),
      sDescription: payload.sDescription.trim(),
      sIcon: payload.sIcon || '🏆',
      eTier: payload.eTier || eBadgeTier.default || eBadgeTier.map.BRONZE,
      eType: badgeType,
      nMinimumVideos: typeof badgeRule.nMinimumVideos === 'number' ? badgeRule.nMinimumVideos : 0,
      oRule: badgeRule,
      iGradeId: payload.iGradeId || null,
      iSubjectId: payload.iSubjectId || null,
      iTermId: payload.iTermId || null,
      eStatus: payload.eStatus || eStatus.map.ACTIVE
    });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].badgeCreated || 'Badge created successfully.',
      data: { badge },
      error: {}
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return handleServiceError(null, req, res, { statusCode: error.statusCode, messageKey: error.messageKey });
    }
    return handleServiceError(error, req, res, { messageKey: 'failedToCreateBadge' });
  }
};

const listBadges = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { limit, start } = getPaginationValues2(req.query);
    const { sortBy = 'dCreatedAt', sortOrder = 'desc' } = req.query;
    const query = buildBadgeQuery(req.query);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [total, badges] = await Promise.all([
      BadgeModel.countDocuments(query),
      BadgeModel.find(query)
        .sort(sort)
        .skip(Number(start))
        .limit(Number(limit))
        .lean()
    ]);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].badgesRetrieved || 'Badges retrieved successfully.',
      data: {
        total,
        limit: Number(limit),
        start: Number(start),
        results: badges
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToListBadges' });
  }
};

const listUserBadges = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const userId = req.user._id;
    const userBadges = await UserBadgeModel.find({ iUserId: userId })
      .populate('iBadgeId')
      .sort({ dEarnedAt: -1 })
      .lean();

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].userBadgesRetrieved || 'User badges retrieved successfully.',
      data: {
        results: userBadges.map((entry) => ({
          _id: entry._id,
          dEarnedAt: entry.dEarnedAt,
          nVideoCount: entry.nVideoCount,
          aVideoIds: entry.aVideoIds,
          badge: entry.iBadgeId
        }))
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToListUserBadges' });
  }
};

const getUserBadgeProgress = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const userId = req.user._id;
    const [
      badges,
      userBadges,
      perfectVideos,
      completedVideosSnapshot,
      completedSubjects,
      streakSnapshot
    ] = await Promise.all([
      BadgeModel.find({ eStatus: eStatus.map.ACTIVE, bDelete: false }).lean(),
      UserBadgeModel.find({ iUserId: userId }).lean(),
      getUserPerfectScoreVideos(userId),
      getCompletedVideosSnapshot({ userId }),
      getUserCompletedSubjects(userId),
      getUserStreakSnapshot(userId)
    ]);

    const completedVideos = completedVideosSnapshot?.videos || [];
    const earnedMap = new Map(userBadges.map((badge) => [badge.iBadgeId.toString(), badge]));

    const progress = await Promise.all(badges.map(async (badge) => {
      const earned = earnedMap.get(badge._id.toString());
      const badgeType = badge.eType;

      let current = 0;
      let required = 0;

      switch (badgeType) {
        case eBadgeType.map.TERM_EXPLORER:
          required = badge.nMinimumVideos || badge.oRule?.nMinimumVideos || 0;
          current = completedVideos.filter((video) => matchesContext(badge, video)).length;
          break;
        case eBadgeType.map.MASTER_SCHOLAR:
          required = badge?.oRule?.nMinimumSubjects || 1;
          current = completedSubjects.filter((subject) => matchesContext(badge, subject)).length;
          break;
        case eBadgeType.map.STREAK_MASTER:
          required = badge?.oRule?.nMinimumStreakDays || badge?.nMinimumVideos || 0;
          current = streakSnapshot?.nCurrent || 0;
          break;
        case eBadgeType.map.PERFECTIONIST:
        case eBadgeType.map.QUIZ_PERFORMANCE:
        default: {
          required = badge.nMinimumVideos || badge.oRule?.nMinimumVideos || 0;
          const percentage = badge.oRule?.nMinimumPercentage || 0;
          if (badgeType === eBadgeType.map.PERFECTIONIST && percentage > 0) {
            const totalVideosInContext = await getTotalVideosForBadge(badge);
            const percentageRequired = Math.ceil((percentage / 100) * totalVideosInContext);
            required = Math.max(required, percentageRequired);
          }
          const contextVideos = perfectVideos.filter((video) => matchesContext(badge, video));
          current = contextVideos.length;
          break;
        }
      }

      const percentage = required ? Math.min(100, Math.round((current / required) * 100)) : 0;

      return {
        badge,
        isEarned: Boolean(earned),
        progress: {
          current,
          required,
          percentage
        },
        earnedAt: earned?.dEarnedAt || null
      };
    }));

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].badgeProgressRetrieved || 'Badge progress retrieved successfully.',
      data: {
        totalPerfectVideos: perfectVideos.length,
        totalCompletedVideos: completedVideosSnapshot?.count || 0,
        completedSubjectsCount: completedSubjects.length,
        currentStreak: streakSnapshot?.nCurrent || 0,
        progress
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToGetBadgeProgress' });
  }
};

module.exports = {
  createBadge,
  listBadges,
  listUserBadges,
  getUserBadgeProgress
};
