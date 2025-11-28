// transaction.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { ePaymentMethod, ePaymentStatus } = require('../../data');
const { UsersDBConnect } = require('../../database/mongoose');

const TransactionSchema = new Schema({
  // User who initiated the transaction
  iUserId: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: true
  },

  // For premium subscription purchases
  eContext: {
    type: String,
    enum: ['subscription'],
    required: true,
    default: 'subscription'
  },

  // Client-generated or gateway-generated idempotency key/reference
  sReferenceId: {
    type: String,
    required: true,
    index: true
  },

  // Payment gateway information
  oGateway: {
    sProvider: { type: String, trim: true }, // e.g., stripe, razorpay
    sPaymentIntentId: { type: String, index: true },
    sOrderId: { type: String },
    sSignature: { type: String }
  },

  // Status lifecycle
  eStatus: {
    type: String,
    enum: ePaymentStatus.value,
    default: ePaymentStatus.map.PENDING
  },

  // Payment details
  oPayment: {
    eMethod: { type: String, enum: ePaymentMethod.value },
    nAmount: { type: Number }, // in smallest currency unit
    sCurrency: { type: String, default: 'INR' },
    dPaymentDate: { type: Date }
  }
}, {
  timestamps: {
    createdAt: 'dCreatedAt',
    updatedAt: 'dUpdatedAt'
  }
});

TransactionSchema.index({ iUserId: 1, sReferenceId: 1 }, { unique: true });

const TransactionModel = UsersDBConnect.model('transactions', TransactionSchema);

module.exports = TransactionModel;
