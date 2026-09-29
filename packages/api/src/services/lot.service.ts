import { prisma } from '../lib/prisma.js';
import { allocateId } from '../lib/id-counter.js';
import type { ServiceResult, PaginatedResult, LotStatus } from '@davall/shared';
import { formatFullId } from '@davall/shared';
import type { CreateLotInput, UpdateLotInput, PaginationInput } from '@davall/shared';

interface Lot {
  id: number;
  tenantKey: string;
  fullId: string;
  productId: number;
  supplierLotNo: string | null;
  receivedAt: Date | null;
  producedAt: Date | null;
  expiresAt: Date | null;
  status: LotStatus;
  createdAt: Date;
  updatedAt: Date;
}

function toLot(record: {
  id: number;
  tenantKey: string;
  productId: number;
  supplierLotNo: string | null;
  receivedAt: Date | null;
  producedAt: Date | null;
  expiresAt: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): Lot {
  return {
    ...record,
    fullId: formatFullId(record.tenantKey, record.id),
    status: record.status as LotStatus,
  };
}

export async function createLot(
  tenantKey: string,
  input: CreateLotInput
): Promise<ServiceResult<Lot>> {
  try {
    const product = await prisma.product.findUnique({
      where: { tenantKey_id: { tenantKey, id: input.productId } },
    });

    if (!product || product.deletedAt) {
      return { success: false, error: 'Product not found', statusCode: 404 };
    }

    if (product.trackingMode === 'none') {
      return {
        success: false,
        error: 'Product does not require lot tracking',
        statusCode: 400,
      };
    }

    const idResult = await allocateId(tenantKey, 'lot');
    if (!idResult.success || idResult.data === undefined) {
      return { success: false, error: 'Failed to allocate ID', statusCode: 500 };
    }

    const lot = await prisma.lot.create({
      data: {
        tenantKey,
        id: idResult.data,
        productId: input.productId,
        supplierLotNo: input.supplierLotNo,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : null,
        producedAt: input.producedAt ? new Date(input.producedAt) : null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        status: input.status,
      },
    });

    return { success: true, data: toLot(lot) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to create lot: ${message}`, statusCode: 500 };
  }
}

export async function getLot(
  tenantKey: string,
  lotId: number
): Promise<ServiceResult<Lot>> {
  try {
    const lot = await prisma.lot.findUnique({
      where: { tenantKey_id: { tenantKey, id: lotId } },
    });

    if (!lot) {
      return { success: false, error: 'Lot not found', statusCode: 404 };
    }

    return { success: true, data: toLot(lot) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to get lot: ${message}`, statusCode: 500 };
  }
}

export async function listLots(
  tenantKey: string,
  pagination: PaginationInput,
  filters?: { productId?: number; status?: LotStatus; expiringWithinDays?: number }
): Promise<ServiceResult<PaginatedResult<Lot>>> {
  try {
    const expiryThreshold = filters?.expiringWithinDays
      ? new Date(Date.now() + filters.expiringWithinDays * 24 * 60 * 60 * 1000)
      : null;

    const where = {
      tenantKey,
      ...(filters?.productId && { productId: filters.productId }),
      ...(filters?.status && { status: filters.status }),
      ...(expiryThreshold && {
        expiresAt: { lte: expiryThreshold, gt: new Date() },
        status: 'available',
      }),
    };

    const [lots, total] = await Promise.all([
      prisma.lot.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lot.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items: lots.map(toLot),
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to list lots: ${message}`, statusCode: 500 };
  }
}

export async function updateLot(
  tenantKey: string,
  lotId: number,
  input: UpdateLotInput
): Promise<ServiceResult<Lot>> {
  try {
    const existing = await prisma.lot.findUnique({
      where: { tenantKey_id: { tenantKey, id: lotId } },
    });

    if (!existing) {
      return { success: false, error: 'Lot not found', statusCode: 404 };
    }

    const lot = await prisma.lot.update({
      where: { tenantKey_id: { tenantKey, id: lotId } },
      data: {
        ...(input.supplierLotNo !== undefined && { supplierLotNo: input.supplierLotNo }),
        ...(input.expiresAt !== undefined && {
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        }),
        ...(input.status !== undefined && { status: input.status }),
      },
    });

    return { success: true, data: toLot(lot) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to update lot: ${message}`, statusCode: 500 };
  }
}

export async function getLotsForPicking(
  tenantKey: string,
  productId: number,
  locationId: number,
  quantity: number
): Promise<ServiceResult<Array<{ lotId: number; quantity: number }>>> {
  try {
    const product = await prisma.product.findUnique({
      where: { tenantKey_id: { tenantKey, id: productId } },
    });

    if (!product || product.deletedAt) {
      return { success: false, error: 'Product not found', statusCode: 404 };
    }

    const orderBy =
      product.pickingRule === 'FEFO'
        ? { lot: { expiresAt: 'asc' as const } }
        : { lot: { receivedAt: 'asc' as const } };

    const balances = await prisma.stockBalance.findMany({
      where: {
        tenantKey,
        productId,
        locationId,
        onHand: { gt: 0 },
        lot: {
          status: 'available',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      },
      include: { lot: true },
      orderBy,
    });

    const picks: Array<{ lotId: number; quantity: number }> = [];
    let remaining = quantity;

    for (const balance of balances) {
      if (remaining <= 0) break;
      if (!balance.lotId) continue;

      const available = balance.onHand.toNumber() - balance.reserved.toNumber();
      if (available <= 0) continue;

      const pickQty = Math.min(available, remaining);
      picks.push({ lotId: balance.lotId, quantity: pickQty });
      remaining -= pickQty;
    }

    return { success: true, data: picks };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to get lots for picking: ${message}`, statusCode: 500 };
  }
}
