const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { UsersDBConnect } = require('../../database/mongoose');
const { eActiveStatus } = require('../../data');

const Country = new Schema(
  {
    id: { type: Number },
    sName: { type: String, trim: true },
    sCode: { type: String, trim: true },
    eStatus: { type: String, enums: eActiveStatus.value, default: eActiveStatus.map.ACTIVE },
    sCurrency: { type: String },
    sCurrencySymbol: { type: String }
  },
  { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } }
);

const CountryModel = UsersDBConnect.model('countries', Country);

module.exports = CountryModel;
