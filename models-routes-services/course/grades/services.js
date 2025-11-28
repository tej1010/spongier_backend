// grade.services.js
const { status, messages } = require('../../../helper/api.responses');
const { getPaginationValues2, handleServiceError } = require('../../../helper/utilities.services');
const GradeModel = require('./model');
const config = require('../../../config/config');
const { deleteObject } = require('../../../helper/s3config');
const SubjectModel = require('../subjects/model');
const TermModel = require('../terms/model');
const VideoModel = require('../videos/model');
const ResourceModel = require('../resource/model');
const { createSeoMeta, getSeoDataForRecord, getSeoDataForRecords } = require('../../../helper/seo.helper');
const data = require('../../../data');
const SeoModel = require('../../seo/model');

// Create grade
const createGrade = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { sName, iOrder, eStatus, sDescription, bFeature, sImage } = req.body;

    // Check if grade name already exists
    const existingGrade = await GradeModel.findOne({ sName: sName.trim(), eStatus: { $ne: 'inactive' } }).lean();
    if (existingGrade) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'gradeNameExists' });
    }

    // Check if iOrder already exists (enforce uniqueness at API level)
    if (typeof iOrder === 'number') {
      const iOrderExists = await GradeModel.findOne({ iOrder, eStatus: { $ne: 'inactive' } }).lean();
      if (iOrderExists) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'orderAlreadyExists' });
      }
    }

    const grade = new GradeModel({
      sName: sName.trim(),
      iOrder: iOrder || 0,
      eStatus: eStatus || 'active',
      sDescription: sDescription || '',
      bFeature: typeof bFeature === 'boolean' ? bFeature : false,
      sImage: sImage || ''
    });

    await grade.save();

    // fire-and-forget SEO meta
    createSeoMeta({
      eType: data.eSeoType.map.GRADE,
      iId: grade._id,
      sTitle: grade.sName,
      sDescription: grade.sDescription,
      contextNames: { eType: data.eSeoType.map.GRADE }
    });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].gradeCreated,
      data: { grade },
      error: {}
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'duplicateValue', data: { message: error.message } });
    }
    return handleServiceError(error, req, res, { messageKey: 'failedToCreateGrade' });
  }
};

// Get grade by ID
const getGrade = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;

    const grade = await GradeModel.findOne({ _id: id, eStatus: { $ne: 'inactive' } }).lean();
    if (!grade) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'gradeNotFound' });
    }

    // Add SEO data to the grade
    const gradeWithSeo = await getSeoDataForRecord(grade, data.eSeoType.map.GRADE);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].gradeRetrieved,
      data: { grade: gradeWithSeo },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveGrade' });
  }
};

// Update grade
const updateGrade = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const updateData = req.body;
    if (updateData.bFeature !== undefined && typeof updateData.bFeature !== 'boolean') {
      updateData.bFeature = ['true', '1', 1, true].includes(updateData.bFeature);
    }

    // Check if grade exists (allow inactive grades to be found for reactivation)
    const existingGrade = await GradeModel.findOne({ _id: id });
    if (!existingGrade) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'gradeNotFound' });
    }

    // Check if reactivating (status changing from inactive to active)
    const isReactivating = existingGrade.eStatus === 'inactive' && updateData.eStatus === 'active';
    const nameToCheck = updateData.sName ? updateData.sName.trim() : existingGrade.sName;
    const orderToCheck = updateData.iOrder !== undefined ? updateData.iOrder : existingGrade.iOrder;

    // Check if name conflicts with active grades (when updating name or reactivating)
    if ((updateData.sName && updateData.sName !== existingGrade.sName) || isReactivating) {
      const nameExists = await GradeModel.findOne({
        sName: nameToCheck,
        _id: { $ne: id },
        eStatus: { $ne: 'inactive' }
      }).lean();

      if (nameExists) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'gradeNameExists' });
      }
    }

    // Check if order conflicts with active grades (when updating order or reactivating)
    if ((updateData.iOrder !== undefined && updateData.iOrder !== existingGrade.iOrder) || isReactivating) {
      const orderExists = await GradeModel.findOne({
        iOrder: orderToCheck,
        _id: { $ne: id },
        eStatus: { $ne: 'inactive' }
      }).lean();
      if (orderExists) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'orderAlreadyExists' });
      }
    }

    // If image explicitly set to null, delete existing S3 object and clear field
    if (Object.prototype.hasOwnProperty.call(updateData, 'sImage') && updateData.sImage === null) {
      const currentImage = existingGrade.sImage;
      if (currentImage) {
        try {
          const key = currentImage.startsWith('http')
            ? currentImage.replace(config.S3_BUCKET_URL, '').replace(/^\//, '')
            : currentImage;
          await deleteObject({ Bucket: config.S3_BUCKET_NAME, Key: key });
        } catch (err) {
          // swallow deletion error; proceed to clear field
        }
      }
      updateData.sImage = '';
    }

    // Update the grade (allow updating inactive grades for reactivation)
    const updatedGrade = await GradeModel.findOneAndUpdate(
      { _id: id },
      updateData,
      { new: true, runValidators: true }
    );
    if (!updatedGrade) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'gradeNotFound' });
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].gradeUpdated,
      data: { grade: updatedGrade },
      error: {}
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'duplicateValue', data: { message: error.message } });
    }
    return handleServiceError(error, req, res, { messageKey: 'failedToUpdateGrade' });
  }
};

// Delete grade (soft delete + cascade)
const deleteGrade = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;

    const grade = await GradeModel.findOneAndUpdate({ _id: id, eStatus: { $ne: 'inactive' } }, { eStatus: 'inactive' }, { new: true });
    if (!grade) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'gradeNotFound' });
    }

    // Cascade soft delete to dependents
    await Promise.all([
      SubjectModel.updateMany({ iGradeId: id, eStatus: { $ne: 'inactive' } }, { $set: { eStatus: 'inactive' } }),
      TermModel.updateMany({ iGradeId: id, eStatus: { $ne: 'inactive' } }, { $set: { eStatus: 'inactive' } }),
      VideoModel.updateMany({ iGradeId: id, eStatus: { $ne: 'inactive' } }, { $set: { eStatus: 'inactive' } }),
      ResourceModel.updateMany({ iGradeId: id, eStatus: { $ne: 'inactive' } }, { $set: { eStatus: 'inactive' } })
    ]);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].gradeDeleted,
      data: {},
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToDeleteGrade' });
  }
};

// List grades
const listGrades = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { limit, start } = getPaginationValues2(req.query);
    const { search, status: gradeStatus, bFeature, sortBy = 'iOrder', sortOrder = 'asc', isFullResponse } = req.query;

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

    // Status filter
    if (gradeStatus) {
      query.eStatus = gradeStatus;
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
      // Get all grades with subject and video counts
      results = await GradeModel.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'subjects',
            localField: '_id',
            foreignField: 'iGradeId',
            as: 'subjects'
          }
        },
        {
          $lookup: {
            from: 'videos',
            localField: '_id',
            foreignField: 'iGradeId',
            as: 'videos'
          }
        },
        {
          $addFields: {
            nSubjectCount: {
              $size: {
                $filter: { input: '$subjects', as: 'subject', cond: { $ne: ['$$subject.eStatus', 'inactive'] } }
              }
            },
            nVideoCount: {
              $size: {
                $filter: {
                  input: '$videos',
                  as: 'video',
                  cond: { $and: [{ $ne: ['$$video.eStatus', 'inactive'] }, { $ne: ['$$video.bDelete', true] }] }
                }
              }
            }
          }
        },
        {
          $project: {
            subjects: 0,
            videos: 0
          }
        },
        { $sort: sortOptions }
      ]);
      total = results.length;
    } else {
      // Get paginated grades with subject and video counts
      const aggregationPipeline = [
        { $match: query },
        {
          $lookup: {
            from: 'subjects',
            localField: '_id',
            foreignField: 'iGradeId',
            as: 'subjects'
          }
        },
        {
          $lookup: {
            from: 'videos',
            localField: '_id',
            foreignField: 'iGradeId',
            as: 'videos'
          }
        },
        {
          $addFields: {
            nSubjectCount: {
              $size: {
                $filter: { input: '$subjects', as: 'subject', cond: { $ne: ['$$subject.eStatus', 'inactive'] } }
              }
            },
            nVideoCount: {
              $size: {
                $filter: {
                  input: '$videos',
                  as: 'video',
                  cond: { $and: [{ $ne: ['$$video.eStatus', 'inactive'] }, { $ne: ['$$video.bDelete', true] }] }
                }
              }
            }
          }
        },
        {
          $project: {
            subjects: 0,
            videos: 0
          }
        },
        { $sort: sortOptions }
      ];

      // Get total count and paginated results
      const [countResult, paginatedResults] = await Promise.all([
        GradeModel.aggregate([...aggregationPipeline.slice(0, 1), { $count: 'total' }]),
        GradeModel.aggregate([...aggregationPipeline, { $skip: Number(start) }, { $limit: Number(limit) }])
      ]);

      total = countResult[0]?.total || 0;
      results = paginatedResults;
    }

    // Add SEO data to all results
    const resultsWithSeo = await getSeoDataForRecords(results, data.eSeoType.map.GRADE);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].gradesRetrieved,
      data: {
        total,
        results: resultsWithSeo,
        limit: [true, 'true'].includes(isFullResponse) ? null : Number(limit),
        start: [true, 'true'].includes(isFullResponse) ? null : Number(start)
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveGrades' });
  }
};

// Helper function to add SEO data to subjects and videos
const addSeoDataToSubjectsAndVideos = async (subjects, gradeName) => {
  if (!subjects || subjects.length === 0) {
    return subjects;
  }

  try {
    // Get all subject IDs and video IDs
    const subjectIds = subjects.map(s => s._id);
    const allVideoIds = subjects.reduce((acc, subject) => {
      if (subject.videos && subject.videos.length > 0) {
        acc.push(...subject.videos.map(v => v._id));
      }
      return acc;
    }, []);

    // Fetch SEO data for subjects and videos
    const [subjectSeoData, videoSeoData] = await Promise.all([
      // Get SEO data for subjects
      (async () => {
        const seoData = await SeoModel.find({
          eType: data.eSeoType.map.SUBJECT,
          iId: { $in: subjectIds },
          eStatus: 'active'
        }, { iId: 1, sSlug: 1 }).lean();

        const seoMap = new Map();
        seoData.forEach(seo => {
          seoMap.set(String(seo.iId), {
            seoId: seo._id,
            slug: seo.sSlug
          });
        });
        return seoMap;
      })(),
      // Get SEO data for videos
      allVideoIds.length > 0 ? (async () => {
        const seoData = await SeoModel.find({
          eType: data.eSeoType.map.VIDEO,
          iId: { $in: allVideoIds },
          eStatus: 'active'
        }, { iId: 1, sSlug: 1 }).lean();

        const seoMap = new Map();
        seoData.forEach(seo => {
          seoMap.set(String(seo.iId), {
            seoId: seo._id,
            slug: seo.sSlug
          });
        });
        return seoMap;
      })() : new Map()
    ]);

    // Add SEO data to subjects and their videos
    return subjects.map(subject => {
      const subjectSeo = subjectSeoData.get(String(subject._id));
      const subjectWithSeo = {
        ...subject,
        seo: subjectSeo || null
      };

      // Add SEO data to videos if they exist
      if (subject.videos && subject.videos.length > 0) {
        subjectWithSeo.videos = subject.videos.map(video => {
          const videoSeo = videoSeoData.get(String(video._id));
          return {
            ...video,
            seo: videoSeo || null
          };
        });
      }

      return subjectWithSeo;
    });
  } catch (error) {
    console.error('Error adding SEO data to subjects and videos:', error);
    // Return original subjects if SEO fetch fails
    return subjects.map(subject => ({
      ...subject,
      seo: null,
      videos: subject.videos ? subject.videos.map(video => ({ ...video, seo: null })) : []
    }));
  }
};

// List featured grades with their subjects and video counts per subject
const featuredGrades = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { limit, start } = getPaginationValues2(req.query);
    const { sortBy = 'iOrder', sortOrder = 'asc' } = req.query;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // First, get featured grades
    const featuredGradesQuery = {
      bFeature: true,
      eStatus: 'active'
    };

    const featuredGrades = await GradeModel.find(featuredGradesQuery)
      .sort(sortOptions)
      .lean();

    // Get total count
    const total = featuredGrades.length;

    // Apply pagination
    const paginatedGrades = featuredGrades.slice(Number(start), Number(start) + Number(limit));

    // For each grade, get active subjects and per-subject video counts
    const results = await Promise.all(
      paginatedGrades.map(async (grade) => {
        // Fetch subjects for this grade
        const subjects = await SubjectModel.find({
          iGradeId: grade._id,
          eStatus: 'active'
        })
          .sort({ iOrder: 1 })
          .select('_id sName iOrder iGradeId sImage')
          .lean();

        if (subjects.length === 0) {
          return { ...grade, subjects: [], nSubjectCount: 0 };
        }

        // Fetch videos for these subjects (active and not deleted)
        const subjectIds = subjects.map((s) => s._id);
        const videos = await VideoModel.find({
          iSubjectId: { $in: subjectIds },
          eStatus: 'active',
          bDelete: { $ne: true }
        })
          .sort({ iOrder: 1 })
          .select('_id sTitle sThumbnailUrl iDuration sUrl iOrder iSubjectId iGradeId iLibraryId iExternalVideoId')
          .lean();

        const normalizedVideos = videos.map(video => ({
          ...video,
          videoId: video._id,
          libraryId: video.iLibraryId || '',
          externalId: video.iExternalVideoId || ''
        }));
        const subjectIdToVideos = new Map();
        for (const video of normalizedVideos) {
          const key = String(video.iSubjectId);
          if (!subjectIdToVideos.has(key)) subjectIdToVideos.set(key, []);
          subjectIdToVideos.get(key).push(video);
        }

        const subjectsWithVideos = subjects.map((s) => ({
          ...s,
          nVideoCount: subjectIdToVideos.get(String(s._id))?.length || 0,
          videos: subjectIdToVideos.get(String(s._id)) || []
        }));

        // Add SEO data to subjects and videos
        const subjectsWithSeo = await addSeoDataToSubjectsAndVideos(subjectsWithVideos, grade.sName);

        return { ...grade, subjects: subjectsWithSeo, nSubjectCount: subjects.length };
      })
    );

    // Add SEO data to all results
    const resultsWithSeo = await getSeoDataForRecords(results, data.eSeoType.map.GRADE);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].gradesRetrieved,
      data: { total, results: resultsWithSeo, limit: Number(limit), start: Number(start) },
      error: {}
    });
  } catch (error) {
    console.error('Error in featuredGrades:', error);
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveGrades' });
  }
};

module.exports = {
  createGrade,
  getGrade,
  updateGrade,
  deleteGrade,
  listGrades,
  featuredGrades
};
