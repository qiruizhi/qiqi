import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const tenantKey = 'ATC';
  const passwordHash = await bcrypt.hash('AdminPassword123!', 12);

  await prisma.tenant.upsert({
    where: { tenantKey },
    update: {},
    create: {
      tenantKey,
      name: '亞泰汽車零件有限公司 (ATC Auto Parts Co., Ltd.)',
      taxId: '12345678',
      baseCurrency: 'TWD',
      timeZone: 'Asia/Taipei',
      defaultLanguage: 'zh-TW',
      status: 'active',
      settings: {
        overProductionPercent: 10,
        overReceiptPercent: 5,
        priceTolerancePercent: 2,
        poApprovalThreshold: 100000,
        defaultPaymentTermsDays: 30,
        defaultTaxPercent: 5,
        expiryWarningDays: 30,
        attendanceGraceMinutes: 5,
        reportFileRetentionDays: 7,
      },
    },
  });

  const entities = [
    'user', 'product', 'warehouse', 'location', 'lot', 'lot_genealogy',
    'stock_balance', 'stock_entry', 'refresh_token', 'token_blacklist', 'audit_log',
  ];

  for (const entity of entities) {
    await prisma.idCounter.upsert({
      where: { tenantKey_entity: { tenantKey, entity } },
      update: {},
      create: { tenantKey, entity, nextValue: 1 },
    });
  }

  await prisma.idCounter.update({
    where: { tenantKey_entity: { tenantKey, entity: 'user' } },
    data: { nextValue: 5 },
  });

  const users = [
    { id: 1, email: 'admin@atc.com.tw', name: '系統管理員', role: 'admin' },
    { id: 2, email: 'manager@atc.com.tw', name: '廠長 陳先生', role: 'manager' },
    { id: 3, email: 'supervisor@atc.com.tw', name: '生產主管 林先生', role: 'staff' },
    { id: 4, email: 'qc@atc.com.tw', name: 'QC 主管 王小姐', role: 'staff' },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { tenantKey_id: { tenantKey, id: user.id } },
      update: {},
      create: {
        tenantKey,
        id: user.id,
        email: user.email,
        name: user.name,
        passwordHash,
        role: user.role,
        status: 'active',
        language: 'zh-TW',
      },
    });
  }

  await prisma.idCounter.update({
    where: { tenantKey_entity: { tenantKey, entity: 'warehouse' } },
    data: { nextValue: 2 },
  });

  await prisma.warehouse.upsert({
    where: { tenantKey_id: { tenantKey, id: 1 } },
    update: {},
    create: {
      tenantKey,
      id: 1,
      name: '彰化主廠',
    },
  });

  const locations = [
    { id: 1, name: '收貨區', locationType: 'receiving' },
    { id: 2, name: '原料倉', locationType: 'storage' },
    { id: 3, name: '生產線側', locationType: 'production' },
    { id: 4, name: '品管待檢區', locationType: 'qc_hold' },
    { id: 5, name: '成品倉', locationType: 'storage' },
    { id: 6, name: '出貨區', locationType: 'shipping' },
    { id: 7, name: '報廢區', locationType: 'scrap' },
  ];

  await prisma.idCounter.update({
    where: { tenantKey_entity: { tenantKey, entity: 'location' } },
    data: { nextValue: locations.length + 1 },
  });

  for (const loc of locations) {
    await prisma.location.upsert({
      where: { tenantKey_id: { tenantKey, id: loc.id } },
      update: {},
      create: {
        tenantKey,
        id: loc.id,
        warehouseId: 1,
        name: loc.name,
        locationType: loc.locationType,
      },
    });
  }

  const products = [
    {
      id: 1,
      name: '引擎油封墊片 A-101',
      itemType: 'finished_good',
      uom: 'pcs',
      canSell: true,
      canManufacture: true,
      trackingMode: 'lot',
      hasShelfLife: false,
      pickingRule: 'FIFO',
      reorderPoint: 500,
      safetyStock: 100,
    },
    {
      id: 2,
      name: '引擎油封墊片 A-102',
      itemType: 'finished_good',
      uom: 'pcs',
      canSell: true,
      canManufacture: true,
      trackingMode: 'lot',
      hasShelfLife: false,
      pickingRule: 'FIFO',
      reorderPoint: 300,
      safetyStock: 50,
    },
    {
      id: 3,
      name: '變速箱墊片組 B-201',
      itemType: 'finished_good',
      uom: 'set',
      canSell: true,
      canManufacture: true,
      trackingMode: 'lot',
      hasShelfLife: false,
      pickingRule: 'FIFO',
      reorderPoint: 100,
      safetyStock: 20,
    },
    {
      id: 4,
      name: 'NBR 橡膠原料',
      itemType: 'raw_material',
      uom: 'kg',
      canPurchase: true,
      trackingMode: 'lot',
      hasShelfLife: true,
      shelfLifeDays: 365,
      pickingRule: 'FEFO',
      reorderPoint: 200,
      safetyStock: 50,
      requiresIncomingInspection: true,
    },
    {
      id: 5,
      name: 'FKM 氟橡膠原料',
      itemType: 'raw_material',
      uom: 'kg',
      canPurchase: true,
      trackingMode: 'lot',
      hasShelfLife: true,
      shelfLifeDays: 180,
      pickingRule: 'FEFO',
      reorderPoint: 100,
      safetyStock: 20,
      requiresIncomingInspection: true,
    },
    {
      id: 6,
      name: '金屬衝壓件 M-001',
      itemType: 'raw_material',
      uom: 'pcs',
      canPurchase: true,
      trackingMode: 'lot',
      hasShelfLife: false,
      pickingRule: 'FIFO',
      reorderPoint: 1000,
      safetyStock: 200,
    },
    {
      id: 7,
      name: '硫化劑',
      itemType: 'consumable',
      uom: 'kg',
      canPurchase: true,
      trackingMode: 'lot',
      hasShelfLife: true,
      shelfLifeDays: 180,
      pickingRule: 'FEFO',
      reorderPoint: 20,
      safetyStock: 5,
    },
    {
      id: 8,
      name: '脫模劑',
      itemType: 'consumable',
      uom: 'L',
      canPurchase: true,
      trackingMode: 'none',
      hasShelfLife: false,
      pickingRule: 'FIFO',
      reorderPoint: 10,
      safetyStock: 2,
    },
    {
      id: 9,
      name: '模具 #A101',
      itemType: 'spare',
      uom: 'pcs',
      canPurchase: true,
      trackingMode: 'serial',
      hasShelfLife: false,
      pickingRule: 'FIFO',
      reorderPoint: 0,
      safetyStock: 0,
    },
    {
      id: 10,
      name: '半成品 - 硫化後 A-101',
      itemType: 'wip',
      uom: 'pcs',
      canManufacture: true,
      trackingMode: 'lot',
      hasShelfLife: false,
      pickingRule: 'FIFO',
      reorderPoint: 0,
      safetyStock: 0,
    },
  ];

  await prisma.idCounter.update({
    where: { tenantKey_entity: { tenantKey, entity: 'product' } },
    data: { nextValue: products.length + 1 },
  });

  for (const product of products) {
    await prisma.product.upsert({
      where: { tenantKey_id: { tenantKey, id: product.id } },
      update: {},
      create: {
        tenantKey,
        id: product.id,
        name: product.name,
        itemType: product.itemType,
        uom: product.uom,
        canPurchase: product.canPurchase ?? false,
        canSell: product.canSell ?? false,
        canManufacture: product.canManufacture ?? false,
        isStocked: true,
        trackingMode: product.trackingMode,
        hasShelfLife: product.hasShelfLife,
        shelfLifeDays: product.shelfLifeDays,
        pickingRule: product.pickingRule,
        requiresIncomingInspection: product.requiresIncomingInspection ?? false,
        reorderPoint: product.reorderPoint,
        safetyStock: product.safetyStock,
        costingMethod: 'moving_average',
      },
    });
  }

  const lots = [
    { id: 1, productId: 4, supplierLotNo: 'SUP-2026-001', status: 'available', receivedAt: new Date('2026-09-01'), expiresAt: new Date('2027-09-01') },
    { id: 2, productId: 4, supplierLotNo: 'SUP-2026-002', status: 'available', receivedAt: new Date('2026-09-15'), expiresAt: new Date('2027-09-15') },
    { id: 3, productId: 5, supplierLotNo: 'FKM-2026-001', status: 'available', receivedAt: new Date('2026-09-10'), expiresAt: new Date('2027-03-10') },
    { id: 4, productId: 1, status: 'available', producedAt: new Date('2026-09-20') },
    { id: 5, productId: 1, status: 'available', producedAt: new Date('2026-09-25') },
    { id: 6, productId: 2, status: 'available', producedAt: new Date('2026-09-22') },
    { id: 7, productId: 6, supplierLotNo: 'MTL-2026-100', status: 'available', receivedAt: new Date('2026-09-05') },
  ];

  await prisma.idCounter.update({
    where: { tenantKey_entity: { tenantKey, entity: 'lot' } },
    data: { nextValue: lots.length + 1 },
  });

  for (const lot of lots) {
    await prisma.lot.upsert({
      where: { tenantKey_id: { tenantKey, id: lot.id } },
      update: {},
      create: {
        tenantKey,
        id: lot.id,
        productId: lot.productId,
        supplierLotNo: lot.supplierLotNo,
        status: lot.status,
        receivedAt: lot.receivedAt,
        producedAt: lot.producedAt,
        expiresAt: lot.expiresAt,
      },
    });
  }

  const balances = [
    { id: 1, productId: 4, lotId: 1, locationId: 2, onHand: 150 },
    { id: 2, productId: 4, lotId: 2, locationId: 2, onHand: 200 },
    { id: 3, productId: 5, lotId: 3, locationId: 2, onHand: 80 },
    { id: 4, productId: 1, lotId: 4, locationId: 5, onHand: 800 },
    { id: 5, productId: 1, lotId: 5, locationId: 5, onHand: 600 },
    { id: 6, productId: 2, lotId: 6, locationId: 5, onHand: 450 },
    { id: 7, productId: 6, lotId: 7, locationId: 2, onHand: 2500 },
  ];

  await prisma.idCounter.update({
    where: { tenantKey_entity: { tenantKey, entity: 'stock_balance' } },
    data: { nextValue: balances.length + 1 },
  });

  for (const balance of balances) {
    await prisma.stockBalance.upsert({
      where: { tenantKey_id: { tenantKey, id: balance.id } },
      update: {},
      create: {
        tenantKey,
        id: balance.id,
        productId: balance.productId,
        lotId: balance.lotId,
        locationId: balance.locationId,
        onHand: balance.onHand,
        reserved: 0,
      },
    });
  }

  await prisma.product.update({
    where: { tenantKey_id: { tenantKey, id: 4 } },
    data: { stockQuantity: 350, averageCost: 18000 },
  });

  await prisma.product.update({
    where: { tenantKey_id: { tenantKey, id: 5 } },
    data: { stockQuantity: 80, averageCost: 85000 },
  });

  await prisma.product.update({
    where: { tenantKey_id: { tenantKey, id: 1 } },
    data: { stockQuantity: 1400, averageCost: 4500 },
  });

  await prisma.product.update({
    where: { tenantKey_id: { tenantKey, id: 2 } },
    data: { stockQuantity: 450, averageCost: 5200 },
  });

  await prisma.product.update({
    where: { tenantKey_id: { tenantKey, id: 6 } },
    data: { stockQuantity: 2500, averageCost: 1200 },
  });

  console.log('Seed completed successfully!');
  console.log('');
  console.log('Demo tenant: ATC');
  console.log('Admin login: admin@atc.com.tw / AdminPassword123!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
