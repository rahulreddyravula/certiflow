"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiter = createRateLimiter;
const ipRequestMap = new Map();
function createRateLimiter(options) {
    return (req, res, next) => {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const record = ipRequestMap.get(ip);
        if (!record || now > record.resetAt) {
            ipRequestMap.set(ip, {
                count: 1,
                resetAt: now + options.windowMs,
            });
            next();
            return;
        }
        if (record.count >= options.maxRequests) {
            const retryAfter = Math.ceil((record.resetAt - now) / 1000);
            res.setHeader('Retry-After', retryAfter);
            res.status(429).json({
                success: false,
                error: `Rate limit exceeded. Maximum ${options.maxRequests} requests per ${options.windowMs / 1000} seconds. Please retry after ${retryAfter} seconds.`,
            });
            return;
        }
        record.count++;
        next();
    };
}
