const { messages, status } = require('../../../helper/api.responses');
const { handleServiceError } = require('../../../helper/utilities.services');
const UserModel = require('../model');
const { sendParentLinkNotificationEmail } = require('../../../helper/mail.services');

/**
 * User Relationship Services
 * Handles parent-child relationships and linking
 */

/**
 * Link parent to the authenticated student
 */
const linkParent = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const studentId = req.user._id;
    const { iParentId, sEmail, sPhone } = req.body;

    const student = await UserModel.findById(studentId, null, { readPreference: 'primary' });
    if (!student) {
      return res.status(status.NotFound).json({ success: false, message: messages[lang].userNotFound, data: {}, error: {} });
    }

    if (student.eRole !== 'student') {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'access_denied' });
    }

    let parent;
    if (iParentId) {
      parent = await UserModel.findById(iParentId, null, { readPreference: 'primary' });
    } else if (sEmail) {
      parent = await UserModel.findOne({ sEmail: sEmail.toLowerCase().trim() }, null, { readPreference: 'primary' });
    } else if (sPhone) {
      parent = await UserModel.findOne({ sPhone }, null, { readPreference: 'primary' });
    }

    if (!parent) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'userNotFound' });
    }

    if (parent._id.equals(student._id)) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'cannotLinkSelfAsParent' });
    }

    if (parent.eRole !== 'parent') {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang].invalidUserRole || 'Invalid user role. Allowed values: teacher, parent, student',
        data: {},
        error: {}
      });
    }

    await Promise.all([
      UserModel.updateOne({ _id: student._id }, { $addToSet: { aParents: parent._id } }),
      UserModel.updateOne({ _id: parent._id }, { $addToSet: { aChildren: student._id } })
    ]);

    sendParentLinkNotificationEmail({
      parentName: parent.sName,
      parentEmail: parent.sEmail,
      studentName: student.sName
    }).catch(err => console.error('Failed to send parent link notification:', err));

    const updated = await UserModel.findById(student._id, null, { readPreference: 'primary' })
      .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
      .populate('aParents', 'sName sEmail sPhone eRole');

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].parentLinked,
      data: { aParents: updated.aParents },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'internalServerError' });
  }
};

/**
 * Unlink parent from the authenticated student
 */
const unlinkParent = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const studentId = req.user._id;
    const { parentId } = req.params;

    const student = await UserModel.findById(studentId, null, { readPreference: 'primary' });
    if (!student) {
      return res.status(status.NotFound).json({ success: false, message: messages[lang].userNotFound, data: {}, error: {} });
    }

    await Promise.all([
      UserModel.updateOne({ _id: student._id }, { $pull: { aParents: parentId } }),
      UserModel.updateOne({ _id: parentId }, { $pull: { aChildren: student._id } })
    ]);

    const updated = await UserModel.findById(student._id, null, { readPreference: 'primary' })
      .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
      .populate('aParents', 'sName sEmail sPhone eRole');

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].parentUnlinked,
      data: { aParents: updated.aParents },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'internalServerError' });
  }
};

/**
 * List linked parents for authenticated student
 */
const listLinkedParents = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const studentId = req.user._id;

    const user = await UserModel.findById(studentId, null, { readPreference: 'primary' })
      .select('_id aParents')
      .populate('aParents', 'sName sEmail sPhone eRole');

    if (!user) {
      return res.status(status.NotFound).json({ success: false, message: messages[lang].userNotFound, data: {}, error: {} });
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].parentsListSuccess,
      data: { aParents: user?.aParents || [] },
      error: {}
    });
  } catch (error) {
    console.log('listLinkedParents error:', error);
    return handleServiceError(error, req, res, { messageKey: 'internalServerError' });
  }
};

module.exports = {
  linkParent,
  unlinkParent,
  listLinkedParents
};
