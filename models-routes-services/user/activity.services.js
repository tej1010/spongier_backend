const UserModel = require('./model');
const UserStreakModel = require('./streak.model');
const { logStreakAchievementActivity } = require('../../helper/activity.helper');
const { evaluateStreakBadges } = require('../../helper/badge.helper');

function normalizeToUTCDate (date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function recordUserActivity (iUserId, sSource = 'request') {
  const now = new Date();
  const todayUTC = normalizeToUTCDate(now);

  await UserModel.updateOne({ _id: iUserId }, { $set: { dLastSeen: now } });

  // Upsert daily streak doc for today
  await UserStreakModel.updateOne(
    { iUserId, dDate: todayUTC },
    { $setOnInsert: { iUserId, dDate: todayUTC, sSource } },
    { upsert: true }
  );

  // Update aggregated streak snapshot on user
  const user = await UserModel.findById(iUserId, { oStreak: 1 }).lean();
  const lastActiveDate = user?.oStreak?.dLastActive ? normalizeToUTCDate(user.oStreak.dLastActive) : null;

  let nCurrent = user?.oStreak?.nCurrent || 0;
  let nBest = user?.oStreak?.nBest || 0;
  let dCurrentStart = user?.oStreak?.dCurrentStart ? new Date(user.oStreak.dCurrentStart) : null;

  if (!lastActiveDate) {
    // first activity
    nCurrent = 1;
    nBest = Math.max(nBest, nCurrent);
    dCurrentStart = todayUTC;
  } else {
    const diffDays = Math.round((todayUTC - lastActiveDate) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      // already counted today; do not change counters
    } else if (diffDays === 1) {
      // continue streak
      nCurrent += 1;
      nBest = Math.max(nBest, nCurrent);
      if (!dCurrentStart) dCurrentStart = lastActiveDate;
    } else if (diffDays > 1) {
      // streak broken, start new
      nCurrent = 1;
      dCurrentStart = todayUTC;
      nBest = Math.max(nBest, nCurrent, user?.oStreak?.nBest || 0);
    }
  }

  // Check if we should log streak achievement (milestone reached)
  const previousStreak = user?.oStreak?.nCurrent || 0;
  const shouldLogStreak = nCurrent > previousStreak && [3, 5, 7, 10, 14, 21, 30, 50, 100].includes(nCurrent);

  await UserModel.updateOne(
    { _id: iUserId },
    {
      $set: {
        'oStreak.nCurrent': nCurrent,
        'oStreak.nBest': nBest,
        'oStreak.dCurrentStart': dCurrentStart,
        'oStreak.dLastActive': todayUTC
      }
    }
  );

  // Log streak achievement activity asynchronously
  if (shouldLogStreak) {
    setImmediate(() => {
      logStreakAchievementActivity({
        userId: iUserId,
        streakCount: nCurrent,
        streakType: 'daily'
      }).catch(err => console.error('Error logging streak achievement:', err));
    });
  }

  setImmediate(() => {
    evaluateStreakBadges({ userId: iUserId, streakCount: nCurrent })
      .catch(err => console.error('Error evaluating streak badges:', err));
  });

  return { nCurrent, nBest, dCurrentStart, dLastActive: todayUTC, dLastSeen: now };
}

module.exports = {
  recordUserActivity
};
