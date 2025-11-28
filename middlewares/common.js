// @ts-check
// const { redisClient } = require('../helper/redis')
const moment = require('moment');

function getDatesObj() {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const weekStart = new Date(new Date().setDate(today.getDate() - today.getDay()));
  const weekEnd = new Date(new Date().setDate(weekStart.getDate() + 6));

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const yearStart = new Date(today.getFullYear(), 0, 1);
  const yearEnd = new Date(today.getFullYear(), 11, 31);

  const dates = {
    toDay: {
      $gte: new Date(today.setHours(0, 0, 0)),
      $lt: new Date(today.setHours(23, 59, 59))
    },
    yesterDay: {
      $gte: new Date(yesterday.setHours(0, 0, 0)),
      $lt: new Date(yesterday.setHours(23, 59, 59))
    },
    week: {
      $gte: new Date(weekStart.setHours(0, 0, 0)),
      $lt: new Date(weekEnd.setHours(23, 59, 59))
    },
    month: {
      $gte: new Date(monthStart.setHours(0, 0, 0)),
      $lt: new Date(monthEnd.setHours(23, 59, 59))
    },
    year: {
      $gte: new Date(yearStart.setHours(0, 0, 0)),
      $lt: new Date(yearEnd.setHours(23, 59, 59))
    }
  };

  return dates;
}
async function getDateRangeQuery(aDate) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        if (aDate === 'total') resolve({ isError: false, query: { dStartDate: { $lte: new Date() } } });
        if (aDate.length !== 2) resolve({ isError: true, query: {} });
        resolve({ isError: false, query: { dStartDate: { $gte: new Date(aDate[0]), $lte: new Date(aDate[1]) } } });
      } catch (error) {
        resolve({ isError: true, query: {} });
      }
    })();
  });
}

async function setDayEndExpiry(key) {
  const d = new Date(moment(new Date()).format());
  const h = d.getHours();
  const m = d.getMinutes();
  const s = d.getSeconds();
  const secondsUntilEndOfDate = (24 * 60 * 60) - (h * 60 * 60) - (m * 60) - s;
  // await redisClient.set(key, true, 'EX', secondsUntilEndOfDate)
  return true;
}

module.exports = {
  setDayEndExpiry,
  getDatesObj,
  getDateRangeQuery
};
