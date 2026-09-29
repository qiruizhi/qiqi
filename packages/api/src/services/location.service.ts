import { prisma } from '../lib/prisma.js';
import { allocateId } from '../lib/id-counter.js';
import type { ServiceResult, PaginatedResult, LocationType } from '@davall/shared';
import type {
  CreateLocationInput,
  UpdateLocationInput,
  PaginationInput,
} from '@davall/shared';

interface Location {
  id: number;
  tenantKey: string;
  warehouseId: number;
  name: string;
  locationType: LocationType;
  createdAt: Date;
  updatedAt: Date;
}

function toLocation(record: {
  id: number;
  tenantKey: string;
  warehouseId: number;
  name: string;
  locationType: string;
  createdAt: Date;
  updatedAt: Date;
}): Location {
  return {
    ...record,
    locationType: record.locationType as LocationType,
  };
}

export async function createLocation(
  tenantKey: string,
  input: CreateLocationInput
): Promise<ServiceResult<Location>> {
  try {
    const warehouse = await prisma.warehouse.findUnique({
      where: { tenantKey_id: { tenantKey, id: input.warehouseId } },
    });

    if (!warehouse || warehouse.deletedAt) {
      return { success: false, error: 'Warehouse not found', statusCode: 404 };
    }

    const idResult = await allocateId(tenantKey, 'location');
    if (!idResult.success || idResult.data === undefined) {
      return { success: false, error: 'Failed to allocate ID', statusCode: 500 };
    }

    const location = await prisma.location.create({
      data: {
        tenantKey,
        id: idResult.data,
        warehouseId: input.warehouseId,
        name: input.name,
        locationType: input.locationType,
      },
    });

    return { success: true, data: toLocation(location) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to create location: ${message}`, statusCode: 500 };
  }
}

export async function getLocation(
  tenantKey: string,
  locationId: number
): Promise<ServiceResult<Location>> {
  try {
    const location = await prisma.location.findUnique({
      where: { tenantKey_id: { tenantKey, id: locationId } },
    });

    if (!location || location.deletedAt) {
      return { success: false, error: 'Location not found', statusCode: 404 };
    }

    return { success: true, data: toLocation(location) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to get location: ${message}`, statusCode: 500 };
  }
}

export async function listLocations(
  tenantKey: string,
  pagination: PaginationInput,
  filters?: { warehouseId?: number; locationType?: LocationType }
): Promise<ServiceResult<PaginatedResult<Location>>> {
  try {
    const where = {
      tenantKey,
      deletedAt: null,
      ...(filters?.warehouseId && { warehouseId: filters.warehouseId }),
      ...(filters?.locationType && { locationType: filters.locationType }),
    };

    const [locations, total] = await Promise.all([
      prisma.location.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { name: 'asc' },
      }),
      prisma.location.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items: locations.map(toLocation),
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to list locations: ${message}`, statusCode: 500 };
  }
}

export async function updateLocation(
  tenantKey: string,
  locationId: number,
  input: UpdateLocationInput
): Promise<ServiceResult<Location>> {
  try {
    const existing = await prisma.location.findUnique({
      where: { tenantKey_id: { tenantKey, id: locationId } },
    });

    if (!existing || existing.deletedAt) {
      return { success: false, error: 'Location not found', statusCode: 404 };
    }

    const location = await prisma.location.update({
      where: { tenantKey_id: { tenantKey, id: locationId } },
      data: input,
    });

    return { success: true, data: toLocation(location) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to update location: ${message}`, statusCode: 500 };
  }
}

export async function deleteLocation(
  tenantKey: string,
  locationId: number
): Promise<ServiceResult<void>> {
  try {
    const existing = await prisma.location.findUnique({
      where: { tenantKey_id: { tenantKey, id: locationId } },
    });

    if (!existing || existing.deletedAt) {
      return { success: false, error: 'Location not found', statusCode: 404 };
    }

    const hasStock = await prisma.stockBalance.findFirst({
      where: { tenantKey, locationId, onHand: { not: 0 } },
    });

    if (hasStock) {
      return {
        success: false,
        error: 'Cannot delete location with stock',
        statusCode: 400,
      };
    }

    await prisma.location.update({
      where: { tenantKey_id: { tenantKey, id: locationId } },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to delete location: ${message}`, statusCode: 500 };
  }
}
