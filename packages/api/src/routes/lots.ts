import { Router } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { authenticate, requireManagerOrAbove } from '../middleware/auth.js';
import {
  createLotSchema,
  updateLotSchema,
  paginationSchema,
  LOT_STATUSES,
} from '@davall/shared';
import * as lotService from '../services/lot.service.js';

export const lotsRouter = Router();

const listLotsSchema = paginationSchema.extend({
  productId: z.coerce.number().int().positive().optional(),
  status: z.enum(LOT_STATUSES).optional(),
  expiringWithinDays: z.coerce.number().int().positive().optional(),
});

lotsRouter.get(
  '/',
  authenticate,
  validateQuery(listLotsSchema),
  async (req, res) => {
    const { page, pageSize, ...filters } = req.query as any;
    const result = await lotService.listLots(req.tenantKey!, { page, pageSize }, filters);
    res.status(result.success ? 200 : result.statusCode || 500).json(result);
  }
);

lotsRouter.get('/:id', authenticate, async (req, res) => {
  const lotId = parseInt(req.params.id as string, 10);
  const result = await lotService.getLot(req.tenantKey!, lotId);
  res.status(result.success ? 200 : result.statusCode || 404).json(result);
});

lotsRouter.post(
  '/',
  authenticate,
  requireManagerOrAbove,
  validateBody(createLotSchema),
  async (req, res) => {
    const result = await lotService.createLot(req.tenantKey!, req.body);
    res.status(result.success ? 201 : result.statusCode || 400).json(result);
  }
);

lotsRouter.patch(
  '/:id',
  authenticate,
  requireManagerOrAbove,
  validateBody(updateLotSchema),
  async (req, res) => {
    const lotId = parseInt(req.params.id as string, 10);
    const result = await lotService.updateLot(req.tenantKey!, lotId, req.body);
    res.status(result.success ? 200 : result.statusCode || 400).json(result);
  }
);

const pickingSchema = z.object({
  productId: z.number().int().positive(),
  locationId: z.number().int().positive(),
  quantity: z.number().positive(),
});

lotsRouter.post(
  '/suggest-picking',
  authenticate,
  validateBody(pickingSchema),
  async (req, res) => {
    const result = await lotService.getLotsForPicking(
      req.tenantKey!,
      req.body.productId,
      req.body.locationId,
      req.body.quantity
    );
    res.status(result.success ? 200 : result.statusCode || 400).json(result);
  }
);
