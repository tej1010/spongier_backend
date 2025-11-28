const AITutorConversationModel = require('./conversation/model');
const data = require('../../data');

async function getConversation (iSessionId, iUserId) {
  try {
    const [oAIConversation, oUserConversation] = await Promise.all([
      AITutorConversationModel.findOne({ iSessionId, iUserId, eSenderType: data.eSenderType.map.AI }).sort({ dCreatedAt: 1 }).lean(),
      AITutorConversationModel.findOne({ iSessionId, iUserId, eSenderType: data.eSenderType.map.USER }).sort({ dCreatedAt: 1 }).lean()
    ]);

    return { oAIConversation, oUserConversation };
  } catch (error) {
    return error;
  }
}

module.exports = {
  getConversation
};
