// user.routes.js
const express = require('express');
const router = express.Router();

// Import controllers
const {
  getSubject,
  listSubjects,
  getRelatedSubjects
} = require('./subjects/services');

const {
  getGrade,
  listGrades,
  featuredGrades
} = require('./grades/services');

const {
  getTerm,
  listTerms
} = require('./terms/services');

const {
  getVideo,
  listVideos
} = require('./videos/services');

const {
  getResource,
  listResources
} = require('./resource/services');

// Import validators
const {
  validateGetSubject,
  validateListSubjects,
  validateGetRelatedSubjects
} = require('./subjects/validators');

const {
  validateGetGrade,
  validateListGrades,
  validateFeaturedGrades
} = require('./grades/validators');

const {
  validateGetTerm,
  validateListTerms
} = require('./terms/validators');

const {
  validateGetVideo,
  validateListVideos
} = require('./videos/validators');

const {
  validateGetResource,
  validateListResources
} = require('./resource/validators');

const { handleValidation } = require('../../helper/utilities.services');
const { getHomePage, exploreStudent, getCourseDetail, getMyLearnings, getPopularGrade, getPopularVideosGuest } = require('./home.services');
const { isUserAuthenticated, optionalUserAuthChecking } = require('../../middlewares/middleware');

// Bookmarks
const { addBookmark, removeBookmark, listBookmarks } = require('./bookmarks/services');
const { validateAddBookmark, validateRemoveBookmark, validateListBookmarks } = require('./bookmarks/validators');

// Apply authentication and subscription middleware to all routes
// router.use(isUserAuthenticated);
// router.use(checkSubscription);

// Grade routes
router.get('/user/grade/:id/v1', optionalUserAuthChecking, validateGetGrade, handleValidation, getGrade);
router.get('/user/grades/v1', optionalUserAuthChecking, validateListGrades, handleValidation, listGrades);
router.get('/user/grades/feature/v1', optionalUserAuthChecking, validateFeaturedGrades, handleValidation, featuredGrades);

// Subject routes
router.get('/user/subject/:id/v1', optionalUserAuthChecking, validateGetSubject, handleValidation, getSubject);
router.get('/user/subjects/v1', optionalUserAuthChecking, validateListSubjects, handleValidation, listSubjects);
router.get('/user/subject/:id/related/v1', optionalUserAuthChecking, validateGetRelatedSubjects, handleValidation, getRelatedSubjects);

// Term routes
router.get('/user/term/:id/v1', optionalUserAuthChecking, validateGetTerm, handleValidation, getTerm);
router.get('/user/terms/v1', optionalUserAuthChecking, validateListTerms, handleValidation, listTerms);

// Video routes
router.get('/user/video/:id/v1', optionalUserAuthChecking, validateGetVideo, handleValidation, getVideo);
router.get('/user/videos/v1', optionalUserAuthChecking, validateListVideos, handleValidation, listVideos);

// Resource routes
router.get('/user/resource/:id/v1', optionalUserAuthChecking, validateGetResource, handleValidation, getResource);
router.get('/user/resources/v1', optionalUserAuthChecking, validateListResources, handleValidation, listResources);

// Home/combined routes
router.get('/user/home/v1', optionalUserAuthChecking, getHomePage);
router.get('/user/explore/v1', optionalUserAuthChecking, exploreStudent);
router.get('/user/course/detail/v1', optionalUserAuthChecking, getCourseDetail);
router.get('/user/learnings/v1', isUserAuthenticated, getMyLearnings);
router.get('/user/popular-grade/v1', isUserAuthenticated, getPopularGrade);
router.get('/user/popular-videos/v1', optionalUserAuthChecking, getPopularVideosGuest);

// Bookmark routes (protected)
router.post('/user/bookmark/add/v1', isUserAuthenticated, validateAddBookmark, handleValidation, addBookmark);
router.post('/user/bookmark/remove/v1', isUserAuthenticated, validateRemoveBookmark, handleValidation, removeBookmark);
router.get('/user/bookmarks/v1', isUserAuthenticated, validateListBookmarks, handleValidation, listBookmarks);

module.exports = router;
