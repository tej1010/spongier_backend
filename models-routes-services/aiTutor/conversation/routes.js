const router = require('express').Router();
const { listConversation, createConversation, childConversationList } = require('./services');
const { validateCreateConversation, validateListConversation } = require('./validators');
const { isUserAuthenticated } = require('../../../middlewares/middleware');

router.post('/user/ai-tutor/conversation/create/v1', validateCreateConversation, isUserAuthenticated, createConversation);
router.get('/user/ai-tutor/conversation/list/v1', validateListConversation, isUserAuthenticated, listConversation);
router.get('/user/ai-tutor/conversation/child-list/:iChildId/v1', validateListConversation, isUserAuthenticated, childConversationList);

module.exports = router;
