export const ITEM_TYPES = [
  'finished_good',
  'raw_material',
  'consumable',
  'spare',
  'wip',
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const TRACKING_MODES = ['none', 'lot', 'serial'] as const;
export type TrackingMode = (typeof TRACKING_MODES)[number];

export const PICKING_RULES = ['FEFO', 'FIFO'] as const;
export type PickingRule = (typeof PICKING_RULES)[number];

export const COSTING_METHODS = ['moving_average', 'standard'] as const;
export type CostingMethod = (typeof COSTING_METHODS)[number];

export const LOT_STATUSES = [
  'available',
  'quarantine',
  'on_hold',
  'expired',
  'consumed',
] as const;
export type LotStatus = (typeof LOT_STATUSES)[number];

export const LOCATION_TYPES = [
  'receiving',
  'storage',
  'production',
  'qc_hold',
  'shipping',
  'scrap',
] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const MOVEMENT_TYPES = [
  'receipt',
  'issue_to_production',
  'production_output',
  'transfer',
  'adjustment',
  'scrap',
  'shipment',
  'return',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const REFERENCE_TYPES = [
  'purchase_order',
  'production_order',
  'sales_order',
  'shipment',
  'stock_count',
] as const;
export type ReferenceType = (typeof REFERENCE_TYPES)[number];

export const REASON_CODES = [
  'count_variance',
  'damaged',
  'found',
  'fefo_override',
  'expired',
  'quality_reject',
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export interface ItemTypeDefaults {
  canPurchase: boolean;
  canSell: boolean;
  canManufacture: boolean;
  isStocked: boolean;
}

export const ITEM_TYPE_DEFAULTS: Record<ItemType, ItemTypeDefaults> = {
  finished_good: {
    canPurchase: false,
    canSell: true,
    canManufacture: true,
    isStocked: true,
  },
  raw_material: {
    canPurchase: true,
    canSell: false,
    canManufacture: false,
    isStocked: true,
  },
  consumable: {
    canPurchase: true,
    canSell: false,
    canManufacture: false,
    isStocked: true,
  },
  spare: {
    canPurchase: true,
    canSell: false,
    canManufacture: false,
    isStocked: true,
  },
  wip: {
    canPurchase: false,
    canSell: false,
    canManufacture: true,
    isStocked: true,
  },
};

export function formatFullId(tenantKey: string, id: number): string {
  return `${tenantKey}-${id}`;
}

export function parseFullId(fullId: string): { tenantKey: string; id: number } | null {
  const match = fullId.match(/^([A-Z0-9]+)-(\d+)$/);
  if (!match) return null;
  return { tenantKey: match[1], id: parseInt(match[2], 10) };
}
