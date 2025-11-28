// Object for all Default cred
const defaultVar = {
  PAGINATION_LIMIT: parseInt(process.env.PAGINATION_LIMIT || 500),
  PORT: process.env.PORT || 1338,
  FRONTEND_HOST_URL: process.env.FRONTEND_HOST_URL || 'https://test.spongein.in',
  BACKEND_URL: process.env.BACKEND_URL,
  LOGIN_HARD_LIMIT_ADMIN: 10, // Login limit for admin
  LOGIN_HARD_LIMIT: 5, // 0 = unlimited

  CRON_AUTH_TOKEN: process.env.CRON_AUTH_TOKEN || '',
  DISABLE_ADMIN_ROUTES: process.env.DISABLE_ADMIN_ROUTES === 'true',
  THRESHOLD_RATE_LIMIT: process.env.THRESHOLD_RATE_LIMIT || 5,
  OTP_EXPIRY_TIME: process.env.OTP_EXPIRY_TIME || 30,

  s3UserSegmentReport: process.env.s3UserSegmentReport || 'report/userSegments/',

  OTP_LENGTH: process.env.OTP_LENGTH || 6,
  CACHE_1: 10, // 10 seconds
  CACHE_2: 60, // 1 minute
  CACHE_3: 3600, // 1 hour
  CACHE_4: 86400, // 1 day
  CACHE_5: 864000, // 10 days
  CACHE_6: 21600, // 6 Hours
  CACHE_7: 300, // 5 minute
  CACHE_8: 600, // 10 minute
  CACHE_9: 5, // 5 seconds,
  CACHE_10: 1800, // 30 minute
  CACHE_11: 30, // 30 seconds
  CACHE_12: 120, // 2 minute
  CACHE_13: 15, // 15 seconds

  DB_SQL_MIN_POOLSIZE: process.env.DB_SQL_MIN_POOLSIZE || 10,
  DB_SQL_MAX_POOLSIZE: process.env.DB_SQL_MAX_POOLSIZE || 85,

  ADMINS_DB_POOLSIZE: process.env.ADMINS_DB_POOLSIZE || 10,
  USERS_DB_POOLSIZE: process.env.USERS_DB_POOLSIZE || 10,
  COURSES_DB_POOLSIZE: process.env.COURSES_DB_POOLSIZE || 10,

  // Admin JWT Secret
  JWT_SECRET: process.env.JWT_SECRET || 'aAbBcC@test_123',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'aAbBcC@test_123', // Refresh token secret
  JWT_VALIDITY: process.env.JWT_VALIDITY || '8h',
  JWT_REFRESH_VALIDITY: process.env.JWT_REFRESH_VALIDITY || '30d',

  // User JWT Secret
  JWT_SECRET_USER: process.env.JWT_SECRET_USER || 'aAbBcC@test_123_User', // JWT secret for user
  JWT_REFRESH_SECRET_USER: process.env.JWT_REFRESH_SECRET_USER || 'aAbBcC@test_123_User_Refresh',
  JWT_VALIDITY_USER: process.env.JWT_VALIDITY_USER || '8h',
  JWT_REFRESH_VALIDITY_USER: process.env.JWT_REFRESH_VALIDITY_USER || '30d',

  S3PAYOUTOPTION: process.env.S3_PAYOUT_OPTION_PATH || 'payout-options/',
  S3PAYMENTOPTION: process.env.S3_PAYMENT_OPTIONS_PATH || 'payment-option/',
  S3_FOLDER_PATH: process.env.S3_FOLDER_PATH || 'images/',

  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef', // Encryption key
  IV_VALUE: process.env.IV_VALUE || 'abcdef9876543210abcdef9876543210', // IV value

  S3EMAILTEMPLATES: process.env.S3_EMAIL_TEMPLATES_PATH || 'email-templates/',
  s3SideBackground: process.env.S3_SIDE_BACKGROUND_PATH || 'side-background/',
  S3_USER_PROFILE_PATH: process.env.S3_USER_PROFILE_PATH || 'Users/profile',
  S3_STREAK_IMAGE_PATH: process.env.S3_STREAK_IMAGE_PATH || 'streak/',
  S3_LINGO_TYPE: process.env.S3_EMAIL_TEMPLATES_PATH || 'lingo_type/',

  DEFAULT_OTP: process.env.DEFAULT_OTP || '123456',
  NEXT_PUBLIC_SPONSOR_STATIC_OTP: process.env.NEXT_PUBLIC_SPONSOR_STATIC_OTP || '',
  DEFAULT_STUDENT_PASSWORD: process.env.DEFAULT_STUDENT_PASSWORD || 'Student@123',

  PAGE_SIZE: process.env.PAGE_SIZE || 50,

  // MAIL_TRANSPORTER: {
  //   host: process.env.SMTP_HOST || 'smtp.gmail.com',
  //   port: process.env.SMTP_PORT || 587,
  //   // If SMTP_SECURE is not explicitly provided, infer from port: 465 => true, others => false
  //   // secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : String(process.env.SMTP_PORT || 587) === '465',
  //   auth: {
  //     user: process.env.SMTP_USERNAME || 'pranav.kakadiya@yudizsolutions.com',
  //     pass: process.env.SMTP_PASSWORD || 'afwefblhwejpwkvf'
  //   }
  // },
  SMTP_FROM: process.env.SMTP_FROM || process.env.SMTP_USERNAME || 'kavita.goel@yudizsolutions.com',

  BUNNY_NET_KEY: process.env.BUNNY_NET_KEY || '4fa4503d-edb9-4681-bc2e-0fc9a74b95ad',

  // MSG91 SMS Configuration
  MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY || '471778ApCL0JF5dUh69031b5aP1',
  MSG91_SENDER_ID: process.env.MSG91_SENDER_ID || 'SPONG2',
  MSG91_BASE_URL: process.env.MSG91_BASE_URL || 'https://cotrol.msg91.com/api/v5'

};
module.exports = defaultVar;
