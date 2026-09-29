import { z } from 'zod';
import { USER_ROLES, USER_STATUSES, TENANT_STATUSES } from '../types/auth.js';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password must be at most 128 characters'),
  name: z.string().min(1, 'Name is required').max(100),
});

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(100),
  role: z.enum(USER_ROLES),
  language: z.string().optional(),
  workerId: z.number().int().positive().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  language: z.string().optional(),
  workerId: z.number().int().positive().nullable().optional(),
});

export const createTenantSchema = z.object({
  tenantKey: z
    .string()
    .min(2, 'Tenant key must be 2-8 characters')
    .max(8, 'Tenant key must be 2-8 characters')
    .regex(/^[A-Z0-9]+$/, 'Tenant key must be uppercase letters and digits only'),
  name: z.string().min(1, 'Name is required').max(200),
  taxId: z.string().max(50).optional(),
  baseCurrency: z.string().default('TWD'),
  timeZone: z.string().default('Asia/Taipei'),
  defaultLanguage: z.enum(['zh-TW', 'en']).default('zh-TW'),
});

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  taxId: z.string().max(50).optional(),
  baseCurrency: z.string().optional(),
  timeZone: z.string().optional(),
  defaultLanguage: z.enum(['zh-TW', 'en']).optional(),
  status: z.enum(TENANT_STATUSES).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
