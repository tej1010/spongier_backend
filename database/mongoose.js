// database/mongoose.js
// Safe mongoose connector for local/offline dev and real DBs
require('dotenv').config(); // load .env if present

const mongoose = require('mongoose');
const { handleCatchError } = require('../helper/utilities.services');
const config = require('../config/config');

// If you want to force offline mode set OFFLINE_MODE=true in .env or in your shell:
// OFFLINE_MODE=true node ...
const envFlag = process.env.OFFLINE_MODE === 'true';

// If config doesn't provide any DB URLs, auto-enable offline mode to avoid hangs:
const noDbUrls =
  !config ||
  (!config.USER_DB_URL && !config.ADMIN_DB_URL && !config.COURSE_DB_URL);

const OFFLINE_MODE = envFlag || noDbUrls;

function createMockConnection(DB) {
  console.log(`⚠️  OFFLINE MODE: using in-memory mock DB for "${DB}"`);
  // simple in-memory store container for this connection (optional)
  const memory = { __store: {} };

  return {
    // mimic connection.model(name, schema) -> returns a very small mock model
    model: (name) => {
      // ensure store for this model
      memory.__store[name] = memory.__store[name] || [];

      return {
        find: async (query = {}) => {
          // very naive filtering for id
          if (query && query._id) {
            return memory.__store[name].filter((r) => r._id == query._id);
          }
          return memory.__store[name];
        },
        findOne: async (query = {}) => {
          if (query && (query._id || query.id)) {
            return memory.__store[name].find((r) => r._id == (query._id || query.id)) || null;
          }
          return memory.__store[name][0] || null;
        },
        findById: async (id) => memory.__store[name].find((r) => r._id == id) || null,
        create: async (data) => {
          const record = Object.assign({}, data);
          record._id = record._id || `${Date.now()}-${Math.floor(Math.random()*1000)}`;
          memory.__store[name].push(record);
          return record;
        },
        updateOne: async (filter = {}, update = {}) => {
          // naive updateOne: update first matched
          const item = memory.__store[name].find((r) => r._id == (filter._id || filter.id));
          if (item) Object.assign(item, update.$set || update);
          return { acknowledged: true, matchedCount: item ? 1 : 0, modifiedCount: item ? 1 : 0 };
        },
        deleteOne: async (filter = {}) => {
          const idx = memory.__store[name].findIndex((r) => r._id == (filter._id || filter.id));
          if (idx >= 0) {
            memory.__store[name].splice(idx, 1);
            return { acknowledged: true, deletedCount: 1 };
          }
          return { acknowledged: true, deletedCount: 0 };
        },
        // expose internal memory for debugging (not necessary)
        __memory: memory.__store[name],
      };
    },
    // minimal no-op close so process can exit
    close: async () => {
      console.log(`Mock connection for "${DB}" closed.`);
      return Promise.resolve();
    },
  };
}

function connection(DB_URL, maxPoolSize = 10, DB) {
  try {
    if (OFFLINE_MODE) {
      // Return mock connection and do not attempt any network operations
      return createMockConnection(DB);
    }

    if (!DB_URL) {
      console.warn(`DB URL for "${DB}" is missing — falling back to OFFLINE mode.`);
      return createMockConnection(DB);
    }

    const dbConfig = {
      readPreference: 'secondaryPreferred',
      maxPoolSize,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000, // keep lower so failed connections fail faster
      serverSelectionTimeoutMS: 10000, // important: stop waiting too long for server selection
    };

    const conn = mongoose.createConnection(DB_URL, dbConfig);

    conn.on('connected', () => console.log(`Connected to ${DB} database.`));
    conn.on('error', (error) => {
      console.log(`Error during database connection for ${DB}:`, error && error.message ? error.message : error);
      handleCatchError(error);
    });

    // If the connection fails to open within serverSelectionTimeoutMS, mongoose will emit an error.
    // We still return the connection object because app code expects it synchronously.
    return conn;
  } catch (error) {
    console.log('Error during connection setup:', error);
    handleCatchError(error);
    // If something goes wrong, return a mock connection to keep app running in dev
    return createMockConnection(DB);
  }
}

// Create connections (these will be mock if OFFLINE_MODE or if DB URLs missing)
const UsersDBConnect = connection(config.USER_DB_URL, parseInt(config.USERS_DB_POOLSIZE || '10', 10), 'Users');
const AdminsDBConnect = connection(config.ADMIN_DB_URL, parseInt(config.ADMINS_DB_POOLSIZE || '10', 10), 'Admins');
const CourseDBConnect = connection(config.COURSE_DB_URL, parseInt(config.COURSES_DB_POOLSIZE || '10', 10), 'Courses');

module.exports = { UsersDBConnect, AdminsDBConnect, CourseDBConnect };
