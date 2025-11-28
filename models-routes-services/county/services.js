const { status, messages } = require('../../helper/api.responses');
const { handleServiceError } = require('../../helper/utilities.services');
const CountryModel = require('./model');
const data = require('../../data');

const getCountries = async (req, res) => {
  const lang = req?.userLanguage;
  try {
    const countries = await CountryModel.find({ eStatus: data.eActiveStatus.map.ACTIVE }).lean();
    return res.status(status.OK).json({ success: true, message: messages[lang].countriesRetrieved, data: countries });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveCountries' });
  }
};

module.exports = { getCountries };
