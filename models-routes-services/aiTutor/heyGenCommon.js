const axios = require('axios');
const { handleCatchError } = require('../../helper/utilities.services');
const { HEYGEN_API_URL, HEYGEN_API_KEY, HEYGEN_AVATAR_NAME, HEYGEN_KNOWLEDGE_BASE_ID } = require('../../config/config');

async function getHeyGenSessionToken (iSessionId) {
  try {
    const response = await axios.post(`${HEYGEN_API_URL}/v1/streaming.create_token`, { session_id: iSessionId }, {
      headers: {
        'x-api-key': HEYGEN_API_KEY
      }
    });

    const sToken = response?.data?.data?.token;

    return { bSuccess: true, sToken };
  } catch (error) {
    handleCatchError(error);
    return { bSuccess: false, error };
  }
}

async function createHeyGenSession ({ iKnowledgeBaseId = HEYGEN_KNOWLEDGE_BASE_ID, iVoiceId = '', sAvatarName = HEYGEN_AVATAR_NAME }) {
  try {
    const response = await axios.post(`${HEYGEN_API_URL}/v1/streaming.new`, {
      quality: 'high',
      avatar_name: sAvatarName,
      voice: {
        voice_id: iVoiceId,
        rate: 1.0
      },
      version: 'v2',
      video_encoding: 'H264',
      activity_idle_timeout: 3600,
      knowledge_base_id: iKnowledgeBaseId
    },
    {
      headers: { 'x-api-key': HEYGEN_API_KEY }
    });

    const oResponse = response?.data?.data;

    return { bSuccess: true, oResponse };
  } catch (error) {
    handleCatchError(error);
    return { bSuccess: false, error };
  }
}

async function startHeyGenSession (iSessionId) {
  try {
    const response = await axios.post(`${HEYGEN_API_URL}/v1/streaming.start`, {
      session_id: iSessionId
    },
    {
      headers: { 'x-api-key': HEYGEN_API_KEY }
    });

    const oResponse = response?.data;

    return { bSuccess: true, oResponse };
  } catch (error) {
    handleCatchError(error);
    return { bSuccess: false, error };
  }
}

async function giveTaskHeyGenSession (iSessionId, sText, sTaskType) {
  try {
    const response = await axios.post(`${HEYGEN_API_URL}/v1/streaming.task`, {
      session_id: iSessionId,
      text: sText,
      task_type: sTaskType
    },
    {
      headers: { 'x-api-key': HEYGEN_API_KEY }
    });

    const oResponse = response?.data;

    return { bSuccess: true, oResponse };
  } catch (error) {
    handleCatchError(error);
    return { bSuccess: false, error };
  }
}

async function stopHeyGenSession (iSessionId) {
  try {
    const response = await axios.post(`${HEYGEN_API_URL}/v1/streaming.stop`, {
      session_id: iSessionId
    },
    {
      headers: { 'x-api-key': HEYGEN_API_KEY }
    });

    const oResponse = response?.data;

    return { bSuccess: true, oResponse };
  } catch (error) {
    handleCatchError(error);
    return { bSuccess: false, error };
  }
}

async function stopTalkHeyGenSession (iSessionId) {
  try {
    const response = await axios.post(`${HEYGEN_API_URL}/v1/streaming.interrupt`, {
      session_id: iSessionId
    },
    {
      headers: { 'x-api-key': HEYGEN_API_KEY }
    });

    const oResponse = response?.data;

    return { bSuccess: true, oResponse };
  } catch (error) {
    handleCatchError(error);
    return { bSuccess: false, error };
  }
}

async function listActiveSessions () {
  try {
    const response = await axios.get(`${HEYGEN_API_URL}/v1/streaming.list`, {
      headers: { 'x-api-key': HEYGEN_API_KEY }
    });

    const oResponse = response?.data;

    return { bSuccess: true, oResponse: oResponse?.data?.sessions };
  } catch (error) {
    handleCatchError(error);
    return { bSuccess: false, error };
  }
}

// DO NOT call this on module load - only call when explicitly needed
// listActiveSessions();

module.exports = {
  getHeyGenSessionToken,
  createHeyGenSession,
  startHeyGenSession,
  giveTaskHeyGenSession,
  stopHeyGenSession,
  stopTalkHeyGenSession,
  listActiveSessions
};
