import { Redis } from "ioredis";  
import type { RedisOptions as IORedisOptions } from "ioredis";

// Extend the original interface if needed
interface RedisOptions extends IORedisOptions {
  // Add any custom options here
}

interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

class CacheService {
  private redis: Redis;  // Type is the Redis class
  private defaultTTL = 3600;

  constructor() {
    const redisOptions: RedisOptions = {
      host: process.env.REDIS_HOST || "localhost",
      port: Number.parseInt(process.env.REDIS_PORT || "6379"),
      ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
      retryStrategy: (times) => Math.min(times * 100, 5000),
      maxRetriesPerRequest: 3,
    };

    this.redis = new Redis(redisOptions);
  }

 async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      console.error("Cache get error:", error)
      return null
    }
  }

  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    try {
      const ttl = options.ttl || this.defaultTTL
      const prefixedKey = options.prefix ? `${options.prefix}:${key}` : key
      await this.redis.setex(prefixedKey, ttl, JSON.stringify(value))
    } catch (error) {
      console.error("Cache set error:", error)
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key)
    } catch (error) {
      console.error("Cache delete error:", error)
    }
  }

  async getOrSet<T>(key: string, fetcher: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached) return cached

    const fresh = await fetcher()
    await this.set(key, fresh, options)
    return fresh
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.redis.mget(...keys)
      return values.map((val) => (val ? JSON.parse(val) : null))
    } catch (error) {
      console.error("Cache mget error:", error)
      return keys.map(() => null)
    }
  }

async setProcessingStatus(
  preferenceId: string,
  data: {
    status: string;
    message?: string;
    progress?: number;
    estimatedCompletion?: Date;
    [key: string]: any; // Allow additional properties
  }
): Promise<void> {
  const statusKey = `processing:${preferenceId}`;
  const statusData = {
    ...data,
    timestamp: new Date().toISOString(),
  };
  await this.set(statusKey, statusData, { ttl: 1800 }); // 30 minutes TTL
}

  async getProcessingStatus(preferenceId: string): Promise<any> {
    const statusKey = `processing:${preferenceId}`
    return await this.get(statusKey)
  }
}

export const cacheService = new CacheService()