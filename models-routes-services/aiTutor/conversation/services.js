const { messages, status } = require('../../../helper/api.responses');
const { handleServiceError, getPaginationValues } = require('../../../helper/utilities.services');
const AITutorConversationModel = require('./model');
const AITutorSessionModel = require('../AiTutorSessionModel');
const UserModel = require('../../user/model');
const data = require('../../../data');

async function createConversation (req, res) {
  const lang = req?.userLanguage;
  try {
    const { iSessionId, sMessage } = req.body;
    const oSession = await AITutorSessionModel.findOne({ iUserId: req.user._id, iExternalSessionId: iSessionId }).lean();
    if (!oSession) {
      return res.status(status.NotFound).json({
        success: false,
        message: messages[lang].sessionNotFound,
        data: {},
        error: {}
      });
    }

    if (oSession?.dEndedAt < new Date()) {
      return res.status(status.NotFound).json({
        success: false,
        message: messages[lang].sessionEnded,
        data: {},
        error: {}
      });
    }

    const oConversation = await AITutorConversationModel.create({
      iUserId: req.user._id,
      iSessionId: oSession._id,
      iExternalSessionId: iSessionId,
      sMessage,
      eSenderType: data.eSenderType.map.AI
    });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].conversationCreated,
      data: oConversation,
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
}

async function listConversation (req, res) {
  const lang = req?.userLanguage;
  try {
    const { iSessionId } = req.query;
    const { start, limit, sorting } = getPaginationValues(req.query);

    const oSession = await AITutorSessionModel.findOne({ iUserId: req.user._id, iExternalSessionId: iSessionId }).lean();
    if (!oSession) {
      return res.status(status.NotFound).json({
        success: false,
        message: messages[lang].sessionNotFound,
        data: {},
        error: {}
      });
    }
    const [results, total] = await Promise.all([
      AITutorConversationModel.find({ iSessionId: oSession._id })
        .sort(sorting)
        .limit(limit)
        .skip(start)
        .lean(),
      AITutorConversationModel.countDocuments({ iSessionId: oSession._id })
    ]);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].conversationListed,
      data: { total, results, limit, start },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
}

async function childConversationList (req, res) {
  const lang = req?.userLanguage;
  try {
    const { iSessionId } = req.query;
    const { start, limit, sorting } = getPaginationValues(req.query);

    const iChildId = req.params.iChildId;

    const oChild = await UserModel.findById(iChildId).lean();
    if (!oChild) return res.status(status.BadRequest).json({ success: false, message: messages[lang].childNotFound });

    const oParent = await UserModel.findById(req.user._id).lean();
    if (!oParent?.aChildren) return res.status(status.BadRequest).json({ success: false, message: messages[lang].childNotFound });

    const bChildFound = oParent?.aChildren.find((child) => child.toString() === iChildId);
    if (!bChildFound) return res.status(status.BadRequest).json({ success: false, message: messages[lang].childNotFound });

    const oSession = await AITutorSessionModel.findOne({ iUserId: iChildId, iExternalSessionId: iSessionId }).lean();
    if (!oSession) {
      return res.status(status.NotFound).json({
        success: false,
        message: messages[lang].sessionNotFound,
        data: {},
        error: {}
      });
    }
    const [results, total] = await Promise.all([
      AITutorConversationModel.find({ iSessionId: oSession._id })
        .sort(sorting)
        .limit(limit)
        .skip(start)
        .lean(),
      AITutorConversationModel.countDocuments({ iSessionId: oSession._id })
    ]);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].conversationListed,
      data: { total, results, limit, start }
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
}

module.exports = {
  createConversation,
  listConversation,
  childConversationList
};
