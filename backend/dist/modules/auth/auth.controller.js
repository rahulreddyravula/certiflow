"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const zod_1 = require("zod");
const auth_service_1 = require("./auth.service");
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address format'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
const demoLoginSchema = zod_1.z.object({
    role: zod_1.z.string().optional(),
    email: zod_1.z.string().optional(),
});
class AuthController {
    static async login(req, res, next) {
        try {
            const data = loginSchema.parse(req.body);
            const result = await auth_service_1.AuthService.login(data.email, data.password);
            res.json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    static async demoLogin(req, res, next) {
        try {
            const data = demoLoginSchema.parse(req.body);
            const result = await auth_service_1.AuthService.demoLogin(data.role || 'TRAINING_CENTRE', data.email);
            res.json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    static async getDemoUsers(req, res, next) {
        try {
            const users = await auth_service_1.AuthService.getDemoUsers();
            res.json({ success: true, users });
        }
        catch (error) {
            next(error);
        }
    }
    static async me(req, res) {
        res.json({ success: true, user: req.user });
    }
}
exports.AuthController = AuthController;
