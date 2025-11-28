const { messages, status } = require('../../../../helper/api.responses');
const { handleServiceError } = require('../../../../helper/utilities.services');
const VideoModel = require('../model');
const s3Config = require('../../../../helper/s3config');
const { getBunnyVideoStatus, getBunnyCDNUrl } = require('../common');
const data = require('../../../../data');

/**
 * Video Multipart Upload Services
 * Handles S3 multipart uploads and Bunny.net webhooks
 */

const initiateMultipart = async (req, res) => {
  try {
    const lang = req.userLanguage;
    const { sFileName, sContentType, sPath = 'videos' } = req.body;

    const sKey = `${sPath}/${Date.now()}_${sFileName.replace(/\s+/g, '-')}`;
    const { iUploadId } = await s3Config.initiateMultipartUpload(sKey, sContentType);
    return res.status(status.OK).jsonp({ success: true, message: messages[lang].multipartInitiated, data: { iUploadId, sKey } });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
};

const getMultipartPartUrls = async (req, res) => {
  try {
    const lang = req.userLanguage;
    const { sKey, iUploadId, nStartPartNumber = 1, nEndPartNumber } = req.body;

    const aPart = [];
    for (let p = nStartPartNumber; p <= nEndPartNumber; p++) {
      const url = await s3Config.getPresignedPartUrl(sKey, iUploadId, p);
      aPart.push({ nPartNumber: p, aUrl: url });
    }
    return res.status(status.OK).jsonp({ success: true, message: messages[lang].multipartPartUrlsRetrieved, data: { aPart } });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
};

const completeMultipart = async (req, res) => {
  try {
    const lang = req.userLanguage;
    const { sKey, iUploadId, aPart } = req.body;

    await s3Config.completeMultipartUpload(sKey, iUploadId, aPart.map(p => ({ ETag: p.sEtag, PartNumber: p.nPartNumber })));
    return res.status(status.OK).jsonp({ success: true, message: messages[lang].multipartCompleted, data: { sKey } });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
};

const abortMultipart = async (req, res) => {
  try {
    const lang = req.userLanguage;
    const { sKey, iUploadId } = req.body;

    await s3Config.abortMultipartUpload(sKey, iUploadId);
    return res.status(status.OK).jsonp({ success: true, message: messages[lang].multipartAborted });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
};

// Get video status from Bunny.net
const getVideoStatus = async (req, res) => {
  try {
    const lang = req.userLanguage;
    const { videoId, libraryId } = req.params;

    const oVideo = await VideoModel.findOne({ iExternalVideoId: videoId }).lean();
    if (!oVideo) return res.status(status.NotFound).jsonp({ success: false, message: 'Video not found' });

    const response = await getBunnyVideoStatus(videoId, libraryId);

    if (response?.bSuccess && response?.mappedStatus === 'ready') {
      const oVideo = await VideoModel.findOneAndUpdate({ iExternalVideoId: videoId }, { eStatus: data.eVideoStatus.map.ACTIVE }, { new: true });
      return res.status(status.OK).jsonp({ success: true, message: messages[lang].videoUploaded, data: oVideo });
    }

    return res.status(status.OK).jsonp({ success: true, message: messages[lang].videoUploadInPending, data: oVideo });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
};

// Bunny webhook handler
const bunnyWebhook = async (req, res) => {
  try {
    const event = req.body;
    const videoId = event.videoGuid || event.videoId || event.guid || event.VideoGuid || event.VideoId;

    const oVideo = await VideoModel.findOne({ iExternalVideoId: videoId }).lean();
    if (!oVideo) return res.status(status.NotFound).jsonp({ success: false });

    const response = await getBunnyVideoStatus(videoId, req.body?.VideoLibraryId);

    if (response?.bSuccess && response?.mappedStatus === 'ready') {
      const sBunnyCDNUrl = getBunnyCDNUrl(videoId);
      await VideoModel.findOneAndUpdate({ iExternalVideoId: videoId }, { eStatus: data.eStatus.map.ACTIVE, sUrl: sBunnyCDNUrl });
      return res.status(status.OK).jsonp({ success: true });
    }

    return res.status(status.OK).jsonp({ success: true });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
};

module.exports = {
  initiateMultipart,
  getMultipartPartUrls,
  completeMultipart,
  abortMultipart,
  getVideoStatus,
  bunnyWebhook
};
