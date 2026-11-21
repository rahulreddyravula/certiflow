"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const verification_controller_1 = require("./verification.controller");
const rateLimiter_middleware_1 = require("../../middleware/rateLimiter.middleware");
const config_1 = require("../../config");
const router = (0, express_1.Router)();
// Rate limited public endpoint - no authentication required
const verifyLimiter = (0, rateLimiter_middleware_1.createRateLimiter)({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: config_1.config.publicVerifyRateLimit,
});
router.get('/:certificateNumber', verifyLimiter, verification_controller_1.VerificationController.verify);
exports.default = router;
