"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../../database");
const config_1 = require("../../config");
const audit_service_1 = require("../audit/audit.service");
class AuthService {
    static async login(email, password) {
        const user = await database_1.prisma.user.findUnique({
            where: { email },
            include: {
                district: true,
                trainingCentre: true,
            },
        });
        if (!user) {
            throw { status: 401, message: 'Invalid credentials. User not found.' };
        }
        const isValid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isValid) {
            throw { status: 401, message: 'Invalid credentials. Password incorrect.' };
        }
        const tokenPayload = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            districtId: user.districtId,
            trainingCentreId: user.trainingCentreId,
        };
        const token = jsonwebtoken_1.default.sign(tokenPayload, config_1.config.jwtSecret, { expiresIn: '7d' });
        await audit_service_1.AuditService.log({
            userId: user.id,
            userRole: user.role,
            action: 'USER_LOGIN',
            entityType: 'USER',
            entityId: user.id,
        });
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                district: user.district,
                trainingCentre: user.trainingCentre,
            },
        };
    }
    static demoUserCache = new Map();
    // Convenient 1-click Demo Switching with Instant In-Memory Cache (< 1ms)
    static async demoLogin(role, email) {
        const cacheKey = (email || role).toLowerCase();
        let user = this.demoUserCache.get(cacheKey);
        if (!user) {
            if (email) {
                user = await database_1.prisma.user.findUnique({
                    where: { email },
                    include: { district: true, trainingCentre: true },
                });
            }
            else {
                user = await database_1.prisma.user.findFirst({
                    where: { role },
                    include: { district: true, trainingCentre: true },
                });
            }
            if (!user) {
                throw { status: 404, message: `No demo user found for role: ${role}` };
            }
            // Cache both by email and role for instant 0.1ms subsequent lookups
            if (user.email)
                this.demoUserCache.set(user.email.toLowerCase(), user);
            if (user.role)
                this.demoUserCache.set(user.role.toLowerCase(), user);
        }
        const tokenPayload = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            districtId: user.districtId,
            trainingCentreId: user.trainingCentreId,
        };
        const token = jsonwebtoken_1.default.sign(tokenPayload, config_1.config.jwtSecret, { expiresIn: '7d' });
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                district: user.district,
                trainingCentre: user.trainingCentre,
            },
        };
    }
    static async getDemoUsers() {
        return await database_1.prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                districtId: true,
                trainingCentreId: true,
                district: { select: { id: true, name: true, code: true } },
                trainingCentre: { select: { id: true, name: true, code: true } },
            },
            orderBy: { role: 'asc' },
        });
    }
}
exports.AuthService = AuthService;
