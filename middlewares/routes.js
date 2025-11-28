const { status, jsonStatus } = require('../helper/api.responses');

module.exports = (app) => {
  // if (DISABLE_ADMIN_ROUTES) {
  //   app.all('/api/admin/*', (req, res) => { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound }) })
  // }

  app.use('/api', (req, res, next) => {
    // if (req.path.includes('/admin/')) {
    //   return checkAccess(req, res, next)
    // }
    return next();
  });

  app.get('/api/health-check', (req, res) => {
    const sDate = new Date().toJSON();
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, sDate });
  });

  // API routes with authentication and subscription middleware
  app.use('/api', [
    require('../models-routes-services/aiTutor/routes'),
    require('../models-routes-services/aiTutor/language/routes'),
    require('../models-routes-services/aiTutor/conversation/routes'),
    require('../models-routes-services/cron/routes'),
    require('../models-routes-services/subscription/subscriptionPlan/routes'), // subscription plan routes
    require('../models-routes-services/subscription/invoice/routes'), // subscription invoice routes
    require('../models-routes-services/county/routes'), // country routes
    require('../models-routes-services/banner/routes'), // banner routes
    // Admin course management routes (no subscription check)
    require('../models-routes-services/course/grades/routes'), // grade management routes
    require('../models-routes-services/course/subjects/routes'), // subject management routes
    require('../models-routes-services/course/terms/routes'), // term management routes
    require('../models-routes-services/course/videos/routes'), // video management routes
    require('../models-routes-services/course/resource/routes'), // resource management routes

    require('../models-routes-services/admin/routes'), // admin routes
    require('../models-routes-services/user/routes'), // user routes
    require('../models-routes-services/user/activityHistory/routes'), // user activity history routes
    require('../models-routes-services/school/routes'), // school routes
    require('../models-routes-services/subscription/routes'), // subscription routes
    require('../models-routes-services/payment/routes'), // subscription routes
    require('../models-routes-services/subscription/bulkStudent.routes'), // bulk student routes
    require('../models-routes-services/stats/routes'), // statistics routes
    require('../models-routes-services/transaction/routes'), // transaction routes

    require('../models-routes-services/course/quiz/routes'), // quiz routes
    require('../models-routes-services/badges/routes'), // badge routes

    // Course-related routes with subscription middleware
    require('../models-routes-services/course/user.routes'), // User-facing course routes with subscription check

    require('../models-routes-services/seo/route'), // SEO management routes
    require('../models-routes-services/seo/redirect.route'), // SEO redirect routes
    require('../models-routes-services/seo/sitemap.route') // SEO sitemap routes
  ]);

  // app.get('*', (req, res) => {
  //   return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', 'route') })
  // })
};
