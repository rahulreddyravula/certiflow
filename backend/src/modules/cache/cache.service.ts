import Redis from 'ioredis';
import { config } from '../../config';

interface MemoryCacheEntry {
  value: any;
  expiresAt: number;
}

interface PerformanceMetric {
  endpoint: string;
  durationMs: number;
  timestamp: string;
}

export class CacheService {
  private static redisClient: Redis | null = null;
  private static isRedisConnected: boolean = false;
  private static memoryCache: Map<string, MemoryCacheEntry> = new Map();
  private static pendingPromises: Map<string, Promise<any>> = new Map();

  // Metrics
  private static hits: number = 0;
  private static misses: number = 0;
  private static recentMetrics: PerformanceMetric[] = [];

  static init() {
    try {
      this.redisClient = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 3) {
            return null; // Stop reconnecting and fall back to memory
          }
          return Math.min(times * 100, 1000);
        },
      });

      this.redisClient.on('connect', () => {
        this.isRedisConnected = true;
        console.log('[Cache] Redis connected successfully.');
      });

      this.redisClient.on('error', (err) => {
        if (this.isRedisConnected) {
          console.warn(`[Cache] Redis disconnected: ${err.message}. Falling back to memory cache.`);
        }
        this.isRedisConnected = false;
      });

      // Attempt non-blocking connection
      this.redisClient.connect().catch((err) => {
        console.log(`[Cache] Redis not reachable on ${config.redisUrl} (${err.message}). Using in-memory cache.`);
        this.isRedisConnected = false;
      });
    } catch (err: any) {
      console.log(`[Cache] Redis initialization note: ${err.message}. Using in-memory cache.`);
      this.isRedisConnected = false;
    }

    // Clean up expired in-memory cache entries every 60s
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.expiresAt <= now) {
          this.memoryCache.delete(key);
        }
      }
    }, 60000);
  }

  static async get<T>(key: string): Promise<T | null> {
    if (this.isRedisConnected && this.redisClient) {
      try {
        const data = await this.redisClient.get(key);
        if (data) {
          this.hits++;
          return JSON.parse(data) as T;
        }
      } catch (err) {
        // Fall back to memory on Redis error
      }
    }

    // Check memory cache
    const memEntry = this.memoryCache.get(key);
    if (memEntry) {
      if (memEntry.expiresAt > Date.now()) {
        this.hits++;
        return memEntry.value as T;
      }
      this.memoryCache.delete(key);
    }

    this.misses++;
    return null;
  }

  static async set(key: string, value: any, ttlSeconds: number = 60): Promise<void> {
    const serialized = JSON.stringify(value);

    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.set(key, serialized, 'EX', ttlSeconds);
      } catch (err) {
        // Fall back to memory
      }
    }

    // Always keep in memory cache as rapid L1 cache
    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  static async del(key: string): Promise<void> {
    this.memoryCache.delete(key);

    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (err) {
        // Ignore
      }
    }
  }

  static async delPattern(pattern: string): Promise<void> {
    // 1. Clear memory cache
    const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.memoryCache.keys()) {
      if (regexPattern.test(key)) {
        this.memoryCache.delete(key);
      }
    }

    // 2. Clear Redis cache
    if (this.isRedisConnected && this.redisClient) {
      try {
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } catch (err) {
        // Ignore
      }
    }
  }

  /**
   * Cache-Aside Helper with Cache Stampede / Coalescing Protection
   */
  static async wrap<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    // 1. Try to read from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // 2. Prevent cache stampede: coalesce identical concurrent fetchers
    if (this.pendingPromises.has(key)) {
      return await this.pendingPromises.get(key);
    }

    const t0 = performance.now();
    const promise = (async () => {
      try {
        const fresh = await fetcher();
        await this.set(key, fresh, ttlSeconds);
        const t1 = performance.now();
        this.recordMetric(key, t1 - t0);
        return fresh;
      } finally {
        this.pendingPromises.delete(key);
      }
    })();

    this.pendingPromises.set(key, promise);
    return await promise;
  }

  static recordMetric(endpoint: string, durationMs: number) {
    this.recentMetrics.unshift({
      endpoint,
      durationMs: parseFloat(durationMs.toFixed(2)),
      timestamp: new Date().toISOString(),
    });
    if (this.recentMetrics.length > 50) {
      this.recentMetrics.pop();
    }
  }

  static getDiagnostics() {
    const totalRequests = this.hits + this.misses;
    const hitRatio = totalRequests > 0 ? parseFloat(((this.hits / totalRequests) * 100).toFixed(1)) : 0;

    return {
      driver: this.isRedisConnected ? 'Redis + Memory L1' : 'In-Memory Cache (Redis Standby)',
      isRedisConnected: this.isRedisConnected,
      hits: this.hits,
      misses: this.misses,
      hitRatio: `${hitRatio}%`,
      memoryKeysCount: this.memoryCache.size,
      recentMetrics: this.recentMetrics.slice(0, 15),
    };
  }
}

// Initialize on load
CacheService.init();
