/**
 * Auth middleware containes the common methods to authenticate user or admin by token.
 * @method {isUserAuthenticated} is for authenticating the token.
 * @method {findByToken} is specified in user.model.js
 */
const net = require('net');
const Sentry = require('@sentry/node');
const jwt = require('jsonwebtoken');
const { verifyAccessToken, extractBearerToken, verifyAccessTokenUser } = require('../helper/token.util');
const { messages, status, jsonStatus } = require('../helper/api.responses');
const { validationResult } = require('express-validator');
const config = require('../config/config');
const { handleCatchError, ObjectId, catchError, getIp } = require('../helper/utilities.services');
const data = require('../data');
// const AdminsModel = require('../models-routes-services/admin/model')
const RolesModel = require('../models-routes-services/admin/roles/model');
const { PRIVATE_KEY, PUBLIC_KEY } = require('../config/config');
const AdminModel = require('../models-routes-services/admin/model');
const Crypt = require('hybrid-crypto-js').Crypt;
const crypt = new Crypt();
// const UsersModel = require('../models-routes-services/user/model')
// const { redisClient } = require('../helper/redis')
const { recordUserActivity } = require('../models-routes-services/user/activity.services');
const validateAdmin = (sKey, eType) => {
  return async (req, res, next) => {
    try {
      // Retrieve the token from the request header
      const token = req.header('Authorization');
      // const token = extractBearerToken(tokenHeader)

      // Check if the token is present
      if (!token) {
        return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized });
      }

      let admin;

      // Authenticate admin based on the provided token
      try {
        // use existing method; token expected to be access token
        admin = await AdminModel.findByToken(token, req?.sTokenTypeProvider);
      } catch (err) {
        return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized });
      }

      // Check if admin authentication is successful
      if (!admin) {
        return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized });
      }

      // Set authenticated admin in the request object
      req.admin = admin;

      let errors;
      // Normalize inputs
      const normalizedKey = (sKey || '').toString().toLowerCase();
      // Accept short codes 'R' | 'W' | 'N' or enum names 'READ' | 'WRITE' | 'NONE'
      const normalizedTypeInput = (eType || '').toString().toUpperCase();
      const adminPermEnum = data?.eAdminPermission?.map || { READ: 'R', WRITE: 'W', NONE: 'N' };
      const normalizedType = ['R', 'W', 'N'].includes(normalizedTypeInput)
        ? normalizedTypeInput
        : (adminPermEnum[normalizedTypeInput] || 'R');

      // Check admin type for SUPER admin
      if (req.admin.eType === 'SUPER') {
        // Validate request parameters if admin is SUPER
        errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.UnprocessableEntity, data: errors.array() });
        }

        return next();
      } else {
        // Check if admin has roles
        if (!req.admin.aRole) {
          return res.status(status.Forbidden).jsonp({ status: jsonStatus.Forbidden, message: messages[req.userLanguage].access_denied });
        }

        // Retrieve roles and permissions for the admin
        const roles = await RolesModel.find({ _id: { $in: req.admin.aRole }, eStatus: 'Y' }, { aPermissions: 1 })
          .populate({ path: 'aPermissions', select: 'sKey eType eStatus' })
          .lean();

        // Check if roles are found
        if (!roles.length) {
          return res.status(status.Forbidden).jsonp({ status: jsonStatus.Forbidden, message: messages[req.userLanguage].access_denied });
        }

        // Flatten permissions array
        let aPermissions = roles.map(role => role.aPermissions);
        aPermissions = [].concat.apply([], aPermissions);

        // Check if admin has the required permission
        const hasPermission = aPermissions.find((permission) => {
          if (!permission || permission.eStatus === 'N') return false;
          const permKey = (permission.sKey || '').toString().toLowerCase();
          const permType = (permission.eType || '').toString().toUpperCase();
          // Write implies read
          const typeAllowed = permType === normalizedType || (normalizedType === 'R' && permType === 'W');
          return permKey === normalizedKey && typeAllowed;
        });

        if (!hasPermission) {
          let hasSubAdminPermission;

          // Check if additional permission is not found
          if (!hasSubAdminPermission) {
            let message;

            // Set appropriate message based on permission type
            switch (normalizedType) {
              case 'R':
                message = messages[req.userLanguage].read_access_denied.replace('##', sKey);
                break;
              case 'W':
                message = messages[req.userLanguage].write_access_denied.replace('##', sKey);
                break;
              case 'N':
                message = messages[req.userLanguage].access_denied;
                break;
              default:
                message = messages[req.userLanguage].access_denied;
                break;
            }

            // Send unauthorized response
            return res.status(status.Forbidden).jsonp({
              status: jsonStatus[403],
              message
            });
          }
        }

        // Validate request parameters
        errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.UnprocessableEntity, data: errors.array() });
        }

        return next(null, null);
      }
    } catch (error) {
      console.log('error', error);
      // Handle errors, log them, and send an internal server error response
      return catchError('validateAdmin', error, req, res);
    }
  };
};

const isAdminAuthenticated = async (req, res, next) => {
  try {
    // Retrieve the token from the request header
    const token = req.header('Authorization');
    // const token = extractBearerToken(req.header('Authorization'))

    // Check if the token is present
    if (!token) {
      return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized });
    }

    // Authenticate admin based on the provided token
    const admin = await AdminModel.findByToken(token, req.sTokenTypeProvider);

    req.admin = admin;

    // Check if admin authentication is successful
    if (!admin) {
      return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized });
    }

    // Set authenticated admin in the request object

    // Validate the request against any specified validation rules
    const errors = validationResult(req);

    // If validation errors are present, send an unprocessable entity response
    if (!errors.isEmpty()) {
      return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.UnprocessableEntity, errors: errors.array() });
    }

    // Call the next middleware in the chain
    return next(null, null);
  } catch (error) {
    // Handle errors, log them, and send an internal server error response
    return catchError('isAdminAuthenticated', error, req, res);
  }
};

const validate = function (req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
      .status(status.UnprocessableEntity)
      .jsonp({ status: jsonStatus.UnprocessableEntity, errors: errors.array() });
  }
  next();
};

const validateFunctionality = (functionality) => {
  return async function (req, res, next) {
    if (config.FUNCTIONALITY[functionality]) {
      return next(null, null);
    } else {
      return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].access_denied });
    }
  };
};

const isCronAuthenticated = (req, res, next) => {
  try {
    if (config.CRON_AUTH_TOKEN) {
      const token = req.header('Authorization');

      if (!token || !config.CRON_AUTH_TOKEN || token !== config.CRON_AUTH_TOKEN) {
        return res.status(status.Unauthorized).jsonp({
          status: jsonStatus.Unauthorized,
          message: messages[req.userLanguage].err_unauthorized
        });
      }
    }
    return next();
  } catch (error) {
    handleCatchError(error);
    if (process.env.NODE_ENV === 'production') Sentry.captureMessage(error);
    return res.status(status.InternalServerError).jsonp({
      status: jsonStatus.InternalServerError,
      message: messages[req.userLanguage].error
    });
  }
};

const isDeprecated = (req, res, next) => {
  res.set('Deprecated', true);
  next();
};
const checkToken = (req, res, next) => {
  try {
    const token = req.header('Authorization');
    // const token = extractBearerToken(req.header('Authorization'))
    // Check if token is present
    if (!token) {
      return res.status(status.Unauthorized).jsonp({
        status: jsonStatus.Unauthorized,
        message: messages[req.userLanguage].err_unauthorized
      });
    }

    const decode = jwt.decode(token);
    if (!decode) {
      return res.status(status.Unauthorized).jsonp({
        status: jsonStatus.Unauthorized,
        message: messages[req.userLanguage].err_unauthorized
      });
    }
    req.sTokenTypeProvider = 'admin';
    try {
      const data = jwt.verify(token, config.JWT_SECRET);
      req.decode = data;

      // Validate the request against any specified validation rules
      const errors = validationResult(req);
      // If validation errors are present, send an unprocessable entity response
      if (!errors.isEmpty()) {
        return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.UnprocessableEntity, errors: errors.array() });
      }
      return next();
    } catch (error) {
      return res.status(status.Unauthorized).jsonp({
        status: jsonStatus.Unauthorized,
        message: messages[req.userLanguage].err_unauthorized
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'production') Sentry.captureMessage(error);
    return res.status(status.InternalServerError).jsonp({
      status: jsonStatus.InternalServerError,
      message: messages[req.userLanguage].error
    });
  }
};

/**
 * Middleware to check if the user is authenticated based on the provided JWT token.
 * @param {*} req - The request object containing the JWT token in the 'Authorization' header.
 * @param {*} res - The response object for sending HTTP responses.
 * @param {*} next - The callback function to pass control to the next middleware.
 * @returns {void} - If the user is authenticated, calls the next middleware; otherwise, sends an unauthorized response.
 */
const isUserAuthenticated = async (req, res, next) => {
  try {
    // Extract JWT token from the 'Authorization' header
    const token = req.header('Authorization');
    // console.log("token", token);
    // Check if token is present
    if (!token) {
      return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized });
    }

    // const isBlackList = await redisClient.get(`BlackListToken:${token}`)
    // if (isBlackList) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

    // Initialize user object
    req.user = {};

    let user;
    // console.log("config.JWT_SECRET_USER", config.JWT_SECRET);

    try {
      // Verify the JWT access token using centralized util
      user = verifyAccessTokenUser(token);
    } catch (err) {
      // Handle JWT verification failure
      return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized });
    }

    // Check if user object is obtained from the JWT token
    if (!user) {
      return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized });
    }

    // Check if the user is blocked (eType '2' means user is blocked)
    if (user.eType === '2' || user.eType === 'B') {
      return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].user_blocked });
    }

    // Set user information in the request object
    req.user = user;
    req.user._id = ObjectId(user._id);
    req.user.eUserType = 'U';

    // Fire-and-forget activity tracking
    try {
      if (req?.user?._id) recordUserActivity(req.user._id, 'request');
    } catch (_) { }

    // Validate the request against any specified validation rules
    const errors = validationResult(req);

    // If validation errors are present, send an unprocessable entity response
    if (!errors.isEmpty()) {
      return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.UnprocessableEntity, errors: errors.array() });
    }

    // await Promise.all([
    //   // track user activity, expire set for 1 hrs, seconds of 1 hrs will be 3600
    //   redisClient.set(`a:user:1:hr:${user._id}`, true, 'EX', 3600),
    //   // 15 days of expire, seconds of 15 day will be 1296000
    //   redisClient.set(`a:user:15:day:${user._id}`, true, 'EX', 1296000)
    // ])
    return next(null, null);
  } catch (error) {
    // Handle any unexpected errors
    return catchError('isUserAuthenticated', error, req, res);
  }
};

const optionalUserAuthChecking = async (req, res, next) => {
  try {
    const token = req.header('Authorization');
    // const token = extractBearerToken(req.header('Authorization'))
    req.user = {};

    let bIsVerifiedToken = false;
    let user;
    if (token) {
      // const isBlackList = await redisClient.get(`BlackListToken:${token}`)
      // if (isBlackList) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })
      try {
        user = verifyAccessToken(token);
        bIsVerifiedToken = true;
      } catch (err) {
        // Handle JWT verification failure
        bIsVerifiedToken = false;
      }
      if (bIsVerifiedToken) {
        // Check if the user is blocked (eType '2' means user is blocked)
        if (user?.eType === '2' || user?.eType === 'B') {
          return next(null, null);
        }

        // Set user information in the request object
        req.user = user;
        req.user._id = ObjectId(user?._id);
        req.user.eUserType = 'U';

        // Fire-and-forget activity tracking
        try {
          if (req?.user?._id) recordUserActivity(req.user._id, 'request');
        } catch (_) { }
      }
    }

    // Validate the request against any specified validation rules
    const errors = validationResult(req);

    // If validation errors are present, send an unprocessable entity response
    if (!errors.isEmpty()) {
      return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.UnprocessableEntity, errors: errors.array() });
    }
    // if (bIsVerifiedToken) {
    //   await Promise.all([
    //     // track user activity, expire set for 1 hrs, seconds of 1 hrs will be 3600
    //     redisClient.set(`a:user:1:hr:${user._id}`, true, 'EX', 3600),
    //     // 15 days of expire, seconds of 15 day will be 1296000
    //     redisClient.set(`a:user:15:day:${user._id}`, true, 'EX', 1296000)
    //   ])
    // }
    return next(null, null);
  } catch (error) {
    // Handle any unexpected errors
    return catchError('isUserAuthenticated', error, req, res);
  }
};

const isUserSocketAuthenticated = (socket, next) => {
  try {
    let token = '';
    if (socket.handshake.auth.Authorization) {
      token = socket.handshake.auth.Authorization;
    } else if (socket.request.headers.authorization) {
      token = socket.request.headers.authorization;
    }
    if (!token) {
      return next(new Error('Token not provided'));
    }
    if (token === config.SOCKET_SECRET) {
      return next(null, null);
    }
    // Initialize user object
    socket.user = {};

    let user;
    let bIsUserUnauthorized = false;
    let bIsAdminUnauthorized = false;
    try {
      // Verify the JWT token using the secret key for user authentication
      user = jwt.verify(token, config.JWT_SECRET_USER);
    } catch (err) {
      // Handle JWT verification failure
      bIsUserUnauthorized = true;
    }

    try {
      // Verify the JWT token using the secret key for user authentication
      user = jwt.verify(token, config.JWT_SECRET);
    } catch (err) {
      // Handle JWT verification failure
      bIsAdminUnauthorized = true;
    }

    if (bIsAdminUnauthorized && bIsUserUnauthorized) {
      socket.emit('unauthorized', { message: messages[req.userLanguage].unauthorized });
      socket.disconnect();
      return next(new Error(messages[req.userLanguage].unauthorized));
    }
    // Check if user object is obtained from the JWT token
    if (!user) {
      socket.emit('unauthorized', { message: messages[req.userLanguage].unauthorized });
      socket.disconnect();
      return next(new Error(messages[req.userLanguage].unauthorized));
    }

    // Check if the user is blocked (eType '2' means user is blocked)
    if (user.eType === '2' || user.eType === 'B') {
      socket.emit('unauthorized', { message: messages[req.userLanguage].unauthorized });
      socket.disconnect();
      return next(new Error(messages[req.userLanguage].unauthorized));
    }

    socket.user = user;
    socket.join(user?._id);
    next();
  } catch (error) {
    console.log('error', error);
    socket.emit('unauthorized', { message: messages[req.userLanguage].unauthorized }, () => {
      socket.disconnect();
    });
  }
};

/**
 * Function to decrypt a password.
 * @param {string} password - The encrypted password.
 * @returns {string} The decrypted password.
 */
const decryption = function (password) {
  try {
    // Decrypt the password using the private key
    const decrypted = crypt.decrypt(PRIVATE_KEY, password);
    // Get the decrypted message
    const decryptedData = decrypted.message;
    // Convert the decrypted data to a string and return it
    return decryptedData.toString();
  } catch (error) {
    return password;
  }
};

/**
 * Middleware to decrypt passwords in the request body.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @param {function} next - The next middleware function.
 */
const decrypt = function (req, res, next) {
  const { sPassword, sOldPassword, sCurrentPassword, sNewPassword } = req.body || {};
  if (sPassword) {
    req.body.sPassword = decryption(sPassword);
  }
  // Support both legacy (sOldPassword) and current (sCurrentPassword) names
  if (sOldPassword) {
    req.body.sOldPassword = decryption(sOldPassword);
  }
  if (sCurrentPassword) {
    req.body.sCurrentPassword = decryption(sCurrentPassword);
  }
  if (sNewPassword) {
    req.body.sNewPassword = decryption(sNewPassword);
  }
  next();
};

// This function encrypts a field using a public key
const encryption = function (field) {
  const encrypted = crypt.encrypt(PUBLIC_KEY, field);
  return encrypted.toString();
};

const changeDeviceTokenField = function (req, res, next) {
  if (req.body) {
    const { sDeviceId } = req.body;

    req.body.sDeviceToken = sDeviceId;
  }

  next();
};

// async function checkAccess(req, res, next) {
//   try {
//     const ip = getIp(req);

//     const ipType = net.isIP(ip);

//     if (!ipType || ipType === 0) {
//       return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized });
//     }

//     const eIpType = (ipType === 4) ? 'IPv4' : 'IPv6';

//     let ipRanges = await NetAccessesModel.find({ eStatus: 'Y' }, { sName: 1 }).lean();

//     if (!ipRanges.length) {
//       if (eIpType === 'IPv4') {
//         ipRanges = [{ sName: '0.0.0.0/0' }];
//       } else {
//         ipRanges = [{ sName: '::0/0' }];
//       }
//     }

//     const checkValidIp = ipRangeCheck(ip, ipRanges.map(ipR => ipR?.sName));

//     if (!checkValidIp) {
//       return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized });
//     }

//     return next();
//   } catch (error) {
//     return res.status(status.InternalServerError).jsonp({
//       status: jsonStatus.InternalServerError,
//       message: messages[req.userLanguage].error
//     });
//   }
// }

// const isBlockedByAdmin = async (req, res, next) => {
//   try {
//     const user = await UsersModel.findById(req.user._id).lean()
//     if (!user || user.eStatus !== 'Y') { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].user_blocked }) }

//     return next(null, null)
//   } catch (error) {
//     handleCatchError(error)
//     if (process.env.NODE_ENV === 'production') Sentry.captureMessage(error)
//     return res.status(status.InternalServerError).jsonp({
//       status: jsonStatus.InternalServerError,
//       message: messages[req.userLanguage].error
//     })
//   }
// }

const importFileValidation = (req, res, next) => {
  try {
    if ([false, 'false'].includes(req?.body?.bAutomated)) {
      const MAX_FILE_SIZE = data.fileSize;
      const ALLOWED_FILE_FORMATS = data.supportFileFormate;

      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(status.NotAcceptable).jsonp({
          status: status.NotAcceptable,
          message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].cFile)
        });
      }
      const uploadedFile = req.files.file;

      if (!ALLOWED_FILE_FORMATS.includes(uploadedFile.mimetype)) {
        const allowedFormats = ALLOWED_FILE_FORMATS.join(', ');
        const errorMessage = messages[req.userLanguage].only_allowed_files.replace('##', allowedFormats);
        return res.status(status.NotAcceptable).jsonp({
          status: status.NotAcceptable,
          message: errorMessage
        });
      }

      // Check file size
      if (uploadedFile.size > MAX_FILE_SIZE) {
        const maxSizeInMB = MAX_FILE_SIZE / (1024 * 1024);
        const errorMessage = messages[req.userLanguage].file_size_exceeds.replace('##', maxSizeInMB);
        return res.status(status.NotAcceptable).jsonp({
          status: status.NotAcceptable,
          message: errorMessage
        });
      }
    }
    next();
  } catch (error) {
    return res.status(status.InternalServerError).jsonp({
      status: status.InternalServerError,
      message: messages[req.userLanguage].error
    });
  }
};

module.exports = {
  validateAdmin,
  validate,
  isAdminAuthenticated,
  isUserAuthenticated,
  validateFunctionality,
  isCronAuthenticated,
  isDeprecated,
  checkToken,
  isUserSocketAuthenticated,
  decrypt,
  decryption,
  encryption,
  changeDeviceTokenField,
  // isBlockedByAdmin,
  // checkAccess,
  importFileValidation,
  optionalUserAuthChecking
};
