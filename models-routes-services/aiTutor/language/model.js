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

// helper that tries different index-sync methods and never throws
async function ensureModelIndexes(model) {
  if (!model) {
    console.warn('ensureModelIndexes: model is falsy, skipping index sync.');
    return;
  }

  if (process.env.OFFLINE_MODE === 'true') {
    console.log(`OFFLINE_MODE=true — skipping index operations for model "${model.modelName || 'unknown'}"`);
    return;
  }

  try {
    if (typeof model.syncIndexes === 'function') {
      await model.syncIndexes();
      console.log(`Indexes synced (syncIndexes) for model: ${model.modelName}`);
      return;
    }

    if (typeof model.createIndexes === 'function') {
      await model.createIndexes();
      console.log(`Indexes created (createIndexes) for model: ${model.modelName}`);
      return;
    }

    if (typeof model.ensureIndexes === 'function') {
      await model.ensureIndexes();
      console.log(`Indexes ensured (ensureIndexes) for model: ${model.modelName}`);
      return;
    }

    console.log(`No index sync method available for model: ${model.modelName}. Skipping index sync.`);
  } catch (err) {
    console.warn(`Index sync failed for model ${model.modelName}:`, err && err.message ? err.message : err);
  }
}

ensureModelIndexes(LanguageModel);

module.exports = LanguageModel;
