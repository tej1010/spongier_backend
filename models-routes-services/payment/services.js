const { status, messages } = require('../../helper/api.responses');
const { handleServiceError } = require('../../helper/utilities.services');
const { stripWebhookEventConstruct, formatInvoiceResponse, fetchStipeInvoice, fetchStripeSession } = require('./stripeCommon');
// const SubscriptionPlanModel = require('../subscription/subscriptionPlan/model');
// const UserModel = require('../user/model');
const OrderModel = require('./model');
const { createOrUpdateUserSubscription, updateOrder } = require('../subscription/common');
const data = require('../../data');

async function stripWebhook (req, res) {
  try {
    const sSignature = req.headers['stripe-signature'];

    const oEvent = await stripWebhookEventConstruct(req.body, sSignature);

    switch (oEvent?.oResponse?.type) {
      case 'checkout.session.completed': {
        const session = oEvent?.oResponse?.data?.object;
        const sStatus = session?.payment_status === 'paid' ? 'SUCCESS' : 'FAILED';
        const oData = {
          iReferenceId: session?.id,
          sStatus,
          iSubscriptionId: session?.subscription

        };
        await updateOrder(oData);

        if (session?.invoice) {
          const oInvoice = await fetchStipeInvoice(session?.invoice);
          if (oInvoice?.bSuccess && oInvoice?.oResponse?.status === 'paid') {
            const oData = formatInvoiceResponse(oInvoice?.oResponse);

            await createOrUpdateUserSubscription(oData);
          }
        }
      }
        break;

      // case 'customer.subscription.created': {
      //   const subscription = oEvent?.oResponse?.data?.object;
      // }
      //   break;
      case 'invoice.payment_succeeded': {
        const invoice = oEvent?.oResponse?.data?.object;

        const oData = formatInvoiceResponse(invoice);

        await createOrUpdateUserSubscription(oData);
      }

        break;
        // case 'invoice.payment_failed': {
        //   const invoice = oEvent?.oResponse?.data?.object;

        // const oData = {
        //   iReferenceId: invoice?.parent?.subscription_details?.subscription,
        //   sStatus: 'FAILED'
        // };
        // await createOrUpdateUserSubscription(oData);
        // }
        // break;
      default:
        console.log(`Unhandled event type ${oEvent?.oResponse?.type}`);
    }

    return res.status(status.OK).json({ success: true });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
}

async function checkUserPaymentStatus (req, res) {
  try {
    const { id } = req.params;
    const iUserId = req.user._id;

    const oOrder = await OrderModel.findOne({ iReferenceId: id, iUserId }, {}, { readPreference: 'primary' }).lean();
    if (!oOrder) {
      return res.status(status.NotFound).json({ success: false, message: messages[req.userLanguage].paymentOrderNotFound });
    }
    let { ePaymentStatus, ePaymentGateway } = oOrder;

    if (ePaymentStatus === data.ePaymentStatus.map.PENDING && ePaymentGateway !== data.ePaymentGateway.map.ADMIN) {
      if (ePaymentGateway === data.ePaymentGateway.map.STRIPE) {
        const oStripeSession = await fetchStripeSession(oOrder?.iReferenceId);

        if (oStripeSession.bSuccess) {
          const oResponse = oStripeSession.oResponse;

          if (oResponse?.status === 'complete' && oResponse?.payment_status === 'paid') {
            const oData = { iReferenceId: oResponse?.id, sStatus: 'SUCCESS', iSubscriptionId: oResponse?.subscription };
            await updateOrder(oData);

            const oInvoice = await fetchStipeInvoice(oResponse?.invoice);

            if (oInvoice?.bSuccess && oInvoice?.oResponse?.status === 'paid') {
              const oData = formatInvoiceResponse(oInvoice?.oResponse);
              const oSubscription = await createOrUpdateUserSubscription(oData);

              if (oSubscription?.bSuccess) {
                ePaymentStatus = data.ePaymentStatus.map.SUCCESS;
              }
            }
          } else if (oResponse?.status === 'expired') {
            const oData = { iReferenceId: oResponse?.id, sStatus: 'FAILED' };
            await updateOrder(oData);
            ePaymentStatus = data.ePaymentStatus.map.FAILED;
          }
        }
      }
      return res.status(status.OK).json({ success: true, message: messages[req.userLanguage].orderFetchedSuccessfully, data: { ...oOrder, ePaymentStatus } });
    }

    return res.status(status.OK).json({ success: true, message: messages[req.userLanguage].orderFetchedSuccessfully, data: oOrder });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
}

module.exports = {
  stripWebhook,
  checkUserPaymentStatus
};
