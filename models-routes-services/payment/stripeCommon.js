const Stripe = require('stripe');
const { handleCatchError } = require('../../helper/utilities.services');
const config = require('../../config/config');
const stripe = Stripe(config.STRIPE_KEY);
const endpointSecret = config.STRIPE_WEBHOOK_SECRET;
const { ePaymentGateway } = require('../../data');

async function createProduct () {
  try {
    const product = await stripe.products.create({
      id: 'Premium',
      name: 'Premium',
      description: 'Access to all premium content'
    });

    return { bSuccess: true, oResponse: product };
  } catch (error) {
    handleCatchError(error);
    return { bSuccess: false };
  }
}

async function createPrice (data) {
  try {
    const { iProductId = config.STRIPE_PRODUCT_ID, sCurrency, sInterval, nIntervalCount, nAmount } = data;
    const monthlyPrice = await stripe.prices.create({
      unit_amount: nAmount * 100, // 49900 ie Rs499
      currency: sCurrency,
      recurring: {
        interval: sInterval, // month
        interval_count: nIntervalCount || 1
      },
      product: iProductId
    });

    return { bSuccess: true, oResponse: monthlyPrice };
  } catch (error) {
    handleCatchError(error);
    return { bSuccess: false };
  }
}

async function findCustomer (iUserId) {
  try {
    const customer = await stripe.customers.retrieve(iUserId);

    return { bSuccess: true, oResponse: customer };
  } catch (error) {
    handleCatchError(error);
    return { bSuccess: false };
  }
}

async function createCustomer (data) {
  try {
    const { sName, sEmail, iUserId, sPhone } = data;
    const customer = await stripe.customers.create({
      id: iUserId,
      name: sName,
      email: sEmail,
      phone: sPhone
    });

    return { bSuccess: true, oResponse: customer };
  } catch (error) {
    handleCatchError(error);
    return { bSuccess: false };
  }
}

async function checkCustomer (data) {
  try {
    const { iUserId } = data;
    const oCustomer = await findCustomer(iUserId);
    if (oCustomer.bSuccess) return { bSuccess: true, oResponse: oCustomer };

    const oNewCustomer = await createCustomer(data);
    if (!oNewCustomer.bSuccess) return { bSuccess: false };

    return { bSuccess: true, oResponse: oNewCustomer };
  } catch (error) {
    handleCatchError(error);
    return { bSuccess: false };
  }
}

async function createSubscription (data) {
  try {
    const { iPriceId, iCustomerId, sUrl } = data;
    const subscription = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: iCustomerId,
      line_items: [
        {
          price: iPriceId,
          quantity: 1
        }
      ],
      success_url: `${sUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${sUrl}?session_id={CHECKOUT_SESSION_ID}`
    });

    return { bSuccess: true, oResponse: subscription };
  } catch (error) {
    handleCatchError(error);
    return { bSuccess: false };
  }
}

async function stripWebhookEventConstruct (oBody, sSignature) {
  try {
    const event = await stripe.webhooks.constructEvent(oBody, sSignature, endpointSecret);
    return { bSuccess: true, oResponse: event };
  } catch (error) {
    handleCatchError(error);
    return { bSuccess: false };
  }
}

async function fetchStipeInvoice (iInvoiceId) {
  try {
    const res = await stripe.invoices.retrieve(iInvoiceId);

    return { bSuccess: true, oResponse: res };
  } catch (error) {
    handleCatchError(error);
    return { bSuccess: false };
  }
}

function formatInvoiceResponse (oInvoice) {
  const dStartDate = oInvoice?.lines?.data?.[0]?.period?.start;
  const dEndDate = oInvoice?.lines?.data?.[0]?.period?.end;
  const iPriceId = oInvoice?.lines?.data?.[0]?.pricing?.price_details?.price;
  const iProductId = oInvoice?.lines?.data?.[0]?.pricing?.price_details?.product;
  const nAmount = oInvoice?.amount_paid / 100;

  return {
    iReferenceId: oInvoice?.parent?.subscription_details?.subscription,
    iInvoiceId: oInvoice?.id,
    iUserId: oInvoice?.customer,
    iPriceId,
    iProductId,
    nAmount,
    ePaymentGateway: ePaymentGateway.map.STRIPE,
    dTrialStartDate: dStartDate ? new Date(dStartDate * 1000) : null,
    dTrialEndDate: dEndDate ? new Date(dEndDate * 1000) : null,
    sUrl: oInvoice?.invoice_pdf,
    sStatus: 'SUCCESS'
  };
}

async function cancelStripeSubscription (iSubscriptionId) {
  try {
    const res = await await stripe.subscriptions.update(iSubscriptionId, {
      cancel_at_period_end: true
    });

    return { bSuccess: true, oResponse: res };
  } catch (error) {
    handleCatchError(error);
    return { bSuccess: false };
  }
}

async function fetchStripeSession (iSessionId) {
  try {
    const res = await stripe.checkout.sessions.retrieve(iSessionId);
    return { bSuccess: true, oResponse: res };
  } catch (error) {
    handleCatchError(error);
    return { bSuccess: false };
  }
}

module.exports = {
  createProduct,
  createPrice,
  createCustomer,
  createSubscription,
  stripWebhookEventConstruct,
  checkCustomer,
  fetchStipeInvoice,
  formatInvoiceResponse,
  cancelStripeSubscription,
  fetchStripeSession
};
