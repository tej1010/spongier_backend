// bookmarks.services.js
const { status, messages } = require('../../../helper/api.responses');
const { handleServiceError, getPaginationValues2, ObjectId } = require('../../../helper/utilities.services');
const data = require('../../../data');
const { getSeoDataForRecords } = require('../../../helper/seo.helper');
const BookmarkModel = require('./model');
const VideoModel = require('../videos/model');

// Add bookmark for current user
const addBookmark = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const userId = req.user._id;
    const { iVideoId } = req.body;

    // validate video exists and is active (not inactive)
    const video = await VideoModel.findOne({ _id: iVideoId, eStatus: { $ne: 'inactive' } }, null, { readPreference: 'primary' }).lean();
    if (!video) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'videoNotFound' });
    }

    // upsert semantics: if soft-deleted, revive; else insert
    const updated = await BookmarkModel.findOneAndUpdate(
      { iUserId: userId, iVideoId: ObjectId(iVideoId) },
      { $set: { bDelete: false } },
      { new: true, upsert: true, setDefaultsOnInsert: true, readPreference: 'primary' }
    ).lean();

    return res.status(status.OK).json({ success: true, message: messages[lang].success || 'Bookmarked', data: { bookmark: updated }, error: {} });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'error', fallbackMessage: 'Failed to add bookmark' });
  }
};

// Remove bookmark for current user
const removeBookmark = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const userId = req.user._id;
    const { iVideoId } = req.body;

    const existing = await BookmarkModel.findOne({ iUserId: userId, iVideoId: ObjectId(iVideoId), bDelete: false }, null, { readPreference: 'primary' }).lean();
    if (!existing) {
      return res.status(status.NotFound).json({ success: false, message: messages[lang].not_found?.replace('##', 'bookmark') || 'Bookmark not found', data: {}, error: {} });
    }

    await BookmarkModel.updateOne({ _id: existing._id }, { $set: { bDelete: true } });

    return res.status(status.OK).json({ success: true, message: messages[lang].success || 'Removed', data: {}, error: {} });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'error', fallbackMessage: 'Failed to remove bookmark' });
  }
};

// List bookmarks for current user (returns videos with bookmark timestamp)
const listBookmarks = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const userId = req.user._id;
    const { limit, start } = getPaginationValues2(req.query);

    const query = { iUserId: ObjectId(userId), bDelete: false };

    const [total, rows] = await Promise.all([
      BookmarkModel.countDocuments(query),
      BookmarkModel.find(query)
        .sort({ dCreatedAt: -1 })
        .populate({
          path: 'iVideoId',
          model: VideoModel,
          select: '_id sTitle iDuration sThumbnailUrl sDescription iOrder dCreatedAt dUpdatedAt iSubjectId iTermId nLikeCount nViewCount iLibraryId iExternalVideoId',
          populate: [
            { path: 'iSubjectId', select: 'sName' },
            { path: 'iTermId', select: 'sName' }
          ]
        })
        .skip(Number(start))
        .limit(Number(limit))
        .lean()
    ]);

    // Attach SEO data on populated videos for redirect usage
    let results = rows || [];
    const videos = results
      .map(r => r?.iVideoId)
      .filter(v => v && v._id);
    if (videos.length) {
      const videosWithSeo = await getSeoDataForRecords(videos, data.eSeoType.map.VIDEO);
      const seoMap = new Map(videosWithSeo.map(v => [String(v._id), v]));
      results = results.map(r => {
        const vid = r?.iVideoId;
        if (vid && vid._id) {
          const enriched = seoMap.get(String(vid._id)) || vid;
          const sSubjectName = enriched?.iSubjectId?.sName || vid?.iSubjectId?.sName || null;
          const sTermName = enriched?.iTermId?.sName || vid?.iTermId?.sName || null;
          const normalized = {
            ...enriched,
            sSubjectName,
            sTermName,
            videoId: enriched?.videoId || enriched?._id || vid?._id || null,
            libraryId: enriched?.libraryId ?? enriched?.iLibraryId ?? vid?.iLibraryId ?? '',
            externalId: enriched?.externalId ?? enriched?.iExternalVideoId ?? vid?.iExternalVideoId ?? ''
          };
          return {
            ...r,
            iVideoId: {
              ...normalized,
              nLikeCount: normalized.nLikeCount || 0,
              nViewCount: normalized.nViewCount || 0,
              likes: normalized.nLikeCount || 0,
              views: normalized.nViewCount || 0
            }
          };
        }
        return r;
      });
    }

    return res.status(status.OK).json({ success: true, message: messages[lang].success || 'Bookmarks', data: { total, results, limit, start }, error: {} });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'error', fallbackMessage: 'Failed to list bookmarks' });
  }
};

module.exports = { addBookmark, removeBookmark, listBookmarks };
