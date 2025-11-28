const bodyParser = require('body-parser');

// Routes that should skip JSON/URL encoded parsing and use raw body instead
const RAW_BODY_ROUTES = [
  '/api/user/payment/stripe-webhook'
];

// Custom body parser middleware that handles different parsing based on route
const customBodyParser = () => {
  return (req, res, next) => {
    const isRawBodyRoute = RAW_BODY_ROUTES.some(route => req.path.startsWith(route));

    if (isRawBodyRoute) {
      // Use raw body parser for webhook routes
      return bodyParser.raw({ type: 'application/json' })(req, res, next);
    } else {
      // Use JSON parser for regular routes
      return bodyParser.json({ limit: '1mb' })(req, res, next);
    }
  };
};

// URL encoded body parser (can be applied globally as it doesn't conflict with webhooks)
const urlEncodedParser = bodyParser.urlencoded({ extended: true });

// Raw body parser for specific routes
const rawBodyParser = bodyParser.raw({ type: 'application/json' });

// Text body parser for specific routes
const textBodyParser = bodyParser.text({ type: 'text/plain' });

module.exports = {
  customBodyParser,
  urlEncodedParser,
  rawBodyParser,
  textBodyParser,
  RAW_BODY_ROUTES
};
