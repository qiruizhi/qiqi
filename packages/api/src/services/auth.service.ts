import { prisma } from '../lib/prisma.js';
import { allocateId } from '../lib/id-counter.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashPassword,
  verifyPassword,
  generateFamilyId,
  hashToken,
  getRefreshTokenExpiry,
  getAccessTokenExpiry,
} from '../lib/auth.js';
import type { ServiceResult, UserRole, AuthUser } from '@davall/shared';

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_DURATION_MS = 2 * 60 * 60 * 1000;

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export async function login(
  email: string,
  password: string
): Promise<ServiceResult<LoginResult>> {
  try {
    const user = await prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });

    if (!user) {
      return { success: false, error: 'Invalid email or password', statusCode: 401 };
    }

    const tenant = await prisma.tenant.findUnique({
      where: { tenantKey: user.tenantKey },
    });

    if (!tenant || tenant.status !== 'active') {
      return { success: false, error: 'Tenant not found or inactive', statusCode: 401 };
    }

    if (user.status === 'locked' || (user.lockedUntil && user.lockedUntil > new Date())) {
      return { success: false, error: 'Account is locked', statusCode: 401 };
    }

    if (user.status === 'disabled') {
      return { success: false, error: 'Account is disabled', statusCode: 401 };
    }

    if (user.status === 'invited' || !user.passwordHash) {
      return { success: false, error: 'Please set your password first', statusCode: 401 };
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      const newFailedLogins = user.failedLogins + 1;
      const updates: { failedLogins: number; lockedUntil?: Date; status?: string } = {
        failedLogins: newFailedLogins,
      };

      if (newFailedLogins >= MAX_FAILED_LOGINS) {
        updates.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        updates.status = 'locked';
      }

      await prisma.user.update({
        where: { tenantKey_id: { tenantKey: user.tenantKey, id: user.id } },
        data: updates,
      });

      return { success: false, error: 'Invalid email or password', statusCode: 401 };
    }

    await prisma.user.update({
      where: { tenantKey_id: { tenantKey: user.tenantKey, id: user.id } },
      data: {
        failedLogins: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const familyId = generateFamilyId();
    const accessToken = generateAccessToken({
      tenantKey: user.tenantKey,
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
    });
    const refreshToken = generateRefreshToken({
      tenantKey: user.tenantKey,
      userId: user.id,
      familyId,
    });

    const idResult = await allocateId(user.tenantKey, 'refresh_token');
    if (!idResult.success || idResult.data === undefined) {
      return { success: false, error: 'Failed to create session', statusCode: 500 };
    }

    await prisma.refreshToken.create({
      data: {
        tenantKey: user.tenantKey,
        id: idResult.data,
        userId: user.id,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    return {
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          tenantKey: user.tenantKey,
          email: user.email,
          role: user.role as UserRole,
          status: user.status as AuthUser['status'],
          language: user.language,
          workerId: user.workerId,
        },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Login failed: ${message}`, statusCode: 500 };
  }
}

export async function refresh(
  refreshTokenValue: string
): Promise<ServiceResult<{ accessToken: string; refreshToken: string }>> {
  try {
    const payload = verifyRefreshToken(refreshTokenValue);
    if (!payload) {
      return { success: false, error: 'Invalid refresh token', statusCode: 401 };
    }

    const tokenHash = hashToken(refreshTokenValue);
    const existingToken = await prisma.refreshToken.findFirst({
      where: {
        tenantKey: payload.tenantKey,
        familyId: payload.familyId,
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!existingToken) {
      await prisma.refreshToken.updateMany({
        where: {
          tenantKey: payload.tenantKey,
          familyId: payload.familyId,
        },
        data: { revokedAt: new Date() },
      });
      return { success: false, error: 'Invalid or reused refresh token', statusCode: 401 };
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
      return { success: false, error: 'User not found or inactive', statusCode: 401 };
    }

    const newAccessToken = generateAccessToken({
      tenantKey: user.tenantKey,
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
    });
    const newRefreshToken = generateRefreshToken({
      tenantKey: user.tenantKey,
      userId: user.id,
      familyId: payload.familyId,
    });

    const idResult = await allocateId(user.tenantKey, 'refresh_token');
    if (!idResult.success || idResult.data === undefined) {
      return { success: false, error: 'Failed to create session', statusCode: 500 };
    }

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: {
          tenantKey_id: {
            tenantKey: existingToken.tenantKey,
            id: existingToken.id,
          },
        },
        data: {
          revokedAt: new Date(),
          replacedById: idResult.data,
        },
      }),
      prisma.refreshToken.create({
        data: {
          tenantKey: user.tenantKey,
          id: idResult.data,
          userId: user.id,
          familyId: payload.familyId,
          tokenHash: hashToken(newRefreshToken),
          expiresAt: getRefreshTokenExpiry(),
        },
      }),
    ]);

    return {
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Refresh failed: ${message}`, statusCode: 500 };
  }
}

export async function logout(
  tenantKey: string,
  accessToken: string,
  refreshTokenValue?: string
): Promise<ServiceResult<void>> {
  try {
    const idResult = await allocateId(tenantKey, 'token_blacklist');
    if (!idResult.success || idResult.data === undefined) {
      return { success: false, error: 'Failed to logout', statusCode: 500 };
    }

    await prisma.tokenBlacklist.create({
      data: {
        tenantKey,
        id: idResult.data,
        tokenHash: hashToken(accessToken),
        expiresAt: getAccessTokenExpiry(),
      },
    });

    if (refreshTokenValue) {
      const payload = verifyRefreshToken(refreshTokenValue);
      if (payload) {
        await prisma.refreshToken.updateMany({
          where: {
            tenantKey: payload.tenantKey,
            familyId: payload.familyId,
          },
          data: { revokedAt: new Date() },
        });
      }
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Logout failed: ${message}`, statusCode: 500 };
  }
}

export async function register(
  tenantKey: string,
  email: string,
  password: string,
  name: string,
  role: UserRole = 'staff'
): Promise<ServiceResult<AuthUser>> {
  try {
    const existing = await prisma.user.findUnique({
      where: { tenantKey_email: { tenantKey, email } },
    });

    if (existing) {
      return { success: false, error: 'Email already registered', statusCode: 409 };
    }

    const idResult = await allocateId(tenantKey, 'user');
    if (!idResult.success || idResult.data === undefined) {
      return { success: false, error: 'Failed to create user', statusCode: 500 };
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        tenantKey,
        id: idResult.data,
        email,
        name,
        passwordHash,
        role,
        status: 'active',
      },
    });

    return {
      success: true,
      data: {
        id: user.id,
        tenantKey: user.tenantKey,
        email: user.email,
        role: user.role as UserRole,
        status: user.status as AuthUser['status'],
        language: user.language,
        workerId: user.workerId,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Registration failed: ${message}`, statusCode: 500 };
  }
}
