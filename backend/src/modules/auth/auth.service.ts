import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../database';
import { config } from '../../config';
import { AuthUser } from '../../middleware/auth.middleware';
import { AuditService } from '../audit/audit.service';

export class AuthService {
  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        district: true,
        trainingCentre: true,
      },
    });

    if (!user) {
      throw { status: 401, message: 'Invalid credentials. User not found.' };
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw { status: 401, message: 'Invalid credentials. Password incorrect.' };
    }

    const tokenPayload: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      districtId: user.districtId,
      trainingCentreId: user.trainingCentreId,
    };

    const token = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: '7d' });

    await AuditService.log({
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

  // Convenient 1-click Demo Switching
  static async demoLogin(role: string, email?: string) {
    let user;
    if (email) {
      user = await prisma.user.findUnique({
        where: { email },
        include: { district: true, trainingCentre: true },
      });
    } else {
      user = await prisma.user.findFirst({
        where: { role },
        include: { district: true, trainingCentre: true },
      });
    }

    if (!user) {
      throw { status: 404, message: `No demo user found for role: ${role}` };
    }

    const tokenPayload: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      districtId: user.districtId,
      trainingCentreId: user.trainingCentreId,
    };

    const token = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: '7d' });

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
    return await prisma.user.findMany({
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
