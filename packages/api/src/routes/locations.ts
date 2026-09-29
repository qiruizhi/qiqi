import { Router } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { authenticate, requireManagerOrAbove } from '../middleware/auth.js';
import {
  createLocationSchema,
  updateLocationSchema,
  paginationSchema,
  LOCATION_TYPES,
} from '@davall/shared';
import * as locationService from '../services/location.service.js';

export const locationsRouter = Router();

const listLocationsSchema = paginationSchema.extend({
  warehouseId: z.coerce.number().int().positive().optional(),
  locationType: z.enum(LOCATION_TYPES).optional(),
});

locationsRouter.get(
  '/',
  authenticate,
  validateQuery(listLocationsSchema),
  async (req, res) => {
    const { page, pageSize, ...filters } = req.query as any;
    const result = await locationService.listLocations(
      req.tenantKey!,
      { page, pageSize },
      filters
    );
    res.status(result.success ? 200 : result.statusCode || 500).json(result);
  }
);

locationsRouter.get('/:id', authenticate, async (req, res) => {
  const locationId = parseInt(req.params.id as string, 10);
  const result = await locationService.getLocation(req.tenantKey!, locationId);
  res.status(result.success ? 200 : result.statusCode || 404).json(result);
});

locationsRouter.post(
  '/',
  authenticate,
  requireManagerOrAbove,
  validateBody(createLocationSchema),
  async (req, res) => {
    const result = await locationService.createLocation(req.tenantKey!, req.body);
    res.status(result.success ? 201 : result.statusCode || 400).json(result);
  }
);

locationsRouter.patch(
  '/:id',
  authenticate,
  requireManagerOrAbove,
  validateBody(updateLocationSchema),
  async (req, res) => {
    const locationId = parseInt(req.params.id as string, 10);
    const result = await locationService.updateLocation(req.tenantKey!, locationId, req.body);
    res.status(result.success ? 200 : result.statusCode || 400).json(result);
  }
);

locationsRouter.delete('/:id', authenticate, requireManagerOrAbove, async (req, res) => {
  const locationId = parseInt(req.params.id as string, 10);
  const result = await locationService.deleteLocation(req.tenantKey!, locationId);
  res.status(result.success ? 200 : result.statusCode || 400).json(result);
});
