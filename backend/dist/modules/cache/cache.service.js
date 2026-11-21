"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("../../config");
class CacheService {
    static redisClient = null;
    static isRedisConnected = false;
    static memoryCache = new Map();
    static pendingPromises = new Map();
    // Metrics
    static hits = 0;
    static misses = 0;
    static recentMetrics = [];
    static init() {
        try {
            this.redisClient = new ioredis_1.default(config_1.config.redisUrl, {
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
                console.log(`[Cache] Redis not reachable on ${config_1.config.redisUrl} (${err.message}). Using in-memory cache.`);
                this.isRedisConnected = false;
            });
        }
        catch (err) {
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
    static async get(key) {
        if (this.isRedisConnected && this.redisClient) {
            try {
                const data = await this.redisClient.get(key);
                if (data) {
                    this.hits++;
                    return JSON.parse(data);
                }
            }
            catch (err) {
                // Fall back to memory on Redis error
            }
        }
        // Check memory cache
        const memEntry = this.memoryCache.get(key);
        if (memEntry) {
            if (memEntry.expiresAt > Date.now()) {
                this.hits++;
                return memEntry.value;
            }
            this.memoryCache.delete(key);
        }
        this.misses++;
        return null;
    }
    static async set(key, value, ttlSeconds = 60) {
        const serialized = JSON.stringify(value);
        if (this.isRedisConnected && this.redisClient) {
            try {
                await this.redisClient.set(key, serialized, 'EX', ttlSeconds);
            }
            catch (err) {
                // Fall back to memory
            }
        }
        // Always keep in memory cache as rapid L1 cache
        this.memoryCache.set(key, {
            value,
            expiresAt: Date.now() + ttlSeconds * 1000,
        });
    }
    static async del(key) {
        this.memoryCache.delete(key);
        if (this.isRedisConnected && this.redisClient) {
            try {
                await this.redisClient.del(key);
            }
            catch (err) {
                // Ignore
            }
        }
    }
    static async delPattern(pattern) {
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
            }
            catch (err) {
                // Ignore
            }
        }
    }
    /**
     * Cache-Aside Helper with Cache Stampede / Coalescing Protection
     */
    static async wrap(key, ttlSeconds, fetcher) {
        // 1. Try to read from cache
        const cached = await this.get(key);
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
            }
            finally {
                this.pendingPromises.delete(key);
            }
        })();
        this.pendingPromises.set(key, promise);
        return await promise;
    }
    static recordMetric(endpoint, durationMs) {
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
exports.CacheService = CacheService;
// Initialize on load
CacheService.init();
