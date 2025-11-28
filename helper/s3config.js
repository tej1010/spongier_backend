const config = require('../config/config');
const { handleCatchError } = require('./utilities.services');
const { AWS_REGION } = require('../config/thirdPartyConfig');
const axios = require('axios');
const { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand, GetObjectCommand, DeleteObjectsCommand, ListObjectsV2Command, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Upload } = require('@aws-sdk/lib-storage');

const s3Client = new S3Client({
  endpoint: config.AWS_BUCKET_ENDPOINT,
  region: AWS_REGION,
  credentials: { accessKeyId: config.AWS_ACCESS_KEY, secretAccessKey: config.AWS_SECRET_KEY }
});

async function signedUrl (sFileName, sContentType, path, eType) {
  try {
    sFileName = sFileName.replace('/', '-');
    sFileName = sFileName.replace(/\s/gi, '-');

    const fileKey = `${Date.now()}_${sFileName}`;
    const s3Path = path;

    const params = {
      Bucket: eType !== 'kyc' ? config.S3_BUCKET_NAME : config.S3_KYC_BUCKET_NAME,
      Key: s3Path + fileKey,
      ContentType: sContentType
    };

    const expiresIn = 300;
    const command = new PutObjectCommand(params);
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });

    return { sUrl: signedUrl, sPath: s3Path + fileKey };
  } catch (error) {
    handleCatchError(error);
  }
}

async function deleteObject (s3Params) {
  try {
    const headCommand = new HeadObjectCommand(s3Params);
    const headResponse = await s3Client.send(headCommand);

    if (headResponse) {
      const deleteCommand = new DeleteObjectCommand(s3Params);
      const response = await s3Client.send(deleteCommand);
      return response;
    }
  } catch (error) {
    handleCatchError(error);
  }
}

async function deleteFolder (bucketName, prefix) {
  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix
    });

    const listedObjects = await s3Client.send(listCommand);

    if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
      console.log('No objects found under this folder.');
      return;
    }

    const deleteCommand = new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: {
        Objects: listedObjects.Contents.map(obj => ({ Key: obj.Key })),
        Quiet: false
      }
    });

    const deleteResponse = await s3Client.send(deleteCommand);
    return deleteResponse;
  } catch (error) {
    handleCatchError(error);
  }
}

async function putObj (sFileName, sContentType, path, fileStream, deposition) {
  try {
    sFileName = sFileName.replace('/', '-');
    sFileName = sFileName.replace(/\s/gi, '-');

    let fileKey = '';
    const s3Path = path;

    fileKey = `${Date.now()}_${sFileName}`;

    const params = {
      Bucket: config.S3_KYC_BUCKET_NAME,
      Key: s3Path + fileKey,
      ContentType: sContentType,
      Body: fileStream
    };

    if (deposition) params.ContentDisposition = deposition;

    const command = new PutObjectCommand(params);
    const response = await s3Client.send(command);

    response.key = params.Key;
    response.Key = params.Key;
    return response;
  } catch (error) {
    handleCatchError(error);
  }
}

/**
 * Gives a s3 bukcket file upload URL and relative path
 * @param {*} url URL of image to upload in s3
 * @param {*} path s3 file upload path
 * @returns s3 image URL and relative path
 */
async function getS3ImageURL (url, path, name) {
  const response = { sSuccess: false, sUrl: '', sPath: '' };
  try {
    const imageURL = url;

    let imageName = imageURL.substring(imageURL.lastIndexOf('/') + 1);
    imageName = (imageName.match(/[^.]+(\.[^?#]+)?/) || [])[0];

    const fileExtensionPattern = /(?:\.([a-z0-9]+)(?=[?#])|\.([a-z0-9]+))$/gi;
    const fileExtension = imageName.match(fileExtensionPattern)?.[0] || '.png';
    // const fileName = generateNumber(100000, 999999).toString()
    let fileName = `${new Date().getTime()}`;
    if (name) {
      fileName = `${name}_${new Date().getTime()}`;
    }
    const imagePath = path + fileName + fileExtension;

    const response = await UploadFromUrlToS3(imageURL, imagePath);
    response.sSuccess = true;
    response.sPath = imagePath;
    response.sUrl = config.S3_BUCKET_URL + imagePath;

    return response;
  } catch (error) {
    handleCatchError(error);
    response.error = error;
    return response;
  }
}

async function UploadFromUrlToS3 (url, destPath) {
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      responseEncoding: 'binary',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' // Mimic a browser
      }
    });
    const params = {
      ContentType: res.headers['content-type'],
      ContentLength: res.headers['content-length'],
      Key: destPath,
      Body: res.data,
      Bucket: config.S3_BUCKET_NAME
    };

    const command = new PutObjectCommand(params);
    const response = await s3Client.send(command);

    return response;
  } catch (error) {
    handleCatchError(error);
  }
}

/**
 * Generates a signed URL for accessing an object in an S3 bucket.
 * @param {Object} params - The parameters for generating the signed URL.
 * @returns {Promise<string>} - A signed URL that can be used to access the object.
 * @throws {Error} - If an error occurs while generating the signed URL.
 */
async function s3GetObjSignedUrl (params) {
  try {
    const command = new GetObjectCommand(params);
    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    return url;
  } catch (error) {
    handleCatchError(error);
  }
}

async function streamObject (Bucket, Key, ContentType, Body) {
  try {
    const params = { Bucket, Key, Body, ContentType };

    const uploader = new Upload({ client: s3Client, params });

    await uploader.done();
  } catch (error) {
    handleCatchError(error);
  }
}

async function initiateMultipartUpload (sKey, sContentType) {
  const command = new CreateMultipartUploadCommand({
    Bucket: config.S3_BUCKET_NAME,
    Key: sKey,
    ContentType: sContentType
  });
  const res = await s3Client.send(command);
  return { iUploadId: res?.UploadId };
}

async function getPresignedPartUrl (sKey, iUploadId, nPartNumber) {
  const command = new UploadPartCommand({
    Bucket: config.S3_BUCKET_NAME,
    Key: sKey,
    UploadId: iUploadId,
    PartNumber: nPartNumber
  });
  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 18000 });
  return presignedUrl;
}

async function completeMultipartUpload (sKey, iUploadId, aParts) {
  const command = new CompleteMultipartUploadCommand({
    Bucket: config.S3_BUCKET_NAME,
    Key: sKey,
    UploadId: iUploadId,
    MultipartUpload: {
      Parts: aParts.sort((a, b) => a.PartNumber - b.PartNumber)
    }
  });
  const res = await s3Client.send(command);
  return { location: res.Location, bucket: res.Bucket, key: res.Key, etag: res.ETag };
}

async function abortMultipartUpload (sKey, iUploadId) {
  const command = new AbortMultipartUploadCommand({
    Bucket: config.S3_BUCKET_NAME,
    Key: sKey,
    UploadId: iUploadId
  });
  await s3Client.send(command);
  return { aborted: true };
}

module.exports = {
  signedUrl,
  deleteObject,
  putObj,
  getS3ImageURL,
  s3GetObjSignedUrl,
  streamObject,
  deleteFolder,
  initiateMultipartUpload,
  getPresignedPartUrl,
  completeMultipartUpload,
  abortMultipartUpload
};
