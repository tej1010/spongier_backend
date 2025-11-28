// user.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { eUserRoles, eStatus, eDeviceType } = require('../../data');
const { UsersDBConnect } = require('../../database/mongoose');
const SubscriptionModel = require('../subscription/model');
const { validateEmail } = require('../../helper/utilities.services');
const { signAccessTokenUser } = require('../../helper/token.util');
const AiTutorLanguageModel = require('../aiTutor/language/model');

const UserSchema = new Schema({
  eRole: {
    type: String,
    required: true,
    enum: eUserRoles.value
  },

  sName: {
    type: String,
    required: true,
    trim: true
  },

  sEmail: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },

  sPassword: {
    type: String,
    required: true,
    select: false
  },

  sPhone: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },

  nAge: {
    type: Number,
    min: 3,
    max: 150,
    required: false
  },

  iSchool: {
    type: Schema.Types.ObjectId,
    ref: 'schools',
    required: false
  },

  // Custom school name (used when iSchool is "Other")
  sSchool: {
    type: String,
    trim: true,
    default: ''
  },

  // Profile image path or URL
  sImage: {
    type: String,
    default: ''
  },

  // Grade/Class for students
  iGradeId: {
    type: Schema.Types.ObjectId,
    ref: 'grades',
    required: false
  },

  // Arbitrary JSON payload for additional user details
  oUserDetails: {
    type: Schema.Types.Mixed,
    default: {}
  },

  oSponsorDashboard: {
    type: Schema.Types.Mixed,
    default: null
  },

  // Address object (optional)
  oAddress: {
    type: Schema.Types.Mixed,
    default: {}
  },

  iSubscriptionId: {
    type: Schema.Types.ObjectId,
    ref: 'subscriptions'
  },

  // Optional: Children (if parent role)
  aChildren: [{
    type: Schema.Types.ObjectId,
    ref: 'users'
  }],

  // Optional: Parents (if student role)
  aParents: [{
    type: Schema.Types.ObjectId,
    ref: 'users'
  }],

  // For email verification
  sOtp: {
    type: String,
    select: false
  },

  dOtpExpiration: {
    type: Date,
    select: false
  },

  bIsEmailVerified: {
    type: Boolean,
    default: false
  },

  bTermsAndConditions: {
    type: Boolean,
    default: false
  },

  // Two Factor Authentication toggle
  bTwoFactorAuthentication: {
    type: Boolean,
    default: false
  },

  // Notification preference flags
  oNotificationPreference: {
    bEmail: { type: Boolean, default: false },
    bPush: { type: Boolean, default: false },
    bPhone: { type: Boolean, default: false }
  },

  // Last seen/activity tracking
  dLastSeen: {
    type: Date,
    default: null
  },

  // Snapchat-like streak tracking snapshot
  oStreak: {
    nCurrent: { type: Number, default: 0 }, // current consecutive days
    nBest: { type: Number, default: 0 }, // best streak ever
    dCurrentStart: { type: Date, default: null }, // when current streak started
    dLastActive: { type: Date, default: null } // last day counted towards streak
  },

  // Refresh tokens issued to this user (support multi-session)
  aRefreshTokens: {
    type: [{
      sToken: { type: String },
      dExpiresAt: { type: Date },
      sUserAgent: { type: String },
      sIp: { type: String },
      sDeviceType: { type: String, enum: eDeviceType.value, default: eDeviceType.default },
      dCreatedAt: { type: Date, default: Date.now }
    }],
    default: []
  },

  eStatus: {
    type: String,
    required: true,
    enum: eStatus.value,
    default: eStatus.map.ACTIVE
  },

  bDelete: {
    type: Boolean,
    default: false
  },

  iAiTutorLanguageId: {
    type: Schema.Types.ObjectId,
    ref: AiTutorLanguageModel,
    required: false
  }
}, {
  timestamps: {
    createdAt: 'dCreatedAt',
    updatedAt: 'dUpdatedAt'
  }
});

UserSchema.pre('save', async function (next) {
  // Hash password if it has been modified
  if (this.isModified('sPassword')) {
    if (!this.sPassword || !this.sPassword.trim()) {
      return next(new Error('Password is required and cannot be empty'));
    }
    try {
      this.sPassword = await bcrypt.hash(this.sPassword, 10);
    } catch (err) {
      return next(err);
    }
  }

  // Validate seat availability if subscriptionId has been modified
  if (this.isModified('subscriptionId')) {
    const subscription = await SubscriptionModel.findById(this.subscriptionId, null, { readPreference: 'primary' });
    if (!subscription) {
      return next(new Error('Subscription not found'));
    }

    const allocatedCount = await UserModel.countDocuments({ subscriptionId: this.subscriptionId });
    if (allocatedCount >= subscription.seats) {
      return next(new Error('No available seats in this subscription'));
    }

    // If the user is new, add them to the allocatedStudents array in the Subscription
    if (!this._id) {
      subscription.allocatedStudents.push(this._id);
      await subscription.save();
    }
  }

  next();
});

UserSchema.methods.generateAuthToken = function () {
  const payload = { _id: this._id.toString(), eType: this.eType };
  return signAccessTokenUser(payload);
};

UserSchema.statics.findByCredentials = async function (sEmail, sPassword) {
  const query = validateEmail(sEmail) ? { sEmail: sEmail.toLowerCase().trim() } : { sPhone: sEmail.toLowerCase().trim() };

  const user = await UserModel.findOne(query, null, { readPreference: 'primary' }).select('+sPassword').exec();
  if (!user) return null;
  const isMatch = await bcrypt.compare(sPassword, user.sPassword);
  if (!isMatch) return null;
  return user;
};

UserSchema.statics.findByToken = async function (token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded._id, null, { readPreference: 'primary' }).lean();
    return user;
  } catch (err) {
    return null;
  }
};

UserSchema.virtual('oAiTutorLanguage', {
  ref: AiTutorLanguageModel,
  localField: 'iAiTutorLanguageId',
  foreignField: '_id',
  justOne: true
});

const UserModel = UsersDBConnect.model('users', UserSchema);

UserModel.syncIndexes()
  .then(() => console.log('User Model Indexes Synced'))
  .catch((err) => console.log('User Model Indexes Sync Error', err));

module.exports = UserModel;
