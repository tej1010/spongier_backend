const mongoose = require('mongoose');
const enums = require('../../data');
const { CourseDBConnect } = require('../../database/mongoose');

const seoRedirectSchema = new mongoose.Schema(
  {
    // From/To
    sOldSlug: { type: String, required: true, lowercase: true, trim: true },
    sNewSlug: { type: String, required: true, lowercase: true, trim: true },

    // HTTP status to return (typically 301 permanent, 302/307 temporary)
    nStatusCode: {
      type: Number,
      enum: enums.eHttpStatusCode.value,
      default: enums.eHttpStatusCode.default
    },

    // Align with SEO targeting
    iId: { type: mongoose.Schema.Types.ObjectId },
    eType: { type: String, enum: enums.eSeoType?.value || undefined },
    eSubType: { type: String },

    // Status & audit
    eStatus: {
      type: String,
      enum: enums.eStatus.value,
      default: enums.eStatus.default
    },
    iCreatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    iLastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

seoRedirectSchema.index({ sOldSlug: 1 }, { unique: true });
seoRedirectSchema.index({ sNewSlug: 1 });

const SEORedirectModel = CourseDBConnect.model('SEORedirect', seoRedirectSchema);

SEORedirectModel.syncIndexes()
  .then(() => {
    console.log('SEORedirect Model Indexes Synced');
  })
  .catch((err) => {
    console.log('SEORedirect Model Indexes Sync Error', err);
  });

module.exports = SEORedirectModel;
