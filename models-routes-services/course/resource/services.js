// resource.services.js
const mongoose = require('mongoose');
const { status, messages } = require('../../../helper/api.responses');
const { handleServiceError } = require('../../../helper/utilities.services');
const ResourceModel = require('./model');
const GradeModel = require('../grades/model');
const SubjectModel = require('../subjects/model');
const TermModel = require('../terms/model');
const VideoModel = require('../videos/model');
const { getPaginationValues2 } = require('../../../helper/utilities.services');

// Create resource
const createResource = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { sTitle, eType, sDescription, iGradeId, iSubjectId, iTermId, iVideoId, sFileUrl, iFileSizeBytes, eStatus, iOrder, bFeature } = req.body;

    // Validate grade/subject/term relations
    const [grade, subject, term] = await Promise.all([
      GradeModel.findOne({ _id: iGradeId, eStatus: { $ne: 'inactive' } }).lean(),
      SubjectModel.findOne({ _id: iSubjectId, eStatus: { $ne: 'inactive' } }).lean(),
      TermModel.findOne({ _id: iTermId, eStatus: { $ne: 'inactive' } }).lean()
    ]);

    if (!grade) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'gradeNotFound' });
    }
    if (!subject) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'subjectNotFound' });
    }
    if (!term) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'termNotFound' });
    }

    // Optional: check video existence
    if (iVideoId) {
      const video = await VideoModel.findOne({ _id: iVideoId, eStatus: { $ne: 'inactive' } }).lean();
      if (!video) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'videoNotFound' });
      }
    }

    // Unique title within grade, subject, term (ignore deleted)
    const existingTitle = await ResourceModel.findOne({ sTitle: sTitle.trim(), iGradeId, iSubjectId, iTermId, eStatus: { $ne: 'inactive' } }).lean();
    if (existingTitle) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'resourceNameExists' });
    }

    // Enforce unique order within (grade+subject+term+video)
    if (typeof iOrder === 'number') {
      const orderExists = await ResourceModel.findOne({ iGradeId, iSubjectId, iTermId, iVideoId: iVideoId || null, iOrder, eStatus: { $ne: 'inactive' } }).lean();
      if (orderExists) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'orderAlreadyExists' });
      }
    }

    const resource = new ResourceModel({
      sTitle: sTitle.trim(),
      eType,
      sDescription: sDescription || '',
      iGradeId,
      iSubjectId,
      iTermId,
      iVideoId: iVideoId || null,
      iOrder,
      sFileUrl: sFileUrl.trim(),
      iFileSizeBytes: Number(iFileSizeBytes) || 0,
      eStatus: eStatus || 'active',
      bFeature: typeof bFeature === 'boolean' ? bFeature : false
    });

    await resource.save();

    const populated = await ResourceModel.findById(resource._id)
      .populate('iGradeId', 'sName')
      .populate('iSubjectId', 'sName')
      .populate('iTermId', 'sName')
      .populate('iVideoId', 'sTitle')
      .lean();

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].resourceCreated,
      data: { resource: populated },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToCreateResource' });
  }
};

// Get resource by ID
const getResource = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const resource = await ResourceModel.findOne({ _id: id, eStatus: { $ne: 'inactive' } })
      .populate('iGradeId', 'sName')
      .populate('iSubjectId', 'sName')
      .populate('iTermId', 'sName')
      .populate('iVideoId', 'sTitle')
      .lean();
    if (!resource) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'resourceNotFound' });
    }
    return res.status(status.OK).json({
      success: true,
      message: messages[lang].resourceRetrieved,
      data: { resource },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveResource' });
  }
};

// Update resource
const updateResource = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existing = await ResourceModel.findOne({ _id: id, eStatus: { $ne: 'inactive' } });
    if (!existing) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'resourceNotFound' });
    }

    if (updateData.iGradeId) {
      const grade = await GradeModel.findOne({ _id: updateData.iGradeId, eStatus: { $ne: 'inactive' } }).lean();
      if (!grade) return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'gradeNotFound' });
    }
    if (updateData.iSubjectId) {
      const subject = await SubjectModel.findOne({ _id: updateData.iSubjectId, eStatus: { $ne: 'inactive' } }).lean();
      if (!subject) return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'subjectNotFound' });
    }
    if (updateData.iTermId) {
      const term = await TermModel.findOne({ _id: updateData.iTermId, eStatus: { $ne: 'inactive' } }).lean();
      if (!term) return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'termNotFound' });
    }
    if (updateData.iVideoId) {
      const video = await VideoModel.findOne({ _id: updateData.iVideoId, eStatus: { $ne: 'inactive' } }).lean();
      if (!video) return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'videoNotFound' });
    }

    if (updateData.sTitle && updateData.sTitle.trim() !== existing.sTitle) {
      const titleExists = await ResourceModel.findOne({
        sTitle: updateData.sTitle.trim(),
        iGradeId: updateData.iGradeId || existing.iGradeId,
        iSubjectId: updateData.iSubjectId || existing.iSubjectId,
        iTermId: updateData.iTermId || existing.iTermId,
        _id: { $ne: id },
        eStatus: { $ne: 'inactive' }
      }).lean();
      if (titleExists) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'resourceNameExists' });
      }
    }

    // If iOrder is being updated, enforce uniqueness within (grade+subject+term+video)
    if (updateData.iOrder !== undefined && updateData.iOrder !== existing.iOrder) {
      const orderExists = await ResourceModel.findOne({
        iGradeId: updateData.iGradeId || existing.iGradeId,
        iSubjectId: updateData.iSubjectId || existing.iSubjectId,
        iTermId: updateData.iTermId || existing.iTermId,
        iVideoId: updateData.iVideoId !== undefined ? (updateData.iVideoId || null) : (existing.iVideoId || null),
        iOrder: updateData.iOrder,
        _id: { $ne: id },
        eStatus: { $ne: 'inactive' }
      }).lean();
      if (orderExists) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'orderAlreadyExists' });
      }
    }

    // Handle bFeature conversion
    if (updateData.bFeature !== undefined && typeof updateData.bFeature !== 'boolean') {
      updateData.bFeature = ['true', '1', 1, true].includes(updateData.bFeature);
    }

    const updated = await ResourceModel.findOneAndUpdate({ _id: id, eStatus: { $ne: 'inactive' } }, updateData, { new: true, runValidators: true })
      .populate('iGradeId', 'sName')
      .populate('iSubjectId', 'sName')
      .populate('iTermId', 'sName')
      .populate('iVideoId', 'sTitle');
    if (!updated) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'resourceNotFound' });
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].resourceUpdated,
      data: { resource: updated },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToUpdateResource' });
  }
};

// Delete resource (soft delete)
const deleteResource = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const resource = await ResourceModel.findOneAndUpdate({ _id: id, eStatus: { $ne: 'inactive' } }, { eStatus: 'inactive' }, { new: true });
    if (!resource) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'resourceNotFound' });
    }
    return res.status(status.OK).json({
      success: true,
      message: messages[lang].resourceDeleted,
      data: {},
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToDeleteResource' });
  }
};

// List resources
const listResources = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { limit, start } = getPaginationValues2(req.query);
    const { search, gradeId, subjectId, termId, videoId, status: resourceStatus, bFeature, sortBy = 'dCreatedAt', sortOrder = 'desc', isFullResponse } = req.query;

    // let query = { eStatus: { $ne: 'inactive' } };
    const query = {};
    if (req?.admin?.eType && ['SUPER', 'SUB'].includes(req.admin.eType)) {
      query.eStatus = { $in: ['active', 'inactive'] };
    } else if (req?.user) {
      query.eStatus = 'active';
    } else {
      query.eStatus = 'active';
    }

    if (search) {
      query.sTitle = new RegExp('^.*' + search + '.*', 'i');
    }
    if (gradeId) query.iGradeId = mongoose.Types.ObjectId(gradeId);
    if (subjectId) query.iSubjectId = mongoose.Types.ObjectId(subjectId);
    if (termId) query.iTermId = mongoose.Types.ObjectId(termId);
    if (videoId) query.iVideoId = mongoose.Types.ObjectId(videoId);
    if (resourceStatus) query.eStatus = resourceStatus;
    if (bFeature !== undefined) {
      query.bFeature = bFeature === 'true' || bFeature === true || bFeature === '1' || bFeature === 1;
    }

    const sortOptions = {}; sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    let results = []; let total = 0;
    if ([true, 'true'].includes(isFullResponse)) {
      results = await ResourceModel.find(query)
        .sort(sortOptions)
        .lean();
      total = results.length;
    } else {
      [total, results] = await Promise.all([
        ResourceModel.countDocuments(query),
        ResourceModel.find(query)
          .sort(sortOptions)
          .skip(Number(start))
          .limit(Number(limit))
          .lean()
      ]);
    }

    // Get grade details if gradeId filter is applied
    let gradeDetails = null;
    if (gradeId) {
      const grade = await GradeModel.findOne({ _id: gradeId }, { sName: 1 }).lean();
      gradeDetails = grade ? { id: grade._id, sName: grade.sName } : null;
    }

    // Get subject details if subjectId filter is applied
    let subjectDetails = null;
    if (subjectId) {
      const subject = await SubjectModel.findOne({ _id: subjectId }, { sName: 1 }).lean();
      subjectDetails = subject ? { id: subject._id, sName: subject.sName } : null;
    }

    // Get term details if termId filter is applied
    let termDetails = null;
    if (termId) {
      const term = await TermModel.findOne({ _id: termId }, { sName: 1 }).lean();
      termDetails = term ? { id: term._id, sName: term.sName } : null;
    }

    // Get video details if videoId filter is applied
    let videoDetails = null;
    if (videoId) {
      const video = await VideoModel.findOne({ _id: videoId }, { sTitle: 1 }).lean();
      videoDetails = video ? { id: video._id, sTitle: video.sTitle } : null;
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].resourcesListed,
      data: { 
        total,
        results,
        limit: [true, 'true'].includes(isFullResponse) ? null : Number(limit),
        start: [true, 'true'].includes(isFullResponse) ? null : Number(start),
        gradeDetails,
        subjectDetails,
        termDetails,
        videoDetails
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveResources' });
  }
};

module.exports = {
  createResource,
  getResource,
  updateResource,
  deleteResource,
  listResources
};
