import { Router } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { authenticate, requireManagerOrAbove } from '../middleware/auth.js';
import {
  stockAdjustmentSchema,
  stockTransferSchema,
  paginationSchema,
  MOVEMENT_TYPES,
  REFERENCE_TYPES,
} from '@davall/shared';
import * as stockService from '../services/stock.service.js';

export const stockRouter = Router();

const listBalancesSchema = paginationSchema.extend({
  productId: z.coerce.number().int().positive().optional(),
  locationId: z.coerce.number().int().positive().optional(),
  hasStock: z.coerce.boolean().optional(),
});

stockRouter.get(
  '/balances',
  authenticate,
  validateQuery(listBalancesSchema),
  async (req, res) => {
    const { page, pageSize, ...filters } = req.query as any;
    const result = await stockService.listStockBalances(
      req.tenantKey!,
      { page, pageSize },
      filters
    );
    res.status(result.success ? 200 : result.statusCode || 500).json(result);
  }
);

const listEntriesSchema = paginationSchema.extend({
  productId: z.coerce.number().int().positive().optional(),
  lotId: z.coerce.number().int().positive().optional(),
  movementType: z.enum(MOVEMENT_TYPES).optional(),
  referenceType: z.enum(REFERENCE_TYPES).optional(),
  referenceId: z.coerce.number().int().positive().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

stockRouter.get(
  '/entries',
  authenticate,
  validateQuery(listEntriesSchema),
  async (req, res) => {
    const { page, pageSize, ...filters } = req.query as any;
    const result = await stockService.listStockEntries(
      req.tenantKey!,
      { page, pageSize },
      filters
    );
    res.status(result.success ? 200 : result.statusCode || 500).json(result);
  }
);

stockRouter.post(
  '/adjust',
  authenticate,
  requireManagerOrAbove,
  validateBody(stockAdjustmentSchema),
  async (req, res) => {
    const result = await stockService.adjustStock(req.tenantKey!, req.body, req.user!.id);
    res.status(result.success ? 201 : result.statusCode || 400).json(result);
  }
);

stockRouter.post(
  '/transfer',
  authenticate,
  validateBody(stockTransferSchema),
  async (req, res) => {
    const result = await stockService.transferStock(req.tenantKey!, req.body, req.user!.id);
    res.status(result.success ? 201 : result.statusCode || 400).json(result);
  }
);

const reserveSchema = z.object({
  productId: z.number().int().positive(),
  locationId: z.number().int().positive(),
  lotId: z.number().int().positive().nullable(),
  quantity: z.number().positive(),
});

stockRouter.post(
  '/reserve',
  authenticate,
  requireManagerOrAbove,
  validateBody(reserveSchema),
  async (req, res) => {
    const result = await stockService.reserveStock(
      req.tenantKey!,
      req.body.productId,
      req.body.locationId,
      req.body.lotId,
      req.body.quantity
    );
    res.status(result.success ? 200 : result.statusCode || 400).json(result);
  }
);

stockRouter.post(
  '/release',
  authenticate,
  requireManagerOrAbove,
  validateBody(reserveSchema),
  async (req, res) => {
    const result = await stockService.releaseReservation(
      req.tenantKey!,
      req.body.productId,
      req.body.locationId,
      req.body.lotId,
      req.body.quantity
    );
    res.status(result.success ? 200 : result.statusCode || 400).json(result);
  }
);
