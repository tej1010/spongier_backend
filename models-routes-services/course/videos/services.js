module.exports = require('./services/index');
// // video.services.js
// const mongoose = require('mongoose');
// const { status, messages } = require('../../../helper/api.responses');
// const { handleServiceError, ObjectId } = require('../../../helper/utilities.services');
// const VideoModel = require('./model');
// const GradeModel = require('../grades/model');
// const SubjectModel = require('../subjects/model');
// const TermModel = require('../terms/model');
// const ResourceModel = require('../resource/model');
// const config = require('../../../config/config');
// const { deleteObject } = require('../../../helper/s3config');
// const { getPaginationValues2 } = require('../../../helper/utilities.services');
// const { createSeoMeta, getSeoDataForRecord, getSeoDataForRecords } = require('../../../helper/seo.helper');
// const data = require('../../../data');
// const BookmarkModel = require('../bookmarks/model');
// const VideoCommentModel = require('./comments/model');
// const UserModel = require('../../user/model');
// const SubscriptionModel = require('../../subscription/model');
// const { generateSecureUrl, uploadVideoBunny, getBunnyVideoStatus } = require('./common');
// const s3Config = require('../../../helper/s3config');

// // Create video
// const createVideo = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { iGradeId, iSubjectId, iTermId, sTitle, iDuration, sDescription, sS3Url, sUrl, sThumbnailUrl, eStatus, iOrder, bFeature, iLibraryId, iExternalVideoId } = req.body;

//     // Check if grade exists
//     const grade = await GradeModel.findOne({ _id: iGradeId, eStatus: { $ne: 'inactive' } }, null, { readPreference: 'primary' }).lean();
//     if (!grade) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'gradeNotFound' });
//     }

//     // Check if subject exists
//     const subject = await SubjectModel.findOne({ _id: iSubjectId, eStatus: { $ne: 'inactive' } }, null, { readPreference: 'primary' }).lean();
//     if (!subject) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'subjectNotFound' });
//     }

//     // Check if subject belongs to the specified grade
//     if (subject.iGradeId.toString() !== iGradeId) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'subjectNotInGrade' });
//     }

//     // Check if term exists
//     const term = await TermModel.findOne({ _id: iTermId, eStatus: { $ne: 'inactive' } }, null, { readPreference: 'primary' }).lean();
//     if (!term) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'termNotFound' });
//     }

//     // Check if term belongs to the specified grade and subject
//     if (term.iGradeId.toString() !== iGradeId || term.iSubjectId.toString() !== iSubjectId) {
//       return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'termNotInGradeOrSubject' });
//     }

//     // Enforce unique order within (grade+subject+term)
//     if (typeof iOrder === 'number') {
//       const orderExists = await VideoModel.findOne({ iGradeId, iSubjectId, iTermId, iOrder, eStatus: { $ne: 'inactive' } }).lean();
//       if (orderExists) {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'orderAlreadyExists' });
//       }
//     }

//     const oUploadVideoBunny = await uploadVideoBunny({
//       url: config.S3_BUCKET_URL + sS3Url,
//       title: sTitle,
//       description: sDescription || ''
//     });

//     const video = new VideoModel({
//       iGradeId,
//       iSubjectId,
//       iTermId,
//       sTitle: sTitle.trim(),
//       iDuration,
//       sDescription: sDescription || '',
//       sUrl: String(sUrl).trim(),
//       sThumbnailUrl: sThumbnailUrl ? String(sThumbnailUrl).trim() : '',
//       iOrder: typeof iOrder === 'number' ? iOrder : 0,
//       eStatus: sS3Url ? data.eVideoStatus.map.INPROGRESS : eStatus || data.eVideoStatus.map.ACTIVE,
//       bFeature: typeof bFeature === 'boolean' ? bFeature : false,
//       iLibraryId: iLibraryId || config.BUNNY_LIBRARY_ID,
//       iExternalVideoId: iExternalVideoId || oUploadVideoBunny?.iVideoId,
//       sS3Url
//     });

//     await video.save();

//     // Create SEO meta
//     await createSeoMeta({
//       eType: data.eSeoType.map.VIDEO,
//       iId: video._id,
//       sTitle: video.sTitle,
//       sDescription: video.sDescription,
//       contextNames: { eType: data.eSeoType.map.VIDEO, gradeName: grade.sName, subjectName: subject.sName, termName: term.sName }
//     });

//     // Populate grade, subject, and term information
//     const populatedVideo = await VideoModel.findById(video._id, null, { readPreference: 'primary' })
//       .populate('iGradeId', 'sName iOrder')
//       .populate('iSubjectId', 'sName')
//       .populate('iTermId', 'sName')
//       .lean();

//     // Add SEO data to the video
//     const videoWithSeo = await getSeoDataForRecord(populatedVideo, data.eSeoType.map.VIDEO);

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].videoCreated,
//       data: { video: videoWithSeo },
//       error: {}
//     });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'failedToCreateVideo' });
//   }
// };

// // Bulk create videos
// const bulkCreateVideos = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const payload = req.body; // array

//     // Collect unique ids for minimal DB lookups
//     const gradeIds = [...new Set(payload.map((p) => p.iGradeId))];
//     const subjectIds = [...new Set(payload.map((p) => p.iSubjectId))];
//     const termIds = [...new Set(payload.map((p) => p.iTermId))];

//     const [grades, subjects, terms] = await Promise.all([
//       GradeModel.find({ _id: { $in: gradeIds }, eStatus: { $ne: 'inactive' } }, { _id: 1 }).lean(),
//       SubjectModel.find({ _id: { $in: subjectIds }, eStatus: { $ne: 'inactive' } }, { _id: 1, iGradeId: 1 }).lean(),
//       TermModel.find({ _id: { $in: termIds }, eStatus: { $ne: 'inactive' } }, { _id: 1, iGradeId: 1, iSubjectId: 1 }).lean()
//     ]);

//     const gradeSet = new Set(grades.map((g) => String(g._id)));
//     const subjectMap = new Map(subjects.map((s) => [String(s._id), s]));
//     const termMap = new Map(terms.map((t) => [String(t._id), t]));

//     // Validate each entry
//     for (const item of payload) {
//       const gradeId = String(item.iGradeId);
//       const subjectId = String(item.iSubjectId);
//       const termId = String(item.iTermId);

//       if (!gradeSet.has(gradeId)) {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'gradeNotFound' });
//       }

//       const subj = subjectMap.get(subjectId);
//       if (!subj) {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'subjectNotFound' });
//       }
//       if (String(subj.iGradeId) !== gradeId) {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'subjectNotInGrade' });
//       }

//       const term = termMap.get(termId);
//       if (!term) {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'termNotFound' });
//       }
//       if (String(term.iGradeId) !== gradeId || String(term.iSubjectId) !== subjectId) {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'termNotInGradeOrSubject' });
//       }
//     }

//     // Enforce unique order within (grade+subject+term) for bulk creation
//     for (const item of payload) {
//       const gradeId = String(item.iGradeId);
//       const subjectId = String(item.iSubjectId);
//       const termId = String(item.iTermId);
//       const order = typeof item.iOrder === 'number' ? item.iOrder : 0;

//       const orderExists = await VideoModel.findOne({
//         iGradeId: gradeId,
//         iSubjectId: subjectId,
//         iTermId: termId,
//         iOrder: order,
//         eStatus: { $ne: 'inactive' },
//         bFeature: item.bFeature
//       }).lean();

//       if (orderExists) {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'orderAlreadyExists' });
//       }
//     }

//     const docs = payload.map((p) => ({
//       iGradeId: p.iGradeId,
//       iSubjectId: p.iSubjectId,
//       iTermId: p.iTermId,
//       sTitle: String(p.sTitle).trim(),
//       iDuration: p.iDuration,
//       sDescription: p.sDescription || '',
//       sUrl: String(p.sUrl).trim(),
//       sThumbnailUrl: p.sThumbnailUrl ? String(p.sThumbnailUrl).trim() : '',
//       iOrder: typeof p.iOrder === 'number' ? p.iOrder : 0,
//       eStatus: p.eStatus || 'active',
//       iLibraryId: p.iLibraryId,
//       iExternalVideoId: p.iExternalVideoId
//     }));

//     const created = await VideoModel.insertMany(docs, { ordered: false });

//     const populated = await VideoModel.find({ _id: { $in: created.map((d) => d._id) } })
//       .populate('iGradeId', 'sName')
//       .populate('iSubjectId', 'sName')
//       .populate('iTermId', 'sName')
//       .lean();

//     // fire-and-forget SEO meta creation for each video
//     populated.forEach((video) => {
//       createSeoMeta({
//         eType: data.eSeoType.map.VIDEO,
//         iId: video._id,
//         sTitle: video.sTitle,
//         sDescription: video.sDescription,
//         contextNames: { eType: data.eSeoType.map.VIDEO, gradeName: video.iGradeId.sName, subjectName: video.iSubjectId.sName, termName: video.iTermId.sName }
//       });
//     });

//     // Add SEO data to all videos
//     const populatedWithSeo = await getSeoDataForRecords(populated, data.eSeoType.map.VIDEO);

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].videoCreated,
//       data: { videos: populatedWithSeo },
//       error: {}
//     });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'failedToCreateVideo' });
//   }
// };

// // Get video by ID
// const getVideo = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { id } = req.params;

//     const video = await VideoModel.findOne({ _id: id, eStatus: { $ne: 'inactive' } })
//       .populate('iGradeId', 'sName iOrder')
//       .populate('iSubjectId', 'sName')
//       .populate('iTermId', 'sName')
//       .lean();

//     if (!video) {
//       return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'videoNotFound' });
//     }

//     if (video.iLibraryId && video.iExternalVideoId) {
//       video.sWebUrl = generateSecureUrl(video.iLibraryId, video.iExternalVideoId);
//     }

//     // Annotate bookmark flag for authenticated users
//     if (req?.user?._id) {
//       const bookmarked = await BookmarkModel.findOne({ iUserId: ObjectId(req.user._id), iVideoId: ObjectId(video._id), bDelete: false }, { _id: 1 }, { readPreference: 'primary' }).lean();
//       video.isBookmarked = Boolean(bookmarked);
//     } else {
//       video.isBookmarked = false;
//     }

//     // Add SEO data to the video
//     const videoWithSeo = await getSeoDataForRecord(video, data.eSeoType.map.VIDEO);

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].videoRetrieved,
//       data: { video: videoWithSeo },
//       error: {}
//     });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveVideo' });
//   }
// };

// // Update video
// const updateVideo = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { id } = req.params;
//     const updateData = req.body;

//     // Check if video exists
//     const existingVideo = await VideoModel.findOne({ _id: id, eStatus: { $ne: 'inactive' } });
//     if (!existingVideo) {
//       return res.status(status.NotFound).json({
//         success: false,
//         message: messages[lang].videoNotFound,
//         data: {},
//         error: {}
//       });
//     }

//     // Check if grade exists (if being updated)
//     if (updateData.iGradeId) {
//       const grade = await GradeModel.findOne({ _id: updateData.iGradeId, eStatus: { $ne: 'inactive' } }).lean();
//       if (!grade) {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'gradeNotFound' });
//       }
//     }

//     // Check if subject exists (if being updated)
//     if (updateData.iSubjectId) {
//       const subject = await SubjectModel.findOne({ _id: updateData.iSubjectId, eStatus: { $ne: 'inactive' } }).lean();
//       if (!subject) {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'subjectNotFound' });
//       }

//       // Check if subject belongs to the specified grade
//       const gradeId = updateData.iGradeId || existingVideo.iGradeId;
//       if (subject.iGradeId.toString() !== gradeId.toString()) {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'subjectNotInGrade' });
//       }
//     }

//     // Check if term exists (if being updated)
//     if (updateData.iTermId) {
//       const term = await TermModel.findOne({ _id: updateData.iTermId, eStatus: { $ne: 'inactive' } }).lean();
//       if (!term) {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'termNotFound' });
//       }

//       // Check if term belongs to the specified grade and subject
//       const gradeId = updateData.iGradeId || existingVideo.iGradeId;
//       const subjectId = updateData.iSubjectId || existingVideo.iSubjectId;
//       if (term.iGradeId.toString() !== gradeId.toString() || term.iSubjectId.toString() !== subjectId.toString()) {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'termNotInGradeOrSubject' });
//       }
//     }

//     // If iOrder is being updated, enforce uniqueness within (grade+subject+term)
//     if (updateData.iOrder !== undefined && updateData.iOrder !== existingVideo.iOrder) {
//       const targetGradeId = updateData.iGradeId || existingVideo.iGradeId;
//       const targetSubjectId = updateData.iSubjectId || existingVideo.iSubjectId;
//       const targetTermId = updateData.iTermId || existingVideo.iTermId;
//       const orderExists = await VideoModel.findOne({ iGradeId: targetGradeId, iSubjectId: targetSubjectId, iTermId: targetTermId, iOrder: updateData.iOrder, _id: { $ne: id }, eStatus: { $ne: 'inactive' } }).lean();
//       if (orderExists) {
//         return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'orderAlreadyExists' });
//       }
//     }

//     // Handle bFeature conversion
//     if (updateData.bFeature !== undefined && typeof updateData.bFeature !== 'boolean') {
//       updateData.bFeature = ['true', '1', 1, true].includes(updateData.bFeature);
//     }

//     // If thumbnail explicitly set to null, delete from S3 and clear field; else normalize
//     if (Object.prototype.hasOwnProperty.call(updateData, 'sThumbnailUrl') && updateData.sThumbnailUrl === null) {
//       const currentThumb = existingVideo.sThumbnailUrl;
//       if (currentThumb) {
//         try {
//           const key = currentThumb.startsWith('http')
//             ? currentThumb.replace(config.S3_BUCKET_URL, '').replace(/^\//, '')
//             : currentThumb;
//           await deleteObject({ Bucket: config.S3_BUCKET_NAME, Key: key });
//         } catch (err) {
//           // ignore deletion errors
//         }
//       }
//       updateData.sThumbnailUrl = '';
//     } else if (updateData.sThumbnailUrl !== undefined) {
//       updateData.sThumbnailUrl = updateData.sThumbnailUrl ? String(updateData.sThumbnailUrl).trim() : '';
//     }

//     // Update the video
//     const updatedVideo = await VideoModel.findOneAndUpdate(
//       { _id: id, eStatus: { $ne: 'inactive' } },
//       updateData,
//       { new: true, runValidators: true, readPreference: 'primary' }
//     ).populate('iGradeId', 'sName iOrder')
//       .populate('iSubjectId', 'sName')
//       .populate('iTermId', 'sName')
//       .lean();
//     if (!updatedVideo) {
//       return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'videoNotFound' });
//     }

//     // Add SEO data to the video
//     const videoWithSeo = await getSeoDataForRecord(updatedVideo, data.eSeoType.map.VIDEO);

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].videoUpdated,
//       data: { video: videoWithSeo },
//       error: {}
//     });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'failedToUpdateVideo' });
//   }
// };

// // Delete video (soft delete + cascade resource)
// const deleteVideo = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { id } = req.params;

//     const video = await VideoModel.findOneAndUpdate({ _id: id, eStatus: { $ne: 'inactive' } }, { eStatus: 'inactive' }, { new: true });
//     if (!video) {
//       return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'videoNotFound' });
//     }

//     await ResourceModel.updateMany({ iVideoId: id, eStatus: { $ne: 'inactive' } }, { $set: { eStatus: 'inactive' } });

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].videoDeleted,
//       data: {},
//       error: {}
//     });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'failedToDeleteVideo' });
//   }
// };

// // List videos
// const listVideos = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { limit, start } = getPaginationValues2(req.query);
//     const { search, gradeId, subjectId, termId, status: videoStatus, bFeature, sortBy = 'dCreatedAt', sortOrder = 'desc', isFullResponse } = req.query;

//     // const query = { eStatus: { $ne: 'inactive' } };
//     const query = {};
//     if (req?.admin?.eType && ['SUPER', 'SUB'].includes(req.admin.eType)) {
//       query.eStatus = { $in: ['active', 'inactive'] };
//     } else if (req?.user) {
//       query.eStatus = 'active';
//     } else {
//       query.eStatus = 'active';
//     }

//     // Search filter
//     if (search) {
//       query.$or = [
//         { sTitle: new RegExp('^.*' + search + '.*', 'i') },
//         { sDescription: new RegExp('^.*' + search + '.*', 'i') }
//       ];
//     }

//     // Grade filter
//     if (gradeId) {
//       query.iGradeId = mongoose.Types.ObjectId(gradeId);
//     }

//     // Subject filter
//     if (subjectId) {
//       query.iSubjectId = mongoose.Types.ObjectId(subjectId);
//     }

//     // Term filter
//     if (termId) {
//       query.iTermId = mongoose.Types.ObjectId(termId);
//     }

//     // Status filter
//     if (videoStatus) {
//       query.eStatus = videoStatus;
//     }

//     // Feature filter
//     if (bFeature !== undefined) {
//       query.bFeature = bFeature === 'true' || bFeature === true || bFeature === '1' || bFeature === 1;
//     }

//     // Sort options
//     const sortOptions = {};
//     sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

//     let results = [];
//     let total = 0;

//     if ([true, 'true'].includes(isFullResponse)) {
//       results = await VideoModel.find(query)
//         .sort(sortOptions)
//         .populate('iGradeId', 'sName iOrder')
//         .lean();
//     } else {
//       [total, results] = await Promise.all([
//         VideoModel.countDocuments(query),
//         VideoModel.find(query)
//           .sort(sortOptions)
//           .skip(Number(start))
//           .limit(Number(limit))
//           .populate('iGradeId', 'sName iOrder')
//           .lean()
//       ]);
//     }

//     // Get term details if termId filter is applied
//     let termDetails = null;
//     if (termId) {
//       const term = await TermModel.findOne({ _id: termId }, { sName: 1 }).lean();
//       termDetails = term ? { id: term._id, sName: term.sName } : null;
//     }

//     // Get subject details if subjectId filter is applied
//     let subjectDetails = null;
//     if (subjectId) {
//       const subject = await SubjectModel.findOne({ _id: subjectId }, { sName: 1 }).lean();
//       subjectDetails = subject ? { id: subject._id, sName: subject.sName } : null;
//     }

//     // Get grade details if gradeId filter is applied
//     let gradeDetails = null;
//     if (gradeId) {
//       const grade = await GradeModel.findOne({ _id: gradeId }, { sName: 1, iOrder: 1 }).lean();
//       gradeDetails = grade ? { id: grade._id, sName: grade.sName, iOrder: grade.iOrder, nVideoCount: total } : null;
//     }

//     // Annotate bookmark flags for authenticated users
//     if (req?.user?._id && Array.isArray(results) && results.length) {
//       const videoIds = results.map(v => ObjectId(v._id));
//       const bookmarks = await BookmarkModel.find({ iUserId: ObjectId(req.user._id), iVideoId: { $in: videoIds }, bDelete: false }, { iVideoId: 1 }, { readPreference: 'primary' }).lean();
//       const bookmarkedSet = new Set(bookmarks.map(b => String(b.iVideoId)));
//       results = results.map(v => ({ ...v, isBookmarked: bookmarkedSet.has(String(v._id)) }));
//     } else if (Array.isArray(results)) {
//       results = results.map(v => ({ ...v, isBookmarked: false }));
//     }

//     // Add SEO data to all results
//     const resultsWithSeo = await getSeoDataForRecords(results, data.eSeoType.map.VIDEO);

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].videosRetrieved,
//       data: { total, termDetails, subjectDetails, gradeDetails, results: resultsWithSeo, pagination: { total, limit, start } },
//       error: {}
//     });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveVideos' });
//   }
// };

// // Get comprehensive video detail page
// const getVideoDetail = async (req, res) => {
//   const lang = req.userLanguage;
//   try {
//     const { id } = req.params;
//     const userId = req?.user?._id;

//     // Get video details with populated references
//     const video = await VideoModel.findOne({ _id: id, eStatus: 'active', bDelete: false })
//       .populate('iGradeId', 'sName iOrder sImage sDescription')
//       .populate('iSubjectId', 'sName sImage sTeacher sDescription iOrder')
//       .populate('iTermId', 'sName iOrder')
//       .lean();

//     if (!video) {
//       return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'videoNotFound' });
//     }

//     // Duration is already in hh:mm:ss format, no conversion needed

//     // Generate secure video URL if available
//     if (video.iLibraryId && video.iExternalVideoId) {
//       video.sWebUrl = generateSecureUrl(video.iLibraryId, video.iExternalVideoId);
//     }

//     // Determine if video is premium or freemium
//     let ePlanType = 'freemium'; // Default to freemium
//     if (userId) {
//       const user = await UserModel.findById(userId).populate('iSubscriptionId').lean();
//       if (user && user.iSubscriptionId) {
//         const subscription = await SubscriptionModel.findById(user.iSubscriptionId).lean();
//         if (subscription && subscription.ePlan === 'premium' && subscription.eStatus === 'success') {
//           ePlanType = 'premium';
//         }
//       }
//     }

//     // Get up next videos (3 records with fallback logic)
//     let upNextVideos = [];

//     // Step 1: Try same grade, term, and subject
//     upNextVideos = await VideoModel.find({
//       iGradeId: video.iGradeId._id,
//       iSubjectId: video.iSubjectId._id,
//       iTermId: video.iTermId._id,
//       _id: { $ne: id },
//       eStatus: 'active',
//       bDelete: false
//     })
//       .sort({ iOrder: 1 })
//       .limit(3)
//       .select('_id sTitle iDuration sThumbnailUrl sDescription iOrder')
//       .lean();

//     // Step 2: If not enough, try same grade and subject but different term
//     if (upNextVideos.length < 3) {
//       const remainingCount = 3 - upNextVideos.length;
//       const excludeIds = [...upNextVideos.map(v => v._id), mongoose.Types.ObjectId(id)];

//       const otherTermVideos = await VideoModel.find({
//         iGradeId: video.iGradeId._id,
//         iSubjectId: video.iSubjectId._id,
//         iTermId: { $ne: video.iTermId._id },
//         _id: { $nin: excludeIds },
//         eStatus: 'active',
//         bDelete: false
//       })
//         .sort({ iOrder: 1 })
//         .limit(remainingCount)
//         .select('_id sTitle iDuration sThumbnailUrl sDescription iOrder')
//         .lean();

//       upNextVideos = [...upNextVideos, ...otherTermVideos];
//     }

//     // Step 3: If still not enough, try different grade
//     if (upNextVideos.length < 3) {
//       const remainingCount = 3 - upNextVideos.length;
//       const excludeIds = [...upNextVideos.map(v => v._id), mongoose.Types.ObjectId(id)];

//       const otherGradeVideos = await VideoModel.find({
//         iGradeId: { $ne: video.iGradeId._id },
//         iSubjectId: video.iSubjectId._id,
//         _id: { $nin: excludeIds },
//         eStatus: 'active',
//         bDelete: false
//       })
//         .sort({ iOrder: 1 })
//         .limit(remainingCount)
//         .select('_id sTitle iDuration sThumbnailUrl sDescription iOrder')
//         .lean();

//       upNextVideos = [...upNextVideos, ...otherGradeVideos];
//     }

//     // Duration is already in hh:mm:ss format from database

//     // Get related courses (3 subjects with same grade, with total episodes count)
//     const relatedCourses = [];

//     // Step 1: Try same grade
//     const sameGradeSubjects = await SubjectModel.find({
//       iGradeId: video.iGradeId._id,
//       _id: { $ne: video.iSubjectId._id },
//       eStatus: 'active'
//     })
//       .populate('iGradeId', 'sName iOrder')
//       .limit(3)
//       .lean();

//     for (const subject of sameGradeSubjects) {
//       const episodeCount = await VideoModel.countDocuments({
//         iSubjectId: subject._id,
//         eStatus: 'active',
//         bDelete: false
//       });

//       relatedCourses.push({
//         _id: subject._id,
//         sSubjectName: subject.sName,
//         sImage: subject.sImage,
//         sTeacher: subject.sTeacher,
//         sDescription: subject.sDescription,
//         iOrder: subject.iOrder,
//         sGradeName: subject.iGradeId.sName,
//         iGradeOrder: subject.iGradeId.iOrder,
//         nEpisodeCount: episodeCount
//       });
//     }

//     // Step 2: If not enough, get subjects from other grades
//     if (relatedCourses.length < 3) {
//       const remainingCount = 3 - relatedCourses.length;
//       const excludeIds = relatedCourses.map(c => c._id);

//       const otherGradeSubjects = await SubjectModel.find({
//         iGradeId: { $ne: video.iGradeId._id },
//         _id: { $nin: excludeIds },
//         eStatus: 'active'
//       })
//         .populate('iGradeId', 'sName iOrder')
//         .limit(remainingCount)
//         .lean();

//       for (const subject of otherGradeSubjects) {
//         const episodeCount = await VideoModel.countDocuments({
//           iSubjectId: subject._id,
//           eStatus: 'active',
//           bDelete: false
//         });

//         relatedCourses.push({
//           _id: subject._id,
//           sSubjectName: subject.sName,
//           sImage: subject.sImage,
//           sTeacher: subject.sTeacher,
//           sDescription: subject.sDescription,
//           iOrder: subject.iOrder,
//           sGradeName: subject.iGradeId.sName,
//           iGradeOrder: subject.iGradeId.iOrder,
//           nEpisodeCount: episodeCount
//         });
//       }
//     }

//     // Get top 3 comments for this video
//     const comments = await VideoCommentModel.find({
//       iVideoId: id,
//       iParentCommentId: null,
//       eStatus: 'active',
//       bDelete: false
//     })
//       .sort({ nLikeCount: -1, dCreatedAt: -1 })
//       .limit(3)
//       .populate({ path: 'iUserId', model: UserModel, select: 'sName sEmail sImage' })
//       .lean();

//     // Add isLiked flag for comments
//     const enrichedComments = comments.map(comment => ({
//       ...comment,
//       isLiked: userId ? comment.aLikes.some(likeId => likeId.toString() === userId.toString()) : false,
//       aLikes: undefined // Don't expose full likes array
//     }));

//     // Check if video is bookmarked
//     let isBookmarked = false;
//     if (userId) {
//       const bookmarked = await BookmarkModel.findOne({
//         iUserId: ObjectId(userId),
//         iVideoId: ObjectId(video._id),
//         bDelete: false
//       }, { _id: 1 }).lean();
//       isBookmarked = Boolean(bookmarked);
//     }

//     // Add SEO data to all entities in parallel
//     const [videoWithSeo, gradeWithSeo, subjectWithSeo, termWithSeo, upNextWithSeo, relatedCoursesWithSeo] = await Promise.all([
//       // Main video SEO
//       getSeoDataForRecord({
//         _id: video._id,
//         sTitle: video.sTitle,
//         iDuration: video.iDuration,
//         sDescription: video.sDescription,
//         sUrl: video.sUrl,
//         sWebUrl: video.sWebUrl,
//         sThumbnailUrl: video.sThumbnailUrl,
//         iOrder: video.iOrder,
//         bFeature: video.bFeature,
//         dCreatedAt: video.dCreatedAt,
//         dUpdatedAt: video.dUpdatedAt
//       }, data.eSeoType.map.VIDEO),

//       // Grade SEO
//       getSeoDataForRecord({
//         _id: video.iGradeId._id,
//         sName: video.iGradeId.sName,
//         iOrder: video.iGradeId.iOrder,
//         sImage: video.iGradeId.sImage,
//         sDescription: video.iGradeId.sDescription
//       }, data.eSeoType.map.GRADE),

//       // Subject SEO
//       getSeoDataForRecord({
//         _id: video.iSubjectId._id,
//         sName: video.iSubjectId.sName,
//         sImage: video.iSubjectId.sImage,
//         sTeacher: video.iSubjectId.sTeacher,
//         sDescription: video.iSubjectId.sDescription,
//         iOrder: video.iSubjectId.iOrder
//       }, data.eSeoType.map.SUBJECT),

//       // Term SEO
//       getSeoDataForRecord({
//         _id: video.iTermId._id,
//         sName: video.iTermId.sName,
//         iOrder: video.iTermId.iOrder
//       }, data.eSeoType.map.TERM),

//       // Up Next videos SEO
//       getSeoDataForRecords(upNextVideos.map(v => ({
//         _id: v._id,
//         sTitle: v.sTitle,
//         iDuration: v.iDuration,
//         sThumbnailUrl: v.sThumbnailUrl,
//         sDescription: v.sDescription,
//         iOrder: v.iOrder
//       })), data.eSeoType.map.VIDEO),

//       // Related courses SEO
//       getSeoDataForRecords(relatedCourses.map(c => ({
//         _id: c._id,
//         sSubjectName: c.sSubjectName,
//         sImage: c.sImage,
//         sTeacher: c.sTeacher,
//         sDescription: c.sDescription,
//         iOrder: c.iOrder,
//         sGradeName: c.sGradeName,
//         iGradeOrder: c.iGradeOrder,
//         nEpisodeCount: c.nEpisodeCount
//       })), data.eSeoType.map.SUBJECT)
//     ]);

//     // Construct comprehensive response
//     const videoDetail = {
//       ...videoWithSeo,

//       // Subject details with SEO
//       oSubject: subjectWithSeo,

//       // Grade details with SEO
//       oGrade: gradeWithSeo,

//       // Term details with SEO
//       oTerm: termWithSeo,

//       // Premium/Freemium status
//       ePlanType: ePlanType,

//       // Bookmarked status
//       isBookmarked: isBookmarked,

//       // Up next videos with SEO
//       aUpNextVideos: upNextWithSeo,

//       // Related courses with SEO
//       aRelatedCourses: relatedCoursesWithSeo,

//       // Top comments
//       aComments: enrichedComments
//     };

//     return res.status(status.OK).json({
//       success: true,
//       message: messages[lang].videoDetailRetrieved || 'Video details retrieved successfully',
//       data: { video: videoDetail },
//       error: {}
//     });
//   } catch (error) {
//     console.log('Failed to get video detail', error);
//     return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveVideo' });
//   }
// };

// const initiateMultipart = async (req, res) => {
//   try {
//     const lang = req.userLanguage;
//     const { fileName, contentType, path = 'videos' } = req.body;

//     const key = `${path}/${Date.now()}_${fileName.replace(/\s+/g, '-')}`;
//     const { uploadId } = await s3Config.initiateMultipartUpload(key, contentType);
//     return res.status(status.OK).jsonp({ success: true, message: messages[lang].multipartInitiated, data: { uploadId, key } });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
//   }
// };

// const getMultipartPartUrls = async (req, res) => {
//   try {
//     const lang = req.userLanguage;
//     const { key, uploadId, startPartNumber = 1, endPartNumber } = req.body;

//     const parts = [];
//     for (let p = startPartNumber; p <= endPartNumber; p++) {
//       const url = await s3Config.getPresignedPartUrl(key, uploadId, p);
//       parts.push({ partNumber: p, url });
//     }
//     return res.status(status.OK).jsonp({ success: true, message: messages[lang].multipartPartUrlsRetrieved, data: { parts } });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
//   }
// };

// const completeMultipart = async (req, res) => {
//   try {
//     const lang = req.userLanguage;
//     const { key, uploadId, parts } = req.body;

//     await s3Config.completeMultipartUpload(key, uploadId, parts.map(p => ({ ETag: p.etag, PartNumber: p.partNumber })));

//     return res.status(status.OK).jsonp({ success: true, message: messages[lang].multipartCompleted, data: { key } });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
//   }
// };

// const abortMultipart = async (req, res) => {
//   try {
//     const lang = req.userLanguage;
//     const { key, uploadId } = req.body;

//     await s3Config.abortMultipartUpload(key, uploadId);
//     return res.status(status.OK).jsonp({ success: true, message: messages[lang].multipartAborted });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
//   }
// };

// // Get video status from Bunny.net
// const getVideoStatus = async (req, res) => {
//   try {
//     const lang = req.userLanguage;
//     const { videoId, libraryId } = req.params;

//     const oVideo = await VideoModel.findOne({ iExternalVideoId: videoId }).lean();
//     if (!oVideo) return res.status(status.NotFound).jsonp({ success: false, message: 'Video not found' });

//     const response = await getBunnyVideoStatus(videoId, libraryId);

//     if (response?.bSuccess && response?.mappedStatus === 'ready') {
//       await VideoModel.findOneAndUpdate({ iExternalVideoId: videoId }, { eStatus: data.eVideoStatus.map.ACTIVE });
//       return res.status(status.OK).jsonp({ success: true, message: messages[lang].videoUploaded, data: response });
//     }

//     return res.status(status.OK).jsonp({ success: true, message: messages[lang].videoUploadInPending, data: response });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
//   }
// };

// // Bunny webhook handler
// const bunnyWebhook = async (req, res) => {
//   try {
//     console.log('=== BUNNY WEBHOOK RECEIVED ===');
//     console.log('VideoLibraryId:', req.body?.VideoLibraryId);
//     console.log('VideoGuid:', req.body?.VideoGuid);
//     console.log('Status:', req.body?.Status);
//     console.log('==============================');

//     const event = req.body;
//     const videoId = event.videoGuid || event.videoId || event.guid || event.VideoGuid || event.VideoId;

//     const oVideo = await VideoModel.findOne({ iExternalVideoId: videoId }).lean();
//     if (!oVideo) return res.status(status.NotFound).jsonp({ success: false });

//     const response = await getBunnyVideoStatus(videoId, req.body?.VideoLibraryId);

//     if (response?.bSuccess && response?.mappedStatus === 'ready') {
//       await VideoModel.findOneAndUpdate({ iExternalVideoId: videoId }, { eStatus: data.eStatus.map.ACTIVE });
//       return res.status(status.OK).jsonp({ success: true });
//     }

//     return res.status(status.OK).jsonp({ success: true });
//   } catch (error) {
//     return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
//   }
// };

// module.exports = {
//   createVideo,
//   bulkCreateVideos,
//   getVideo,
//   updateVideo,
//   deleteVideo,
//   listVideos,
//   getVideoDetail,
//   initiateMultipart,
//   getMultipartPartUrls,
//   completeMultipart,
//   abortMultipart,
//   getVideoStatus,
//   bunnyWebhook
// };
