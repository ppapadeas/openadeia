import IORedis from 'ioredis';

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // required for BullMQ
  enableOfflineQueue: false,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 3) return null; // stop retrying, don't crash the app
    return Math.min(times * 500, 2000);
  },
});

redis.on('error', (err) => {
  // Log but don't crash — email jobs will fail gracefully
  console.warn('[Redis] connection error (email jobs disabled):', err.message);
});

export default redis;
