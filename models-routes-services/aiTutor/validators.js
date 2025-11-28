const { body } = require('express-validator');

const validateCreateSession = [
  body('iLanguageId').not().isEmpty()
];

const validateStartSession = [
  body('iSessionId').not().isEmpty()
];

const validateGiveTask = [
  body('iSessionId').not().isEmpty(),
  body('sText').not().isEmpty()
];

const validateStopSession = [
  body('iSessionId').not().isEmpty()
];

const validateStopTalk = [
  body('iSessionId').not().isEmpty()
];

module.exports = {
  validateCreateSession,
  validateStartSession,
  validateGiveTask,
  validateStopSession,
  validateStopTalk
};
