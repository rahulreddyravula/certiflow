"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("./config");
const errorHandler_middleware_1 = require("./middleware/errorHandler.middleware");
const event_service_1 = require("./modules/events/event.service");
// Routes
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const batch_routes_1 = __importDefault(require("./modules/batch/batch.routes"));
const certificate_routes_1 = __importDefault(require("./modules/certificate/certificate.routes"));
const verification_routes_1 = __importDefault(require("./modules/verification/verification.routes"));
const monitoring_routes_1 = __importDefault(require("./modules/monitoring/monitoring.routes"));
const neon_routes_1 = __importDefault(require("./modules/neon/neon.routes"));
const candidate_routes_1 = __importDefault(require("./modules/candidate/candidate.routes"));
exports.app = (0, express_1.default)();
// Security and parsers
exports.app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});
exports.app.use((0, cors_1.default)({
    origin: '*',
    credentials: true,
}));
exports.app.use(express_1.default.json({ limit: '10mb' }));
exports.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Serve certificate PDFs
exports.app.use('/certificates', express_1.default.static(config_1.config.certificatesDir));
// Healthcheck
exports.app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'CertiFlow API',
        version: '1.0.0',
    });
});
// Real-Time Server-Sent Events (SSE) Stream
exports.app.get('/api/events/subscribe', (req, res) => {
    // Extract token from query or Authorization header
    const token = req.query.token || (req.headers.authorization?.split(' ')[1]);
    let user;
    if (token) {
        try {
            user = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
        }
        catch (err) {
            // Allow unauthenticated connection or reject? Allow with general events
        }
    }
    // Set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    event_service_1.EventService.addClient({
        id: clientId,
        userId: user?.id,
        role: user?.role,
        res,
    });
    // Send initial connection packet
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId, status: 'connected' })}\n\n`);
    // Heartbeat ping every 25s
    const heartbeat = setInterval(() => {
        try {
            res.write(': heartbeat\n\n');
        }
        catch (e) {
            clearInterval(heartbeat);
        }
    }, 25000);
    req.on('close', () => {
        clearInterval(heartbeat);
        event_service_1.EventService.removeClient(clientId);
    });
});
// API Routes
exports.app.use('/api/auth', auth_routes_1.default);
exports.app.use('/api/batches', batch_routes_1.default);
exports.app.use('/api/certificates', certificate_routes_1.default);
exports.app.use('/api/verify', verification_routes_1.default);
exports.app.use('/api/monitoring', monitoring_routes_1.default);
exports.app.use('/api/neon', neon_routes_1.default);
exports.app.use('/api/candidates', candidate_routes_1.default);
// Centralized Error Handler
exports.app.use(errorHandler_middleware_1.errorHandler);
