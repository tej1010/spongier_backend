const LanguageModel = require('./model');
const data = require('../../../data');
const { messages, status } = require('../../../helper/api.responses');
const { handleServiceError } = require('../../../helper/utilities.services');

async function listLanguage (req, res) {
  const lang = req?.userLanguage;
  try {
    const aLanguage = await LanguageModel.find({ eStatus: data.eActiveStatus.map.ACTIVE }, { sName: 1, sLocalName: 1 }).lean();

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].languageFetched,
      data: aLanguage,
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
}

module.exports = {
  listLanguage
};
