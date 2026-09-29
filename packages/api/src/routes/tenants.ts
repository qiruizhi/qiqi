import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { createTenantSchema, updateTenantSchema } from '@davall/shared';
import * as tenantService from '../services/tenant.service.js';

export const tenantsRouter = Router();

const createTenantWithAdminSchema = createTenantSchema.extend({
  adminEmail: z.string().email(),
  adminPassword: z.string().min(12),
  adminName: z.string().min(1),
});

tenantsRouter.post('/', validateBody(createTenantWithAdminSchema), async (req, res) => {
  const result = await tenantService.createTenant(
    {
      tenantKey: req.body.tenantKey,
      name: req.body.name,
      taxId: req.body.taxId,
      baseCurrency: req.body.baseCurrency,
      timeZone: req.body.timeZone,
      defaultLanguage: req.body.defaultLanguage,
    },
    req.body.adminEmail,
    req.body.adminPassword,
    req.body.adminName
  );

  res.status(result.success ? 201 : result.statusCode || 400).json(result);
});

tenantsRouter.get('/current', authenticate, async (req, res) => {
  const result = await tenantService.getTenant(req.tenantKey!);
  res.status(result.success ? 200 : result.statusCode || 404).json(result);
});

tenantsRouter.patch('/current', authenticate, requireAdmin, validateBody(updateTenantSchema), async (req, res) => {
  const result = await tenantService.updateTenant(req.tenantKey!, req.body);
  res.status(result.success ? 200 : result.statusCode || 400).json(result);
});

tenantsRouter.patch(
  '/current/settings',
  authenticate,
  requireAdmin,
  async (req, res) => {
    const result = await tenantService.updateTenantSettings(req.tenantKey!, req.body);
    res.status(result.success ? 200 : result.statusCode || 400).json(result);
  }
);
