const router = require('express').Router();
const { createSession, startSession, giveTask, stopSession, stopTalk, createSessionToken, userList, parentChildList } = require('./services');
const { validateCreateSession, validateStartSession, validateGiveTask, validateStopSession } = require('./validators');
const { isUserAuthenticated } = require('../../middlewares/middleware');

router.post('/user/ai-tutor/create-session/v1', validateCreateSession, isUserAuthenticated, createSession);
router.post('/user/ai-tutor/create-session-token/v1', isUserAuthenticated, createSessionToken);
router.post('/user/ai-tutor/start-session/v1', validateStartSession, isUserAuthenticated, startSession);
router.post('/user/ai-tutor/give-task/v1', validateGiveTask, isUserAuthenticated, giveTask);
router.post('/user/ai-tutor/stop-talk/v1', validateStartSession, isUserAuthenticated, stopTalk);
router.post('/user/ai-tutor/stop-session/v1', validateStopSession, isUserAuthenticated, stopSession);
router.get('/user/ai-tutor/user-list/v1', isUserAuthenticated, userList);
router.get('/user/ai-tutor/child-list/:iChildId/v1', isUserAuthenticated, parentChildList);

module.exports = router;
