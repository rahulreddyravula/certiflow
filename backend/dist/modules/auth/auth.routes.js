"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const rateLimiter_middleware_1 = require("../../middleware/rateLimiter.middleware");
const router = (0, express_1.Router)();
// Protect credential login with sliding-window rate limiting
const authLimiter = (0, rateLimiter_middleware_1.createRateLimiter)({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 attempts per minute
});
router.post('/login', authLimiter, auth_controller_1.AuthController.login);
router.post('/demo-login', auth_controller_1.AuthController.demoLogin);
router.get('/demo-users', auth_controller_1.AuthController.getDemoUsers);
router.get('/me', auth_middleware_1.authMiddleware, auth_controller_1.AuthController.me);
exports.default = router;
