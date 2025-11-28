// banner.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { eStatus, eBannerKey } = require('../../data');
const { CourseDBConnect } = require('../../database/mongoose');

const BannerSchema = new Schema({
  sTitle: {
    type: String,
    required: true,
    trim: true
  },

  sSubtitle: {
    type: String,
    trim: true,
    default: ''
  },

  eKey: {
    type: String,
    required: true,
    enum: eBannerKey.value,
    default: eBannerKey.map.HOME
  },

  sImageUrl: {
    type: String,
    required: true,
    trim: true
  },

  sRedirectUrl: {
    type: String,
    trim: true,
    default: ''
  },

  iOrder: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },

  eStatus: {
    type: String,
    required: true,
    enum: eStatus.value,
    default: eStatus.map.ACTIVE
  },

  bFeature: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: {
    createdAt: 'dCreatedAt',
    updatedAt: 'dUpdatedAt'
  }
});

BannerSchema.index({ iOrder: 1 });
BannerSchema.index({ eStatus: 1 });

const BannerModel = CourseDBConnect.model('banners', BannerSchema);

module.exports = BannerModel;
