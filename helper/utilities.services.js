const { messages, status } = require('./api.responses');
const MongoObjectId = require('mongoose').Types.ObjectId;
const Sentry = require('@sentry/node');
const { randomInt, createHash } = require('crypto');
const mongoose = require('mongoose');
const CryptoJS = require('crypto-js');
const { imageFormat } = require('../data');
const moment = require('moment');
const csvParser = require('csv-parser');
const XLSX = require('xlsx');
const { ENCRYPTION_KEY, IV_VALUE, S3_BUCKET_NAME, CLOUD_STORAGE_PROVIDER, GCS_BUCKET_NAME, AZURE_STORAGE_CONTAINER_NAME, SEND_EMAIL_PROVIDER } = require('../config/config');
const fs = require('fs');
const encryptedKey = CryptoJS.enc.Hex.parse(ENCRYPTION_KEY);
const iv = CryptoJS.enc.Hex.parse(IV_VALUE);
const { sendMailOneSignal, sendMailNodeMailer } = require('./mail.services');
const geoip = require('geoip-lite');
const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');

/**
 * It'll remove all nullish, not defined and blank properties of input object.
 * @param {object}
 */
const removenull = (obj) => {
  for (const propName in obj) {
    if (obj[propName] === null || obj[propName] === undefined || obj[propName] === '') {
      delete obj[propName];
    }
  }
};
function validObjectId (id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// hash key for volume
const getHashVolumeKey = (eventId, symbol) => {
  return `OT:${eventId}:${symbol}:VOLUME`;
};

// hash key for order
const getHashOrderKey = (eventId, userType, price, userId = '') => {
  return `OT:${eventId}:${userType}:${price}:${userId}`;
};

const getHashAdminOrderKey = (iEventId, symbol) => {
  return `OT:${iEventId}:ADMIN:${symbol}:SET_ADMIN_ORDER`;
};

const catchError = (name, error, req, res) => {
  handleCatchError(error);
  return res.status(status.InternalServerError).json({
    success: false,
    message: messages[req.userLanguage].error,
    data: {},
    error: {}
  });
};

// New common error handler to standardize catch blocks across services
const handleServiceError = (error, req, res, options = {}) => {
  try {
    if (error) { handleCatchError(error); }
    const { statusCode = status.InternalServerError, messageKey = 'error', data = {} } = options;

    // If a validation error format is passed in error (e.g., express-validator), prefer that
    if (error && Array.isArray(error.errors) && error.errors.length) {
      return res.status(status.BadRequest).json({
        success: false,
        message: error.errors[0]?.msg || messages[req.userLanguage][messageKey],
        data: {},
        error: error.errors
      });
    }

    return res.status(statusCode).json({
      success: false,
      message: messages[req.userLanguage][messageKey] || messages[req.userLanguage].error,
      data: {},
      error: data || {}
    });
  } catch (_) {
    // Fallback to generic error if any issue occurs inside handler
    return res.status(status.InternalServerError).json({
      success: false,
      message: messages[req.userLanguage].error,
      data: {},
      error: {}
    });
  }
};

// Usage: sendError(req, res, { statusCode: status.BadRequest, messageKey: 'invalidStatus' })
const sendError = (req, res, { statusCode = status.InternalServerError, messageKey = 'error', data = {} } = {}) => {
  return handleServiceError(null, req, res, { statusCode, messageKey, data });
};

const handleCatchError = (error) => {
  if (process.env.NODE_ENV === 'production') Sentry.captureMessage(error);
  const { data = undefined, status = undefined } = error.response ?? {};
  console.trace(error);
  if (error?.code === 'EAUTH' && error?.responseCode === 535) return console.log('**********ERROR***********', 'Username and Password not accepted');
  if (!status) console.log('**********ERROR***********', error);
  else console.log('**********ERROR***********', { status, data, error: data.errors });
};

const pick = (object, keys) => {
  return keys.reduce((obj, key) => {
    if (object && object.hasOwnProperty(key)) {
      obj[key] = object[key];
    }
    return obj;
  }, {});
};

function getAllDatesBetweenTwoRange (startDate, endDate) {
  const dateArray = [];
  let fromDate = moment(startDate);
  const toDate = moment(endDate);
  while (fromDate <= toDate) {
    dateArray.push(moment(fromDate).format('YYYY-MM-DD'));
    fromDate = moment(fromDate).add(1, 'days');
  }
  return dateArray;
}

function getDatesForDashboard () {
  // we need to change this hrs and min as per the region
  // currently we are setting as per india region
  const hrs = 5;
  const min = 30;
  const today = new Date();
  const todayFrom = new Date(moment(today).startOf('day').subtract({ hours: hrs, minutes: min }).format());
  const todayTo = new Date(moment(today).endOf('day').subtract({ hours: hrs, minutes: min }).format());

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const yesterdayFrom = new Date(moment(today).startOf('day').subtract({ hours: hrs, minutes: min }).format());
  const yesterdayTo = new Date(moment(yesterday).endOf('day').subtract({ hours: hrs, minutes: min }).format());

  const weekFrom = new Date(moment(today).startOf('week').subtract({ hours: hrs, minutes: min }).format());
  const weekTo = new Date(moment(today).endOf('week').subtract({ hours: hrs, minutes: min }).format());

  const monthFrom = new Date(moment(today).startOf('month').subtract({ hours: hrs, minutes: min }).format());
  const monthTo = new Date(moment(today).endOf('month').subtract({ hours: hrs, minutes: min }).format());

  const yearFrom = new Date(moment(today).startOf('year').subtract({ hours: hrs, minutes: min }).format());
  const yearTo = new Date(moment(today).endOf('year').subtract({ hours: hrs, minutes: min }).format());

  const dates = {
    toDay: {
      $gte: new Date(new Date(todayFrom).toISOString()),
      $lt: new Date(new Date(todayTo).toISOString())
    },
    yesterDay: {
      $gte: new Date(new Date(yesterdayFrom).toISOString()),
      $lt: new Date(new Date(yesterdayTo).toISOString())
    },
    week: {
      $gte: new Date(new Date(weekFrom).toISOString()),
      $lt: new Date(new Date(weekTo).toISOString())
    },
    month: {
      $gte: new Date(new Date(monthFrom).toISOString()),
      $lt: new Date(new Date(monthTo).toISOString())
    },
    year: {
      $gte: new Date(new Date(yearFrom).toISOString()),
      $lt: new Date(new Date(yearTo).toISOString())
    }
  };
  return dates;
}

const defaultSearch = (val) => {
  let search;
  if (val) {
    search = val.replace(/\\/g, '\\\\')
      .replace(/\$/g, '\\$')
      .replace(/\*/g, '\\*')
      .replace(/\+/g, '\\+')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\)/g, '\\)')
      .replace(/\(/g, '\\(')
      .replace(/'/g, '\\\'')
      .replace(/"/g, '\\"');
    return search;
  } else {
    return '';
  }
};

function searchValues (search) {
  let userQuery;
  search = defaultSearch(search);
  if (isNaN(Number(search))) {
    userQuery = {
      $or: [
        { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } },
        { sUsername: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
      ]
    };
  } else {
    userQuery = {
      $or: [
        { sMobNum: encryptKey(search) }
      ]
    };
  }
  return userQuery;
}

const getPaginationValues = (obj) => {
  let { start = 0, limit = 10, sort = 'dCreatedAt', order, search } = obj;

  start = parseInt(start);
  limit = parseInt(limit);

  const orderBy = order && order === 'asc' ? 1 : -1;

  const sorting = { [sort]: orderBy };

  if (search) search = defaultSearch(search);

  return { start, limit, sorting, search };
};

const getPaginationValues2 = (obj) => {
  let { start = 0, limit = 10, sort = '_id', order, search } = obj;
  const orderBy = order && order === 'asc' ? 1 : -1;

  const sorting = { [sort]: orderBy };
  if (search) search = defaultSearch(search);
  return { start, limit, sorting, search };
};

const getDates = (oCriteria) => {
  let { dDateFrom = '', dDateTo = '' } = oCriteria;
  if (oCriteria.eTimeRange) {
    dDateTo = new Date();
    dDateFrom = new Date();

    switch (oCriteria.eTimeRange) {
      case 'D':
        dDateFrom.setDate(new Date().getDate() - 1);
        break;
      case 'W':
        dDateFrom.setDate(new Date().getDate() - 7);
        break;
      case 'M':
        dDateFrom.setDate(new Date().getDate() - 30);
        break;
    }
  }
  oCriteria.dDateFrom = dDateFrom;
  oCriteria.dDateTo = dDateTo;
};

function ObjectId (id) {
  return new MongoObjectId(id);
}

function getCountryFromIP (ip) {
  const geo = geoip.lookup(ip);
  return geo ? geo.country : 'Unknown'; // Returns country code or 'Unknown'
}

const getIp = function (req) {
  try {
    let ip = req.header('x-forwarded-for') ? req.header('x-forwarded-for').split(',') : [];
    ip = ip[0] || req.socket.remoteAddress;
    return ip;
  } catch (error) {
    handleCatchError(error);
    return req.socket.remoteAddress;
  }
};
function generateNumber (min, max) {
  return randomInt(min, max);
}

// This function decrypts a value and returns a promise
function decryptValuePromise (key) {
  return new Promise((resolve, reject) => {
    try {
      if (key) {
        const decrypted = CryptoJS.AES.decrypt(key, encryptedKey, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
        const decryptedMessage = decrypted?.toString(CryptoJS.enc.Utf8);
        if (decryptedMessage.length) { resolve(decryptedMessage); }
        resolve(key);
      }
    } catch (error) {
      reject(error);
    }
  });
}

// This function checks if the input string is alphanumeric
const checkAlphanumeric = (input) => {
  const letters = /^[0-9a-zA-Z]+$/;
  return !!(input.match(letters));
};

// This function validates a mobile number
function validateMobile (mobile) {
  return !mobile.match(/^\+?[1-9]\d{8,12}$/);
}

// This function generates an OTP of a specified length
const generateOTP = (nLength) => {
  const digits = '0123456789';
  let OTP = '';
  for (let i = 0; i < nLength; i++) {
    OTP += digits[generateNumber(0, 10)];
  }
  if (Number(OTP).toString().length !== nLength) {
    return generateOTP(nLength);
  }
  return OTP;
};

// This function encrypts a value and returns a promise
function encryptKeyPromise (value) {
  return new Promise((resolve, reject) => {
    try {
      if (value) {
        const message = CryptoJS.enc.Utf8.parse(value);
        const encrypted = CryptoJS.AES.encrypt(message, encryptedKey, {
          iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        });
        const cipherText = encrypted.toString();
        resolve(cipherText);
      }
    } catch (error) {
      reject(error);
    }
  });
}

// This function decrypts a value if it exists in the object
async function decryptIfExist (object, fields) {
  await Promise.all(
    fields.map(async field => {
      if (object?.[field]) object[field] = await decryptValuePromise(object[field]);
    })
  );
}

// convert id to mongoose id
function mongify (id) {
  return new mongoose.Types.ObjectId(id.toString());
}

// This is common function we are using for sending response
function createResponse ({ req, res, statusCode = 200, messageKey = null, replacementKey, data = {} }) {
  if (statusCode === 200 && !messageKey) messageKey = 'success';
  // Prepare the message
  let message = messages[req.userLanguage][messageKey];
  if (replacementKey) {
    const replacement = messages[req.userLanguage][replacementKey];
    message = message.replace('##', replacement);
  }

  const isSuccess = statusCode >= 200 && statusCode < 400;

  // Return the JSON response
  return res.status(statusCode).json({
    success: isSuccess,
    message,
    data: isSuccess ? (data || {}) : {},
    error: isSuccess ? {} : (data || {})
  });
}

// This function encrypts a value
function encryptKey (value) {
  if (value) {
    const message = CryptoJS.enc.Utf8.parse(value);
    const encrypted = CryptoJS.AES.encrypt(message, encryptedKey, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    const cipherText = encrypted.toString();
    return cipherText;
  }
}

// This function masks a value if it exists in the object
function maskIfExist (object, fields) {
  fields.forEach(field => {
    if (object?.[field]) object[field] = '';
  });
}

// This function made regexp to use in query
function searchRegExp (string) {
  const safeString = string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escapes special characters
  return new RegExp('^.*' + safeString + '.*', 'i');
}

// this function checks whether the url provided is valid or not
const isUrl = (s) => {
  const regex = /^(ftp|http|https):\/\/[^ "]+$/;
  return s && s.match(regex);
};

// This function checks if the image type is valid
function checkValidImageType (sFileName, sContentType) {
  const extension = sFileName.split('.').pop().toLowerCase();
  const valid = imageFormat.find(format => format.extension === extension && format.type === sContentType);
  return !!valid;
}

// this function gets bucket name for different entities like banner, offers for storing images in different cloud providers
const getBucketName = () => {
  let sBucketName = S3_BUCKET_NAME;

  if (CLOUD_STORAGE_PROVIDER === 'GC') {
    sBucketName = GCS_BUCKET_NAME;
  } else if (CLOUD_STORAGE_PROVIDER === 'AZURE') {
    sBucketName = AZURE_STORAGE_CONTAINER_NAME;
  }
  return sBucketName;
};

const slugify = (text) => {
  return text
    .trim()
    .toLowerCase()
    .replace(/'s/g, '') // Remove 's
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};
const generateSlug = ({ sCategoryName, sExternalId, sArticleTitle, dPublishedAt, sExternalArticleId }) => {
  if (!sCategoryName || !sExternalId || !sArticleTitle || !sExternalArticleId) {
    throw new Error('Invalid article data');
  }

  const category = slugify(sCategoryName);
  const externalId = slugify(sExternalId);
  const title = slugify(sArticleTitle);
  // const timestamp = new Date(dPublishedAt).getTime()

  return `${category}/${externalId}/${title}-${sExternalArticleId}`;
};

/**
 * The function `randomStr` generates a random string of a specified length and type.
 * @param len - The `len` parameter represents the length of the random string that you want to
 * generate.
 * @param type - The `type` parameter in the `randomStr` function is used to determine the type of
 * characters that should be included in the generated random string. There are three possible values
 * for the `type` parameter:
 * @returns a random string of characters based on the specified length and type.
 */
const randomStr = (len, type) => {
  let char = '';
  if (type === 'private') {
    char = '0123456789abcdefghijklmnopqrstuvwxyz';
  } else if (type === 'otp') {
    char = '0123456789';
  } else if (type === 'referral') {
    char = 'abcdefghijklmnopqrstuvwxyz';
  }
  let val = '';
  for (let i = len; i > 0; i--) {
    val += char[generateNumber(0, char.length)];
  }

  if (val.length === len) {
    return val;
  } else {
    randomStr(len, type);
  }
};

/**
 * The function "validateEmail" checks if a given email address is valid using a regular expression.
 * @param email - The `email` parameter is a string that represents an email address.
 * @returns a boolean value. It returns true if the email passed as an argument matches the regular
 * expression pattern for a valid email address, and false otherwise.
 */
function validateEmail (email) {
  const sRegexEmail = /^(?=[a-zA-Z0-9@._%+-]{6,254}$)[a-zA-Z0-9._%+-]{1,64}@(?:[a-zA-Z0-9-]{1,63}\.){1,8}[a-zA-Z]{2,63}$/;
  return !!(email.match(sRegexEmail));
}

/**
 * The function "validateIndianNumber" checks if a given mobile number is a valid Indian number.
 * @param mobile - The mobile parameter is a string representing an Indian phone number.
 * @returns a boolean value indicating whether the given mobile number is a valid Indian number or not.
 */
function validateIndianNumber (mobile) {
  return /^[6-9]\d{9}$/.test(mobile);
}

/**
 * The function `validateUsername` checks if a given string is a valid username, which consists of 3 to
 * 15 alphanumeric characters or underscores.
 * @param sUsername - The parameter `sUsername` is a string representing a username that needs to be
 * validated.
 */
const validateUsername = (sUsername) => /^[a-zA-Z0-9]{5,18}$/.test(sUsername);

/**
 * The function checks if a mobile number has a country code.
 * @param mobile - The `mobile` parameter is a string representing a mobile phone number.
 * @returns a boolean value.
 */
function checkCountryCode (mobile) {
  return /^(?:\+?1|\|1|\D)/.test(mobile);
}

/**
 * The function decrypts a given key using AES encryption and returns the decrypted message if
 * successful, otherwise it returns the original key.
 * @param key - The `key` parameter is the value that you want to decrypt. It is the encrypted value
 * that you want to convert back to its original form.
 * @returns The function will return the decrypted message if it is successfully decrypted, otherwise
 * it will return the original key.
 */
function decryptValue (key) {
  if (key) {
    try {
      const decrypted = CryptoJS.AES.decrypt(key, encryptedKey, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
      const decryptedMessage = decrypted?.toString(CryptoJS.enc.Utf8);
      if (decryptedMessage.length) {
        return decryptedMessage;
      }
    } catch (error) {
      console.error('Decryption failed:', error);
    }
    return key;
  }
}

function validateIndianMobile (mobile) {
  return !!mobile.match(/^\+?\d{10}$/);
  // return !!mobile.match(/^\+?[0-9]{10}$/)
}

/**
 * The function `fieldsToDecrypt` takes an array of field names and an object of data, and decrypts the
 * values of the specified fields in the data object.
 * @param aField - `aField` is an array of field names that need to be decrypted.
 * @param data - The `data` parameter is an object that contains the fields to be decrypted.
 * @returns the updated `data` object with the specified fields decrypted.
 */
function fieldsToDecrypt (aField, data) {
  for (const field of aField) {
    if (data[field]) data[field] = decryptValue(data[field]);
  }
  return data;
}

// Change jwt field User Type during generate
const getUserType = (userType) => {
  try {
    return userType === 'U' ? '1' : '2';
  } catch (error) {
    handleCatchError(error);
  }
};

/**
 * The function `validatePassword` checks if a given password meets certain criteria.
 * @param pass - The `pass` parameter represents the password that needs to be validated.
 * @returns The function `validatePassword` returns a boolean value. It returns `true` if the `pass`
 * parameter matches the specified regular expression pattern, which represents a valid password. It
 * returns `false` otherwise.
 */
const validatePassword = (pass) => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,15}$/;
  return !!(pass.match(regex));
};

/**
 * The function `projectionFields` creates a projection object by iterating over the properties of a
 * given object and adding them to the projection if their value is not null or undefined.
 * @param body - The `body` parameter is an object that represents the data you want to project. It
 * contains key-value pairs where the key is the name of a property and the value is the value of that
 * property.
 * @returns The function `projectionFields` returns an object `projection` that contains the property
 * names from the `body` object as keys, with a value of `1` for each property that is not `null` or
 * `undefined`.
 */
const projectionFields = (body) => {
  const projection = {};
  for (const propName in body) {
    if (body[propName] !== null && body[propName] !== undefined) {
      projection[propName] = 1;
    }
  }
  return projection;
};

/**
 * The function `replaceSensitiveInfo` replaces sensitive information in the `body` object with hashed
 * values.
 * @param body - The `body` parameter is an object that contains various properties. The properties
 * that are being checked and modified in the `replaceSensitiveInfo` function are:
 * @returns the modified `body` object after replacing sensitive information with hashed values.
 */
const replaceSensitiveInfo = (body) => {
  let myObj;
  if (body?.oOldFields) {
    myObj = body?.oOldFields;
    body.oOldFields = hashBody256(myObj);
  }
  if (body?.oNewFields) {
    myObj = body?.oNewFields;
    body.oNewFields = hashBody256(myObj);
  }
  if (body?.oRes?.data) {
    const myObj = body.oRes.data;
    body.oRes.data = hashBody256(myObj);
  }
  return body;
};

const hashBody256 = (body) => {
  for (const key in body) {
    // removed 'sMoNum' as it is already decrypted
    if (['phone', 'bankAccount', 'sNo', 'sAccountNo'].includes(key)) {
      const encryptHash = createHash('sha256').update(body[key]).digest('hex');
      body[key] = body[key].replaceAll(body[key], encryptHash);
    }
  }
  return body;
};

/**
 * The function `fieldsToReset` takes an array of field names and an object, and sets the values of the
 * fields in the object to an empty string.
 * @param aField - An array of field names that need to be reset.
 * @param data - The `data` parameter is an object that contains various fields and their corresponding
 * values.
 * @returns the updated `data` object with the specified fields reset to an empty string.
 */
function fieldsToReset (aField, data) {
  for (const field of aField) {
    if (data[field]) data[field] = '';
  }
  return data;
}

// Function to generate username
function generateUsername () {
  const fixedAlpha = 'fn';
  const randomNumeric = generateNumber(100000000, 999999999).toString(); // 7-digit number
  return fixedAlpha + randomNumeric;
}

function trimNumber (num, len = -4) {
  if (len >= num.toString().length || len < -4) len = -4;
  return 'XXXXXXXXXXX' + num.toString().slice(len);
}

const chunk = (array, size) => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    const chunks = array.slice(i, i + size);
    result.push(chunks);
  }
  return result;
};

/**
 * To validate IFSC code is in proper format.
 * @param {string} ifsc code
 * @return { boolean }
 */
function validateIFSC (code) {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(code);
}

/**
 * to convert string / number to fix length decimal value
 * @param  {number || string} number
 * @param  {number} length=2
 * @return  {number}
 */
const convertToDecimal = (number, length = 2) => Number(parseFloat(number).toFixed(length));

function dateDiffInDays (startDate, EndDate) {
  // Discard the time and time-zone information.
  const dateFormat = 'YYYY-MM-DD';
  const sD = moment(startDate).format(dateFormat);
  const eD = moment(EndDate).format(dateFormat);
  const differenceInDays = moment(sD).diff(eD, 'days');
  return { differenceInDays, sD, eD };
}

function readJSONFile (filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        return reject(err);
      }
      try {
        const json = JSON.parse(data);
        resolve(json);
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
}

function readCSVFile (filePath) {
  return new Promise((resolve, reject) => {
    const records = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        records.push(row);
      })
      .on('end', () => {
        resolve(records);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

function readTSVFile (filePath) {
  return new Promise((resolve, reject) => {
    const records = [];
    fs.createReadStream(filePath)
      .pipe(csvParser({ separator: '\t' }))
      .on('data', (row) => {
        records.push(row);
      })
      .on('end', () => {
        resolve(records);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

function readExcelFile (filePath) {
  const workbook = XLSX.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(worksheet);
}

function isMongoId (id) {
  return mongoose.Types.ObjectId.isValid(id);
}

const sendMails = function (data, mailOption) {
  let content;
  switch (data.sType) {
    case 'register':
      content = `Hello ${data.sEmail}, Please use ${data.sCode} otp to register`;
      break;
    case 'forgot':
      content = `Hello ${data.sUsername}, Please use ${data.sCode} otp to reset your password`;
      break;
    case 'verification':
      content = `Hello ${data.sUsername}, Please use ${data.sCode} otp to verify your email`;
      break;
    default:
      break;
  }
  switch (SEND_EMAIL_PROVIDER) {
    case 'oneSignal':
      return sendMailOneSignal({ aTo: [mailOption.to], sSubject: mailOption.subject, sTemplate: 'otp-email', oTemplateBody: { content, code: data.sCode } });
    case 'nodeMailer':
      return sendMailNodeMailer({ aTo: mailOption.to, sSubject: mailOption.subject, sTemplate: 'otp-email', oTemplateBody: { content, code: data.sCode } });
    default:
      break;
  }
};

const comparePassword = function (password, hash) {
  return bcrypt.compareSync(password, hash);
};

const generateUniqueHashForReel = async ({ sLength, iPostId }) => {
  const hash = CryptoJS.SHA256(iPostId + randomStr(sLength, 'private')).toString();
  return hash;
};

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(status.BadRequest).json({
      success: false,
      message: errors.array()[0].msg, // or use language keys here
      data: {},
      error: errors.array()
    });
  }
  next();
};

/**
 * Converts seconds to hh:mm:ss format
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration as hh:mm:ss
 */
const secondsToHHMMSS = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds < 0) {
    return '00:00:00';
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const pad = (num) => String(num).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
};

/**
 * Converts hh:mm:ss format to seconds
 * @param {string} timeString - Time in hh:mm:ss format
 * @returns {number} - Duration in seconds
 */
const hhmmssToSeconds = (timeString) => {
  if (!timeString || typeof timeString !== 'string') {
    return 0;
  }

  const parts = timeString.split(':');
  if (parts.length !== 3) {
    return 0;
  }

  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  const seconds = parseInt(parts[2], 10) || 0;

  return hours * 3600 + minutes * 60 + seconds;
};

/**
 * Validates if a string is in valid hh:mm:ss format
 * @param {string} timeString - Time string to validate
 * @returns {boolean} - True if valid hh:mm:ss format
 */
const isValidHHMMSS = (timeString) => {
  if (!timeString || typeof timeString !== 'string') {
    return false;
  }

  // Check format: hh:mm:ss
  const regex = /^([0-9]{2}):([0-5][0-9]):([0-5][0-9])$/;
  if (!regex.test(timeString)) {
    return false;
  }

  const parts = timeString.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);

  // Validate ranges
  return hours >= 0 && hours <= 99 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59;
};

/**
 * Formats duration fields in an object or array of objects
 * Converts duration fields to hh:mm:ss format directly
 * @param {Object|Array} data - Object or array to format
 * @param {Array<string>} fields - Array of field names to format
 * @returns {Object|Array} - Formatted data
 */
const formatDurationFields = (data, fields = ['iDuration', 'nWatchDuration', 'nTotalDuration', 'nLastPosition']) => {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map(item => formatDurationFields(item, fields));
  }

  if (typeof data === 'object') {
    const formatted = { ...data };

    fields.forEach(field => {
      if (formatted[field] !== undefined && formatted[field] !== null) {
        let seconds = formatted[field];

        // Handle Decimal128 type from MongoDB
        if (seconds && typeof seconds.toString === 'function') {
          seconds = parseFloat(seconds.toString());
        } else if (typeof seconds === 'string') {
          seconds = parseFloat(seconds);
        }

        // Replace the field value with hh:mm:ss format
        formatted[field] = secondsToHHMMSS(seconds);
      }
    });

    return formatted;
  }

  return data;
};

module.exports = {
  sendMails,
  handleValidation,
  getHashVolumeKey,
  getHashOrderKey,
  removenull,
  catchError,
  handleCatchError,
  pick,
  getPaginationValues2,
  getDates,
  ObjectId,
  getIp,
  getPaginationValues,
  getHashAdminOrderKey,
  convertToDecimal,
  generateNumber,
  decryptValuePromise,
  checkAlphanumeric,
  validateMobile,
  generateOTP,
  encryptKeyPromise,
  decryptIfExist,
  mongify,
  createResponse,
  encryptKey,
  maskIfExist,
  searchRegExp,
  isUrl,
  checkValidImageType,
  getBucketName,
  randomStr,
  validateEmail,
  validateIndianNumber,
  validateUsername,
  checkCountryCode,
  decryptValue,
  validateIndianMobile,
  fieldsToDecrypt,
  getUserType,
  validatePassword,
  replaceSensitiveInfo,
  projectionFields,
  fieldsToReset,
  generateUsername,
  trimNumber,
  chunk,
  validateIFSC,
  searchValues,
  getDatesForDashboard,
  getAllDatesBetweenTwoRange,
  dateDiffInDays,
  readJSONFile,
  validObjectId,
  readExcelFile,
  readTSVFile,
  readCSVFile,
  generateSlug,
  isMongoId,
  generateUniqueHashForReel,
  slugify,
  comparePassword,
  getCountryFromIP,
  handleServiceError,
  sendError,
  secondsToHHMMSS,
  hhmmssToSeconds,
  formatDurationFields,
  isValidHHMMSS
};
