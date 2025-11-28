/**
 * Video Services Index
 * Aggregates all video-related services for backward compatibility
 */

const crudServices = require('./crud.services');
const listServices = require('./list.services');
const detailServices = require('./detail.services');
const multipartServices = require('./multipart.services');

module.exports = {
  // CRUD services
  ...crudServices,

  // List services
  ...listServices,

  // Detail services
  ...detailServices,

  // Multipart and Bunny services
  ...multipartServices
};
