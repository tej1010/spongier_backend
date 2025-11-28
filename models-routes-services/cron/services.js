const AITutorSessionModel = require('../aiTutor/AiTutorSessionModel');
const OrderModel = require('../payment/model');
const { handleServiceError, handleCatchError } = require('../../helper/utilities.services');
const { messages, status } = require('../../helper/api.responses');
const { eAITutorStatus, ePaymentStatus, ePaymentGateway } = require('../../data');
const { listActiveSessions } = require('../aiTutor/heyGenCommon');
const { fetchStripeSession, fetchStipeInvoice, formatInvoiceResponse } = require('../payment/stripeCommon');
const { updateOrder, createOrUpdateUserSubscription } = require('../subscription/common');

async function updateStatusAITutorSession (req, res) {
  try {
    const lang = req.userLanguage;

    const aHeyGenSession = await listActiveSessions();

    if (aHeyGenSession.bSuccess) {
      const aSessionId = aHeyGenSession?.oResponse?.map((oSession) => oSession.session_id);

      const aAITutorSession = await AITutorSessionModel.find({ iExternalSessionId: { $nin: aSessionId }, eStatus: { $in: [eAITutorStatus.map.ACTIVE, eAITutorStatus.map.INITIATED] } }).lean();

      const aAITutorSessionId = aAITutorSession.map((oSession) => oSession._id);

      await AITutorSessionModel.updateMany({ _id: { $in: aAITutorSessionId } }, { eStatus: eAITutorStatus.map.CLOSED, dEndedAt: new Date() });
    }

    return res.status(status.OK).json({ success: true, message: messages[lang].sessionStopped });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
}

async function updatePaymentStatus (req, res) {
  try {
    // From 5 min to Last 24 hours orders
    const dStartDate = new Date(new Date().getTime() - 5 * 60 * 1000);
    const dEndDate = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);

    const oQuery = {
      ePaymentStatus: ePaymentStatus.map.PENDING,
      dCreatedAt: { $gte: dStartDate, $lte: dEndDate },
      ePaymentGateway: { $ne: ePaymentGateway.map.ADMIN }
    };
    const aOrder = await OrderModel.find(oQuery).lean();

    for (const oOrder of aOrder) {
      try {
        // check in stripe session
        if (oOrder.ePaymentGateway === ePaymentGateway.map.STRIPE) {
          const oStripeSession = await fetchStripeSession(oOrder.iReferenceId);
          if (oStripeSession.bSuccess) {
            const oResponse = oStripeSession.oResponse;
            if (oResponse?.status === 'complete' && oResponse?.payment_status === 'paid') {
              const oData = {
                iReferenceId: oResponse?.id,
                sStatus: 'SUCCESS',
                iSubscriptionId: oResponse?.subscription
              };

              await updateOrder(oData);

              const oInvoice = await fetchStipeInvoice(oResponse?.invoice);
              if (oInvoice?.bSuccess && oInvoice?.oResponse?.status === 'paid') {
                const oData = formatInvoiceResponse(oInvoice?.oResponse);
                await createOrUpdateUserSubscription(oData);
              }
            } else if (oResponse?.status === 'expired') {
              const oData = { iReferenceId: oResponse?.id, sStatus: 'FAILED' };
              await updateOrder(oData);
            }
          }
        }
      } catch (error) {
        handleCatchError(error);
      }
    }

    return res.status(status.OK).json({ success: true, message: messages[req.userLanguage].subscriptionUpdated });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
}

module.exports = {
  updateStatusAITutorSession,
  updatePaymentStatus
};
