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

async function ensureModelIndexes(model) {
  if (!model) {
    console.warn('ensureModelIndexes: model is falsy, skipping index sync.');
    return;
  }

  if (process.env.OFFLINE_MODE === 'true') {
    console.log(`OFFLINE_MODE=true — skipping index operations for model "${model.modelName || 'unknown'}"`);
    return;
  }

  try {
    if (typeof model.syncIndexes === 'function') {
      await model.syncIndexes();
      console.log(`Indexes synced (syncIndexes) for model: ${model.modelName}`);
      return;
    }

    if (typeof model.createIndexes === 'function') {
      await model.createIndexes();
      console.log(`Indexes created (createIndexes) for model: ${model.modelName}`);
      return;
    }

    if (typeof model.ensureIndexes === 'function') {
      await model.ensureIndexes();
      console.log(`Indexes ensured (ensureIndexes) for model: ${model.modelName}`);
      return;
    }

    console.log(`No index sync method available for model: ${model.modelName}. Skipping index sync.`);
  } catch (err) {
    console.warn(`Index sync failed for model ${model.modelName}:`, err && err.message ? err.message : err);
  }
}

ensureModelIndexes(SubscriptionModel);

module.exports = SubscriptionModel;
