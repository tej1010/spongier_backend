const { messages, status } = require('../../helper/api.responses');
const { handleServiceError, getPaginationValues2 } = require('../../helper/utilities.services');
const SchoolModel = require('./model');
const { eUserRoles } = require('../../data');

const getSchoolsList = async (req, res) => {
  const lang = req.userLanguage;
  try {
    // Verify user is parent
    if (req.user.eRole !== eUserRoles.map.PARENT) {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'access_denied' });
    }

    const { search, limit, start, sorting } = getPaginationValues2(req.query);
    const query = { eStatus: 'active', bDelete: false };

    if (search) {
      query.$or = [
        { sName: { $regex: search, $options: 'i' } },
        { sCity: { $regex: search, $options: 'i' } },
        { sState: { $regex: search, $options: 'i' } }
      ];
    }

    const [total, results] = await Promise.all([
      SchoolModel.countDocuments(query),
      SchoolModel.find(query)
        .select('sName sAddress sCity sState sCountry sPhone sEmail')
        .sort(sorting)
        .skip(Number(start))
        .limit(Number(limit))
        .lean()
    ]);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].schoolsListSuccess,
      data: { total, results, limit: Number(limit), start: Number(start) },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'internalServerError' });
  }
};

module.exports = {
  getSchoolsList
};
