const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { UsersDBConnect } = require('../../../database/mongoose');
const data = require('../../../data');
const UserModel = require('../model');

const OTPVerifications = new Schema({
  sLogin: { type: String, trim: true, required: true },
  sCode: { type: Number, required: true },
  sType: { type: String, enum: data.eOtpType.value, required: true },
  sAuth: { type: String, enum: data.eOtpAuth.value, required: true },
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  bIsVerify: { type: Boolean, default: false }
}, {
  timestamps: {
    createdAt: 'dCreatedAt',
    updatedAt: 'dUpdatedAt'
  }
});

OTPVerifications.index({ sLogin: 1, sCode: 1, sType: 1 });

module.exports = UsersDBConnect.model('otpverifications', OTPVerifications);
