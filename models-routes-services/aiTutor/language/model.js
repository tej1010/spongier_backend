const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { CourseDBConnect } = require('../../../database/mongoose');
const data = require('../../../data');

const Language = new Schema({
  sName: { type: String },
  sLocalName: { type: String },
  sFlagImage: { type: String },
  iVoiceId: { type: String },
  iKnowledgeBaseId: { type: String },
  eStatus: { type: String, enum: data.eActiveStatus.value, default: data.eActiveStatus.default }
}, {
  timestamps: {
    createdAt: 'dCreatedAt',
    updatedAt: 'dUpdatedAt'
  }
});

const LanguageModel = CourseDBConnect.model('language', Language);

LanguageModel.syncIndexes()
  .then(() => console.log('Language Model Indexes Synced'))
  .catch((err) => console.log('Language Model Indexes Sync Error', err));

module.exports = LanguageModel;
