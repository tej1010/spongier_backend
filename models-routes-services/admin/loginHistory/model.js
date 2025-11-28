const mongoose = require('mongoose');
const { AdminsDBConnect } = require('../../../database/mongoose');

const Schema = mongoose.Schema;

const AdminLoginHistorySchema = new Schema({
  iAdminId: { type: Schema.Types.ObjectId, ref: 'admins', required: false, index: true },
  sIp: { type: String },
  sUserAgent: { type: String },
  sBrowser: { type: String },
  sOs: { type: String },
  sDevice: { type: String },
  sCity: { type: String },
  sCountry: { type: String },
  eStatus: { type: String, enum: ['success', 'failed'], required: true },
  dCreatedAt: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'dCreatedAt', updatedAt: false }
});

AdminLoginHistorySchema.index({ iAdminId: 1, dCreatedAt: -1 });

const AdminLoginHistoryModel = AdminsDBConnect.model('login_histories', AdminLoginHistorySchema);

module.exports = AdminLoginHistoryModel;
