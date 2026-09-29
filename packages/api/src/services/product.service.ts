import { prisma } from '../lib/prisma.js';
import { allocateId } from '../lib/id-counter.js';
import {
  type ServiceResult,
  type PaginatedResult,
  type ItemType,
  ITEM_TYPE_DEFAULTS,
  formatFullId,
} from '@davall/shared';
import type {
  CreateProductInput,
  UpdateProductInput,
  PaginationInput,
  ProductFilterInput,
} from '@davall/shared';
import { Decimal } from '@prisma/client/runtime/library';

interface Product {
  id: number;
  tenantKey: string;
  fullId: string;
  name: string;
  itemType: ItemType;
  uom: string;
  purchaseUom: string | null;
  purchaseUomFactor: number | null;
  canPurchase: boolean;
  canSell: boolean;
  canManufacture: boolean;
  isStocked: boolean;
  trackingMode: string;
  hasShelfLife: boolean;
  shelfLifeDays: number | null;
  pickingRule: string;
  requiresIncomingInspection: boolean;
  safetyStock: number;
  reorderPoint: number;
  minStockLevel: number;
  maxStockLevel: number | null;
  leadTimeDays: number | null;
  costingMethod: string;
  standardCost: number | null;
  stockQuantity: number;
  averageCost: number;
  createdAt: Date;
  updatedAt: Date;
}

function toProduct(record: {
  id: number;
  tenantKey: string;
  name: string;
  itemType: string;
  uom: string;
  purchaseUom: string | null;
  purchaseUomFactor: Decimal | null;
  canPurchase: boolean;
  canSell: boolean;
  canManufacture: boolean;
  isStocked: boolean;
  trackingMode: string;
  hasShelfLife: boolean;
  shelfLifeDays: number | null;
  pickingRule: string;
  requiresIncomingInspection: boolean;
  safetyStock: Decimal;
  reorderPoint: Decimal;
  minStockLevel: Decimal;
  maxStockLevel: Decimal | null;
  leadTimeDays: number | null;
  costingMethod: string;
  standardCost: number | null;
  stockQuantity: Decimal;
  averageCost: number;
  createdAt: Date;
  updatedAt: Date;
}): Product {
  return {
    id: record.id,
    tenantKey: record.tenantKey,
    fullId: formatFullId(record.tenantKey, record.id),
    name: record.name,
    itemType: record.itemType as ItemType,
    uom: record.uom,
    purchaseUom: record.purchaseUom,
    purchaseUomFactor: record.purchaseUomFactor?.toNumber() ?? null,
    canPurchase: record.canPurchase,
    canSell: record.canSell,
    canManufacture: record.canManufacture,
    isStocked: record.isStocked,
    trackingMode: record.trackingMode,
    hasShelfLife: record.hasShelfLife,
    shelfLifeDays: record.shelfLifeDays,
    pickingRule: record.pickingRule,
    requiresIncomingInspection: record.requiresIncomingInspection,
    safetyStock: record.safetyStock.toNumber(),
    reorderPoint: record.reorderPoint.toNumber(),
    minStockLevel: record.minStockLevel.toNumber(),
    maxStockLevel: record.maxStockLevel?.toNumber() ?? null,
    leadTimeDays: record.leadTimeDays,
    costingMethod: record.costingMethod,
    standardCost: record.standardCost,
    stockQuantity: record.stockQuantity.toNumber(),
    averageCost: record.averageCost,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function createProduct(
  tenantKey: string,
  input: CreateProductInput
): Promise<ServiceResult<Product>> {
  try {
    const idResult = await allocateId(tenantKey, 'product');
    if (!idResult.success || idResult.data === undefined) {
      return { success: false, error: 'Failed to allocate ID', statusCode: 500 };
    }

    const defaults = ITEM_TYPE_DEFAULTS[input.itemType];

    const product = await prisma.product.create({
      data: {
        tenantKey,
        id: idResult.data,
        name: input.name,
        itemType: input.itemType,
        uom: input.uom,
        purchaseUom: input.purchaseUom,
        purchaseUomFactor: input.purchaseUomFactor,
        canPurchase: input.canPurchase ?? defaults.canPurchase,
        canSell: input.canSell ?? defaults.canSell,
        canManufacture: input.canManufacture ?? defaults.canManufacture,
        isStocked: input.isStocked ?? defaults.isStocked,
        trackingMode: input.trackingMode,
        hasShelfLife: input.hasShelfLife,
        shelfLifeDays: input.shelfLifeDays,
        pickingRule: input.pickingRule,
        requiresIncomingInspection: input.requiresIncomingInspection,
        safetyStock: input.safetyStock,
        reorderPoint: input.reorderPoint,
        minStockLevel: input.minStockLevel,
        maxStockLevel: input.maxStockLevel,
        leadTimeDays: input.leadTimeDays,
        costingMethod: input.costingMethod,
        standardCost: input.standardCost,
      },
    });

    return { success: true, data: toProduct(product) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to create product: ${message}`, statusCode: 500 };
  }
}

export async function getProduct(
  tenantKey: string,
  productId: number
): Promise<ServiceResult<Product>> {
  try {
    const product = await prisma.product.findUnique({
      where: { tenantKey_id: { tenantKey, id: productId } },
    });

    if (!product || product.deletedAt) {
      return { success: false, error: 'Product not found', statusCode: 404 };
    }

    return { success: true, data: toProduct(product) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to get product: ${message}`, statusCode: 500 };
  }
}

export async function listProducts(
  tenantKey: string,
  pagination: PaginationInput,
  filters?: ProductFilterInput
): Promise<ServiceResult<PaginatedResult<Product>>> {
  try {
    const where = {
      tenantKey,
      deletedAt: null,
      ...(filters?.itemType && { itemType: filters.itemType }),
      ...(filters?.canPurchase !== undefined && { canPurchase: filters.canPurchase }),
      ...(filters?.canSell !== undefined && { canSell: filters.canSell }),
      ...(filters?.canManufacture !== undefined && { canManufacture: filters.canManufacture }),
      ...(filters?.isStocked !== undefined && { isStocked: filters.isStocked }),
      ...(filters?.search && {
        name: { contains: filters.search, mode: 'insensitive' as const },
      }),
      ...(filters?.belowReorderPoint && {
        stockQuantity: { lt: prisma.product.fields.reorderPoint },
      }),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { name: 'asc' },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items: products.map(toProduct),
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to list products: ${message}`, statusCode: 500 };
  }
}

export async function updateProduct(
  tenantKey: string,
  productId: number,
  input: UpdateProductInput
): Promise<ServiceResult<Product>> {
  try {
    const existing = await prisma.product.findUnique({
      where: { tenantKey_id: { tenantKey, id: productId } },
    });

    if (!existing || existing.deletedAt) {
      return { success: false, error: 'Product not found', statusCode: 404 };
    }

    const product = await prisma.product.update({
      where: { tenantKey_id: { tenantKey, id: productId } },
      data: input,
    });

    return { success: true, data: toProduct(product) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to update product: ${message}`, statusCode: 500 };
  }
}

export async function deleteProduct(
  tenantKey: string,
  productId: number
): Promise<ServiceResult<void>> {
  try {
    const existing = await prisma.product.findUnique({
      where: { tenantKey_id: { tenantKey, id: productId } },
    });

    if (!existing || existing.deletedAt) {
      return { success: false, error: 'Product not found', statusCode: 404 };
    }

    const hasStock = await prisma.stockBalance.findFirst({
      where: {
        tenantKey,
        productId,
        onHand: { not: 0 },
      },
    });

    if (hasStock) {
      return {
        success: false,
        error: 'Cannot delete product with stock on hand',
        statusCode: 400,
      };
    }

    await prisma.product.update({
      where: { tenantKey_id: { tenantKey, id: productId } },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to delete product: ${message}`, statusCode: 500 };
  }
}
