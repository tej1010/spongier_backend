// subject.services.js
const mongoose = require('mongoose');
const { messages, status } = require('../../../helper/api.responses');
const { handleServiceError } = require('../../../helper/utilities.services');
const SubjectModel = require('./model');
const GradeModel = require('../grades/model');
const TermModel = require('../terms/model');
const VideoModel = require('../videos/model');
const ResourceModel = require('../resource/model');
const config = require('../../../config/config');
const { deleteObject } = require('../../../helper/s3config');
const { getPaginationValues2 } = require('../../../helper/utilities.services');
const { createSeoMeta, getSeoDataForRecord, getSeoDataForRecords } = require('../../../helper/seo.helper');
const data = require('../../../data');

const normalizeFeatureFlag = (value) => {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase();
    if (['true', '1', 'yes'].includes(lowerValue)) return true;
    if (['false', '0', 'no'].includes(lowerValue)) return false;
  }
  return false;
};

const hasFeatureImageValue = (value) => typeof value === 'string' && value.trim().length > 0;

const getFeatureImageRequiredMessage = (lang) => {
  if (messages[lang] && messages[lang].featureImageRequired) {
    return messages[lang].featureImageRequired;
  }
  return 'Feature image is required when subject is marked as featured';
};

// Create subject
const createSubject = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { sName, sDescription, iGradeId, iOrder, eStatus, bFeature, sImage, sFeatureImage, sTeacher } = req.body;

    // Check if grade exists
    const grade = await GradeModel.findOne({ _id: iGradeId, eStatus: { $ne: 'inactive' } }).lean();
    if (!grade) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang].gradeNotFound,
        data: {},
        error: {}
      });
    }

    // Check if subject name already exists in the same grade
    const existingSubject = await SubjectModel.findOne({
      sName: sName.trim(),
      iGradeId,
      eStatus: { $ne: 'inactive' }
    }).lean();

    if (existingSubject) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang].subjectNameExists,
        data: {},
        error: {}
      });
    }

    // Enforce unique order within grade (excluding deleted)
    if (typeof iOrder === 'number') {
      const orderExists = await SubjectModel.findOne({ iGradeId, iOrder, eStatus: { $ne: 'inactive' } }).lean();
      if (orderExists) {
        return res.status(status.BadRequest).json({
          success: false,
          message: messages[lang].orderAlreadyExists,
          data: {},
          error: {}
        });
      }
    }

    const normalizedFeature = normalizeFeatureFlag(bFeature);
    const isFeatured = normalizedFeature === undefined ? false : normalizedFeature;

    if (isFeatured && !hasFeatureImageValue(sFeatureImage)) {
      return res.status(status.BadRequest).json({
        success: false,
        message: getFeatureImageRequiredMessage(lang),
        data: {},
        error: {}
      });
    }

    const subject = new SubjectModel({
      sName: sName.trim(),
      sDescription: sDescription || '',
      iGradeId,
      iOrder: iOrder || 0,
      eStatus: eStatus || 'active',
      bFeature: isFeatured,
      sImage: sImage || '',
      sFeatureImage: hasFeatureImageValue(sFeatureImage) ? sFeatureImage : '',
      sTeacher: sTeacher || ''
    });

    await subject.save();

    // fire-and-forget SEO meta
    createSeoMeta({
      eType: data.eSeoType.map.SUBJECT,
      iId: subject._id,
      sTitle: subject.sName,
      sDescription: subject.sDescription,
      contextNames: { eType: data.eSeoType.map.SUBJECT, gradeName: grade.sName }
    });

    // Populate grade information
    const populatedSubject = await SubjectModel.findById(subject._id)
      .populate('iGradeId', 'sName iOrder')
      .lean();

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].subjectCreated,
      data: { subject: populatedSubject },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToCreateSubject' });
  }
};

// Get subject by ID
const getSubject = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;

    // Find the subject and populate grade information
    const subject = await SubjectModel.findOne({ _id: id, eStatus: { $ne: 'inactive' } })
      .populate('iGradeId', 'sName iOrder eStatus')
      .lean();

    if (!subject) {
      return res.status(status.NotFound).json({
        success: false,
        message: messages[lang].notFound.replace('##', messages[lang].cSubject),
        data: {},
        error: {}
      });
    }

    // Check if the subject is active
    if (subject.eStatus !== 'active') {
      return res.status(status.NotFound).json({
        success: false,
        message: messages[lang].notFound.replace('##', messages[lang].cSubject),
        data: {},
        error: {}
      });
    }

    // Compute video count for this subject
    const nVideoCount = await VideoModel.countDocuments({ iSubjectId: id, eStatus: { $ne: 'inactive' }, bDelete: { $ne: true } });

    // Add SEO data to the subject
    const subjectWithSeo = await getSeoDataForRecord({ ...subject, nVideoCount }, data.eSeoType.map.SUBJECT);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].subjectFetched,
      data: { subject: subjectWithSeo },
      error: {}
    });
  } catch (error) {
    console.error('Error in getSubject:', error);
    return handleServiceError(error, req, res, { messageKey: 'internalServerError' });
  }
};

// Update subject
const updateSubject = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const { sName, sDescription, iGradeId, iOrder, eStatus, bFeature, sImage, sFeatureImage, sTeacher } = req.body;

    // Check if subject exists
    const subject = await SubjectModel.findOne({ _id: id, eStatus: { $ne: 'inactive' } });
    if (!subject) {
      return res.status(status.NotFound).json({
        success: false,
        message: messages[lang].subjectNotFound,
        data: {},
        error: {}
      });
    }

    // If grade ID is being updated, check if it exists
    if (iGradeId && iGradeId !== subject.iGradeId.toString()) {
      const grade = await GradeModel.findOne({ _id: iGradeId, eStatus: { $ne: 'inactive' } }).lean();
      if (!grade) {
        return res.status(status.BadRequest).json({
          success: false,
          message: messages[lang].gradeNotFound,
          data: {},
          error: {}
        });
      }
      subject.iGradeId = iGradeId;
    }

    // Check if name is being updated and if it already exists in the same grade
    if (sName && sName.trim() !== subject.sName) {
      const existingSubject = await SubjectModel.findOne({
        sName: sName.trim(),
        iGradeId: subject.iGradeId,
        _id: { $ne: id },
        eStatus: { $ne: 'inactive' }
      }).lean();

      if (existingSubject) {
        return res.status(status.BadRequest).json({
          success: false,
          message: messages[lang].subjectNameExists,
          data: {},
          error: {}
        });
      }
      subject.sName = sName.trim();
    }

    // If iOrder is being updated, enforce uniqueness within the (grade) scope
    if (iOrder !== undefined && iOrder !== subject.iOrder) {
      const orderExists = await SubjectModel.findOne({ iGradeId: subject.iGradeId, iOrder, _id: { $ne: id }, eStatus: { $ne: 'inactive' } }).lean();
      if (orderExists) {
        return res.status(status.BadRequest).json({
          success: false,
          message: messages[lang].orderAlreadyExists,
          data: {},
          error: {}
        });
      }
    }

    const normalizedFeatureRequest = normalizeFeatureFlag(bFeature);
    const finalFeatureFlag = normalizedFeatureRequest === undefined ? subject.bFeature : normalizedFeatureRequest;
    const requestedFeatureImageValue = sFeatureImage === undefined ? subject.sFeatureImage : (sFeatureImage === null ? '' : sFeatureImage);

    if (finalFeatureFlag && !hasFeatureImageValue(requestedFeatureImageValue)) {
      return res.status(status.BadRequest).json({
        success: false,
        message: getFeatureImageRequiredMessage(lang),
        data: {},
        error: {}
      });
    }

    // If image explicitly set to null, delete existing S3 object and clear field
    if (Object.prototype.hasOwnProperty.call(req.body, 'sImage') && sImage === null) {
      const currentImage = subject.sImage;
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
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'sFeatureImage') && sFeatureImage === null) {
      const currentFeatureImage = subject.sFeatureImage;
      if (currentFeatureImage) {
        try {
          const key = currentFeatureImage.startsWith('http')
            ? currentFeatureImage.replace(config.S3_BUCKET_URL, '').replace(/^\//, '')
            : currentFeatureImage;
          await deleteObject({ Bucket: config.S3_BUCKET_NAME, Key: key });
        } catch (err) {
          // ignore deletion errors
        }
      }
    }

    // Update other fields if provided
    if (sDescription !== undefined) subject.sDescription = sDescription;
    if (iOrder !== undefined) subject.iOrder = iOrder;
    if (eStatus) subject.eStatus = eStatus;
    if (normalizedFeatureRequest !== undefined) subject.bFeature = normalizedFeatureRequest;
    if (sImage !== undefined) subject.sImage = sImage === null ? '' : sImage;
    if (sFeatureImage !== undefined) subject.sFeatureImage = sFeatureImage === null ? '' : sFeatureImage;
    if (sTeacher !== undefined) subject.sTeacher = sTeacher;

    await subject.save();

    // Populate grade information
    const updatedSubject = await SubjectModel.findById(subject._id)
      .populate('iGradeId', 'sName iOrder')
      .lean();

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].subjectUpdated,
      data: { subject: updatedSubject },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToUpdateSubject' });
  }
};

// Delete subject (soft delete + cascade)
const deleteSubject = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const subject = await SubjectModel.findOneAndUpdate({ _id: id, eStatus: { $ne: 'inactive' } }, { eStatus: 'inactive' }, { new: true });

    if (!subject) {
      return res.status(status.NotFound).json({
        success: false,
        message: messages[lang].subjectNotFound,
        data: {},
        error: {}
      });
    }

    // cascade soft-delete to terms, videos, resources
    await Promise.all([
      TermModel.updateMany({ iSubjectId: id, eStatus: { $ne: 'inactive' } }, { $set: { eStatus: 'inactive' } }),
      VideoModel.updateMany({ iSubjectId: id, eStatus: { $ne: 'inactive' } }, { $set: { eStatus: 'inactive' } }),
      ResourceModel.updateMany({ iSubjectId: id, eStatus: { $ne: 'inactive' } }, { $set: { eStatus: 'inactive' } })
    ]);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].subjectDeleted,
      data: {},
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToDeleteSubject' });
  }
};

// List subjects
const listSubjects = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { limit, start } = getPaginationValues2(req.query);
    const { search, gradeId, status: subjectStatus, bFeature, sortBy = 'iOrder', sortOrder = 'asc', isFullResponse } = req.query;

    // let query = { eStatus: { $ne: 'inactive' } };
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

    // Status filter
    if (subjectStatus) {
      query.eStatus = subjectStatus;
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
      results = await SubjectModel.find(query)
        .sort(sortOptions)
        .populate('iGradeId', 'sName iOrder')
        .lean();
      total = results.length;
    } else {
      [total, results] = await Promise.all([
        SubjectModel.countDocuments(query),
        SubjectModel.find(query)
          .sort(sortOptions)
          .skip(Number(start))
          .limit(Number(limit))
          .populate('iGradeId', 'sName iOrder')
          .lean()
      ]);
    }

    // Add term counts to each subject
    const subjectIds = results.map(subject => subject._id);
    const termCounts = await TermModel.aggregate([
      {
        $match: {
          iSubjectId: { $in: subjectIds },
          eStatus: { $ne: 'inactive' }
        }
      },
      {
        $group: {
          _id: '$iSubjectId',
          termCount: { $sum: 1 }
        }
      }
    ]);

    // Create a map of subject ID to term count
    const termCountMap = {};
    termCounts.forEach(count => {
      termCountMap[count._id.toString()] = count.termCount;
    });

    // Add video counts for each subject
    const videoCounts = await VideoModel.aggregate([
      {
        $match: {
          iSubjectId: { $in: subjectIds },
          eStatus: { $ne: 'inactive' },
          bDelete: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$iSubjectId',
          videoCount: { $sum: 1 }
        }
      }
    ]);
    const videoCountMap = {};
    videoCounts.forEach(count => {
      videoCountMap[count._id.toString()] = count.videoCount;
    });

    // Add term and video count to each subject result
    const resultsWithCounts = results.map(subject => ({
      ...subject,
      nTermCount: termCountMap[subject._id.toString()] || 0,
      nVideoCount: videoCountMap[subject._id.toString()] || 0
    }));

    // Add SEO data to all results
    const resultsWithSeo = await getSeoDataForRecords(resultsWithCounts, data.eSeoType.map.SUBJECT);

    // Get grade details if gradeId filter is applied
    let gradeDetails = null;
    if (gradeId) {
      const grade = await GradeModel.findOne({ _id: gradeId }, { sName: 1 }).lean();
      gradeDetails = grade ? { id: grade._id, sName: grade.sName } : null;
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].subjectsListed,
      data: { 
        total, 
        results: resultsWithSeo, 
        limit: [true, 'true'].includes(isFullResponse) ? null : Number(limit), 
        start: [true, 'true'].includes(isFullResponse) ? null : Number(start), 
        gradeDetails 
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveSubjects' });
  }
};

// Get related subjects (same grade, different subject)
const getRelatedSubjects = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const { limit = 6, sortBy = 'iOrder', sortOrder = 'asc' } = req.query;

    // Find the subject to get its grade
    const subject = await SubjectModel.findOne({ _id: id, eStatus: 'active' }).lean();

    if (!subject) {
      return res.status(status.NotFound).json({
        success: false,
        message: messages[lang].notFound.replace('##', messages[lang].cSubject),
        data: {},
        error: {}
      });
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Find related subjects in the same grade (excluding current subject)
    const relatedSubjects = await SubjectModel.find({
      iGradeId: subject.iGradeId,
      _id: { $ne: id },
      eStatus: 'active'
    })
      .sort(sortOptions)
      .limit(Number(limit))
      .populate('iGradeId', 'sName iOrder')
      .lean();

    // Get video counts for each related subject
    const subjectIds = relatedSubjects.map(s => s._id);
    let videoCounts = [];
    if (subjectIds.length) {
      videoCounts = await VideoModel.aggregate([
        {
          $match: {
            iSubjectId: { $in: subjectIds },
            eStatus: 'active',
            bDelete: { $ne: true }
          }
        },
        {
          $group: {
            _id: '$iSubjectId',
            nVideoCount: { $sum: 1 }
          }
        }
      ]);
    }

    // Create a map of subject ID to video count
    const videoCountMap = new Map(videoCounts.map(v => [String(v._id), v.nVideoCount]));

    // Add video count to each related subject
    const resultsWithCounts = relatedSubjects.map(s => ({
      ...s,
      nVideoCount: videoCountMap.get(String(s._id)) || 0
    }));

    // Add SEO data to results
    const resultsWithSeo = await getSeoDataForRecords(resultsWithCounts, data.eSeoType.map.SUBJECT);

    // Get grade details
    const grade = await GradeModel.findOne({ _id: subject.iGradeId }, { sName: 1 }).lean();
    const gradeDetails = grade ? { id: grade._id, sName: grade.sName } : null;

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].relatedSubjectsRetrieved || messages[lang].subjectsListed,
      data: {
        total: resultsWithSeo.length,
        results: resultsWithSeo,
        limit: Number(limit),
        start: 0,
        currentSubject: {
          id: subject._id,
          sName: subject.sName
        },
        gradeDetails
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveSubjects' });
  }
};

module.exports = {
  createSubject,
  getSubject,
  updateSubject,
  deleteSubject,
  listSubjects,
  getRelatedSubjects
};
