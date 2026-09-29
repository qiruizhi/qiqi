import { prisma } from './prisma.js';
import type { ServiceResult } from '@davall/shared';

export type EntityType =
  | 'user'
  | 'product'
  | 'warehouse'
  | 'location'
  | 'lot'
  | 'lot_genealogy'
  | 'stock_balance'
  | 'stock_entry'
  | 'refresh_token'
  | 'token_blacklist'
  | 'audit_log';

export async function allocateId(
  tenantKey: string,
  entity: EntityType
): Promise<ServiceResult<number>> {
  try {
    const result = await prisma.$queryRaw<{ next_value: number }[]>`
      INSERT INTO id_counters (tenant_key, entity, next_value)
      VALUES (${tenantKey}, ${entity}, 2)
      ON CONFLICT (tenant_key, entity)
      DO UPDATE SET next_value = id_counters.next_value + 1
      RETURNING next_value - 1 as next_value
    `;

    if (!result || result.length === 0) {
      return { success: false, error: 'Failed to allocate ID', statusCode: 500 };
    }

    return { success: true, data: result[0].next_value };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to allocate ID: ${message}`, statusCode: 500 };
  }
}

export async function allocateIds(
  tenantKey: string,
  entity: EntityType,
  count: number
): Promise<ServiceResult<number[]>> {
  if (count <= 0) {
    return { success: true, data: [] };
  }

  try {
    const result = await prisma.$queryRaw<{ next_value: number }[]>`
      INSERT INTO id_counters (tenant_key, entity, next_value)
      VALUES (${tenantKey}, ${entity}, ${count + 1})
      ON CONFLICT (tenant_key, entity)
      DO UPDATE SET next_value = id_counters.next_value + ${count}
      RETURNING next_value - ${count} as next_value
    `;

    if (!result || result.length === 0) {
      return { success: false, error: 'Failed to allocate IDs', statusCode: 500 };
    }

    const startId = result[0].next_value;
    const ids = Array.from({ length: count }, (_, i) => startId + i);
    return { success: true, data: ids };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to allocate IDs: ${message}`, statusCode: 500 };
  }
}

export async function getCurrentCounter(
  tenantKey: string,
  entity: EntityType
): Promise<ServiceResult<number>> {
  try {
    const counter = await prisma.idCounter.findUnique({
      where: { tenantKey_entity: { tenantKey, entity } },
    });

    return { success: true, data: counter?.nextValue ?? 1 };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to get counter: ${message}`, statusCode: 500 };
  }
}
