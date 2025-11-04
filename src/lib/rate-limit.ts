/**
 * Simple in-memory rate limiter for API endpoints
 * Tracks requests per IP address with configurable limits and windows
 */

interface RateLimitConfig {
  interval: number; // Time window in milliseconds
  uniqueTokenPerInterval: number; // Max requests per interval
}

interface TokenBucket {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private tokenCache: Map<string, TokenBucket> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request should be rate limited
   * @param identifier - Unique identifier (e.g., IP address)
   * @returns Object with allowed status and remaining requests
   */
  check(identifier: string): { 
    allowed: boolean; 
    remaining: number; 
    resetTime: number;
    limit: number;
  } {
    const now = Date.now();
    const bucket = this.tokenCache.get(identifier);

    // No bucket exists or expired - create new one
    if (!bucket || now > bucket.resetTime) {
      const newBucket: TokenBucket = {
        count: 1,
        resetTime: now + this.config.interval
      };
      this.tokenCache.set(identifier, newBucket);
      
      return {
        allowed: true,
        remaining: this.config.uniqueTokenPerInterval - 1,
        resetTime: newBucket.resetTime,
        limit: this.config.uniqueTokenPerInterval
      };
    }

    // Bucket exists and not expired
    if (bucket.count < this.config.uniqueTokenPerInterval) {
      bucket.count++;
      this.tokenCache.set(identifier, bucket);
      
      return {
        allowed: true,
        remaining: this.config.uniqueTokenPerInterval - bucket.count,
        resetTime: bucket.resetTime,
        limit: this.config.uniqueTokenPerInterval
      };
    }

    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetTime: bucket.resetTime,
      limit: this.config.uniqueTokenPerInterval
    };
  }

  /**
   * Clean up expired entries (optional, for memory management)
   */
  cleanup() {
    const now = Date.now();
    for (const [key, bucket] of this.tokenCache.entries()) {
      if (now > bucket.resetTime) {
        this.tokenCache.delete(key);
      }
    }
  }
}

// Create rate limiter instances for different endpoints
export const uploadRateLimiter = new RateLimiter({
  interval: 10 * 60 * 1000, // 10 minutes
  uniqueTokenPerInterval: 50 // 50 requests per 10 minutes
});

export const analyzeRateLimiter = new RateLimiter({
  interval: 10 * 60 * 1000, // 10 minutes
  uniqueTokenPerInterval: 1000 // 1000 requests per 10 minutes
});

export const sharepointRateLimiter = new RateLimiter({
  interval: 10 * 60 * 1000, // 10 minutes
  uniqueTokenPerInterval: 20 // 20 requests per 10 minutes
});

// Cleanup expired entries every 15 minutes
setInterval(() => {
  uploadRateLimiter.cleanup();
  analyzeRateLimiter.cleanup();
  sharepointRateLimiter.cleanup();
}, 15 * 60 * 1000);

/**
 * Get client IP address from request
 */
export function getClientIp(request: Request): string {
  // Try to get real IP from headers (for proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to a default (in development, this might be localhost)
  return '127.0.0.1';
}
