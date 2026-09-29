export const USER_ROLES = ['admin', 'manager', 'staff', 'viewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['invited', 'active', 'locked', 'disabled'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const TENANT_STATUSES = ['active', 'suspended', 'closed'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export interface JwtPayload {
  sub: string;
  tenantKey: string;
  userId: number;
  role: UserRole;
  email: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  tenantKey: string;
  userId: number;
  familyId: string;
  iat: number;
  exp: number;
}

export interface AuthUser {
  id: number;
  tenantKey: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  language: string | null;
  workerId: number | null;
}

export interface TenantSettings {
  overProductionPercent: number;
  overReceiptPercent: number;
  priceTolerancePercent: number;
  poApprovalThreshold: number | null;
  defaultPaymentTermsDays: number;
  defaultTaxPercent: number;
  expiryWarningDays: number;
  attendanceGraceMinutes: number;
  reportFileRetentionDays: number;
}

export const DEFAULT_TENANT_SETTINGS: TenantSettings = {
  overProductionPercent: 10,
  overReceiptPercent: 5,
  priceTolerancePercent: 2,
  poApprovalThreshold: null,
  defaultPaymentTermsDays: 30,
  defaultTaxPercent: 5,
  expiryWarningDays: 30,
  attendanceGraceMinutes: 5,
  reportFileRetentionDays: 7,
};
