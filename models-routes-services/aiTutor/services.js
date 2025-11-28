const { messages, status } = require('../../helper/api.responses');
const { handleServiceError, getPaginationValues } = require('../../helper/utilities.services');
const { getHeyGenSessionToken, createHeyGenSession, startHeyGenSession, giveTaskHeyGenSession, stopHeyGenSession, stopTalkHeyGenSession } = require('./heyGenCommon');
const LanguageModel = require('./language/model');
const AITutorSessionModel = require('./AiTutorSessionModel');
const AITutorConversationModel = require('./conversation/model');
const UserModel = require('../user/model');
const data = require('../../data');
const { getConversation } = require('./common');

async function createSession (req, res) {
  const lang = req?.userLanguage;
  try {
    const { iLanguageId } = req.body;

    const oLanguage = await LanguageModel.findById(iLanguageId).lean();
    if (!oLanguage) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang].languageNotFound,
        data: {},
        error: {}
      });
    }

    // Update language for future use
    await UserModel.updateOne({ _id: req.user._id }, { $set: { iAiTutorLanguageId: oLanguage._id } });

    const sessionToken = await getHeyGenSessionToken();
    if (!sessionToken.bSuccess) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang].somethingWentWrong,
        data: {},
        error: { message: sessionToken.error.message }
      });
    }

    const oSession = await createHeyGenSession({ iKnowledgeBaseId: oLanguage.iKnowledgeBaseId, iVoiceId: oLanguage.iVoiceId });
    if (!oSession.bSuccess) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang].somethingWentWrong,
        data: {},
        error: { message: oSession.error.message }
      });
    }

    oSession.oResponse.session_token = sessionToken.sToken;

    const oInternalSession = await AITutorSessionModel.create({
      iUserId: req.user._id,
      iExternalSessionId: oSession.oResponse.session_id,
      iLanguageId,
      sSessionToken: sessionToken.sToken,
      eStatus: data.eAITutorStatus.map.INITIATED,
      oConfig: oSession.oResponse
    });

    const oData = { ...oSession.oResponse, oInternalSession };
    if (oData?.oInternalSession?.oConfig) oData.oInternalSession.oConfig = undefined;

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].sessionCreated,
      data: oData,
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
}

async function createSessionToken (req, res) {
  const lang = req?.userLanguage;
  try {
    const { iSessionId } = req.body;
    const sessionToken = await getHeyGenSessionToken(iSessionId);
    if (!sessionToken.bSuccess) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang].somethingWentWrong,
        data: {},
        error: { message: sessionToken.error.message }
      });
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].sessionCreated,
      data: { token: sessionToken.sToken },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
}

async function startSession (req, res) {
  const lang = req?.userLanguage;
  try {
    const { iSessionId } = req.body;
    const oSession = await startHeyGenSession(iSessionId);
    if (!oSession.bSuccess) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang].somethingWentWrong,
        data: {},
        error: { message: oSession.error.message }
      });
    }

    await AITutorSessionModel.updateOne({ iExternalSessionId: iSessionId }, { dStartedAt: new Date(), eStatus: data.eAITutorStatus.map.ACTIVE });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].sessionStarted,
      data: oSession.oResponse,
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
}

async function giveTask (req, res) {
  const lang = req?.userLanguage;
  try {
    const { iSessionId, sText, sTaskType = 'talk' } = req.body;
    const dDate = new Date();

    const oSession = await giveTaskHeyGenSession(iSessionId, sText, sTaskType);
    if (!oSession.bSuccess) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang].somethingWentWrong,
        data: {},
        error: { message: oSession.error.message }
      });
    }

    const oAITutorSession = await AITutorSessionModel.findOne({ iExternalSessionId: iSessionId }).lean();

    await AITutorConversationModel.create({
      iUserId: req.user._id,
      iSessionId: oAITutorSession?._id,
      iExternalSessionId: iSessionId,
      sMessage: sText,
      eSenderType: data.eSenderType.map.USER,
      dCreatedAt: dDate,
      dUpdatedAt: dDate
    });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].sessionGiveTask,
      data: oSession.oResponse,
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
}

async function stopSession (req, res) {
  const lang = req?.userLanguage;
  try {
    const { iSessionId } = req.body;
    const oSession = await stopHeyGenSession(iSessionId);
    if (!oSession.bSuccess) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang].somethingWentWrong,
        data: {},
        error: { message: oSession.error.message }
      });
    }

    await AITutorSessionModel.updateOne({ iExternalSessionId: iSessionId }, { dEndedAt: new Date(), eStatus: data.eAITutorStatus.map.CLOSED });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].sessionStopped,
      data: oSession.oResponse,
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
}

async function stopTalk (req, res) {
  const lang = req?.userLanguage;
  try {
    const { iSessionId } = req.body;
    const oSession = await stopTalkHeyGenSession(iSessionId);
    if (!oSession.bSuccess) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang].somethingWentWrong,
        data: {},
        error: { message: oSession.error.message }
      });
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].stopTalkSuccess,
      data: oSession.oResponse,
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
}

async function userList (req, res) {
  const lang = req?.userLanguage;
  try {
    const { start, limit, sorting } = getPaginationValues(req.query);

    const [aSession, nTotal] = await Promise.all([
      await AITutorSessionModel.find({ iUserId: req.user._id }, { oConfig: 0 })
        .populate('oLanguage', 'sName sLocalName sFlagImage')
        .sort(sorting)
        .limit(limit)
        .skip(start)
        .lean(),
      await AITutorSessionModel.countDocuments({ iUserId: req.user._id })
    ]);

    const aConversation = [];
    for (const session of aSession) {
      aConversation.push(getConversation(session._id, req.user._id));
    }
    const aConversationData = await Promise.all(aConversation);

    for (let i = 0; i < aSession.length; i++) {
      const oSession = aSession[i];
      const oConversation = aConversationData[i];

      oSession.oConversation = {
        sUserText: oConversation?.oUserConversation?.sMessage,
        sAIText: oConversation?.oAIConversation?.sMessage
      };
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].sessionFetched,
      data: { total: nTotal, results: aSession, limit, start },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
}

async function parentChildList (req, res) {
  const lang = req?.userLanguage;
  try {
    const { start, limit, sorting } = getPaginationValues(req.query);

    const iChildId = req.params.iChildId;

    const oChild = await UserModel.findById(iChildId).lean();
    if (!oChild) return res.status(status.BadRequest).json({ success: false, message: messages[lang].childNotFound });

    const oParent = await UserModel.findById(req.user._id).lean();
    if (!oParent?.aChildren) return res.status(status.BadRequest).json({ success: false, message: messages[lang].childNotFound });

    const bChildFound = oParent?.aChildren.find((child) => child.toString() === iChildId);
    if (!bChildFound) return res.status(status.BadRequest).json({ success: false, message: messages[lang].childNotFound });

    const [aSession, nTotal] = await Promise.all([
      await AITutorSessionModel.find({ iUserId: iChildId }, { oConfig: 0 })
        .populate('oLanguage', 'sName sLocalName sFlagImage')
        .sort(sorting)
        .limit(limit)
        .skip(start)
        .lean(),
      await AITutorSessionModel.countDocuments({ iUserId: iChildId })
    ]);

    const aConversation = [];
    for (const session of aSession) {
      aConversation.push(getConversation(session._id, iChildId));
    }
    const aConversationData = await Promise.all(aConversation);

    for (let i = 0; i < aSession.length; i++) {
      const oSession = aSession[i];
      const oConversation = aConversationData[i];

      oSession.oConversation = {
        sUserText: oConversation?.oUserConversation?.sMessage,
        sAIText: oConversation?.oAIConversation?.sMessage
      };
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].sessionFetched,
      data: { total: nTotal, results: aSession, limit, start }
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
}

module.exports = {
  createSession,
  startSession,
  giveTask,
  stopSession,
  stopTalk,
  createSessionToken,
  userList,
  parentChildList
};
