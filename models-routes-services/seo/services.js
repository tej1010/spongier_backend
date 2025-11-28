const SEO = require('./model');
const { status } = require('../../helper/api.responses');
const { handleServiceError, getPaginationValues2, createResponse } = require('../../helper/utilities.services');
const GradeModel = require('../course/grades/model');
const SubjectModel = require('../course/subjects/model');
const TermModel = require('../course/terms/model');
const VideoModel = require('../course/videos/model');
const seoService = {};

seoService.createSEO = async (req, res) => {
  try {
    const seo = await SEO.create({ ...req.body });
    return createResponse({ req, res, statusCode: status.Create, messageKey: 'success', data: seo });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToCreateSEO' });
  }
};

seoService.getAllSEOs = async (req, res) => {
  try {
    const { start, limit, sorting, search } = getPaginationValues2(req.query);
    const filter = {};
    if (req.query.eType) filter.eType = req.query.eType;
    if (req.query.eSubType) filter.eSubType = req.query.eSubType;
    if (req.query.eStatus) filter.eStatus = req.query.eStatus;
    if (search) filter.sTitle = { $regex: search, $options: 'i' };

    const [items, total] = await Promise.all([
      SEO.find(filter)
        .sort(sorting)
        .skip(Number(start))
        .limit(Number(limit))
        .lean(),
      SEO.countDocuments(filter)
    ]);
    return createResponse({ req, res, statusCode: status.OK, messageKey: 'success', data: { total, results: items, limit: Number(limit), start: Number(start) } });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveSEOs' });
  }
};

seoService.getSEOById = async (req, res) => {
  try {
    const item = await SEO.findById(req.params.id).lean();
    if (!item) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'seoNotFound' });
    }
    return createResponse({ req, res, statusCode: status.OK, messageKey: 'success', data: item });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveSEO' });
  }
};

seoService.updateSEO = async (req, res) => {
  try {
    const item = await SEO.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    ).lean();
    if (!item) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'seoNotFound' });
    }
    return createResponse({ req, res, statusCode: status.OK, messageKey: 'success', data: item });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToUpdateSEO' });
  }
};

seoService.deleteSEO = async (req, res) => {
  try {
    const del = await SEO.findByIdAndUpdate(
      req.params.id,
      { eStatus: 'inactive' },
      { new: true }
    ).lean();
    if (!del) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'seoNotFound' });
    }
    return createResponse({ req, res, statusCode: status.OK, messageKey: 'success', data: {} });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToDeleteSEO' });
  }
};

// Frontend specific methods
seoService.getPageSEO = async (req, res) => {
  try {
    const { eType, iId, slug } = req.query;
    const filter = {};
    if (eType) filter.eType = eType;
    if (iId) filter.iId = iId;
    if (slug) filter.sSlug = slug;

    const seo = await SEO.findOne(filter).lean();
    if (!seo) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'seoNotFound' });
    }

    const seoData = {
      meta: {
        title: seo.sTitle,
        description: seo.sDescription,
        keywords: (seo.aKeywords || []).join(', '),
        robots: seo.sRobots || 'index,follow',
        canonical: seo.sCUrl
      },
      og: {
        title: (seo.oFB && seo.oFB.sTitle) || seo.sTitle,
        description: (seo.oFB && seo.oFB.sDescription) || seo.sDescription,
        url: (seo.oFB && seo.oFB.sUrl) || seo.sCUrl
      },
      twitter: {
        title: (seo.oTwitter && seo.oTwitter.sTitle) || seo.sTitle,
        description: (seo.oTwitter && seo.oTwitter.sDescription) || seo.sDescription,
        url: (seo.oTwitter && seo.oTwitter.sUrl) || seo.sCUrl
      }
    };

    return createResponse({ req, res, statusCode: status.OK, messageKey: 'success', data: seoData });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveSEO' });
  }
};

// Helper function to populate referenced records based on eType
const populateReferencedRecord = async (seoItem, deep = false) => {
  if (!seoItem.iId || !seoItem.eType) {
    return seoItem;
  }

  try {
    let populatedRecord = null;

    switch (seoItem.eType) {
      case 'grade':
        populatedRecord = await GradeModel.findById(seoItem.iId).lean();
        break;

      case 'subject':
        if (deep) {
          // Populate with grade information if available
          populatedRecord = await SubjectModel.findById(seoItem.iId)
            .populate('iGradeId', 'sName sDescription')
            .lean();
        } else {
          populatedRecord = await SubjectModel.findById(seoItem.iId).lean();
        }
        break;

      case 'term':
        if (deep) {
          // Populate with subject and grade information if available
          populatedRecord = await TermModel.findById(seoItem.iId)
            .populate({
              path: 'iSubjectId',
              select: 'sName sDescription iGradeId',
              populate: {
                path: 'iGradeId',
                select: 'sName sDescription'
              }
            })
            .lean();
        } else {
          populatedRecord = await TermModel.findById(seoItem.iId).lean();
        }
        break;

      case 'video':
        if (deep) {
          // Populate with full hierarchy: video -> term -> subject -> grade
          populatedRecord = await VideoModel.findById(seoItem.iId)
            .populate({
              path: 'iTermId',
              select: 'sName sDescription iSubjectId',
              populate: {
                path: 'iSubjectId',
                select: 'sName sDescription iGradeId',
                populate: {
                  path: 'iGradeId',
                  select: 'sName sDescription'
                }
              }
            })
            .lean();
        } else {
          populatedRecord = await VideoModel.findById(seoItem.iId).lean();
        }
        break;

      default:
        // For 'home' or other types that don't have a specific model
        break;
    }

    return {
      ...seoItem,
      populatedRecord
    };
  } catch (error) {
    console.error(`Error populating ${seoItem.eType} record:`, error);
    return seoItem;
  }
};

// Get SEOs by slug or list of slugs
seoService.getSeosBySlug = async (req, res) => {
  try {
    // Accept slug(s) from query or body
    let { slug, slugs } = req.query;
    const { populate = false, deep = false } = req.query; // Add populate and deep options

    if (!slug && !slugs && (req.body && (req.body.slug || req.body.slugs))) {
      ({ slug, slugs } = req.body);
    }

    const shouldPopulate = populate === 'true' || populate === true;
    const shouldDeepPopulate = deep === 'true' || deep === true;

    // Prefer explicit list in `slugs` over single `slug`
    if (slugs) {
      const slugList = Array.isArray(slugs)
        ? slugs
        : String(slugs)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

      if (slugList.length === 0) {
        return createResponse({ req, res, statusCode: status.OK, messageKey: 'success', data: [] });
      }

      let items = await SEO.find({ sSlug: { $in: slugList } }).lean();

      // Populate referenced records if requested
      if (shouldPopulate) {
        items = await Promise.all(items.map(item => populateReferencedRecord(item, shouldDeepPopulate)));
      }

      return createResponse({ req, res, statusCode: status.OK, messageKey: 'success', data: items });
    }

    if (slug) {
      let item = await SEO.findOne({ sSlug: slug }).lean();
      if (!item) {
        return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'seoNotFound' });
      }

      // Populate referenced record if requested
      if (shouldPopulate) {
        item = await populateReferencedRecord(item, shouldDeepPopulate);
      }

      return createResponse({ req, res, statusCode: status.OK, messageKey: 'success', data: item });
    }

    // If neither provided, bad request
    return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'badRequest' });
  } catch (error) {
    console.log('error', error);
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveSEOs' });
  }
};

module.exports = seoService;
