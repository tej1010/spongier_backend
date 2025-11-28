const { Queue } = require('bullmq');
const Redis = require('ioredis');
const { handleCatchError } = require('./utilities.services');

const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: false
});

const smsQueue = new Queue('sms-queue', {
  connection: redisConnection,
  prefix: 'bull:{smsQueue}',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 50,
    removeOnFail: 100
  }
});

/**
 * Add OTP SMS to queue
 */
const queueOTPSMS = async (data) => {
  try {
    const job = await smsQueue.add(
      'send-otp',
      {
        type: 'otp',
        data
      },
      {
        priority: 1
      }
    );

    return {
      success: true,
      jobId: job.id,
      message: 'OTP SMS queued'
    };
  } catch (error) {
    handleCatchError(error);
    return {
      success: false,
      message: 'Failed to queue OTP SMS',
      error: error.message
    };
  }
};

/**
 * Add general SMS to queue
 */
const queueGeneralSMS = async (data) => {
  try {
    const job = await smsQueue.add('send-sms', {
      type: 'general',
      data
    });

    return {
      success: true,
      jobId: job.id,
      message: 'SMS queued'
    };
  } catch (error) {
    handleCatchError(error);
    return {
      success: false,
      message: 'Failed to queue SMS',
      error: error.message
    };
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  await smsQueue.close();
});

process.on('SIGINT', async () => {
  await smsQueue.close();
});

module.exports = {
  smsQueue,
  // smsWorker,
  queueOTPSMS,
  queueGeneralSMS
};
