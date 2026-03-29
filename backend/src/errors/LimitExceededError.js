/**
 * LimitExceededError
 *
 * Thrown when a tenant exceeds their plan limits.
 * Results in HTTP 402 Payment Required with structured error body.
 */

export class LimitExceededError extends Error {
  constructor(limitType, current, max) {
    super(`Plan limit exceeded: ${limitType} (${current}/${max})`);
    this.name = 'LimitExceededError';
    this.statusCode = 402;
    this.limitType = limitType;
    this.current = current;
    this.max = max;
  }
}
