import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, hashToken } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import type { AuthUser, UserRole } from '@davall/shared';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      tenantKey?: string;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies?.accessToken || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ success: false, error: 'No token provided' });
    return;
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({ success: false, error: 'Invalid token' });
    return;
  }

  const tokenHash = hashToken(token);
  const blacklisted = await prisma.tokenBlacklist.findFirst({
    where: {
      tokenHash,
      expiresAt: { gt: new Date() },
    },
  });

  if (blacklisted) {
    res.status(401).json({ success: false, error: 'Token revoked' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: {
      tenantKey_id: {
        tenantKey: payload.tenantKey,
        id: payload.userId,
      },
    },
  });

  if (!user || user.status !== 'active' || user.deletedAt) {
    res.status(401).json({ success: false, error: 'User not found or inactive' });
    return;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    res.status(401).json({ success: false, error: 'Account is locked' });
    return;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { tenantKey: payload.tenantKey },
  });

  if (!tenant || tenant.status !== 'active') {
    res.status(401).json({ success: false, error: 'Tenant not found or inactive' });
    return;
  }

  req.user = {
    id: user.id,
    tenantKey: user.tenantKey,
    email: user.email,
    role: user.role as UserRole,
    status: user.status as AuthUser['status'],
    language: user.language,
    workerId: user.workerId,
  };
  req.tenantKey = user.tenantKey;

  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireRole('admin')(req, res, next);
}

export function requireManagerOrAbove(req: Request, res: Response, next: NextFunction): void {
  requireRole('admin', 'manager')(req, res, next);
}
