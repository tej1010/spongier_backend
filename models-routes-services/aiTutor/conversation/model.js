const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { CourseDBConnect } = require('../../../database/mongoose');
const UserModel = require('../../user/model');
const AITutorSessionModel = require('../AiTutorSessionModel');
const data = require('../../../data');

const AITutorConversation = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel, required: true },
  iSessionId: { type: Schema.Types.ObjectId, ref: AITutorSessionModel },
  iExternalSessionId: { type: String },
  eSenderType: { type: String, enum: data.eSenderType.value, default: data.eSenderType.default },
  sMessage: { type: String }
}, {
  timestamps: {
    createdAt: 'dCreatedAt',
    updatedAt: 'dUpdatedAt'
  }
});

AITutorConversation.index({ iExternalSessionId: 1 });
AITutorConversation.index({ iSessionId: 1, dCreatedAt: -1 });

const AITutorConversationModel = CourseDBConnect.model('aitutorconversation', AITutorConversation);

AITutorConversationModel.syncIndexes()
  .then(() => console.log('AI Tutor Conversation Model Indexes Synced'))
  .catch((err) => console.log('AI Tutor Conversation Model Indexes Sync Error', err));

module.exports = CourseDBConnect.model('aitutorconversation', AITutorConversation);
