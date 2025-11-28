// banner.services.js
const { status, messages } = require('../../helper/api.responses');
const { getPaginationValues2, handleServiceError } = require('../../helper/utilities.services');
const BannerModel = require('./model');

// Create banner (Admin)
const createBanner = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { sTitle, sSubtitle, eKey, sImageUrl, sRedirectUrl, iOrder, eStatus: eStatusIn, bFeature } = req.body;

    // Enforce unique order within the same key (allow repeats across different eKeys)
    if (typeof iOrder === 'number') {
      const keyToUse = eKey || 'home';
      const exists = await BannerModel.findOne({ iOrder, eKey: keyToUse, eStatus: { $ne: 'inactive' } }).lean();
      if (exists) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'orderAlreadyExists' });
      }
    }

    const banner = new BannerModel({
      sTitle: (sTitle || '').trim(),
      sSubtitle: (sSubtitle || '').trim(),
      eKey: eKey || 'home',
      sImageUrl: (sImageUrl || '').trim(),
      sRedirectUrl: (sRedirectUrl || '').trim(),
      iOrder: iOrder || 0,
      eStatus: eStatusIn || 'active',
      bFeature: typeof bFeature === 'boolean' ? bFeature : false
    });

    await banner.save();

    return res.status(status.OK).json({ success: true, message: messages[lang].bannerCreated, data: { banner }, error: {} });
  } catch (error) {
    if (error && error.code === 11000) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'duplicateValue', data: { message: error.message } });
    }
    return handleServiceError(error, req, res, { messageKey: 'failedToCreateBanner' });
  }
};

// Get banner by ID (Admin/User)
const getBanner = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const banner = req.admin
      ? await BannerModel.findById(id).lean()
      : await BannerModel.findOne({ _id: id, eStatus: { $ne: 'inactive' } }).lean();
    if (!banner) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'bannerNotFound' });
    }
    return res.status(status.OK).json({ success: true, message: messages[lang].bannerRetrieved, data: { banner }, error: {} });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveBanner' });
  }
};

// Update banner (Admin)
const updateBanner = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const { sTitle, sSubtitle, eKey, sImageUrl, sRedirectUrl, iOrder, eStatus: eStatusIn, bFeature } = req.body;

    const banner = await BannerModel.findById(id);
    if (!banner) {
      return res.status(status.NotFound).json({ success: false, message: messages[lang].bannerNotFound, data: {}, error: {} });
    }

    // Unique order check within the same key when changing iOrder
    if (typeof iOrder === 'number' && iOrder !== banner.iOrder) {
      const keyToUse = (eKey !== undefined) ? eKey : banner.eKey;
      const exists = await BannerModel.findOne({ iOrder, eKey: keyToUse, eStatus: { $ne: 'inactive' }, _id: { $ne: id } }).lean();
      if (exists) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'orderAlreadyExists' });
      }
    }

    if (sTitle !== undefined) banner.sTitle = sTitle.trim();
    if (sSubtitle !== undefined) banner.sSubtitle = sSubtitle.trim();
    if (eKey !== undefined) banner.eKey = eKey;
    if (sImageUrl !== undefined) banner.sImageUrl = sImageUrl.trim();
    if (sRedirectUrl !== undefined) banner.sRedirectUrl = sRedirectUrl.trim();
    if (iOrder !== undefined) banner.iOrder = iOrder;
    if (eStatusIn !== undefined) banner.eStatus = eStatusIn;
    if (typeof bFeature === 'boolean') banner.bFeature = bFeature;

    await banner.save();

    return res.status(status.OK).json({ success: true, message: messages[lang].bannerUpdated, data: { banner }, error: {} });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToUpdateBanner' });
  }
};

// Delete banner (soft delete) (Admin)
const deleteBanner = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const banner = await BannerModel.findById(id);
    if (!banner) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'bannerNotFound' });
    }
    banner.eStatus = 'inactive';
    await banner.save();
    return res.status(status.OK).json({ success: true, message: messages[lang].bannerDeleted, data: {}, error: {} });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToDeleteBanner' });
  }
};

// List banners (Admin/User)
const listBanners = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { limit, start } = getPaginationValues2(req.query);
    const { search, status: statusFilter, key, sortBy = 'iOrder', sortOrder = 'asc' } = req.query;

    const isAdmin = !!req.admin;
    const query = {};
    if (!isAdmin) {
      query.eStatus = { $ne: 'inactive' };
    }
    if (search) {
      query.sTitle = { $regex: search, $options: 'i' };
    }
    if (statusFilter) {
      if (isAdmin) {
        query.eStatus = statusFilter;
      } else if (statusFilter !== 'inactive') {
        query.eStatus = statusFilter;
      }
    }
    if (key) {
      query.eKey = { $regex: key, $options: 'i' };
    }

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [total, results] = await Promise.all([
      BannerModel.countDocuments(query),
      BannerModel.find(query)
        .sort(sort)
        .skip(Number(start))
        .limit(Number(limit))
        .lean()
    ]);

    return res.status(status.OK).json({ success: true, message: messages[lang].bannersListed, data: { total, results, limit: Number(limit), start: Number(start) }, error: {} });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveBanners' });
  }
};

module.exports = {
  createBanner,
  getBanner,
  updateBanner,
  deleteBanner,
  listBanners
};
