import { prisma } from '../lib/prisma.js';
import { allocateId } from '../lib/id-counter.js';
import type { ServiceResult, PaginatedResult } from '@davall/shared';
import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  PaginationInput,
} from '@davall/shared';

interface Warehouse {
  id: number;
  tenantKey: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function createWarehouse(
  tenantKey: string,
  input: CreateWarehouseInput
): Promise<ServiceResult<Warehouse>> {
  try {
    const idResult = await allocateId(tenantKey, 'warehouse');
    if (!idResult.success || idResult.data === undefined) {
      return { success: false, error: 'Failed to allocate ID', statusCode: 500 };
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        tenantKey,
        id: idResult.data,
        name: input.name,
      },
    });

    return { success: true, data: warehouse };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to create warehouse: ${message}`, statusCode: 500 };
  }
}

export async function getWarehouse(
  tenantKey: string,
  warehouseId: number
): Promise<ServiceResult<Warehouse>> {
  try {
    const warehouse = await prisma.warehouse.findUnique({
      where: { tenantKey_id: { tenantKey, id: warehouseId } },
    });

    if (!warehouse || warehouse.deletedAt) {
      return { success: false, error: 'Warehouse not found', statusCode: 404 };
    }

    return { success: true, data: warehouse };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to get warehouse: ${message}`, statusCode: 500 };
  }
}

export async function listWarehouses(
  tenantKey: string,
  pagination: PaginationInput
): Promise<ServiceResult<PaginatedResult<Warehouse>>> {
  try {
    const where = { tenantKey, deletedAt: null };

    const [warehouses, total] = await Promise.all([
      prisma.warehouse.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { name: 'asc' },
      }),
      prisma.warehouse.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items: warehouses,
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to list warehouses: ${message}`, statusCode: 500 };
  }
}

export async function updateWarehouse(
  tenantKey: string,
  warehouseId: number,
  input: UpdateWarehouseInput
): Promise<ServiceResult<Warehouse>> {
  try {
    const existing = await prisma.warehouse.findUnique({
      where: { tenantKey_id: { tenantKey, id: warehouseId } },
    });

    if (!existing || existing.deletedAt) {
      return { success: false, error: 'Warehouse not found', statusCode: 404 };
    }

    const warehouse = await prisma.warehouse.update({
      where: { tenantKey_id: { tenantKey, id: warehouseId } },
      data: input,
    });

    return { success: true, data: warehouse };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to update warehouse: ${message}`, statusCode: 500 };
  }
}

export async function deleteWarehouse(
  tenantKey: string,
  warehouseId: number
): Promise<ServiceResult<void>> {
  try {
    const existing = await prisma.warehouse.findUnique({
      where: { tenantKey_id: { tenantKey, id: warehouseId } },
    });

    if (!existing || existing.deletedAt) {
      return { success: false, error: 'Warehouse not found', statusCode: 404 };
    }

    const hasLocations = await prisma.location.findFirst({
      where: { tenantKey, warehouseId, deletedAt: null },
    });

    if (hasLocations) {
      return {
        success: false,
        error: 'Cannot delete warehouse with locations',
        statusCode: 400,
      };
    }

    await prisma.warehouse.update({
      where: { tenantKey_id: { tenantKey, id: warehouseId } },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to delete warehouse: ${message}`, statusCode: 500 };
  }
}
