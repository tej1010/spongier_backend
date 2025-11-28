const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { eStatus } = require('../../data');
const { UsersDBConnect } = require('../../database/mongoose');

const SchoolSchema = new Schema({
  sName: {
    type: String,
    required: true,
    trim: true
  },

  sAddress: {
    type: String,
    trim: true
  },

  sCity: {
    type: String,
    trim: true
  },

  sState: {
    type: String,
    trim: true
  },

  sCountry: {
    type: String,
    trim: true
  },

  sPhone: {
    type: String,
    trim: true
  },

  sEmail: {
    type: String,
    trim: true,
    lowercase: true
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
  }
}, {
  timestamps: {
    createdAt: 'dCreatedAt',
    updatedAt: 'dUpdatedAt'
  }
});

const SchoolModel = UsersDBConnect.model('schools', SchoolSchema);

SchoolModel.syncIndexes()
  .then(() => console.log('School Model Indexes Synced'))
  .catch((err) => console.log('School Model Indexes Sync Error', err));

module.exports = SchoolModel;
