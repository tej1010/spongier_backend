const { messages, status } = require('../../../helper/api.responses');
const { handleServiceError } = require('../../../helper/utilities.services');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../../../config/config');
const { AWS_REGION } = require('../../../config/thirdPartyConfig');

// Initialize S3 client
const s3Client = new S3Client({
  endpoint: config.AWS_BUCKET_ENDPOINT,
  region: AWS_REGION,
  credentials: { accessKeyId: config.AWS_ACCESS_KEY, secretAccessKey: config.AWS_SECRET_KEY }
});

/**
 * Admin Upload Services
 * Handles file upload presigned URLs
 */

// Generate pre-signed URL for image upload
async function generatePreSignedUrl ({ sFileName, sContentType, path }) {
  // eslint-disable-next-line no-useless-catch
  try {
    console.log(sFileName, sContentType, path);
    sFileName = sFileName.replace('/', '-');
    sFileName = sFileName.replace(/\s/gi, '-');

    const fileKey = `${Date.now()}_${sFileName}`;
    const s3Path = path;

    const params = {
      Bucket: config.S3_BUCKET_NAME,
      Key: s3Path + fileKey,
      ContentType: sContentType
    };

    const expiresIn = 300;
    const command = new PutObjectCommand(params);
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });

    return { sUrl: signedUrl, sPath: s3Path + fileKey };
  } catch (error) {
    console.log('Error generating pre-signed URL:', error);
    // handleCatchError(error);
    throw error; // Re-throw to be handled by the calling function
  }
}

// Get signed URL for image upload
const getSignedUploadUrl = async (req, res) => {
  const lang = req.userLanguage;
  try {
    // req.body = pick(req.body, ['sFileName', 'sContentType', 'sPath']);
    console.log('req.body', req.body);
    const { sFileName, sContentType, sPath } = req.body;
    console.log('sFileName, sContentType, sPath', sFileName, sContentType, sPath);
    // const valid = checkValidImageType(sFileName, sContentType);
    // if (!valid) return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'invalidImage' });

    // Generate a signed URL for the image upload
    const path = process.env.S3_FOLDER_PATH || `images/${sPath}`;
    console.log('path', path);
    const data = await generatePreSignedUrl({ sFileName, sContentType, path: path });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].presigned_succ || 'Pre-signed URL generated successfully',
      data,
      error: {}
    });
  } catch (error) {
    console.error('Error generating pre-signed URL:', error);
    return handleServiceError(error, req, res, { messageKey: 'errorGeneratingPreSignedUrl' });
  }
};

module.exports = {
  getSignedUploadUrl
};
