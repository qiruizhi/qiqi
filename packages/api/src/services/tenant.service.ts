import { prisma } from '../lib/prisma.js';
import { allocateId } from '../lib/id-counter.js';
import { hashPassword } from '../lib/auth.js';
import type { ServiceResult, TenantSettings } from '@davall/shared';
import type { CreateTenantInput, UpdateTenantInput } from '@davall/shared';
import type { Prisma } from '@prisma/client';

interface Tenant {
  tenantKey: string;
  name: string;
  taxId: string | null;
  baseCurrency: string;
  timeZone: string;
  defaultLanguage: string;
  status: string;
  settings: TenantSettings;
  createdAt: Date;
}

export async function createTenant(
  input: CreateTenantInput,
  adminEmail: string,
  adminPassword: string,
  adminName: string
): Promise<ServiceResult<Tenant>> {
  try {
    const existing = await prisma.tenant.findUnique({
      where: { tenantKey: input.tenantKey },
    });

    if (existing) {
      return { success: false, error: 'Tenant key already exists', statusCode: 409 };
    }

    const defaultSettings: TenantSettings = {
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

    const passwordHash = await hashPassword(adminPassword);

    const [tenant] = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          tenantKey: input.tenantKey,
          name: input.name,
          taxId: input.taxId,
          baseCurrency: input.baseCurrency,
          timeZone: input.timeZone,
          defaultLanguage: input.defaultLanguage,
          settings: defaultSettings as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.idCounter.create({
        data: {
          tenantKey: input.tenantKey,
          entity: 'user',
          nextValue: 2,
        },
      });

      await tx.user.create({
        data: {
          tenantKey: input.tenantKey,
          id: 1,
          email: adminEmail,
          name: adminName,
          passwordHash,
          role: 'admin',
          status: 'active',
          language: input.defaultLanguage,
        },
      });

      return [tenant];
    });

    return {
      success: true,
      data: {
        ...tenant,
        settings: tenant.settings as unknown as TenantSettings,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to create tenant: ${message}`, statusCode: 500 };
  }
}

export async function getTenant(tenantKey: string): Promise<ServiceResult<Tenant>> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { tenantKey },
    });

    if (!tenant) {
      return { success: false, error: 'Tenant not found', statusCode: 404 };
    }

    return {
      success: true,
      data: {
        ...tenant,
        settings: tenant.settings as unknown as TenantSettings,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to get tenant: ${message}`, statusCode: 500 };
  }
}

export async function updateTenant(
  tenantKey: string,
  input: UpdateTenantInput
): Promise<ServiceResult<Tenant>> {
  try {
    const tenant = await prisma.tenant.update({
      where: { tenantKey },
      data: input,
    });

    return {
      success: true,
      data: {
        ...tenant,
        settings: tenant.settings as unknown as TenantSettings,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to update tenant: ${message}`, statusCode: 500 };
  }
}

export async function updateTenantSettings(
  tenantKey: string,
  settings: Partial<TenantSettings>
): Promise<ServiceResult<Tenant>> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { tenantKey },
    });

    if (!tenant) {
      return { success: false, error: 'Tenant not found', statusCode: 404 };
    }

    const currentSettings = tenant.settings as unknown as TenantSettings;
    const newSettings = { ...currentSettings, ...settings };

    const updated = await prisma.tenant.update({
      where: { tenantKey },
      data: { settings: newSettings as unknown as Prisma.InputJsonValue },
    });

    return {
      success: true,
      data: {
        ...updated,
        settings: updated.settings as unknown as TenantSettings,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to update settings: ${message}`, statusCode: 500 };
  }
}
