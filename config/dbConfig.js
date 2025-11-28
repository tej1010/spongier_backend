const dbVar = {

  USER_DB_URL: process.env.USER_DB_URL || 'mongodb://localhost:27017/users',
  USER_DB_POOLSIZE: process.env.USER_DB_POOLSIZE || 10,

  ADMIN_DB_URL: process.env.ADMIN_DB_URL || 'mongodb://localhost:27017/admins',
  ADMIN_DB_POOLSIZE: process.env.ADMIN_DB_POOLSIZE || 10,

  COURSE_DB_URL: process.env.COURSE_DB_URL || 'mongodb://localhost:27017/courses',
  COURSE_DB_POOLSIZE: process.env.COURSE_DB_POOLSIZE || 10,

  // USER_DB_URL: process.env.USER_DB_URL || 'mongodb://localhost:27017/users',
  // REELS_DB_URL: process.env.REELS_DB_URL || 'mongodb://localhost:27017/reels',
  // ARTICLES_DB_URL: process.env.ARTICLES_DB_URL || 'mongodb://localhost:27017/articles',
  // MATCHES_DB_URL: process.env.MATCHES_DB_URL || 'mongodb://localhost:27017/matches',
  // STATISTICS_DB_URL: process.env.STATISTICS_DB_URL || 'mongodb://localhost:27017/statistics',

  ADMIN_LOGIN_AUTHENTICATION: process.env.ADMIN_LOGIN_AUTHENTICATION || 'password', // Admin login authentication method

  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: process.env.REDIS_PORT || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || ''
};

module.exports = dbVar;
