const Redis = require('ioredis');
const sanitizeHtml = require('sanitize-html');
const config = require('../config/config');
const { handleCatchError } = require('./utilities.services');
const data = require('../data');

const redisClient = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD
});

const redisCacheGooseClient = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD
});

redisClient.on('error', function (error) {
  console.log('Error in Redis', error);
  handleCatchError(error);
  process.exit(1);
});

redisClient.on('connect', function () {
  console.log('redis connected');
});

const queueObject = {
  SendMail: { name: 'SendMail', client: null }
};

async function assignClientToQueues (queues) {
  for (const queue in queues) {
    queues[queue].client = await new Redis({
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD
    });
  }
}
assignClientToQueues(queueObject);

module.exports = {
  queueObject,

  cacheRoute: function (duration) {
    return async (req, res, next) => {
      const key = '__route__' + sanitizeHtml(req.originalUrl || req.url);
      if (config.NODE_ENV === data?.eEnv.map.DEVELOPMENT) return next();

      const cachedBody = await redisClient.get(key);
      if (cachedBody) {
        res.setHeader('is-cache', 1);
        res.setHeader('content-type', 'application/json');
        res.status(JSON.parse(cachedBody)?.status || 200);
        return res.send(cachedBody);
      } else {
        res.sendResponse = res.send;
        res.send = (body) => {
          redisClient.set(key, body, 'EX', duration);
          res.setHeader('content-type', 'application/json');
          res.sendResponse(body);
        };
        next();
      }
    };
  },

  checkRateLimitOTP: function (sLogin, sType, sAuth) {
    return new Promise((resolve, reject) => {
      if (config.NODE_ENV === data?.eEnv.map.DEVELOPMENT) resolve();

      if (!config.THRESHOLD_RATE_LIMIT) resolve();
      if (!sLogin || !sType || !sAuth) resolve();
      redisClient.incr(`rlotp:${sLogin}:${sType}:${sAuth}`).then(data => {
        if (data > config.THRESHOLD_RATE_LIMIT) {
          resolve('LIMIT_REACHED');
        } else {
          redisClient.expire(`rlotp:${sLogin}:${sType}:${sAuth}`, config.OTP_EXPIRY_TIME).then().catch();
          resolve();
        }
      }).catch(error => {
        handleCatchError(error);
        resolve();
      });
    });
  },

  // It will check only rate limit count if limit is reached returns 'LIMIT_REACHED'
  getRateLimitStatus: function (sLogin, sType, sAuth) {
    return new Promise((resolve, reject) => {
      if (config.NODE_ENV === data?.eEnv.map.DEVELOPMENT) resolve();

      if (!sLogin || !sType || !sAuth) resolve();
      redisClient.get(`rlotp:${sLogin}:${sType}:${sAuth}`).then(data => {
        if (data > config.THRESHOLD_RATE_LIMIT) {
          return resolve('LIMIT_REACHED');
        }
        return resolve();
      }).catch(error => {
        handleCatchError(error);
        resolve();
      });
    });
  },

  //  It will check whether sent otp is expired or not
  getOTPExpiryStatus: function (sLogin, sType, sAuth) {
    return new Promise((resolve, reject) => {
      if (config.NODE_ENV === data?.eEnv.map.DEVELOPMENT) resolve();

      if (!sLogin || !sType || !sAuth) resolve();
      redisClient.ttl(`rlotp:${sLogin}:${sType}:${sAuth}`).then(data => {
        if (data <= 0) {
          return resolve('EXPIRED');
        }
        return resolve();
      }).catch(error => {
        handleCatchError(error);
        resolve();
      });
    });
  },

  queuePush: function (queueName, data) {
    if (queueObject[`${queueName}`]) {
      queueObject[`${queueName}`].client.rpush(queueObject[`${queueName}`].name, JSON.stringify(data));
    } else redisClient.rpush(queueName, JSON.stringify(data));
  },

  queuePop: function (queueName) {
    if (queueObject[`${queueName}`]) {
      return queueObject[`${queueName}`].client.blpop(queueName, 10);
    }
    return redisClient.lpop(queueName);
  },

  bulkQueuePop: function (queueName) {
    if (queueObject[`${queueName}`]) {
      return queueObject[`${queueName}`].client.blpop(queueName, 10);
    }
    return redisClient.lpop(queueName);
  },

  queueLen: function (queueName) {
    if (queueObject[`${queueName}`]) {
      return queueObject[`${queueName}`].client.llen(queueObject[`${queueName}`].name);
    }
    return redisClient.llen(queueName);
  },

  redisClient,
  redisCacheGooseClient
};
