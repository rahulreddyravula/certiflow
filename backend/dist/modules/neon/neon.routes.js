"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const neon_service_1 = require("./neon.service");
const router = (0, express_1.Router)();
// GET /api/neon/status - Health and operational status of all wired Neon services
router.get('/status', async (req, res) => {
    try {
        const status = await neon_service_1.NeonService.getFullStatus();
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            platform: 'Neon Serverless Platform',
            services: status,
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});
// GET /api/neon/functions/hello - Trigger Neon Serverless Function
router.get('/functions/hello', async (req, res) => {
    try {
        const result = await neon_service_1.NeonService.testFunctions();
        res.json({
            success: result.status === 'healthy',
            result,
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});
// POST /api/neon/storage/test - Upload a test asset to Neon Object Storage
router.post('/storage/test', async (req, res) => {
    try {
        const result = await neon_service_1.NeonService.testObjectStorage();
        res.json({
            success: result.status === 'connected',
            result,
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});
exports.default = router;
