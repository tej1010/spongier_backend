const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { UsersDBConnect } = require('../../database/mongoose');
const { ePaymentStatus, ePaymentGateway } = require('../../data');

const Order = new Schema({
  iUserId: { type: Schema.Types.ObjectId, required: true },
  ePaymentStatus: { type: String, enum: ePaymentStatus.value, default: ePaymentStatus.default }, // ['P', 'S', 'F', 'R']
  nAmount: { type: Number, required: true },
  ePaymentGateway: { type: String, enum: ePaymentGateway.value, default: ePaymentGateway.default },
  iSubscriptionPlanId: { type: Schema.Types.ObjectId, required: true },
  sCurrency: { type: String, required: true },
  sCurrencySymbol: { type: String },
  iStripePriceId: { type: String },
  iStripeProductId: { type: String },
  iReferenceId: { type: String },
  iExternalSubscriptionId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } });

const OrderModel = UsersDBConnect.model('order', Order);

module.exports = OrderModel;
