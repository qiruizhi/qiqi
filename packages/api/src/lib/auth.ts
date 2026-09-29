import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import type { JwtPayload, RefreshTokenPayload, UserRole } from '@davall/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const SALT_ROUNDS = 12;

export function generateAccessToken(payload: {
  tenantKey: string;
  userId: number;
  email: string;
  role: UserRole;
}): string {
  return jwt.sign(
    {
      sub: `${payload.tenantKey}:${payload.userId}`,
      tenantKey: payload.tenantKey,
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

export function generateRefreshToken(payload: {
  tenantKey: string;
  userId: number;
  familyId: string;
}): string {
  return jwt.sign(
    {
      sub: `${payload.tenantKey}:${payload.userId}`,
      tenantKey: payload.tenantKey,
      userId: payload.userId,
      familyId: payload.familyId,
    },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateFamilyId(): string {
  return crypto.randomUUID();
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getAccessTokenExpiry(): Date {
  return new Date(Date.now() + 15 * 60 * 1000);
}

export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}
