// transaction.services.js
const TransactionModel = require('./model');
const SubscriptionModel = require('../subscription/model');
const UserModel = require('../user/model');
const { ePaymentStatus, eSubscriptionPlan } = require('../../data');
const { status } = require('../../helper/api.responses');
const { handleServiceError, createResponse } = require('../../helper/utilities.services');

// Create a pending transaction intent
const createIntent = async (req, res) => {
  const { nAmount, sCurrency = 'INR', sReferenceId, ePaymentMethod, eContext = 'subscription' } = req.body;
  try {
    // Idempotent by (user, reference)
    const existing = await TransactionModel.findOne({ iUserId: req.user?._id, sReferenceId }).read('primary');
    if (existing) {
      return createResponse({ req, res, statusCode: status.OK, messageKey: 'success', data: { transaction: existing } });
    }

    const transaction = await TransactionModel.create({
      iUserId: req.user?._id,
      eContext,
      sReferenceId,
      eStatus: ePaymentStatus.map.PENDING,
      oPayment: { eMethod: ePaymentMethod, nAmount, sCurrency }
    });

    return createResponse({ req, res, statusCode: status.OK, messageKey: 'success', data: { transaction } });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'error' });
  }
};

// Webhook to update transaction and, on success, provision premium subscription
const webhook = async (req, res) => {
  const { sProvider, data } = req.body;
  try {
    // Minimal generic handling; assume data contains: sReferenceId, sPaymentIntentId, nAmount, eStatus
    const { sReferenceId, sPaymentIntentId, nAmount, eStatus: paymentStatus, iUserId } = data || {};
    const transaction = await TransactionModel.findOne({ sReferenceId }).read('primary');
    if (!transaction) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'not_found' });
    }

    // Update gateway fields and status
    transaction.oGateway = {
      ...(transaction.oGateway || {}),
      sProvider,
      sPaymentIntentId
    };
    if (typeof nAmount === 'number') transaction.oPayment.nAmount = nAmount;
    transaction.eStatus = paymentStatus;
    if (paymentStatus === ePaymentStatus.map.SUCCESS) {
      transaction.oPayment.dPaymentDate = new Date();
    }
    await transaction.save();

    // On success and subscription context: create premium subscription and link user
    if (paymentStatus === ePaymentStatus.map.SUCCESS && transaction.eContext === 'subscription') {
      const userId = transaction.iUserId || iUserId;
      const session = await SubscriptionModel.db.startSession();
      await session.withTransaction(async () => {
        const subscription = new SubscriptionModel({
          iUserId: userId,
          ePlan: eSubscriptionPlan.map.PREMIUM,
          nSeats: 1,
          eStatus: ePaymentStatus.map.SUCCESS,
          dTrialEndDate: null,
          dTenewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          oPaymentDetails: {
            ePaymentMethod: transaction.oPayment.eMethod,
            sTransactionId: transaction.oGateway?.sPaymentIntentId || transaction._id.toString(),
            nPaymentAmount: transaction.oPayment.nAmount,
            dPaymentDate: transaction.oPayment.dPaymentDate || new Date()
          }
        });

        await subscription.save({ session });
        await UserModel.findByIdAndUpdate(userId, { iSubscriptionId: subscription._id }, { new: true, session });
      }, {
        readPreference: 'primary',
        readConcern: { level: 'local' },
        writeConcern: { w: 'majority' }
      });
      session.endSession();
    }

    return createResponse({ req, res, statusCode: status.OK, messageKey: 'success', data: { transaction } });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'error' });
  }
};

module.exports = { createIntent, webhook };
