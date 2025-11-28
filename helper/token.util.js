const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Centralized helpers for access/refresh tokens

function signAccessToken (payload) {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_VALIDITY });
}

function signRefreshToken (payload) {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, { expiresIn: config.JWT_REFRESH_VALIDITY });
}

function verifyAccessToken (token) {
  return jwt.verify(token, config.JWT_SECRET);
}

function verifyRefreshToken (token) {
  return jwt.verify(token, config.JWT_REFRESH_SECRET);
}

// User-specific token functions
function signAccessTokenUser (payload) {
  return jwt.sign(payload, config.JWT_SECRET_USER, { expiresIn: config.JWT_VALIDITY_USER });
}

function signRefreshTokenUser (payload) {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET_USER, { expiresIn: config.JWT_REFRESH_VALIDITY_USER });
}

function verifyAccessTokenUser (token) {
  return jwt.verify(token, config.JWT_SECRET_USER);
}

function verifyRefreshTokenUser (token) {
  return jwt.verify(token, config.JWT_REFRESH_SECRET_USER);
}

function extractBearerToken (authorizationHeader) {
  if (!authorizationHeader) return null;
  const parts = authorizationHeader.split(' ');
  if (parts.length === 2 && /^bearer$/i.test(parts[0])) return parts[1];
  return authorizationHeader;
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  signAccessTokenUser,
  signRefreshTokenUser,
  verifyAccessTokenUser,
  verifyRefreshTokenUser,
  extractBearerToken
};
