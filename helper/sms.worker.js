const { Worker } = require('bullmq');
const Redis = require('ioredis');
const { sendSMS, sendOTPSMS } = require('./sms.service');

const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: false
});

const smsWorker = new Worker(
  'sms-queue',
  async (job) => {
    console.log('📨 Processing job:', job.name, 'ID:', job.id);

    try {
      if (job.name === 'send-otp') {
        return await sendOTPSMS(job.data.data);
      }

      if (job.name === 'send-sms') {
        return await sendSMS(job.data.data);
      }
    } catch (err) {
      console.error('❌ SMS Worker Error:', err.message);
      throw err;
    }
  },
  {
    connection: redisConnection,
    prefix: 'bull:{smsQueue}'
  }
);

smsWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

smsWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err.message);
});

smsWorker.on('error', (err) => {
  console.error('❌ SMS Worker Error:', err);
});

process.on('SIGTERM', async () => {
  await smsWorker.close();
});

process.on('SIGINT', async () => {
  await smsWorker.close();
});

console.log('🚀 SMS Worker is running...');

module.exports = smsWorker;
