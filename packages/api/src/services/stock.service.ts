import { prisma } from '../lib/prisma.js';
import { allocateId, allocateIds } from '../lib/id-counter.js';
import type {
  ServiceResult,
  PaginatedResult,
  MovementType,
  ReferenceType,
} from '@davall/shared';
import { formatFullId } from '@davall/shared';
import type {
  StockAdjustmentInput,
  StockTransferInput,
  PaginationInput,
} from '@davall/shared';
import { Prisma } from '@prisma/client';

interface StockEntry {
  id: number;
  tenantKey: string;
  fullId: string;
  productId: number;
  lotId: number | null;
  fromLocationId: number | null;
  toLocationId: number | null;
  movementType: MovementType;
  quantity: number;
  unitCost: number | null;
  referenceType: ReferenceType | null;
  referenceId: number | null;
  reasonCode: string | null;
  reversesId: number | null;
  createdById: number;
  createdAt: Date;
}

interface StockBalance {
  id: number;
  tenantKey: string;
  productId: number;
  lotId: number | null;
  locationId: number;
  onHand: number;
  reserved: number;
  available: number;
}

function toStockEntry(record: {
  id: number;
  tenantKey: string;
  productId: number;
  lotId: number | null;
  fromLocationId: number | null;
  toLocationId: number | null;
  movementType: string;
  quantity: Prisma.Decimal;
  unitCost: number | null;
  referenceType: string | null;
  referenceId: number | null;
  reasonCode: string | null;
  reversesId: number | null;
  createdById: number;
  createdAt: Date;
}): StockEntry {
  return {
    ...record,
    fullId: formatFullId(record.tenantKey, record.id),
    movementType: record.movementType as MovementType,
    referenceType: record.referenceType as ReferenceType | null,
    quantity: record.quantity.toNumber(),
  };
}

function toStockBalance(record: {
  id: number;
  tenantKey: string;
  productId: number;
  lotId: number | null;
  locationId: number;
  onHand: Prisma.Decimal;
  reserved: Prisma.Decimal;
}): StockBalance {
  const onHand = record.onHand.toNumber();
  const reserved = record.reserved.toNumber();
  return {
    ...record,
    onHand,
    reserved,
    available: onHand - reserved,
  };
}

async function updateBalance(
  tx: Prisma.TransactionClient,
  tenantKey: string,
  productId: number,
  lotId: number | null,
  locationId: number,
  quantityDelta: number
): Promise<void> {
  const existing = await tx.stockBalance.findFirst({
    where: { tenantKey, productId, lotId, locationId },
  });

  if (existing) {
    const newOnHand = existing.onHand.toNumber() + quantityDelta;
    if (newOnHand < 0) {
      throw new Error('Insufficient stock');
    }
    await tx.stockBalance.update({
      where: { tenantKey_id: { tenantKey, id: existing.id } },
      data: { onHand: newOnHand },
    });
  } else {
    if (quantityDelta < 0) {
      throw new Error('Insufficient stock');
    }
    const idResult = await allocateId(tenantKey, 'stock_balance');
    if (!idResult.success || idResult.data === undefined) {
      throw new Error('Failed to allocate ID');
    }
    await tx.stockBalance.create({
      data: {
        tenantKey,
        id: idResult.data,
        productId,
        lotId,
        locationId,
        onHand: quantityDelta,
        reserved: 0,
      },
    });
  }
}

async function updateProductStockQuantity(
  tx: Prisma.TransactionClient,
  tenantKey: string,
  productId: number
): Promise<void> {
  const result = await tx.stockBalance.aggregate({
    where: { tenantKey, productId },
    _sum: { onHand: true },
  });

  await tx.product.update({
    where: { tenantKey_id: { tenantKey, id: productId } },
    data: { stockQuantity: result._sum.onHand ?? 0 },
  });
}

export async function createStockEntry(
  tenantKey: string,
  input: {
    productId: number;
    lotId?: number | null;
    fromLocationId?: number | null;
    toLocationId?: number | null;
    movementType: MovementType;
    quantity: number;
    unitCost?: number | null;
    referenceType?: ReferenceType | null;
    referenceId?: number | null;
    reasonCode?: string | null;
    reversesId?: number | null;
  },
  userId: number
): Promise<ServiceResult<StockEntry>> {
  try {
    const entry = await prisma.$transaction(async (tx) => {
      const idResult = await allocateId(tenantKey, 'stock_entry');
      if (!idResult.success || idResult.data === undefined) {
        throw new Error('Failed to allocate ID');
      }

      const entry = await tx.stockEntry.create({
        data: {
          tenantKey,
          id: idResult.data,
          productId: input.productId,
          lotId: input.lotId ?? null,
          fromLocationId: input.fromLocationId ?? null,
          toLocationId: input.toLocationId ?? null,
          movementType: input.movementType,
          quantity: input.quantity,
          unitCost: input.unitCost ?? null,
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
          reasonCode: input.reasonCode ?? null,
          reversesId: input.reversesId ?? null,
          createdById: userId,
        },
      });

      if (input.fromLocationId) {
        await updateBalance(
          tx,
          tenantKey,
          input.productId,
          input.lotId ?? null,
          input.fromLocationId,
          -Math.abs(input.quantity)
        );
      }

      if (input.toLocationId) {
        await updateBalance(
          tx,
          tenantKey,
          input.productId,
          input.lotId ?? null,
          input.toLocationId,
          Math.abs(input.quantity)
        );
      }

      await updateProductStockQuantity(tx, tenantKey, input.productId);

      return entry;
    });

    return { success: true, data: toStockEntry(entry) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to create stock entry: ${message}`, statusCode: 500 };
  }
}

export async function adjustStock(
  tenantKey: string,
  input: StockAdjustmentInput,
  userId: number
): Promise<ServiceResult<StockEntry>> {
  if (!input.reasonCode) {
    return { success: false, error: 'Reason code is required for adjustments', statusCode: 400 };
  }

  return createStockEntry(
    tenantKey,
    {
      productId: input.productId,
      lotId: input.lotId,
      fromLocationId: input.quantity < 0 ? input.locationId : null,
      toLocationId: input.quantity > 0 ? input.locationId : null,
      movementType: 'adjustment',
      quantity: Math.abs(input.quantity),
      reasonCode: input.reasonCode,
    },
    userId
  );
}

export async function transferStock(
  tenantKey: string,
  input: StockTransferInput,
  userId: number
): Promise<ServiceResult<StockEntry>> {
  return createStockEntry(
    tenantKey,
    {
      productId: input.productId,
      lotId: input.lotId,
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      movementType: 'transfer',
      quantity: input.quantity,
    },
    userId
  );
}

export async function getStockBalance(
  tenantKey: string,
  productId: number,
  locationId?: number,
  lotId?: number
): Promise<ServiceResult<StockBalance[]>> {
  try {
    const where = {
      tenantKey,
      productId,
      ...(locationId !== undefined && { locationId }),
      ...(lotId !== undefined && { lotId }),
    };

    const balances = await prisma.stockBalance.findMany({ where });

    return { success: true, data: balances.map(toStockBalance) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to get stock balance: ${message}`, statusCode: 500 };
  }
}

export async function listStockBalances(
  tenantKey: string,
  pagination: PaginationInput,
  filters?: { productId?: number; locationId?: number; hasStock?: boolean }
): Promise<ServiceResult<PaginatedResult<StockBalance>>> {
  try {
    const where = {
      tenantKey,
      ...(filters?.productId && { productId: filters.productId }),
      ...(filters?.locationId && { locationId: filters.locationId }),
      ...(filters?.hasStock && { onHand: { gt: 0 } }),
    };

    const [balances, total] = await Promise.all([
      prisma.stockBalance.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      prisma.stockBalance.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items: balances.map(toStockBalance),
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to list stock balances: ${message}`, statusCode: 500 };
  }
}

export async function listStockEntries(
  tenantKey: string,
  pagination: PaginationInput,
  filters?: {
    productId?: number;
    lotId?: number;
    movementType?: MovementType;
    referenceType?: ReferenceType;
    referenceId?: number;
    fromDate?: Date;
    toDate?: Date;
  }
): Promise<ServiceResult<PaginatedResult<StockEntry>>> {
  try {
    const where = {
      tenantKey,
      ...(filters?.productId && { productId: filters.productId }),
      ...(filters?.lotId && { lotId: filters.lotId }),
      ...(filters?.movementType && { movementType: filters.movementType }),
      ...(filters?.referenceType && { referenceType: filters.referenceType }),
      ...(filters?.referenceId && { referenceId: filters.referenceId }),
      ...(filters?.fromDate && { createdAt: { gte: filters.fromDate } }),
      ...(filters?.toDate && { createdAt: { lte: filters.toDate } }),
    };

    const [entries, total] = await Promise.all([
      prisma.stockEntry.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.stockEntry.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items: entries.map(toStockEntry),
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to list stock entries: ${message}`, statusCode: 500 };
  }
}

export async function reserveStock(
  tenantKey: string,
  productId: number,
  locationId: number,
  lotId: number | null,
  quantity: number
): Promise<ServiceResult<void>> {
  try {
    await prisma.$transaction(async (tx) => {
      const balance = await tx.stockBalance.findFirst({
        where: { tenantKey, productId, locationId, lotId },
      });

      if (!balance) {
        throw new Error('No stock balance found');
      }

      const available = balance.onHand.toNumber() - balance.reserved.toNumber();
      if (available < quantity) {
        throw new Error('Insufficient available stock');
      }

      await tx.stockBalance.update({
        where: { tenantKey_id: { tenantKey, id: balance.id } },
        data: { reserved: { increment: quantity } },
      });
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to reserve stock: ${message}`, statusCode: 500 };
  }
}

export async function releaseReservation(
  tenantKey: string,
  productId: number,
  locationId: number,
  lotId: number | null,
  quantity: number
): Promise<ServiceResult<void>> {
  try {
    await prisma.$transaction(async (tx) => {
      const balance = await tx.stockBalance.findFirst({
        where: { tenantKey, productId, locationId, lotId },
      });

      if (!balance) {
        throw new Error('No stock balance found');
      }

      const currentReserved = balance.reserved.toNumber();
      if (currentReserved < quantity) {
        throw new Error('Release quantity exceeds reserved quantity');
      }

      await tx.stockBalance.update({
        where: { tenantKey_id: { tenantKey, id: balance.id } },
        data: { reserved: { decrement: quantity } },
      });
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to release reservation: ${message}`, statusCode: 500 };
  }
}
