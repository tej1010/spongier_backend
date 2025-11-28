const OrderModel = require('../payment/model');
const SubscriptionModel = require('./model');
const InvoiceModel = require('./invoice/model');
const UserModel = require('../user/model');
const { ePaymentStatus, eSubscriptionType, eBillingCycle } = require('../../data');
const SubscriptionPlanModel = require('./subscriptionPlan/model');
const { UsersDBConnect } = require('../../database/mongoose');
const { handleCatchError } = require('../../helper/utilities.services');

async function createOrUpdateUserSubscription (data) {
  const session = await UsersDBConnect.startSession();
  try {
    const { iReferenceId, iInvoiceId, iUserId, iPriceId, iProductId, nAmount, dTrialStartDate, dTrialEndDate, sUrl, sStatus, ePaymentGateway } = data;

    session.startTransaction({
      readPreference: 'primary',
      readConcern: { level: 'majority' },
      writeConcern: { w: 'majority' }
    });

    // const oOrder = await OrderModel.findOne({ iReferenceId }).lean().session(session);
    // if (!oOrder) {
    //   await session.abortTransaction();
    //   return { bSuccess: false };
    // }

    if (sStatus === 'SUCCESS') {
      const oInvoice = await InvoiceModel.findOne({ iInvoiceId, ePaymentGateway }).lean().session(session);
      if (oInvoice) {
        await session.commitTransaction();
        return { bSuccess: true };
      }

      let oSubscription = await SubscriptionModel.findOne({ iUserId, iReferenceId }).lean().session(session);
      if (oSubscription) {
        await SubscriptionModel.updateOne({ iUserId, iReferenceId }, { dTrialStartDate, dTrialEndDate }).session(session);
      } else {
        const oSubscriptionPlan = await SubscriptionPlanModel.findOne({ iStripeProductId: iProductId, iStripePriceId: iPriceId }, { __v: 0, dCreatedAt: 0, dUpdatedAt: 0 }).lean().session(session);

        const iSubscriptionPlanId = oSubscriptionPlan?._id;

        const oPlanDetails = { ...oSubscriptionPlan, _id: undefined };

        const [createdSubscription] = await SubscriptionModel.create([{
          iUserId,
          iReferenceId,
          dTrialStartDate,
          dTrialEndDate,
          iSubscriptionPlanId,
          ePaymentGateway,
          ...oPlanDetails
        }], { session });

        oSubscription = createdSubscription;
      }

      await InvoiceModel.create([{
        iUserId: iUserId,
        iInvoiceId,
        dStartDate: dTrialStartDate,
        dEndDate: dTrialEndDate,
        nAmount,
        sUrl,
        ePaymentGateway,
        iSubscriptionId: oSubscription?._id
      }], { session });

      await UserModel.updateOne({ _id: iUserId }, { iSubscriptionId: oSubscription?._id }).session(session);

      // await OrderModel.updateOne({ _id: oOrder._id }, { eStatus: ePaymentStatus.map.SUCCESS }).session(session);

      await session.commitTransaction();
      return { bSuccess: true };
    } else if (sStatus === 'FAILED') {
      // if (oOrder?.ePaymentStatus === ePaymentStatus.map.SUCCESS) {
      //   await session.commitTransaction();
      //   return { bSuccess: true };
      // }

      // await OrderModel.updateOne({ _id: oOrder._id }, { eStatus: ePaymentStatus.map.FAILED }).session(session);

      await session.commitTransaction();
      return { bSuccess: true };
    } else {
      await session.abortTransaction();
      return { bSuccess: false };
    }
  } catch (error) {
    handleCatchError(error);
    await session.abortTransaction();
    return { bSuccess: false };
  } finally {
    await session.endSession();
  }
}

async function updateOrder (data) {
  const session = await UsersDBConnect.startSession();
  try {
    const { iReferenceId, sStatus, iSubscriptionId } = data;

    session.startTransaction({
      readPreference: 'primary',
      readConcern: { level: 'majority' },
      writeConcern: { w: 'majority' }
    });

    const oOrder = await OrderModel.findOne({ iReferenceId }).lean().session(session);
    if (!oOrder) {
      await session.abortTransaction();
      return { bSuccess: false };
    }

    if (oOrder?.ePaymentStatus === ePaymentStatus.map.SUCCESS) {
      await session.abortTransaction();
      return { bSuccess: true };
    }

    if (sStatus === 'SUCCESS') {
      await OrderModel.updateOne({ _id: oOrder._id }, { ePaymentStatus: ePaymentStatus.map.SUCCESS, iExternalSubscriptionId: iSubscriptionId }).session(session);

      await session.commitTransaction();
      return { bSuccess: true };
    } else if (sStatus === 'FAILED') {
      await OrderModel.updateOne({ _id: oOrder._id }, { ePaymentStatus: ePaymentStatus.map.FAILED }).session(session);

      await session.commitTransaction();
      return { bSuccess: true };
    } else {
      await session.abortTransaction();
      return { bSuccess: false };
    }
  } catch (error) {
    handleCatchError(error);
    await session.abortTransaction();
    return { bSuccess: false };
  } finally {
    await session.endSession();
  }
}

async function createFreemiumUserSubscription (data) {
  try {
    const { iUserId } = data;

    const oUserSubscription = await SubscriptionModel.findOne({ iUserId, $or: [{ dTrialEndDate: { $gte: new Date() } }, { eType: eSubscriptionType.map.FREEMIUM }] }).lean();
    if (oUserSubscription) return null;

    // TODO: Need to figure out if there is country specific freemium plan
    const oSubscriptionPlan = await SubscriptionPlanModel.findOne({ eType: eSubscriptionType.map.FREEMIUM }).lean();
    if (!oSubscriptionPlan) return null;

    const oSubscription = { ...oSubscriptionPlan, _id: undefined };
    const dTrialStartDate = new Date();
    const dTrialEndDate = new Date();
    if (oSubscription?.eBillingCycle === eBillingCycle.map.DAY) dTrialEndDate.setDate(dTrialEndDate.getDate() + oSubscription?.nBillingInterval);
    if (oSubscription?.eBillingCycle === eBillingCycle.map.MONTHLY) dTrialEndDate.setMonth(dTrialEndDate.getMonth() + oSubscription?.nBillingInterval);
    if (oSubscription?.eBillingCycle === eBillingCycle.map.YEARLY) dTrialEndDate.setFullYear(dTrialEndDate.getFullYear() + oSubscription?.nBillingInterval);

    const createdSubscription = await SubscriptionModel.create({
      iUserId,
      dTrialStartDate,
      dTrialEndDate,
      iSubscriptionPlanId: oSubscriptionPlan?._id,
      ...oSubscription
    });

    return createdSubscription;
  } catch (error) {
    handleCatchError(error);
    return null;
  }
}

module.exports = {
  createOrUpdateUserSubscription,
  updateOrder,
  createFreemiumUserSubscription
};
