const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { UsersDBConnect } = require('../../../database/mongoose');
const { eActiveStatus, eBillingType, eBillingCycle, eSubscriptionType } = require('../../../data');
const CountryModel = require('../../county/model');

const SubscriptionPlanSchema = new Schema({
  sName: { type: String, required: true },
  sDescription: { type: String },
  eType: { type: String, enum: eSubscriptionType.value, default: eSubscriptionType.default },
  nPrice: { type: Number, required: true },
  nDiscount: { type: Number },
  bRecommended: { type: Boolean, default: false },
  aBaseFeature: [{ type: String }],
  aPremiumFeature: [{ type: String }],
  eStatus: { type: String, enum: eActiveStatus?.value, default: eActiveStatus.default },
  bDefault: { type: Boolean, default: false },
  iCountryId: { type: Schema.Types.ObjectId, ref: CountryModel },
  sCountry: { type: String },
  sCountryCode: { type: String },
  sCurrency: { type: String },
  sCurrencySymbol: { type: String },
  eBillingType: { type: String, enum: eBillingType.value, default: eBillingType.default },
  eBillingCycle: { type: String, enum: eBillingCycle.value, default: eBillingCycle.default },
  nBillingInterval: { type: Number, default: 1 },
  iStripePriceId: { type: String },
  iStripeProductId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } });

SubscriptionPlanSchema.index({ iStripeProductId: 1, iStripePriceId: 1 });

SubscriptionPlanSchema.virtual('oCountry', {
  ref: CountryModel,
  localField: 'iCountryId',
  foreignField: '_id',
  justOne: true
});

const SubscriptionPlanModel = UsersDBConnect.model('subscriptionplans', SubscriptionPlanSchema);

SubscriptionPlanModel.syncIndexes()
  .then(() => console.log('SubscriptionPlanModel Indexes Synced'))
  .catch((err) => console.log('SubscriptionPlanModel Indexes Sync Error', err));

module.exports = SubscriptionPlanModel;
