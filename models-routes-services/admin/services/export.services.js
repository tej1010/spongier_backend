const mongoose = require('mongoose');
const { messages, status } = require('../../../helper/api.responses');
const { handleServiceError } = require('../../../helper/utilities.services');
const UserModel = require('../../user/model');
const GradeModel = require('../../course/grades/model');
const SubjectModel = require('../../course/subjects/model');
const TermModel = require('../../course/terms/model');
const VideoModel = require('../../course/videos/model');
const ResourceModel = require('../../course/resource/model');

/**
 * Admin Export Services
 * Handles data export functionality for reports
 */

/**
 * Export users for download (JSON, no pagination)
 */
const exportUsers = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const role = (req.query?.userRole || '').trim();

    const query = {};
    if (role && role.toLowerCase() !== 'all') {
      query.eRole = role;
    }

    const users = await UserModel.find(query)
      .select('-sPassword -sOtp -dOtpExpiration')
      .populate('iSubscriptionId')
      .populate('iSchool', 'sName sAddress sCity sState sCountry')
      .populate('aParents', 'sName sEmail sPhone eRole')
      .populate('aChildren', 'sName sEmail sPhone eRole')
      .sort({ dCreatedAt: -1 })
      .lean();

    // Remove refresh tokens from each user
    users.forEach(user => delete user.aRefreshTokens);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang]?.usersListSuccess || 'Users exported successfully.',
      data: { count: users.length, results: users },
      error: {}
    });
  } catch (error) {
    console.log('Error exporting users:', error);
    return handleServiceError(error, req, res, { messageKey: 'errorGettingUsers' });
  }
};

/**
 * Export course modules for download (JSON, no pagination)
 */
const exportCourse = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { module, gradeId, termId, subjectId, videoId, resourceId } = req.query;

    let dataQuery = {};
    const query = { bDelete: false };

    // Set model based on module
    switch (module) {
      case 'grade':
        dataQuery = GradeModel.find(query).sort({ dCreatedAt: -1 });
        break;
      case 'subject':
        if (gradeId) query.iGradeId = mongoose.Types.ObjectId(gradeId);
        dataQuery = SubjectModel.find(query).sort({ dCreatedAt: -1 }).populate('iGradeId');
        break;
      case 'term':
        if (gradeId) query.iGradeId = mongoose.Types.ObjectId(gradeId);
        if (subjectId) query.iSubjectId = mongoose.Types.ObjectId(subjectId);
        dataQuery = TermModel.find(query).sort({ dCreatedAt: -1 }).populate('iGradeId iSubjectId');
        break;
      case 'video':
        if (gradeId) query.iGradeId = mongoose.Types.ObjectId(gradeId);
        if (subjectId) query.iSubjectId = mongoose.Types.ObjectId(subjectId);
        if (termId) query.iTermId = mongoose.Types.ObjectId(termId);
        dataQuery = VideoModel.find(query).sort({ dCreatedAt: -1 }).populate('iGradeId iSubjectId iTermId');
        break;
      case 'resource':
        if (subjectId) query.iSubjectId = mongoose.Types.ObjectId(subjectId);
        if (termId) query.iTermId = mongoose.Types.ObjectId(termId);
        if (videoId) query.iVideoId = mongoose.Types.ObjectId(videoId);
        dataQuery = ResourceModel.find(query).sort({ dCreatedAt: -1 }).populate('iGradeId iSubjectId iTermId iVideoId');
        break;
      default:
        return handleServiceError(null, req, res, {
          statusCode: status.BadRequest,
          messageKey: 'invalidModuleParameter',
          data: { message: messages[lang].moduleOptions }
        });
    }

    const results = await dataQuery.lean();

    return res.status(status.OK).json({
      success: true,
      message: messages[lang]?.dataExportSuccess || `${module} data exported successfully.`,
      data: {
        count: results.length,
        module: module,
        filters: { gradeId, termId, subjectId, videoId, resourceId },
        results: results
      },
      error: {}
    });
  } catch (error) {
    console.log('Error exporting course data:', error);
    return handleServiceError(error, req, res, { messageKey: 'errorExportingData' });
  }
};

module.exports = {
  exportUsers,
  exportCourse
};
