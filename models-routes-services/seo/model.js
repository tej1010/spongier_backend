const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const data = require('../../data');
const { CourseDBConnect } = require('../../database/mongoose');

const SocialSchema = new Schema({
  sTitle: { type: String, trim: true },
  sDescription: { type: String, trim: true, required: true },
  sUrl: { type: String, trim: true },
  oMeta: {
    nSize: { type: Number },
    nWidth: { type: Number },
    nHeight: { type: Number }
  }
}, { _id: false });

const SeoSchema = new Schema({
  iId: { type: Schema.Types.ObjectId },
  sTitle: { type: String, trim: true },
  sDescription: { type: String, trim: true },
  sSlug: { type: String, trim: true, unique: true },
  aKeywords: [{ type: String, trim: true }],
  oFB: { type: SocialSchema },
  oTwitter: { type: SocialSchema },
  eType: { type: String, enum: data.eSeoType.value },
  eSubType: { type: String },
  eStatus: { type: String, enum: data.eStatus.value, default: data.eStatus.map.ACTIVE },
  // sCUrl => Canonical url
  sCUrl: { type: String, trim: true },
  sRobots: { type: String, trim: true },
  iUpdatedBy: { type: Schema.Types.ObjectId },
  eCode: { type: Number, min: 100, max: 599 }
}, {
  timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// seoSchema = SeoSchema; // preserve naming intent for clarity
SeoSchema.index({ eType: 1, eSubType: 1, iId: 1 });

const SEOModel = CourseDBConnect.model('SEO', SeoSchema);

SEOModel.syncIndexes()
  .then(() => {
    console.log('SEO Model Indexes Synced');
  })
  .catch((err) => {
    console.log('SEO Model Indexes Sync Error', err);
  });

module.exports = SEOModel;
