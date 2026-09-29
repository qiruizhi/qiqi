import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { allocateId, allocateIds, getCurrentCounter } from '../lib/id-counter.js';

const prisma = new PrismaClient();
const TEST_TENANT = 'TEST';

describe('IdCounter', () => {
  beforeAll(async () => {
    await prisma.tenant.upsert({
      where: { tenantKey: TEST_TENANT },
      update: {},
      create: {
        tenantKey: TEST_TENANT,
        name: 'Test Tenant',
        settings: {},
      },
    });
  });

  afterAll(async () => {
    await prisma.idCounter.deleteMany({ where: { tenantKey: TEST_TENANT } });
    await prisma.tenant.delete({ where: { tenantKey: TEST_TENANT } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.idCounter.deleteMany({ where: { tenantKey: TEST_TENANT } });
  });

  describe('allocateId', () => {
    it('should allocate the first ID as 1', async () => {
      const result = await allocateId(TEST_TENANT, 'product');
      expect(result.success).toBe(true);
      expect(result.data).toBe(1);
    });

    it('should allocate sequential IDs', async () => {
      const result1 = await allocateId(TEST_TENANT, 'product');
      const result2 = await allocateId(TEST_TENANT, 'product');
      const result3 = await allocateId(TEST_TENANT, 'product');

      expect(result1.data).toBe(1);
      expect(result2.data).toBe(2);
      expect(result3.data).toBe(3);
    });

    it('should allocate IDs separately per entity', async () => {
      const product1 = await allocateId(TEST_TENANT, 'product');
      const warehouse1 = await allocateId(TEST_TENANT, 'warehouse');
      const product2 = await allocateId(TEST_TENANT, 'product');

      expect(product1.data).toBe(1);
      expect(warehouse1.data).toBe(1);
      expect(product2.data).toBe(2);
    });
  });

  describe('allocateIds (batch)', () => {
    it('should allocate multiple IDs at once', async () => {
      const result = await allocateIds(TEST_TENANT, 'product', 5);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3, 4, 5]);
    });

    it('should continue sequence after batch allocation', async () => {
      await allocateIds(TEST_TENANT, 'product', 3);
      const single = await allocateId(TEST_TENANT, 'product');

      expect(single.data).toBe(4);
    });

    it('should return empty array for count 0', async () => {
      const result = await allocateIds(TEST_TENANT, 'product', 0);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('concurrency', () => {
    it('should not produce duplicate IDs under concurrent allocation', async () => {
      const promises = Array.from({ length: 100 }, () =>
        allocateId(TEST_TENANT, 'product')
      );

      const results = await Promise.all(promises);
      const ids = results
        .filter((r) => r.success)
        .map((r) => r.data as number);

      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(100);
      expect(Math.min(...ids)).toBe(1);
      expect(Math.max(...ids)).toBe(100);
    });

    it('should not produce gaps under concurrent allocation', async () => {
      const promises = Array.from({ length: 50 }, () =>
        allocateId(TEST_TENANT, 'warehouse')
      );

      const results = await Promise.all(promises);
      const ids = results
        .filter((r) => r.success)
        .map((r) => r.data as number)
        .sort((a, b) => a - b);

      for (let i = 0; i < ids.length; i++) {
        expect(ids[i]).toBe(i + 1);
      }
    });
  });

  describe('getCurrentCounter', () => {
    it('should return 1 for non-existent counter', async () => {
      const result = await getCurrentCounter(TEST_TENANT, 'lot');
      expect(result.success).toBe(true);
      expect(result.data).toBe(1);
    });

    it('should return correct next value after allocations', async () => {
      await allocateId(TEST_TENANT, 'product');
      await allocateId(TEST_TENANT, 'product');
      await allocateId(TEST_TENANT, 'product');

      const result = await getCurrentCounter(TEST_TENANT, 'product');
      expect(result.success).toBe(true);
      expect(result.data).toBe(4);
    });
  });
});
