require('dotenv').config();
const dbVar = require('./dbConfig');
// Object for all third party cred
const thirdPartyCred = require('./thirdPartyConfig');

// Object for all Default cred
const defaultVar = require('./defaultConfig');

const environment = {
  ...dbVar,
  ...thirdPartyCred,
  ...defaultVar,
  NODE_ENV: process.env.NODE_ENV || 'dev'
};

module.exports = environment;
