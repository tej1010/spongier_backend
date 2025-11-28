const { status, messages } = require('../../../helper/api.responses');
const { handleServiceError, pick, getPaginationValues } = require('../../../helper/utilities.services');
const CountryModel = require('../../county/model');
const { createPrice } = require('../../payment/stripeCommon');
const SubscriptionPlanModel = require('./model');
const data = require('../../../data');

const createSubscriptionPlan = async (req, res) => {
  const lang = req?.userLanguage;
  try {
    req.body = pick(req.body, [
      'sName', 'sDescription', 'eType', 'nPrice', 'nDiscount', 'bRecommended', 'aBaseFeature', 'aPremiumFeature', 'eStatus', 'bDefault', 'sCountry', 'sCountryCode', 'sCurrency', 'sCurrencySymbol', 'eBillingType', 'eBillingCycle', 'nBillingInterval', 'iCountryId'
    ]);

    const { iCountryId, eBillingCycle, nBillingInterval, nPrice, eType } = req.body;
    const oCountry = await CountryModel.findById(iCountryId).lean();
    if (!oCountry) return res.status(status.BadRequest).json({ success: false, message: messages[lang].countryNotFound });

    req.body.sCurrency = oCountry?.sCurrency;
    req.body.sCurrencySymbol = oCountry?.sCurrencySymbol;
    req.body.sCountryCode = oCountry?.sCode;
    req.body.sCountry = oCountry?.sName;

    if (eType === data.eSubscriptionType.map.PREMIUM && nPrice > 0) {
      let sInterval = data.eStripeInterval.map.MONTHLY;
      if (eBillingCycle === data.eBillingCycle.map.MONTHLY) sInterval = data.eStripeInterval.map.MONTHLY;
      if (eBillingCycle === data.eBillingCycle.map.YEARLY) sInterval = data.eStripeInterval.map.YEARLY;
      if (eBillingCycle === data.eBillingCycle.map.DAY) sInterval = data.eStripeInterval.map.DAY;

      const oPrice = await createPrice({
        sCurrency: oCountry?.sCurrency?.toLowerCase(),
        sInterval,
        nIntervalCount: nBillingInterval,
        nAmount: nPrice
      });

      if (!oPrice?.bSuccess) {
        return res.status(status.BadRequest).json({ success: false, message: messages[lang].failedToCreateSubscriptionPlan });
      }

      req.body.iStripePriceId = oPrice?.oResponse?.id;
      req.body.iStripeProductId = oPrice?.oResponse?.product;
    }

    const subscriptionPlan = await SubscriptionPlanModel.create({ ...req.body });
    return res.status(status.OK).json({
      success: true,
      message: messages[lang].subscriptionPlanCreated,
      data: subscriptionPlan
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToCreateSubscriptionPlan' });
  }
};

const getSubscriptionPlan = async (req, res) => {
  const lang = req?.userLanguage;
  try {
    const { id } = req.params;

    const subscriptionPlan = await SubscriptionPlanModel.findById(id).lean();

    if (!subscriptionPlan) return res.status(status.BadRequest).json({ success: false, message: messages[lang].subscriptionPlanNotFound });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].subscriptionPlanRetrieved,
      data: subscriptionPlan
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveSubscriptionPlan' });
  }
};

// Update subscription plan
const updateSubscriptionPlan = async (req, res) => {
  try {
    const lang = req?.userLanguage;
    const { id } = req.params;

    req.body = pick(req.body, [
      'sName',
      'sDescription',
      'nPrice',
      'eType',
      'nDiscount',
      'bRecommended',
      'aBaseFeature',
      'aPremiumFeature',
      'eStatus',
      'bDefault',
      'sCountry',
      'sCountryCode',
      'sCurrency',
      'sCurrencySymbol',
      'eBillingType',
      'eBillingCycle',
      'nBillingInterval',
      'iCountryId'
    ]);

    const { iCountryId, eBillingCycle, nBillingInterval, nPrice, eType } = req.body;

    const oSubscriptionPlan = await SubscriptionPlanModel.findById(id).lean();
    if (!oSubscriptionPlan) return res.status(status.BadRequest).json({ success: false, message: messages[lang].subscriptionPlanNotFound });

    if (iCountryId) {
      const oCountry = await CountryModel.findById(iCountryId).lean();
      if (!oCountry) return res.status(status.BadRequest).json({ success: false, message: messages[lang].countryNotFound });

      req.body.sCurrency = oCountry?.sCurrency;
      req.body.sCurrencySymbol = oCountry?.sCurrencySymbol;
      req.body.sCountryCode = oCountry?.sCode;
      req.body.sCountry = oCountry?.sName;
    }

    if (req.body.sCurrencySymbol && req.body.sCountryCode && eBillingCycle && nBillingInterval && nPrice) {
      const bCond =
    req.body.sCountryCode !== oSubscriptionPlan?.sCountryCode ||
    eBillingCycle !== oSubscriptionPlan?.eBillingCycle ||
    nBillingInterval !== oSubscriptionPlan?.nBillingInterval ||
    nPrice !== oSubscriptionPlan?.nPrice;

      if (bCond && eType === data.eSubscriptionType.map.PREMIUM && nPrice > 0) {
        let sInterval = data.eStripeInterval.map.MONTHLY;
        if (eBillingCycle === data.eBillingCycle.map.MONTHLY) sInterval = data.eStripeInterval.map.MONTHLY;
        if (eBillingCycle === data.eBillingCycle.map.YEARLY) sInterval = data.eStripeInterval.map.YEARLY;
        if (eBillingCycle === data.eBillingCycle.map.DAY) sInterval = data.eStripeInterval.map.DAY;

        const oPrice = await createPrice({
          sCurrency: req.body.sCurrencySymbol?.toLowerCase(),
          sInterval,
          nIntervalCount: nBillingInterval,
          nAmount: nPrice
        });

        if (!oPrice?.bSuccess) {
          return res.status(status.BadRequest).json({ success: false, message: messages[lang].failedToCreateSubscriptionPlan });
        }

        req.body.iStripePriceId = oPrice?.oResponse?.id;
        req.body.iStripeProductId = oPrice?.oResponse?.product;
      }
    }

    const subscriptionPlan = await SubscriptionPlanModel.findByIdAndUpdate(id, { ...req.body }, { new: true }).lean();
    if (!subscriptionPlan) return res.status(status.BadRequest).json({ success: false, message: messages[lang].subscriptionPlanNotFound });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].subscriptionPlanUpdated,
      data: subscriptionPlan
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToUpdateSubscriptionPlan' });
  }
};

// Delete subscription plan (soft delete)
const deleteSubscriptionPlan = async (req, res) => {
  try {
    const lang = req?.userLanguage;
    const { id } = req.params;

    const subscriptionPlan = await SubscriptionPlanModel.findByIdAndUpdate(id, { ...req.body }, { new: true }).lean();
    if (!subscriptionPlan) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang].subscriptionPlanNotFound
      });
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].subscriptionPlanUpdated,
      data: subscriptionPlan
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToDeleteSubscriptionPlan' });
  }
};

// List subscription plans with pagination and filters
const listSubscriptionPlans = async (req, res) => {
  try {
    const lang = req?.userLanguage;
    const { limit, start, search, sorting } = getPaginationValues(req.query);

    const { eType, eBillingType, eStatus } = req.query;
    const query = {};

    if (eType) query.eType = eType;
    if (eBillingType) query.eBillingType = eBillingType;
    if (eStatus) query.eStatus = eStatus;

    if (search) {
      query.$or = [
        { sName: { $regex: search, $options: 'i' } },
        { sDescription: { $regex: search, $options: 'i' } }
      ];
    }

    const [results, total] = await Promise.all([
      SubscriptionPlanModel.find(query).sort(sorting).limit(limit).skip(start).populate('oCountry').lean(),
      SubscriptionPlanModel.countDocuments(query)
    ]);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].subscriptionPlanRetrieved,
      data: { total, results }
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveSubscriptionPlans' });
  }
};

const listUserSubscriptionPlans = async (req, res) => {
  try {
    const lang = req?.userLanguage;

    // TODO: Country Wise list pending
    const oQuery = {
      sCountryCode: 'SA',
      eStatus: data.eActiveStatus.map.ACTIVE
    };

    const subscriptionPlans = await SubscriptionPlanModel.find(oQuery).lean();
    if (!subscriptionPlans?.length) return res.status(status.BadRequest).json({ success: false, message: messages[lang].subscriptionPlanNotFound });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].subscriptionPlanRetrieved,
      data: subscriptionPlans
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
};

module.exports = {
  createSubscriptionPlan,
  getSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  listSubscriptionPlans,
  listUserSubscriptionPlans
};
