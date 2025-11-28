// subscription.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { eBillingType, eBillingCycle, eSubscriptionType, ePaymentGateway } = require('../../data');
const { UsersDBConnect } = require('../../database/mongoose');

const SubscriptionSchema = new Schema({
  // User associated with the subscription (School Admin, Teacher, etc.)
  iUserId: { type: Schema.Types.ObjectId, ref: 'users', required: true },
  nSeats: { type: Number },
  eType: { type: String, enum: eSubscriptionType.value, default: eSubscriptionType.default },
  dTrialStartDate: { type: Date },
  dTrialEndDate: { type: Date },
  iSubscriptionPlanId: { type: Schema.Types.ObjectId },
  iReferenceId: { type: String },
  sName: { type: String },
  sDescription: { type: String },
  nPrice: { type: Number },
  nDiscount: { type: Number },
  aBaseFeature: [{ type: String }],
  aPremiumFeature: [{ type: String }],
  sCountry: { type: String },
  sCountryCode: { type: String },
  sCurrency: { type: String },
  sCurrencySymbol: { type: String },
  sPaymentMethod: { type: String },
  ePaymentGateway: { type: String, enum: ePaymentGateway.value, default: ePaymentGateway.default },
  eBillingType: { type: String, enum: eBillingType.value, default: eBillingType.default },
  eBillingCycle: { type: String, enum: eBillingCycle.value, default: eBillingCycle.default },
  nBillingInterval: { type: Number, default: 1 },
  iStripePriceId: { type: String },
  iStripeProductId: { type: String }
}, {
  timestamps: {
    createdAt: 'dCreatedAt',
    updatedAt: 'dUpdatedAt'
  }
});

// Virtual to get students linked to a subscription (reverse lookup)
SubscriptionSchema.virtual('students', {
  ref: 'users',
  localField: '_id',
  foreignField: 'iSubscriptionId',
  justOne: false
});

// Sync indexes for efficient querying
SubscriptionSchema.index({ iUserId: 1 });

const SubscriptionModel = UsersDBConnect.model('subscriptions', SubscriptionSchema);

SubscriptionModel.syncIndexes()
  .then(() => console.log('Subscription Model Indexes Synced'))
  .catch((err) => console.log('Subscription Model Indexes Sync Error', err));

module.exports = SubscriptionModel;
