// Global test environment setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-vitest-do-not-use-in-production';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test'; // overridden by mocks

// Silence BullMQ Redis connection errors in tests — Redis is not available locally
process.env.REDIS_URL = 'redis://localhost:6379';
