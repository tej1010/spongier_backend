const SEORedirect = require('../seo/SeoRedirect');
const { status } = require('../../helper/api.responses');
const { getPaginationValues2, createResponse, handleServiceError } = require('../../helper/utilities.services');

const redirectService = {};

redirectService.createRedirect = async (req, res) => {
  try {
    const { sOldSlug, sNewSlug } = req.body;
    if (sOldSlug && sNewSlug && sOldSlug.toLowerCase() === sNewSlug.toLowerCase()) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'badRequest', data: { message: 'Old and new slug cannot be the same' } });
    }

    // Check if old slug already exists
    const existingRedirect = await SEORedirect.findOne({ sOldSlug }).lean();
    if (existingRedirect) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'badRequest', data: { message: 'Redirect rule for this old slug already exists' } });
    }

    // avoid simple 2-step loop (A->B while B->A exists)
    const loop = await SEORedirect.findOne({ sOldSlug: sNewSlug?.toLowerCase(), sNewSlug: sOldSlug?.toLowerCase() }).lean();
    if (loop) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'badRequest', data: { message: 'Redirect would create a loop' } });
    }

    const redirect = await SEORedirect.create({ ...req.body });
    return createResponse({ req, res, statusCode: status.Create, messageKey: 'success', data: redirect });
  } catch (err) {
    return handleServiceError(err, req, res, { messageKey: 'internalServerError' });
  }
};

redirectService.getAllRedirects = async (req, res) => {
  try {
    const { start, limit, sorting, search } = getPaginationValues2(req.query);
    const filter = {
      eStatus: { $ne: 'deleted' } // Exclude deleted records by default
    };

    if (req.query.eType) filter.eType = req.query.eType;
    if (req.query.eSubType) filter.eSubType = req.query.eSubType;
    if (req.query.eStatus && req.query.eStatus !== 'deleted') filter.eStatus = req.query.eStatus;
    if (search) {
      filter.$or = [
        { sOldSlug: { $regex: search, $options: 'i' } },
        { sNewSlug: { $regex: search, $options: 'i' } }
      ];
    }

    const [items, total] = await Promise.all([
      SEORedirect.find(filter)
        .sort(sorting)
        .skip(parseInt(start))
        .limit(parseInt(limit))
        .populate('iCreatedBy', 'sEmail sUsername')
        .populate('iLastModifiedBy', 'sEmail sUsername')
        .lean(),
      SEORedirect.countDocuments(filter)
    ]);

    return createResponse({ req, res, statusCode: status.OK, messageKey: 'success', data: { total, results: items, limit: Number(limit), start: Number(start) } });
  } catch (err) {
    return handleServiceError(err, req, res, { messageKey: 'internalServerError' });
  }
};

redirectService.getRedirectById = async (req, res) => {
  try {
    const redirect = await SEORedirect.findById(req.params.id)
      .populate('iCreatedBy', 'sEmail sUsername')
      .populate('iLastModifiedBy', 'sEmail sUsername')
      .lean();

    if (!redirect) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'notFound' });
    }

    return createResponse({ req, res, statusCode: status.OK, messageKey: 'success', data: redirect });
  } catch (err) {
    return handleServiceError(err, req, res, { messageKey: 'internalServerError' });
  }
};

redirectService.updateRedirect = async (req, res) => {
  try {
    const { sOldSlug, sNewSlug } = req.body;

    // Check if old slug already exists for other records
    if (sOldSlug) {
      const existingRedirect = await SEORedirect.findOne({
        sOldSlug,
        _id: { $ne: req.params.id }
      }).lean();

      if (existingRedirect) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'badRequest', data: { message: 'Redirect rule for this old slug already exists' } });
      }
    }
    if (sOldSlug && sNewSlug && sOldSlug.toLowerCase() === sNewSlug.toLowerCase()) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'badRequest', data: { message: 'Old and new slug cannot be the same' } });
    }
    const loop = sNewSlug
      ? await SEORedirect.findOne({ sOldSlug: sNewSlug.toLowerCase(), sNewSlug: sOldSlug?.toLowerCase(), _id: { $ne: req.params.id } }).lean()
      : null;
    if (loop) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'badRequest', data: { message: 'Redirect would create a loop' } });
    }

    const redirect = await SEORedirect.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        iLastModifiedBy: req.user._id
      },
      { new: true, runValidators: true }
    )
      .populate('iCreatedBy', 'sEmail sUsername')
      .populate('iLastModifiedBy', 'sEmail sUsername')
      .lean();

    if (!redirect) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'notFound' });
    }

    return createResponse({ req, res, statusCode: status.OK, messageKey: 'success', data: redirect });
  } catch (err) {
    return handleServiceError(err, req, res, { messageKey: 'internalServerError' });
  }
};

redirectService.deleteRedirect = async (req, res) => {
  try {
    // Instead of findByIdAndDelete, use findByIdAndUpdate to set eStatus to 'deleted'
    const redirect = await SEORedirect.findByIdAndUpdate(
      req.params.id,
      {
        eStatus: 'deleted'
      },
      { new: true }
    ).lean();

    if (!redirect) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'notFound' });
    }

    return createResponse({ req, res, statusCode: status.OK, messageKey: 'success', data: {} });
  } catch (err) {
    return handleServiceError(err, req, res, { messageKey: 'internalServerError' });
  }
};

redirectService.checkRedirect = async (req, res) => {
  try {
    const { slug } = req.params;

    const redirect = await SEORedirect.findOne({
      sOldSlug: slug.toLowerCase(),
      eStatus: 'active'
    }).lean();

    if (!redirect) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'notFound' });
    }

    return createResponse({ req, res, statusCode: status.OK, messageKey: 'success', data: { newSlug: redirect.sNewSlug, statusCode: redirect.nStatusCode } });
  } catch (err) {
    return handleServiceError(err, req, res, { messageKey: 'internalServerError' });
  }
};

module.exports = redirectService;
