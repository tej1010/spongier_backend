const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { CourseDBConnect } = require('../../database/mongoose');
const UserModel = require('../user/model');
const LanguageModel = require('./language/model');
const data = require('../../data');

const AITutorSession = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel, required: true },
  iExternalSessionId: { type: String },
  iLanguageId: { type: Schema.Types.ObjectId, ref: LanguageModel },
  sSessionToken: { type: String },
  eStatus: { type: String, enum: data.eAITutorStatus.value, default: data.eAITutorStatus.default },
  dStartedAt: { type: Date },
  dEndedAt: { type: Date },
  oConfig: { type: Object }
}, {
  timestamps: {
    createdAt: 'dCreatedAt',
    updatedAt: 'dUpdatedAt'
  }
});

AITutorSession.index({ iExternalSessionId: 1 });
AITutorSession.index({ iUserId: 1 });

AITutorSession.virtual('oUser', {
  ref: UserModel,
  localField: 'iUserId',
  foreignField: '_id',
  justOne: true
});
AITutorSession.virtual('oLanguage', {
  ref: LanguageModel,
  localField: 'iLanguageId',
  foreignField: '_id',
  justOne: true
});

const AITutorSessionModel = CourseDBConnect.model('aitutorsession', AITutorSession);

AITutorSessionModel.syncIndexes()
  .then(() => console.log('AI Tutor Session Model Indexes Synced'))
  .catch((err) => console.log('AI Tutor Session Model Indexes Sync Error', err));

module.exports = AITutorSessionModel;
