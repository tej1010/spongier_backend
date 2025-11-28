// course-stats.services.js
const { status, messages } = require('../../helper/api.responses');
const { handleServiceError } = require('../../helper/utilities.services');
const UserModel = require('../user/model');
const AdminModel = require('../admin/model');
const GradeModel = require('../course/grades/model');
const SubjectModel = require('../course/subjects/model');
const TermModel = require('../course/terms/model');
const VideoModel = require('../course/videos/model');
const ResourceModel = require('../course/resource/model');
const QuizModel = require('../course/quiz/model');
const QuizAttemptModel = require('../course/quiz/attempt.model');
const { eUserRoles, eStatus } = require('../../data');

const getDashboardCounts = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const [users, admins, grades, subjects, terms, videos, resources] = await Promise.all([
      UserModel.countDocuments({}),
      AdminModel.countDocuments({}),
      GradeModel.countDocuments({}),
      SubjectModel.countDocuments({}),
      TermModel.countDocuments({}),
      VideoModel.countDocuments({}),
      ResourceModel.countDocuments({})
    ]);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].dashboardCountRetrived,
      data: {
        users,
        admins,
        grades,
        subjects,
        terms,
        videos,
        resources
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveDashboardCounts' });
  }
};
const getCourseCounts = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const [grades, subjects, terms, videos, resources] = await Promise.all([
      GradeModel.countDocuments({}),
      SubjectModel.countDocuments({}),
      TermModel.countDocuments({}),
      VideoModel.countDocuments({}),
      ResourceModel.countDocuments({})
    ]);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].courseCountRetrived,
      data: {
        grades,
        subjects,
        terms,
        videos,
        resources
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveCourseCounts' });
  }
};

const getUserStatistics = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { userRole } = req.query;
    // Build base filter object
    const baseFilter = { };
    // const baseFilter2 = { eStatus: 'active', bDelete: false };
    if (userRole) {
      // Validate userRole against allowed values
      const allowedRoles = eUserRoles.value;
      if (!allowedRoles.includes(userRole)) {
        return res.status(status.BadRequest).json({
          success: false,
          message: messages[lang].invalidUserRole || 'Invalid user role. Allowed values: teacher, parent, student',
          data: {},
          error: {}
        });
      }
      baseFilter.eRole = userRole;
    }

    // Get total users count
    const totalUsers = await UserModel.countDocuments(baseFilter);

    // Get active users count
    const activeUsers = await UserModel.countDocuments({
      ...baseFilter,
      eStatus: 'active'
      // bIsEmailVerified: true
    });

    // Get inactive users count
    const inactiveUsers = await UserModel.countDocuments({
      ...baseFilter,
      eStatus: 'inactive'
      // bIsEmailVerified: false
    });

    // Get trial users count (users with subscription that has dTrialEndDate not null)
    const trialUsers = await UserModel.aggregate([
      {
        $match: baseFilter
      },
      {
        $lookup: {
          from: 'subscriptions',
          localField: 'iSubscriptionId',
          foreignField: '_id',
          as: 'subscription'
        }
      },
      {
        $match: {
          'subscription.dTrialEndDate': { $ne: null }
        }
      },
      {
        $count: 'trialUsers'
      }
    ]);

    const trialUsersCount = trialUsers.length > 0 ? trialUsers[0].trialUsers : 0;

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].userStatsRetrieved || 'User statistics retrieved successfully',
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        trialUsers: trialUsersCount,
        filter: userRole ? { userRole } : null
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveUserStatistics' });
  }
};

const getQuizStatistics = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const activeFilter = { bDelete: false, eStatus: eStatus.map.ACTIVE };
    const inactiveFilter = { bDelete: false, eStatus: eStatus.map.INACTIVE };
    const baseFilter = { bDelete: false };

    const [totalQuizzes, activeQuizzes, inactiveQuizzes, totalAttempts] = await Promise.all([
      QuizModel.countDocuments(baseFilter),
      QuizModel.countDocuments(activeFilter),
      QuizModel.countDocuments(inactiveFilter),
      QuizAttemptModel.countDocuments({})
    ]);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].quizStatsRetrieved || 'Quiz statistics retrieved successfully',
      data: {
        totalQuizzes,
        totalAttempts,
        activeQuizzes,
        inactiveQuizzes
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveQuizStatistics' });
  }
};

module.exports = { getDashboardCounts, getCourseCounts, getUserStatistics, getQuizStatistics };
