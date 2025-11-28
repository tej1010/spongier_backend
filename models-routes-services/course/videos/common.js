const crypto = require('crypto');
const axios = require('axios');
const { BUNNY_NET_KEY, BUNNY_LIBRARY_ID, BUNNY_TOKEN_AUTH_KEY, BUNNY_CDN_BASE_URL } = require('../../../config/config');
const { handleCatchError } = require('../../../helper/utilities.services');

function generateSecureUrl (iLibraryId, iVideoId) {
  const expires = Math.round(Date.now() / 1000) + 86400;

  // Create SHA256 hex token
  const hashableBase = BUNNY_TOKEN_AUTH_KEY + iVideoId + expires;
  const token = crypto.createHash('sha256').update(hashableBase).digest('hex');

  // Build the final secure URL
  const videoUrl = `https://iframe.mediadelivery.net/embed/${iLibraryId}/${iVideoId}?token=${token}&expires=${expires}`;

  return videoUrl;
}

function generateBunnyTokenUrl (iVideoId, isDirectory = true) {
  let parameterData = '';
  let parameterDataUrl = '';
  let signaturePath = '';
  let hashableBase = '';
  let token = '';

  const expires = Math.floor(new Date() / 1000) + 3600;
  const sBunnyCDNUrl = getBunnyCDNUrl(iVideoId);
  if (!sBunnyCDNUrl) {
    return '';
  }
  const parsedUrl = new URL(sBunnyCDNUrl);
  const parameters = (new URL(sBunnyCDNUrl)).searchParams;

  signaturePath = decodeURIComponent(`/${iVideoId}/`);
  parameters.set('token_path', signaturePath);
  parameters.sort();

  if (Array.from(parameters).length > 0) {
    parameters.forEach(function (value, key) {
      if (value === '') {
        return;
      }
      if (parameterData.length > 0) {
        parameterData += '&';
      }
      parameterData += key + '=' + value;
      parameterDataUrl += '&' + key + '=' + encodeURIComponent(value);
    });
  }

  hashableBase = BUNNY_TOKEN_AUTH_KEY + signaturePath + expires + parameterData;
  token = Buffer.from(crypto.createHash('sha256').update(hashableBase).digest()).toString('base64');
  token = token.replace(/\n/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  if (isDirectory) {
    return parsedUrl.protocol + '//' + parsedUrl.host + '/bcdn_token=' + token + parameterDataUrl + '&expires=' + expires + parsedUrl.pathname;
  } else {
    return parsedUrl.protocol + '//' + parsedUrl.host + parsedUrl.pathname + '?token=' + token + parameterDataUrl + '&expires=' + expires;
  }
}

function getBunnyCDNUrl (iVideoId) {
  return iVideoId ? `${BUNNY_CDN_BASE_URL}${iVideoId}/playlist.m3u8` : '';
}

async function uploadVideoBunny (data) {
  try {
    const response = await axios.post(`https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/fetch`,
      data,
      {
        headers: { AccessKey: BUNNY_NET_KEY, 'Content-Type': 'application/json' },
        timeout: 30000 // 30 second timeout
      }
    );

    if (response.status !== 200) {
      return { bSuccess: false };
    }
    const videoData = response?.data || {};
    const iVideoId = videoData?.guid || videoData?.id || videoData?.videoId;

    return { bSuccess: true, iVideoId };
  } catch (error) {
    handleCatchError(error);
    return { bSuccess: false };
  }
}

async function getBunnyVideoStatus (iVideoId, iLibraryId = BUNNY_LIBRARY_ID) {
  try {
    const response = await axios.get(`https://video.bunnycdn.com/library/${iLibraryId}/videos/${iVideoId}`,
      { headers: { AccessKey: BUNNY_NET_KEY } }
    );

    if (response.status !== 200) {
      return { bSuccess: false };
    }

    const videoData = response.data;
    const rawStatus = videoData.status || videoData.state;
    const progress = videoData.encodeProgress || videoData.transcodingProgress || videoData.processingProgress || null;
    let mappedStatus = mapBunnyStatus(rawStatus);

    if (videoData.playbackUrls && Object.keys(videoData.playbackUrls || {}).length > 0) {
      mappedStatus = 'ready';
    }

    if (mappedStatus !== 'ready' && rawStatus === 4 && progress === 100) {
      mappedStatus = 'ready';
    }

    return { bSuccess: true, mappedStatus };
  } catch (error) {
    handleCatchError(error);
    return { bSuccess: false };
  }
}

function mapBunnyStatus (rawStatus) {
  const statusMapping = {
    0: 'pending',
    1: 'uploading',
    2: 'processing',
    3: 'ready',
    4: 'processing',
    5: 'ready',
    6: 'failed',
    7: 'error',
    pending: 'pending',
    uploading: 'uploading',
    processing: 'processing',
    ready: 'ready',
    finished: 'ready',
    completed: 'ready',
    failed: 'failed',
    error: 'error'
  };
  if (rawStatus === undefined || rawStatus === null || rawStatus === 'unknown') {
    return 'processing';
  }
  return statusMapping[rawStatus] || rawStatus;
};

module.exports = {
  generateSecureUrl,
  uploadVideoBunny,
  getBunnyVideoStatus,
  generateBunnyTokenUrl,
  getBunnyCDNUrl
};
