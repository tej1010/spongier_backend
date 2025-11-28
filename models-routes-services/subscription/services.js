// subscription.services.js
const SubscriptionModel = require('./model');
const UserModel = require('../user/model');
const { eSubscriptionPlan, ePaymentStatus, ePaymentGateway, eBillingCycle } = require('../../data');
const { status, messages } = require('../../helper/api.responses');
const { handleServiceError, createResponse } = require('../../helper/utilities.services');
const SubscriptionPlanModel = require('./subscriptionPlan/model');
const OrderModel = require('../payment/model');
const { createSubscription, checkCustomer, cancelStripeSubscription } = require('../payment/stripeCommon');
const { eSubscriptionType } = require('../../data');
// const { generatePaymentId } = require('../../helper/paymentHelper'); // Helper function to generate payment ID (to be implemented)

// Unified subscription handler that automatically handles freemium and premium based on ePlan
const handleUnifiedSubscription = async (req, res) => {
  const { iUserId, ePlan, nSeats = 1, sTransactionId, nAmount, eStatus, ePaymentMethod } = req.body; // Default nSeats to 1

  try {
    const session = await SubscriptionModel.db.startSession();
    let response;
    await session.withTransaction(async () => {
      // Presence/format validations are enforced by validators

      // Find the user
      const user = await UserModel.findById(iUserId).session(session).read('primary');
      if (!user) {
        response = createResponse({ req, res, statusCode: status.BadRequest, messageKey: 'userNotFound' });
        await session.abortTransaction();
        return;
      }

      // Handle Premium Plan
      if (ePlan === eSubscriptionPlan.map.PREMIUM) {
        const subscription = new SubscriptionModel({
          iUserId,
          ePlan,
          nSeats,
          eStatus: eStatus,
          dTrialEndDate: null,
          dTenewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          oPaymentDetails: {
            ePaymentMethod,
            sTransactionId,
            nPaymentAmount: nAmount,
            dPaymentDate: new Date()
          }
        });

        await subscription.save({ session });

        // Update payment status to success for premium
        subscription.eStatus = ePaymentStatus.map.SUCCESS;
        await subscription.save({ session });

        // Link subscriptionId with the user
        user.iSubscriptionId = subscription._id;
        await user.save({ session });

        response = createResponse({
          req,
          res,
          statusCode: status.OK,
          messageKey: 'premiumSubscriptionCreated',
          data: { subscription }
        });
        return;
      }

      // Handle Freemium Plan
      if (ePlan === eSubscriptionPlan.map.FREEMIUM) {
        const subscription = new SubscriptionModel({
          iUserId,
          ePlan,
          nSeats,
          eStatus: ePaymentStatus.map.PENDING,
          dTrialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          dTenewalDate: null
        });

        await subscription.save({ session });

        // Link subscriptionId with the user
        user.iSubscriptionId = subscription._id;
        await user.save({ session });

        response = createResponse({
          req,
          res,
          statusCode: status.OK,
          messageKey: 'freemiumSubscriptionCreated',
          data: { subscription }
        });
      }
    }, {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' }
    });
    session.endSession();
    if (response) return response;
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'errorCreatingSubscription' });
  }
};

const premiumSubscription = async (req, res) => {
  const { sTransactionId, nAmount, eStatus, ePaymentMethod } = req.body; // Default nSeats to 1

  try {
    const session = await SubscriptionModel.db.startSession();
    let response;
    await session.withTransaction(async () => {
      const subscription = new SubscriptionModel({
        iUserId: req.user._id,
        ePlan: eSubscriptionPlan.map.PREMIUM,
        nSeats: 1,
        eStatus: eStatus,
        dTrialEndDate: null,
        dTenewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        oPaymentDetails: {
          ePaymentMethod,
          sTransactionId,
          nPaymentAmount: nAmount,
          dPaymentDate: new Date()
        }
      });

      await subscription.save({ session });

      // Update payment status to success
      subscription.eStatus = ePaymentStatus.map.SUCCESS;
      await subscription.save({ session });

      // Link subscriptionId with the user
      await UserModel.findByIdAndUpdate(
        req.user._id,
        { iSubscriptionId: subscription._id },
        { new: true, session }
      );

      response = createResponse({
        req,
        res,
        statusCode: status.OK,
        messageKey: 'premiumSubscriptionCreated',
        data: { subscription }
      });
    }, {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' }
    });
    session.endSession();
    if (response) return response;
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'errorCreatingSubscription' });
  }
};

async function userSubscription (req, res) {
  try {
    const lang = req?.userLanguage;
    const { iSubscriptionId, sUrl } = req.body;
    const iUserId = req.user._id.toString();

    const oSubscription = await SubscriptionPlanModel.findOne({ _id: iSubscriptionId }, { __v: 0, dCreatedAt: 0, dUpdatedAt: 0 }).lean();
    if (!oSubscription) return res.status(status.BadRequest).json({ success: false, message: messages[lang].subscriptionPlanNotFound });

    const oUser = await UserModel.findOne({ _id: iUserId }).lean();
    if (!oUser) return res.status(status.BadRequest).json({ success: false, message: messages[lang].userNotFound });

    const oUserSubscription = await SubscriptionModel.findOne({ iUserId, dTrialEndDate: { $gte: new Date() } }).lean();
    if (oUserSubscription) {
      return res.status(status.BadRequest).json({ success: false, message: messages[lang].subscriptionAlreadyExists });
    }

    if (oSubscription?.eType === eSubscriptionType.map.FREEMIUM) {
      const oFreeSubscription = await SubscriptionModel.findOne({ iUserId, eType: eSubscriptionType.map.FREEMIUM }).lean();
      if (oFreeSubscription) {
        return res.status(status.BadRequest).json({ success: false, message: messages[lang].subscriptionAlreadyUsedFreeTrial });
      }

      const oSubscriptionPlan = { ...oSubscription, _id: undefined };
      const dTrialStartDate = new Date();
      const dTrialEndDate = new Date();
      if (oSubscription?.eBillingCycle === eBillingCycle.map.DAY) dTrialEndDate.setDate(dTrialEndDate.getDate() + oSubscription?.nBillingInterval);
      if (oSubscription?.eBillingCycle === eBillingCycle.map.MONTHLY) dTrialEndDate.setMonth(dTrialEndDate.getMonth() + oSubscription?.nBillingInterval);
      if (oSubscription?.eBillingCycle === eBillingCycle.map.YEARLY) dTrialEndDate.setFullYear(dTrialEndDate.getFullYear() + oSubscription?.nBillingInterval);

      const data = await SubscriptionModel.create({
        iUserId,
        dTrialStartDate,
        dTrialEndDate,
        iSubscriptionPlanId: oSubscription?._id,
        ...oSubscriptionPlan
      });

      return res.status(status.OK).json({ success: true, message: messages[lang].subscriptionCreatedSuccessfully, data });
    }

    const oCustomer = await checkCustomer({
      sName: oUser?.sName, sEmail: oUser?.sEmail, iUserId: oUser?._id?.toString(), sPhone: oUser?.sPhone
    });

    if (!oCustomer.bSuccess) {
      return res.status(status.BadRequest).json({ success: false, message: messages[lang].somethingWentWrong });
    }

    const payload = {
      ePaymentGateway: 'STRIPE',
      nAmount: oSubscription?.nPrice,
      iSubscriptionPlanId: iSubscriptionId,
      sSubscriptionName: oSubscription?.sName,
      sCurrency: oSubscription?.sCurrency,
      sCurrencySymbol: oSubscription?.sCurrencySymbol,
      iUserId,
      iStripePriceId: oSubscription?.iStripePriceId,
      iStripeProductId: oSubscription?.iStripeProductId
    };

    const oOrder = new OrderModel(payload);

    const oData = await createSubscription({
      iCustomerId: oUser?._id?.toString(),
      iPriceId: oSubscription?.iStripePriceId,
      sUrl
    });

    if (!oData.bSuccess) {
      return res.status(status.BadRequest).json({ success: false, message: messages[lang].somethingWentWrong });
    }

    oOrder.iReferenceId = oData?.oResponse?.id;

    await oOrder.save();

    const data = {
      sUrl: oData?.oResponse?.url
    };

    return res.status(status.OK).json({ success: true, message: messages[lang].subscriptionCreatedSuccessfully, data });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
}

async function getUserSubscription (req, res) {
  try {
    const lang = req?.userLanguage;
    const iUserId = req.user._id.toString();

    const oUserSubscription = await SubscriptionModel.findOne({ iUserId, dTrialEndDate: { $gte: new Date() } }, { dTrialStartDate: 1, dTrialEndDate: 1, sName: 1, sDescription: 1, nPrice: 1, aBaseFeature: 1, aPremiumFeature: 1, sCountry: 1, sCountryCode: 1, sCurrency: 1, sCurrencySymbol: 1, eBillingCycle: 1 }).lean();
    if (!oUserSubscription) {
      return res.status(status.BadRequest).json({ success: false, message: messages[lang].subscriptionNotFound });
    }

    return res.status(status.OK).json({ success: true, message: messages[lang].subscriptionFound, data: oUserSubscription });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
}

async function cancelUserSubscription (req, res) {
  try {
    const lang = req?.userLanguage;

    const { iSubscriptionId } = req.body;

    const oUserSubscription = await SubscriptionModel.findOne({ _id: iSubscriptionId }, { dTrialStartDate: 1, dTrialEndDate: 1, sName: 1, sDescription: 1, nPrice: 1, aBaseFeature: 1, aPremiumFeature: 1, sCountry: 1, sCountryCode: 1, sCurrency: 1, sCurrencySymbol: 1, eBillingCycle: 1 }).lean();
    if (!oUserSubscription) {
      return res.status(status.BadRequest).json({ success: false, message: messages[lang].subscriptionNotFound });
    }

    if (oUserSubscription.ePaymentGateway === ePaymentGateway.map.STRIPE) {
      const oRes = await cancelStripeSubscription(oUserSubscription.iReferenceId);
      if (!oRes.bSuccess) {
        return res.status(status.BadRequest).json({ success: false, message: messages[lang].somethingWentWrong });
      }
    }

    return res.status(status.OK).json({ success: true, message: messages[lang].subscriptionCancelledAtEndOfPeriod, data: oUserSubscription });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
}

module.exports = { handleUnifiedSubscription, premiumSubscription, userSubscription, getUserSubscription, cancelUserSubscription };
