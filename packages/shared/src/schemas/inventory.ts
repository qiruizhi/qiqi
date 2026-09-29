import { z } from 'zod';
import {
  ITEM_TYPES,
  TRACKING_MODES,
  PICKING_RULES,
  COSTING_METHODS,
  LOT_STATUSES,
  LOCATION_TYPES,
  MOVEMENT_TYPES,
  REFERENCE_TYPES,
  REASON_CODES,
} from '../types/inventory.js';

export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  itemType: z.enum(ITEM_TYPES),
  uom: z.string().min(1, 'Unit of measure is required').max(10),
  purchaseUom: z.string().max(10).optional(),
  purchaseUomFactor: z.number().positive().optional(),
  canPurchase: z.boolean().optional(),
  canSell: z.boolean().optional(),
  canManufacture: z.boolean().optional(),
  isStocked: z.boolean().optional(),
  trackingMode: z.enum(TRACKING_MODES).default('lot'),
  hasShelfLife: z.boolean().default(false),
  shelfLifeDays: z.number().int().positive().optional(),
  pickingRule: z.enum(PICKING_RULES).default('FIFO'),
  requiresIncomingInspection: z.boolean().default(false),
  safetyStock: z.number().nonnegative().default(0),
  reorderPoint: z.number().nonnegative().default(0),
  minStockLevel: z.number().nonnegative().default(0),
  maxStockLevel: z.number().nonnegative().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  costingMethod: z.enum(COSTING_METHODS).default('moving_average'),
  standardCost: z.number().int().nonnegative().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const createWarehouseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});

export const updateWarehouseSchema = createWarehouseSchema.partial();

export const createLocationSchema = z.object({
  warehouseId: z.number().int().positive(),
  name: z.string().min(1, 'Name is required').max(100),
  locationType: z.enum(LOCATION_TYPES),
});

export const updateLocationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  locationType: z.enum(LOCATION_TYPES).optional(),
});

export const createLotSchema = z.object({
  productId: z.number().int().positive(),
  supplierLotNo: z.string().max(100).optional(),
  receivedAt: z.string().datetime().optional(),
  producedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  status: z.enum(LOT_STATUSES).default('available'),
});

export const updateLotSchema = z.object({
  supplierLotNo: z.string().max(100).optional(),
  expiresAt: z.string().datetime().optional(),
  status: z.enum(LOT_STATUSES).optional(),
});

export const createStockEntrySchema = z.object({
  productId: z.number().int().positive(),
  lotId: z.number().int().positive().optional(),
  fromLocationId: z.number().int().positive().optional(),
  toLocationId: z.number().int().positive().optional(),
  movementType: z.enum(MOVEMENT_TYPES),
  quantity: z.number(),
  unitCost: z.number().int().nonnegative().optional(),
  referenceType: z.enum(REFERENCE_TYPES).optional(),
  referenceId: z.number().int().positive().optional(),
  reasonCode: z.string().max(50).optional(),
  reversesId: z.number().int().positive().optional(),
});

export const stockAdjustmentSchema = z.object({
  productId: z.number().int().positive(),
  lotId: z.number().int().positive().optional(),
  locationId: z.number().int().positive(),
  quantity: z.number(),
  reasonCode: z.enum(REASON_CODES),
  notes: z.string().max(500).optional(),
});

export const stockTransferSchema = z.object({
  productId: z.number().int().positive(),
  lotId: z.number().int().positive().optional(),
  fromLocationId: z.number().int().positive(),
  toLocationId: z.number().int().positive(),
  quantity: z.number().positive(),
  notes: z.string().max(500).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const productFilterSchema = z.object({
  itemType: z.enum(ITEM_TYPES).optional(),
  canPurchase: z.coerce.boolean().optional(),
  canSell: z.coerce.boolean().optional(),
  canManufacture: z.coerce.boolean().optional(),
  isStocked: z.coerce.boolean().optional(),
  search: z.string().optional(),
  belowReorderPoint: z.coerce.boolean().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type CreateLotInput = z.infer<typeof createLotSchema>;
export type UpdateLotInput = z.infer<typeof updateLotSchema>;
export type CreateStockEntryInput = z.infer<typeof createStockEntrySchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type StockTransferInput = z.infer<typeof stockTransferSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type ProductFilterInput = z.infer<typeof productFilterSchema>;
