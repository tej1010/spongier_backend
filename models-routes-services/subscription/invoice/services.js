const InvoiceModel = require('./model');
const { getPaginationValues, handleServiceError } = require('../../../helper/utilities.services');
const { messages, status } = require('../../../helper/api.responses');

async function userList (req, res) {
  const lang = req?.userLanguage;
  try {
    const { start, limit, sorting } = getPaginationValues(req.query);
    const iUserId = req.user._id;

    const [results, total] = await Promise.all([
      InvoiceModel.find({ iUserId })
        .sort(sorting)
        .limit(limit)
        .skip(start)
        .lean(),
      InvoiceModel.countDocuments({ iUserId })
    ]);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang]?.invoiceFetched,
      data: { total, results, limit, start }
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'somethingWentWrong' });
  }
}

module.exports = {
  userList
};
