const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { UsersDBConnect } = require('../../../database/mongoose');
const { ePaymentGateway } = require('../../../data');

const InvoiceSchema = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: 'users', required: true },
  iInvoiceId: { type: String, required: true },
  ePaymentGateway: { type: String, enum: ePaymentGateway.value, default: ePaymentGateway.default },
  dStartDate: { type: Date },
  dEndDate: { type: Date },
  nAmount: { type: Number, required: true },
  sUrl: { type: String },
  iSubscriptionId: { type: Schema.Types.ObjectId, required: true }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } });

InvoiceSchema.index({ iInvoiceId: 1, ePaymentGateway: 1 }, { unique: true });

const InvoiceModel = UsersDBConnect.model('invoices', InvoiceSchema);

InvoiceModel.syncIndexes()
  .then(() => console.log('InvoiceModel Indexes Synced'))
  .catch((err) => console.log('InvoiceModel Indexes Sync Error', err));

module.exports = InvoiceModel;
