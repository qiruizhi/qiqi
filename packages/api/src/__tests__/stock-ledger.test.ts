import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import * as stockService from '../services/stock.service.js';
import { allocateId } from '../lib/id-counter.js';

const prisma = new PrismaClient();
const TEST_TENANT = 'STKTEST';

describe('Stock Ledger', () => {
  let productId: number;
  let locationId: number;
  let lotId: number;
  let userId: number;

  beforeAll(async () => {
    await prisma.tenant.upsert({
      where: { tenantKey: TEST_TENANT },
      update: {},
      create: {
        tenantKey: TEST_TENANT,
        name: 'Stock Test Tenant',
        settings: {},
      },
    });

    const userIdResult = await allocateId(TEST_TENANT, 'user');
    userId = userIdResult.data!;

    await prisma.user.create({
      data: {
        tenantKey: TEST_TENANT,
        id: userId,
        email: 'test@test.com',
        name: 'Test User',
        role: 'admin',
        status: 'active',
      },
    });

    const warehouseIdResult = await allocateId(TEST_TENANT, 'warehouse');
    await prisma.warehouse.create({
      data: {
        tenantKey: TEST_TENANT,
        id: warehouseIdResult.data!,
        name: 'Test Warehouse',
      },
    });

    const locationIdResult = await allocateId(TEST_TENANT, 'location');
    locationId = locationIdResult.data!;
    await prisma.location.create({
      data: {
        tenantKey: TEST_TENANT,
        id: locationId,
        warehouseId: warehouseIdResult.data!,
        name: 'Test Location',
        locationType: 'storage',
      },
    });

    const productIdResult = await allocateId(TEST_TENANT, 'product');
    productId = productIdResult.data!;
    await prisma.product.create({
      data: {
        tenantKey: TEST_TENANT,
        id: productId,
        name: 'Test Product',
        itemType: 'raw_material',
        uom: 'kg',
        trackingMode: 'lot',
      },
    });

    const lotIdResult = await allocateId(TEST_TENANT, 'lot');
    lotId = lotIdResult.data!;
    await prisma.lot.create({
      data: {
        tenantKey: TEST_TENANT,
        id: lotId,
        productId: productId,
        status: 'available',
      },
    });
  });

  afterAll(async () => {
    await prisma.stockEntry.deleteMany({ where: { tenantKey: TEST_TENANT } });
    await prisma.stockBalance.deleteMany({ where: { tenantKey: TEST_TENANT } });
    await prisma.lot.deleteMany({ where: { tenantKey: TEST_TENANT } });
    await prisma.product.deleteMany({ where: { tenantKey: TEST_TENANT } });
    await prisma.location.deleteMany({ where: { tenantKey: TEST_TENANT } });
    await prisma.warehouse.deleteMany({ where: { tenantKey: TEST_TENANT } });
    await prisma.user.deleteMany({ where: { tenantKey: TEST_TENANT } });
    await prisma.idCounter.deleteMany({ where: { tenantKey: TEST_TENANT } });
    await prisma.tenant.delete({ where: { tenantKey: TEST_TENANT } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.stockEntry.deleteMany({ where: { tenantKey: TEST_TENANT } });
    await prisma.stockBalance.deleteMany({ where: { tenantKey: TEST_TENANT } });
    await prisma.product.update({
      where: { tenantKey_id: { tenantKey: TEST_TENANT, id: productId } },
      data: { stockQuantity: 0 },
    });
  });

  describe('Stock Entry Creation', () => {
    it('should create a receipt entry and update balance', async () => {
      const result = await stockService.createStockEntry(
        TEST_TENANT,
        {
          productId,
          lotId,
          toLocationId: locationId,
          movementType: 'receipt',
          quantity: 100,
        },
        userId
      );

      expect(result.success).toBe(true);
      expect(result.data?.quantity).toBe(100);

      const balanceResult = await stockService.getStockBalance(TEST_TENANT, productId);
      expect(balanceResult.success).toBe(true);
      expect(balanceResult.data?.[0]?.onHand).toBe(100);
    });

    it('should update product stock quantity after receipt', async () => {
      await stockService.createStockEntry(
        TEST_TENANT,
        {
          productId,
          lotId,
          toLocationId: locationId,
          movementType: 'receipt',
          quantity: 50,
        },
        userId
      );

      const product = await prisma.product.findUnique({
        where: { tenantKey_id: { tenantKey: TEST_TENANT, id: productId } },
      });

      expect(product?.stockQuantity.toNumber()).toBe(50);
    });
  });

  describe('Stock Transfer', () => {
    it('should transfer stock between locations', async () => {
      await stockService.createStockEntry(
        TEST_TENANT,
        {
          productId,
          lotId,
          toLocationId: locationId,
          movementType: 'receipt',
          quantity: 100,
        },
        userId
      );

      const location2IdResult = await allocateId(TEST_TENANT, 'location');
      const location2Id = location2IdResult.data!;
      await prisma.location.create({
        data: {
          tenantKey: TEST_TENANT,
          id: location2Id,
          warehouseId: 1,
          name: 'Test Location 2',
          locationType: 'storage',
        },
      });

      const transferResult = await stockService.transferStock(
        TEST_TENANT,
        {
          productId,
          lotId,
          fromLocationId: locationId,
          toLocationId: location2Id,
          quantity: 30,
        },
        userId
      );

      expect(transferResult.success).toBe(true);

      const balances = await stockService.getStockBalance(TEST_TENANT, productId);
      const loc1Balance = balances.data?.find((b) => b.locationId === locationId);
      const loc2Balance = balances.data?.find((b) => b.locationId === location2Id);

      expect(loc1Balance?.onHand).toBe(70);
      expect(loc2Balance?.onHand).toBe(30);
    });
  });

  describe('Stock Adjustment', () => {
    it('should require reason code for adjustment', async () => {
      const result = await stockService.adjustStock(
        TEST_TENANT,
        {
          productId,
          lotId,
          locationId,
          quantity: 10,
          reasonCode: undefined as any,
        },
        userId
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Reason code is required');
    });

    it('should allow positive adjustment with reason', async () => {
      const result = await stockService.adjustStock(
        TEST_TENANT,
        {
          productId,
          lotId,
          locationId,
          quantity: 25,
          reasonCode: 'found',
        },
        userId
      );

      expect(result.success).toBe(true);

      const balance = await stockService.getStockBalance(TEST_TENANT, productId);
      expect(balance.data?.[0]?.onHand).toBe(25);
    });

    it('should allow negative adjustment with reason', async () => {
      await stockService.createStockEntry(
        TEST_TENANT,
        {
          productId,
          lotId,
          toLocationId: locationId,
          movementType: 'receipt',
          quantity: 100,
        },
        userId
      );

      const result = await stockService.adjustStock(
        TEST_TENANT,
        {
          productId,
          lotId,
          locationId,
          quantity: -20,
          reasonCode: 'damaged',
        },
        userId
      );

      expect(result.success).toBe(true);

      const balance = await stockService.getStockBalance(TEST_TENANT, productId);
      expect(balance.data?.[0]?.onHand).toBe(80);
    });
  });

  describe('Stock Invariants', () => {
    it('should not allow negative stock', async () => {
      await stockService.createStockEntry(
        TEST_TENANT,
        {
          productId,
          lotId,
          toLocationId: locationId,
          movementType: 'receipt',
          quantity: 50,
        },
        userId
      );

      const result = await stockService.transferStock(
        TEST_TENANT,
        {
          productId,
          lotId,
          fromLocationId: locationId,
          toLocationId: locationId + 100,
          quantity: 60,
        },
        userId
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient stock');
    });

    it('should maintain balance = sum of entries', async () => {
      await stockService.createStockEntry(
        TEST_TENANT,
        {
          productId,
          lotId,
          toLocationId: locationId,
          movementType: 'receipt',
          quantity: 100,
        },
        userId
      );

      await stockService.adjustStock(
        TEST_TENANT,
        {
          productId,
          lotId,
          locationId,
          quantity: -10,
          reasonCode: 'damaged',
        },
        userId
      );

      await stockService.adjustStock(
        TEST_TENANT,
        {
          productId,
          lotId,
          locationId,
          quantity: 5,
          reasonCode: 'found',
        },
        userId
      );

      const balance = await stockService.getStockBalance(TEST_TENANT, productId);
      expect(balance.data?.[0]?.onHand).toBe(95);

      const entries = await prisma.stockEntry.findMany({
        where: { tenantKey: TEST_TENANT, productId },
      });

      let calculatedBalance = 0;
      for (const entry of entries) {
        if (entry.toLocationId === locationId) {
          calculatedBalance += entry.quantity.toNumber();
        }
        if (entry.fromLocationId === locationId) {
          calculatedBalance -= entry.quantity.toNumber();
        }
      }

      expect(calculatedBalance).toBe(95);
    });
  });

  describe('Reservations', () => {
    it('should reserve stock successfully', async () => {
      await stockService.createStockEntry(
        TEST_TENANT,
        {
          productId,
          lotId,
          toLocationId: locationId,
          movementType: 'receipt',
          quantity: 100,
        },
        userId
      );

      const result = await stockService.reserveStock(
        TEST_TENANT,
        productId,
        locationId,
        lotId,
        30
      );

      expect(result.success).toBe(true);

      const balance = await stockService.getStockBalance(TEST_TENANT, productId);
      expect(balance.data?.[0]?.onHand).toBe(100);
      expect(balance.data?.[0]?.reserved).toBe(30);
      expect(balance.data?.[0]?.available).toBe(70);
    });

    it('should not reserve more than available', async () => {
      await stockService.createStockEntry(
        TEST_TENANT,
        {
          productId,
          lotId,
          toLocationId: locationId,
          movementType: 'receipt',
          quantity: 50,
        },
        userId
      );

      await stockService.reserveStock(TEST_TENANT, productId, locationId, lotId, 30);

      const result = await stockService.reserveStock(
        TEST_TENANT,
        productId,
        locationId,
        lotId,
        30
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient available stock');
    });

    it('should release reservations', async () => {
      await stockService.createStockEntry(
        TEST_TENANT,
        {
          productId,
          lotId,
          toLocationId: locationId,
          movementType: 'receipt',
          quantity: 100,
        },
        userId
      );

      await stockService.reserveStock(TEST_TENANT, productId, locationId, lotId, 50);

      const releaseResult = await stockService.releaseReservation(
        TEST_TENANT,
        productId,
        locationId,
        lotId,
        20
      );

      expect(releaseResult.success).toBe(true);

      const balance = await stockService.getStockBalance(TEST_TENANT, productId);
      expect(balance.data?.[0]?.reserved).toBe(30);
      expect(balance.data?.[0]?.available).toBe(70);
    });
  });
});
