// term.services.js
const mongoose = require('mongoose');
const { status, messages } = require('../../../helper/api.responses');
const { handleServiceError } = require('../../../helper/utilities.services');
const TermModel = require('./model');
const GradeModel = require('../grades/model');
const SubjectModel = require('../subjects/model');
const VideoModel = require('../videos/model');
const ResourceModel = require('../resource/model');
const config = require('../../../config/config');
const { deleteObject } = require('../../../helper/s3config');
const { getPaginationValues2 } = require('../../../helper/utilities.services');
const { createSeoMeta, getSeoDataForRecord, getSeoDataForRecords } = require('../../../helper/seo.helper');
const data = require('../../../data');

// Create term
const createTerm = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { sName, iGradeId, iSubjectId, sDescription, iOrder, eStatus, bFeature, sImage } = req.body;

    // Check if grade exists
    const grade = await GradeModel.findOne({ _id: iGradeId, eStatus: { $ne: 'inactive' } }).lean();
    if (!grade) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'gradeNotFound' });
    }

    // Check if subject exists
    const subject = await SubjectModel.findOne({ _id: iSubjectId, eStatus: { $ne: 'inactive' } }).lean();
    if (!subject) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'subjectNotFound' });
    }

    // Check if subject belongs to the specified grade
    if (subject.iGradeId.toString() !== iGradeId) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'subjectNotInGrade' });
    }

    // Check if term name already exists in the same grade and subject
    const existingTerm = await TermModel.findOne({
      sName: sName.trim(),
      iGradeId,
      iSubjectId,
      eStatus: { $ne: 'inactive' }
    }).lean();

    if (existingTerm) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'termNameExists' });
    }

    // Enforce unique order within (grade+subject)
    if (typeof iOrder === 'number') {
      const orderExists = await TermModel.findOne({ iGradeId, iSubjectId, iOrder, eStatus: { $ne: 'inactive' } }).lean();
      if (orderExists) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'orderAlreadyExists' });
      }
    }

    const term = new TermModel({
      sName: sName.trim(),
      iGradeId,
      iSubjectId,
      sDescription: sDescription || '',
      iOrder: iOrder || 0,
      eStatus: eStatus || 'active',
      bFeature: typeof bFeature === 'boolean' ? bFeature : false,
      sImage: sImage || ''
    });

    await term.save();

    // fire-and-forget SEO meta
    createSeoMeta({
      eType: data.eSeoType.map.TERM,
      iId: term._id,
      sTitle: term.sName,
      sDescription: term.sDescription,
      contextNames: { eType: data.eSeoType.map.TERM, gradeName: grade.sName, subjectName: subject.sName }
    });

    // Populate grade and subject information
    const populatedTerm = await TermModel.findById(term._id)
      .populate('iGradeId', 'sName')
      .populate('iSubjectId', 'sName')
      .lean();

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].termCreated,
      data: { term: populatedTerm },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToCreateTerm' });
  }
};

// Get term by ID
const getTerm = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;

    const term = await TermModel.findOne({ _id: id, eStatus: { $ne: 'inactive' } })
      .populate('iGradeId', 'sName')
      .populate('iSubjectId', 'sName')
      .lean();

    if (!term) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'termNotFound' });
    }

    // Add SEO data to the term
    const termWithSeo = await getSeoDataForRecord(term, data.eSeoType.map.TERM);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].termRetrieved,
      data: { term: termWithSeo },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveTerm' });
  }
};

// Update term
const updateTerm = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const updateData = req.body;
    if (updateData.bFeature !== undefined && typeof updateData.bFeature !== 'boolean') {
      updateData.bFeature = ['true', '1', 1, true].includes(updateData.bFeature);
    }

    // Check if term exists
    const existingTerm = await TermModel.findOne({ _id: id, eStatus: { $ne: 'inactive' } });
    if (!existingTerm) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'termNotFound' });
    }

    // Check if grade exists (if being updated)
    if (updateData.iGradeId) {
      const grade = await GradeModel.findOne({ _id: updateData.iGradeId, eStatus: { $ne: 'inactive' } }).lean();
      if (!grade) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'gradeNotFound' });
      }
    }

    // Check if subject exists (if being updated)
    if (updateData.iSubjectId) {
      const subject = await SubjectModel.findOne({ _id: updateData.iSubjectId, eStatus: { $ne: 'inactive' } }).lean();
      if (!subject) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'subjectNotFound' });
      }

      // Check if subject belongs to the specified grade
      const gradeId = updateData.iGradeId || existingTerm.iGradeId;
      if (subject.iGradeId.toString() !== gradeId.toString()) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'subjectNotInGrade' });
      }
    }

    // Check if name is being updated and if it already exists in the same grade and subject
    if (updateData.sName && updateData.sName !== existingTerm.sName) {
      const nameExists = await TermModel.findOne({
        sName: updateData.sName.trim(),
        iGradeId: updateData.iGradeId || existingTerm.iGradeId,
        iSubjectId: updateData.iSubjectId || existingTerm.iSubjectId,
        _id: { $ne: id },
        eStatus: { $ne: 'inactive' }
      }).lean();

      if (nameExists) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'termNameExists' });
      }
    }

    // If iOrder is being updated, enforce uniqueness within (grade+subject)
    if (updateData.iOrder !== undefined && updateData.iOrder !== existingTerm.iOrder) {
      const targetGradeId = updateData.iGradeId || existingTerm.iGradeId;
      const targetSubjectId = updateData.iSubjectId || existingTerm.iSubjectId;
      const orderExists = await TermModel.findOne({ iGradeId: targetGradeId, iSubjectId: targetSubjectId, iOrder: updateData.iOrder, _id: { $ne: id }, eStatus: { $ne: 'inactive' } }).lean();
      if (orderExists) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'orderAlreadyExists' });
      }
    }

    // If image explicitly set to null, delete existing S3 object and clear field
    if (Object.prototype.hasOwnProperty.call(updateData, 'sImage') && updateData.sImage === null) {
      const currentImage = existingTerm.sImage;
      if (currentImage) {
        try {
          const key = currentImage.startsWith('http')
            ? currentImage.replace(config.S3_BUCKET_URL, '').replace(/^\//, '')
            : currentImage;
          await deleteObject({ Bucket: config.S3_BUCKET_NAME, Key: key });
        } catch (err) {
          // ignore deletion errors
        }
      }
      updateData.sImage = '';
    }

    // Update the term
    const updatedTerm = await TermModel.findOneAndUpdate(
      { _id: id, eStatus: { $ne: 'inactive' } },
      updateData,
      { new: true, runValidators: true }
    ).populate('iGradeId', 'sName')
      .populate('iSubjectId', 'sName');
    if (!updatedTerm) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'termNotFound' });
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].termUpdated,
      data: { term: updatedTerm },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToUpdateTerm' });
  }
};

// Delete term (soft delete + cascade)
const deleteTerm = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;

    const term = await TermModel.findOneAndUpdate({ _id: id, eStatus: { $ne: 'inactive' } }, { eStatus: 'inactive' }, { new: true });
    if (!term) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'termNotFound' });
    }

    await Promise.all([
      VideoModel.updateMany({ iTermId: id, eStatus: { $ne: 'inactive' } }, { $set: { eStatus: 'inactive' } }),
      ResourceModel.updateMany({ iTermId: id, eStatus: { $ne: 'inactive' } }, { $set: { eStatus: 'inactive' } })
    ]);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].termDeleted,
      data: {},
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToDeleteTerm' });
  }
};

// List terms
const listTerms = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { limit, start } = getPaginationValues2(req.query);
    const { search, gradeId, subjectId, status: termStatus, bFeature, sortBy = 'iOrder', sortOrder = 'asc', isFullResponse } = req.query;

    // const query = { eStatus: { $ne: 'inactive' } };
    const query = {};
    if (req?.admin?.eType && ['SUPER', 'SUB'].includes(req.admin.eType)) {
      query.eStatus = { $in: ['active', 'inactive'] };
    } else if (req?.user) {
      query.eStatus = 'active';
    } else {
      query.eStatus = 'active';
    }

    // Search filter
    if (search) {
      query.sName = new RegExp('^.*' + search + '.*', 'i');
    }

    // Grade filter
    if (gradeId) {
      query.iGradeId = mongoose.Types.ObjectId(gradeId);
    }

    // Subject filter
    if (subjectId) {
      query.iSubjectId = mongoose.Types.ObjectId(subjectId);
    }

    // Status filter
    if (termStatus) {
      query.eStatus = termStatus;
    }

    // Feature filter
    if (bFeature !== undefined) {
      query.bFeature = bFeature === 'true' || bFeature === true || bFeature === '1' || bFeature === 1;
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    let results = [];
    let total = 0;

    if ([true, 'true'].includes(isFullResponse)) {
      results = await TermModel.find(query)
        .sort(sortOptions)
        .lean();
      total = results.length;
    } else {
      [total, results] = await Promise.all([
        TermModel.countDocuments(query),
        TermModel.find(query)
          .sort(sortOptions)
          .skip(Number(start))
          .limit(Number(limit))
          .lean()
      ]);
    }

    // Get subject details if subjectId filter is applied
    let subjectDetails = null;
    if (subjectId) {
      const subject = await SubjectModel.findOne({ _id: subjectId }, { sName: 1 }).lean();
      subjectDetails = subject ? { id: subject._id, sName: subject.sName } : null;
    }

    // Add SEO data to all results
    const resultsWithSeo = await getSeoDataForRecords(results, data.eSeoType.map.TERM);

    // Get grade details if gradeId filter is applied
    let gradeDetails = null;
    if (gradeId) {
      const grade = await GradeModel.findOne({ _id: gradeId }, { sName: 1 }).lean();
      gradeDetails = grade ? { id: grade._id, sName: grade.sName } : null;
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].termsListed,
      data: { 
        total, 
        results: resultsWithSeo, 
        limit: [true, 'true'].includes(isFullResponse) ? null : Number(limit), 
        start: [true, 'true'].includes(isFullResponse) ? null : Number(start), 
        subjectDetails, 
        gradeDetails 
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveTerms' });
  }
};

module.exports = {
  createTerm,
  getTerm,
  updateTerm,
  deleteTerm,
  listTerms
};
