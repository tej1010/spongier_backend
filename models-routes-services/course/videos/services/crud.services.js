// video.crud.services.js
const { status, messages } = require('../../../../helper/api.responses');
const { handleServiceError } = require('../../../../helper/utilities.services');
const VideoModel = require('../model');
const GradeModel = require('../../grades/model');
const SubjectModel = require('../../subjects/model');
const TermModel = require('../../terms/model');
const ResourceModel = require('../../resource/model');
const config = require('../../../../config/config');
const { deleteObject } = require('../../../../helper/s3config');
const { createSeoMeta, getSeoDataForRecord, getSeoDataForRecords } = require('../../../../helper/seo.helper');
const data = require('../../../../data');
const { uploadVideoBunny, generateSecureUrl, getBunnyCDNUrl } = require('../common');
const BookmarkModel = require('../../bookmarks/model');
const VideoLikeModel = require('../likes/model');

/**
 * Video CRUD Services
 * Handles create, update, delete operations for videos
 */

// Create video
const createVideo = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { iGradeId, iSubjectId, iTermId, sTitle, iDuration, sDescription, sS3Url, sUrl, sThumbnailUrl, eStatus, iOrder, bFeature, iLibraryId, iExternalVideoId } = req.body;

    // Check if grade exists
    const grade = await GradeModel.findOne({ _id: iGradeId, eStatus: { $ne: 'inactive' } }, null, { readPreference: 'primary' }).lean();
    if (!grade) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'gradeNotFound' });
    }

    // Check if subject exists
    const subject = await SubjectModel.findOne({ _id: iSubjectId, eStatus: { $ne: 'inactive' } }, null, { readPreference: 'primary' }).lean();
    if (!subject) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'subjectNotFound' });
    }

    // Check if subject belongs to the specified grade
    if (subject.iGradeId.toString() !== iGradeId) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'subjectNotInGrade' });
    }

    // Check if term exists
    const term = await TermModel.findOne({ _id: iTermId, eStatus: { $ne: 'inactive' } }, null, { readPreference: 'primary' }).lean();
    if (!term) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'termNotFound' });
    }

    // Check if term belongs to the specified grade and subject
    if (term.iGradeId.toString() !== iGradeId || term.iSubjectId.toString() !== iSubjectId) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'termNotInGradeOrSubject' });
    }

    // Enforce unique order within (grade+subject+term)
    if (typeof iOrder === 'number') {
      const orderExists = await VideoModel.findOne({ iGradeId, iSubjectId, iTermId, iOrder, eStatus: { $ne: 'inactive' } }).lean();
      if (orderExists) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'orderAlreadyExists' });
      }
    }

    const oUploadVideoBunny = await uploadVideoBunny({
      url: config.S3_BUCKET_URL + sS3Url,
      title: sTitle,
      description: sDescription || ''
    });

    const video = new VideoModel({
      iGradeId,
      iSubjectId,
      iTermId,
      sTitle: sTitle.trim(),
      iDuration,
      sDescription: sDescription || '',
      sUrl: sS3Url ? getBunnyCDNUrl(oUploadVideoBunny?.iVideoId) : String(sUrl).trim(),
      sThumbnailUrl: sThumbnailUrl ? String(sThumbnailUrl).trim() : '',
      iOrder: typeof iOrder === 'number' ? iOrder : 0,
      eStatus: sS3Url ? data.eVideoStatus.map.INPROGRESS : eStatus || data.eVideoStatus.map.ACTIVE,
      bFeature: typeof bFeature === 'boolean' ? bFeature : false,
      iLibraryId: sS3Url ? config.BUNNY_LIBRARY_ID : iLibraryId,
      iExternalVideoId: sS3Url ? oUploadVideoBunny?.iVideoId : iExternalVideoId,
      sS3Url
    });

    await video.save();

    // Create SEO meta
    await createSeoMeta({
      eType: data.eSeoType.map.VIDEO,
      iId: video._id,
      sTitle: video.sTitle,
      sDescription: video.sDescription,
      contextNames: { eType: data.eSeoType.map.VIDEO, gradeName: grade.sName, subjectName: subject.sName, termName: term.sName }
    });

    // Populate grade, subject, and term information
    const populatedVideo = await VideoModel.findById(video._id, null, { readPreference: 'primary' })
      .populate('iGradeId', 'sName iOrder')
      .populate('iSubjectId', 'sName')
      .populate('iTermId', 'sName')
      .lean();

    // Add SEO data to the video
    const videoWithSeo = await getSeoDataForRecord(populatedVideo, data.eSeoType.map.VIDEO);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].videoCreated,
      data: { video: videoWithSeo },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToCreateVideo' });
  }
};

// Get video by ID
const getVideo = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;

    const video = await VideoModel.findOne({ _id: id, eStatus: { $ne: 'inactive' } })
      .populate('iGradeId', 'sName iOrder')
      .populate('iSubjectId', 'sName')
      .populate('iTermId', 'sName')
      .lean();

    if (!video) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'videoNotFound' });
    }

    if (video.iLibraryId && video.iExternalVideoId) {
      video.sWebUrl = generateSecureUrl(video.iLibraryId, video.iExternalVideoId);
    }

    // Annotate bookmark and like flags for authenticated users
    const { ObjectId } = require('../../../../helper/utilities.services');
    if (req?.user?._id) {
      const userId = ObjectId(req.user._id);
      const [bookmarked, liked] = await Promise.all([
        BookmarkModel.findOne({ iUserId: userId, iVideoId: ObjectId(video._id), bDelete: false }, { _id: 1 }, { readPreference: 'primary' }).lean(),
        VideoLikeModel.findOne({ iUserId: userId, iVideoId: ObjectId(video._id), bDelete: false }, { _id: 1 }, { readPreference: 'primary' }).lean()
      ]);
      video.isBookmarked = Boolean(bookmarked);
      video.isLiked = Boolean(liked);
    } else {
      video.isBookmarked = false;
      video.isLiked = false;
    }

    // Ensure like and view counts are included
    video.nLikeCount = video.nLikeCount || 0;
    video.nViewCount = video.nViewCount || 0;

    // Add SEO data to the video
    const videoWithSeo = await getSeoDataForRecord(video, data.eSeoType.map.VIDEO);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].videoRetrieved,
      data: { video: videoWithSeo },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveVideo' });
  }
};

// Bulk create videos
const bulkCreateVideos = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const payload = req.body; // array

    // Collect unique ids for minimal DB lookups
    const gradeIds = [...new Set(payload.map((p) => p.iGradeId))];
    const subjectIds = [...new Set(payload.map((p) => p.iSubjectId))];
    const termIds = [...new Set(payload.map((p) => p.iTermId))];

    const [grades, subjects, terms] = await Promise.all([
      GradeModel.find({ _id: { $in: gradeIds }, eStatus: { $ne: 'inactive' } }, { _id: 1 }).lean(),
      SubjectModel.find({ _id: { $in: subjectIds }, eStatus: { $ne: 'inactive' } }, { _id: 1, iGradeId: 1 }).lean(),
      TermModel.find({ _id: { $in: termIds }, eStatus: { $ne: 'inactive' } }, { _id: 1, iGradeId: 1, iSubjectId: 1 }).lean()
    ]);

    const gradeSet = new Set(grades.map((g) => String(g._id)));
    const subjectMap = new Map(subjects.map((s) => [String(s._id), s]));
    const termMap = new Map(terms.map((t) => [String(t._id), t]));

    // Validate each entry
    for (const item of payload) {
      const gradeId = String(item.iGradeId);
      const subjectId = String(item.iSubjectId);
      const termId = String(item.iTermId);

      if (!gradeSet.has(gradeId)) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'gradeNotFound' });
      }

      const subj = subjectMap.get(subjectId);
      if (!subj) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'subjectNotFound' });
      }
      if (String(subj.iGradeId) !== gradeId) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'subjectNotInGrade' });
      }

      const term = termMap.get(termId);
      if (!term) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'termNotFound' });
      }
      if (String(term.iGradeId) !== gradeId || String(term.iSubjectId) !== subjectId) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'termNotInGradeOrSubject' });
      }
    }

    // Enforce unique order within (grade+subject+term) for bulk creation
    for (const item of payload) {
      const gradeId = String(item.iGradeId);
      const subjectId = String(item.iSubjectId);
      const termId = String(item.iTermId);
      const order = typeof item.iOrder === 'number' ? item.iOrder : 0;

      const orderExists = await VideoModel.findOne({
        iGradeId: gradeId,
        iSubjectId: subjectId,
        iTermId: termId,
        iOrder: order,
        eStatus: { $ne: 'inactive' },
        bFeature: item.bFeature
      }).lean();

      if (orderExists) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'orderAlreadyExists' });
      }
    }

    const aBunnyVideoPromise = [];
    payload.forEach((p) => {
      aBunnyVideoPromise.push(uploadVideoBunny({
        url: config.S3_BUCKET_URL + p.sS3Url,
        title: p.sTitle,
        description: p.sDescription || ''
      }));
    });

    const aBunnyVideoResponse = await Promise.all(aBunnyVideoPromise);

    const docs = payload.map((p, i) => ({
      iGradeId: p.iGradeId,
      iSubjectId: p.iSubjectId,
      iTermId: p.iTermId,
      sTitle: String(p.sTitle).trim(),
      iDuration: p.iDuration,
      sDescription: p.sDescription || '',
      sUrl: p.sS3Url ? getBunnyCDNUrl(aBunnyVideoResponse?.[i]?.iVideoId) : String(p.sUrl).trim(),
      sThumbnailUrl: p.sThumbnailUrl ? String(p.sThumbnailUrl).trim() : '',
      iOrder: typeof p.iOrder === 'number' ? p.iOrder : 0,
      eStatus: p.sS3Url ? data.eVideoStatus.map.INPROGRESS : p.eStatus || data.eVideoStatus.map.ACTIVE,
      sS3Url: p.sS3Url,
      iLibraryId: p.sS3Url ? config.BUNNY_LIBRARY_ID : p.iLibraryId,
      iExternalVideoId: p.sS3Url ? aBunnyVideoResponse?.[i]?.iVideoId : p.iExternalVideoId
    }));

    const created = await VideoModel.insertMany(docs, { ordered: false });

    const populated = await VideoModel.find({ _id: { $in: created.map((d) => d._id) } })
      .populate('iGradeId', 'sName')
      .populate('iSubjectId', 'sName')
      .populate('iTermId', 'sName')
      .lean();

    // fire-and-forget SEO meta creation for each video
    populated.forEach((video) => {
      createSeoMeta({
        eType: data.eSeoType.map.VIDEO,
        iId: video._id,
        sTitle: video.sTitle,
        sDescription: video.sDescription,
        contextNames: { eType: data.eSeoType.map.VIDEO, gradeName: video.iGradeId.sName, subjectName: video.iSubjectId.sName, termName: video.iTermId.sName }
      });
    });

    // Add SEO data to all videos
    const populatedWithSeo = await getSeoDataForRecords(populated, data.eSeoType.map.VIDEO);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].videoCreated,
      data: { videos: populatedWithSeo },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToCreateVideo' });
  }
};

// Update video
const updateVideo = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if video exists
    const existingVideo = await VideoModel.findOne({ _id: id, eStatus: { $ne: 'inactive' } });
    if (!existingVideo) {
      return res.status(status.NotFound).json({
        success: false,
        message: messages[lang].videoNotFound,
        data: {},
        error: {}
      });
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
      const gradeId = updateData.iGradeId || existingVideo.iGradeId;
      if (subject.iGradeId.toString() !== gradeId.toString()) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'subjectNotInGrade' });
      }
    }

    // Check if term exists (if being updated)
    if (updateData.iTermId) {
      const term = await TermModel.findOne({ _id: updateData.iTermId, eStatus: { $ne: 'inactive' } }).lean();
      if (!term) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'termNotFound' });
      }

      // Check if term belongs to the specified grade and subject
      const gradeId = updateData.iGradeId || existingVideo.iGradeId;
      const subjectId = updateData.iSubjectId || existingVideo.iSubjectId;
      if (term.iGradeId.toString() !== gradeId.toString() || term.iSubjectId.toString() !== subjectId.toString()) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'termNotInGradeOrSubject' });
      }
    }

    // If iOrder is being updated, enforce uniqueness within (grade+subject+term)
    if (updateData.iOrder !== undefined && updateData.iOrder !== existingVideo.iOrder) {
      const targetGradeId = updateData.iGradeId || existingVideo.iGradeId;
      const targetSubjectId = updateData.iSubjectId || existingVideo.iSubjectId;
      const targetTermId = updateData.iTermId || existingVideo.iTermId;
      const orderExists = await VideoModel.findOne({ iGradeId: targetGradeId, iSubjectId: targetSubjectId, iTermId: targetTermId, iOrder: updateData.iOrder, _id: { $ne: id }, eStatus: { $ne: 'inactive' } }).lean();
      if (orderExists) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'orderAlreadyExists' });
      }
    }

    // Handle bFeature conversion
    if (updateData.bFeature !== undefined && typeof updateData.bFeature !== 'boolean') {
      updateData.bFeature = ['true', '1', 1, true].includes(updateData.bFeature);
    }

    // If thumbnail explicitly set to null, delete from S3 and clear field; else normalize
    if (Object.prototype.hasOwnProperty.call(updateData, 'sThumbnailUrl') && updateData.sThumbnailUrl === null) {
      const currentThumb = existingVideo.sThumbnailUrl;
      if (currentThumb) {
        try {
          const key = currentThumb.startsWith('http')
            ? currentThumb.replace(config.S3_BUCKET_URL, '').replace(/^\//, '')
            : currentThumb;
          await deleteObject({ Bucket: config.S3_BUCKET_NAME, Key: key });
        } catch (err) {
          // ignore deletion errors
        }
      }
      updateData.sThumbnailUrl = '';
    } else if (updateData.sThumbnailUrl !== undefined) {
      updateData.sThumbnailUrl = updateData.sThumbnailUrl ? String(updateData.sThumbnailUrl).trim() : '';
    }

    if (updateData?.sS3Url && existingVideo?.sS3Url !== updateData?.sS3Url) {
      const oUploadVideoBunny = await uploadVideoBunny({
        url: config.S3_BUCKET_URL + updateData.sS3Url,
        title: updateData.sTitle,
        description: updateData.sDescription || ''
      });

      updateData.iExternalVideoId = oUploadVideoBunny?.iVideoId;
      updateData.sUrl = getBunnyCDNUrl(oUploadVideoBunny?.iVideoId);
    }

    // Update the video
    const updatedVideo = await VideoModel.findOneAndUpdate(
      { _id: id, eStatus: { $ne: 'inactive' } },
      updateData,
      { new: true, runValidators: true, readPreference: 'primary' }
    ).populate('iGradeId', 'sName iOrder')
      .populate('iSubjectId', 'sName')
      .populate('iTermId', 'sName')
      .lean();
    if (!updatedVideo) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'videoNotFound' });
    }

    // Add SEO data to the video
    const videoWithSeo = await getSeoDataForRecord(updatedVideo, data.eSeoType.map.VIDEO);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].videoUpdated,
      data: { video: videoWithSeo },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToUpdateVideo' });
  }
};

// Delete video (soft delete + cascade resource)
const deleteVideo = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;

    const video = await VideoModel.findOneAndUpdate({ _id: id, eStatus: { $ne: 'inactive' } }, { eStatus: 'inactive' }, { new: true });
    if (!video) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'videoNotFound' });
    }

    await ResourceModel.updateMany({ iVideoId: id, eStatus: { $ne: 'inactive' } }, { $set: { eStatus: 'inactive' } });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].videoDeleted,
      data: {},
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToDeleteVideo' });
  }
};

module.exports = {
  createVideo,
  bulkCreateVideos,
  getVideo,
  updateVideo,
  deleteVideo
};
