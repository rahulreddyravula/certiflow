import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service';

const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
});

const demoLoginSchema = z.object({
  role: z.string().optional(),
  email: z.string().optional(),
});

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = loginSchema.parse(req.body);
      const result = await AuthService.login(data.email, data.password);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async demoLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const data = demoLoginSchema.parse(req.body);
      const result = await AuthService.demoLogin(data.role || 'TRAINING_CENTRE', data.email);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async getDemoUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await AuthService.getDemoUsers();
      res.json({ success: true, users });
    } catch (error) {
      next(error);
    }
  }

  static async me(req: Request, res: Response) {
    res.json({ success: true, user: req.user });
  }
}
