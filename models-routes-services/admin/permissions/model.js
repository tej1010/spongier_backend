const mongoose = require('mongoose');
const { AdminsDBConnect } = require('../../../database/mongoose');

const Schema = mongoose.Schema;

const data = require('../../../data');

const PermissionSchema = new Schema({
  sName: { type: String, required: true, trim: true },
  sKey: { type: String, required: true, unique: true, trim: true, lowercase: true },
  eType: { type: String, enum: data.eAdminPermission.value, default: data.eAdminPermission.map.READ },
  eStatus: { type: String, enum: ['Y', 'N'], default: 'Y' }
}, {
  timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' }
});

const PermissionModel = AdminsDBConnect.model('permissions', PermissionSchema);

PermissionModel.syncIndexes()
  .then(() => console.log('Admin Permission Model Indexes Synced'))
  .catch((err) => console.log('Admin Permission Model Indexes Sync Error', err));

module.exports = PermissionModel;
