const thirdPartyCred = {

  AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY || 'aws-access-key-placeholder',
  AWS_SECRET_KEY: process.env.AWS_SECRET_KEY || 'aws-secret-key-placeholder',
  AWS_REGION: process.env.AWS_REGION || 'ap-south-1',
  AWS_BUCKET_ENDPOINT: process.env.AWS_BUCKET_ENDPOINT,
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || 'spongein-media',
  S3_BUCKET_URL: process.env.S3_BUCKET_URL || 'https://spongein-media.s3.ap-south-1.amazonaws.com/',

  FIREBASE_WEB_API_KEY: process.env.FIREBASE_WEB_API_KEY || 'AIzaSyBbVb54ZxgNwG-c3ImBDBRS2OZrlVO_23s',
  GOOGLE_CLIENT_ID_W: process.env.GOOGLE_CLIENT_ID_W || '218538323308-p1bf5od94pbdfna1rstq3s1kea8gpgfr.apps.googleusercontent.com',
  GOOGLE_CLIENT_ID_A: process.env.GOOGLE_CLIENT_ID_A || '̌',
  GOOGLE_CLIENT_ID_I: process.env.GOOGLE_CLIENT_ID_I || '',
  CLOUD_STORAGE_PROVIDER: process.env.CLOUD_STORAGE_PROVIDER || 'AWS',
  SENTRY_DSN: process.env.SENTRY_DSN || 'https://public@sentry.example.com/',
  OTP_PROVIDER: process.env.OTP_PROVIDER || 'TEST',
  TEST_OTP: process.env.TEST_OTP || 123456,

  HEYGEN_API_URL: process.env.HEYGEN_API_URL || 'https://api.heygen.com',
  HEYGEN_API_KEY: process.env.HEYGEN_API_KEY || 'MzgxY2NlMmJkYzJmNDQwMDk0NGYyNDI4ZjM3MmMzZDYtMTc1ODE4MDYxMQ==',
  HEYGEN_AVATAR_NAME: process.env.HEYGEN_AVATAR_NAME || 'Wayne_20240711',
  HEYGEN_KNOWLEDGE_BASE_ID: process.env.HEYGEN_KNOWLEDGE_BASE_ID || 'e14c3f45b4ed49519f3181b82eadb361',

  BUNNY_LIBRARY_ID: process.env.BUNNY_LIBRARY_ID || '509436',
  BUNNY_NET_KEY: process.env.BUNNY_NET_KEY || '4fa4503d-edb9-4681-bc2e-0fc9a74b95ad',
  BUNNY_TOKEN_AUTH_KEY: process.env.BUNNY_TOKEN_AUTH_KEY || '4fa4503d-edb9-4681-bc2e-0fc9a74b95ad',
  BUNNY_CDN_BASE_URL: process.env.BUNNY_CDN_BASE_URL || 'https://vz-119774b4-8cd.b-cdn.net/',

  STRIPE_KEY: process.env.STRIPE_KEY || 'stripe-key-placeholder',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'stripe-webhook-secret-placeholder', // whsec_XAZA20c28XOHfDcfmm8Wde4tgsfZLoqY
  STRIPE_SUCCESS_URL: process.env.STRIPE_SUCCESS_URL || 'https://spongein.lc.webdevprojects.cloud/',
  STRIPE_CANCEL_URL: process.env.STRIPE_CANCEL_URL || 'https://spongein.lc.webdevprojects.cloud/',
  STRIPE_PRODUCT_ID: process.env.STRIPE_PRODUCT_ID || 'Premium'
};
module.exports = thirdPartyCred;
