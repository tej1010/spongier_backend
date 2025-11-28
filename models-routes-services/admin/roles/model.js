const mongoose = require('mongoose');
const { AdminsDBConnect } = require('../../../database/mongoose');

const Schema = mongoose.Schema;

const RoleSchema = new Schema({
  sName: { type: String, required: true, trim: true },
  sKey: { type: String, required: true, unique: true, trim: true, lowercase: true },
  aPermissions: [{ type: Schema.Types.ObjectId, ref: 'permissions' }],
  eStatus: { type: String, enum: ['Y', 'N'], default: 'Y' }
}, {
  timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' }
});

const RoleModel = AdminsDBConnect.model('roles', RoleSchema);

RoleModel.syncIndexes()
  .then(() => console.log('Admin Role Model Indexes Synced'))
  .catch((err) => console.log('Admin Role Model Indexes Sync Error', err));

module.exports = RoleModel;
