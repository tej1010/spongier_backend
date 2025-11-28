const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { signAccessToken } = require('../../helper/token.util');
const { AdminsDBConnect } = require('../../database/mongoose');

const Schema = mongoose.Schema;

const AdminSchema = new Schema({
  sName: { type: String, required: true, trim: true },
  sUsername: { type: String, required: true, unique: true, trim: true },
  sEmail: { type: String, required: true, unique: true, trim: true, lowercase: true },
  sMobNum: { type: String, trim: true },
  sLocation: { type: String, trim: true },
  sPassword: { type: String, required: true, select: false },
  eType: { type: String, enum: ['SUPER', 'SUB'], required: true, default: 'SUB' },
  eStatus: { type: String, enum: ['Y', 'N'], default: 'Y' },
  sResetToken: { type: String, select: false },
  aRole: [{ type: Schema.Types.ObjectId, ref: 'roles' }],
  aRefreshTokens: [{
    sToken: { type: String, unique: true, select: false },
    dExpiresAt: { type: Date, select: false },
    sUserAgent: { type: String, select: false },
    sIp: { type: String, select: false },
    dCreatedAt: { type: Date, default: Date.now, select: false }
  }]
}, {
  timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' }
});

// Add pagination plugin
AdminSchema.plugin(require('mongoose-paginate-v2'));

AdminSchema.pre('save', async function (next) {
  try {
    if (this.isModified('sPassword')) {
      this.sPassword = await bcrypt.hash(this.sPassword, 10);
    }
    return next();
  } catch (err) {
    return next(err);
  }
});

AdminSchema.methods.generateAuthToken = function () {
  const payload = { _id: this._id.toString(), eType: this.eType };
  return signAccessToken(payload);
};

AdminSchema.statics.findByCredentials = async function (sEmailOrUsername, sPassword) {
  const query = sEmailOrUsername.includes('@') ? { sEmail: sEmailOrUsername.toLowerCase().trim() } : { sUsername: sEmailOrUsername.trim() };
  const admin = await AdminModel.findOne(query).select('+sPassword').exec();
  if (!admin) return null;
  const isMatch = await bcrypt.compare(sPassword, admin.sPassword);
  if (!isMatch) return null;
  return admin;
};

AdminSchema.statics.findByToken = async function (token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await AdminModel.findById(decoded._id, null, { readPreference: 'primary' }).lean();
    return admin;
  } catch (err) {
    return null;
  }
};

const AdminModel = AdminsDBConnect.model('admins', AdminSchema);

AdminModel.syncIndexes()
  .then(() => console.log('Admin Model Indexes Synced'))
  .catch((err) => console.log('Admin Model Indexes Sync Error', err));

module.exports = AdminModel;
