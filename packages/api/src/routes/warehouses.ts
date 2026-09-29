import { Router } from 'express';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { authenticate, requireManagerOrAbove } from '../middleware/auth.js';
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  paginationSchema,
} from '@davall/shared';
import * as warehouseService from '../services/warehouse.service.js';

export const warehousesRouter = Router();

warehousesRouter.get(
  '/',
  authenticate,
  validateQuery(paginationSchema),
  async (req, res) => {
    const { page, pageSize } = req.query as any;
    const result = await warehouseService.listWarehouses(req.tenantKey!, { page, pageSize });
    res.status(result.success ? 200 : result.statusCode || 500).json(result);
  }
);

warehousesRouter.get('/:id', authenticate, async (req, res) => {
  const warehouseId = parseInt(req.params.id as string, 10);
  const result = await warehouseService.getWarehouse(req.tenantKey!, warehouseId);
  res.status(result.success ? 200 : result.statusCode || 404).json(result);
});

warehousesRouter.post(
  '/',
  authenticate,
  requireManagerOrAbove,
  validateBody(createWarehouseSchema),
  async (req, res) => {
    const result = await warehouseService.createWarehouse(req.tenantKey!, req.body);
    res.status(result.success ? 201 : result.statusCode || 400).json(result);
  }
);

warehousesRouter.patch(
  '/:id',
  authenticate,
  requireManagerOrAbove,
  validateBody(updateWarehouseSchema),
  async (req, res) => {
    const warehouseId = parseInt(req.params.id as string, 10);
    const result = await warehouseService.updateWarehouse(req.tenantKey!, warehouseId, req.body);
    res.status(result.success ? 200 : result.statusCode || 400).json(result);
  }
);

warehousesRouter.delete('/:id', authenticate, requireManagerOrAbove, async (req, res) => {
  const warehouseId = parseInt(req.params.id as string, 10);
  const result = await warehouseService.deleteWarehouse(req.tenantKey!, warehouseId);
  res.status(result.success ? 200 : result.statusCode || 400).json(result);
});
