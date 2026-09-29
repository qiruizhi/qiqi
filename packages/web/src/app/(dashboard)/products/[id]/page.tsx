'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { productsApi, stockApi } from '@/lib/api';

interface Product {
  id: number;
  tenantKey: string;
  fullId: string;
  name: string;
  itemType: string;
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
  createdAt: string;
  updatedAt: string;
}

interface StockBalance {
  id: number;
  productId: number;
  lotId: number | null;
  locationId: number;
  onHand: number;
  reserved: number;
  available: number;
}

const itemTypeLabels: Record<string, string> = {
  finished_good: '成品',
  raw_material: '原料',
  consumable: '耗材',
  spare: '備品',
  wip: '在製品',
};

const trackingModeLabels: Record<string, string> = {
  none: '無',
  lot: '批次',
  serial: '序號',
};

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = Number(params.id);

  const [product, setProduct] = useState<Product | null>(null);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productRes, balancesRes] = await Promise.all([
          productsApi.get(productId),
          stockApi.balances({ productId, hasStock: true }),
        ]);
        setProduct((productRes as any).data);
        setBalances((balancesRes as any).data.items || []);
      } catch (error) {
        console.error('Failed to fetch product:', error);
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchData();
    }
  }, [productId]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">載入中...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <p className="mb-4 text-muted-foreground">找不到產品</p>
        <Link href="/products">
          <Button variant="outline">返回產品列表</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/products">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <p className="text-muted-foreground">{product.fullId}</p>
        </div>
        <Button variant="outline">
          <Edit className="mr-2 h-4 w-4" />
          編輯
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>基本資訊</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">物料類型</p>
                <Badge variant="secondary">
                  {itemTypeLabels[product.itemType] || product.itemType}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">單位</p>
                <p className="font-medium">{product.uom}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">追蹤模式</p>
                <p className="font-medium">
                  {trackingModeLabels[product.trackingMode] || product.trackingMode}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">揀貨規則</p>
                <p className="font-medium">{product.pickingRule}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm text-muted-foreground">功能屬性</p>
              <div className="flex flex-wrap gap-2">
                {product.canPurchase && <Badge>可採購</Badge>}
                {product.canSell && <Badge>可銷售</Badge>}
                {product.canManufacture && <Badge>可生產</Badge>}
                {product.isStocked && <Badge variant="outline">列入庫存</Badge>}
                {product.hasShelfLife && (
                  <Badge variant="warning">有效期 ({product.shelfLifeDays} 天)</Badge>
                )}
                {product.requiresIncomingInspection && (
                  <Badge variant="outline">需進料檢驗</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>庫存與計劃</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">現有庫存</p>
                <p
                  className={`text-2xl font-bold ${
                    product.stockQuantity < product.reorderPoint ? 'text-destructive' : ''
                  }`}
                >
                  {product.stockQuantity.toLocaleString()} {product.uom}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">平均成本</p>
                <p className="text-2xl font-bold">
                  {(product.averageCost / 100).toLocaleString('zh-TW', {
                    style: 'currency',
                    currency: 'TWD',
                    minimumFractionDigits: 0,
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">再訂購點</p>
                <p className="font-medium">{product.reorderPoint.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">安全庫存</p>
                <p className="font-medium">{product.safetyStock.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">最小庫存</p>
                <p className="font-medium">{product.minStockLevel.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">最大庫存</p>
                <p className="font-medium">
                  {product.maxStockLevel?.toLocaleString() || '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>庫存分布</CardTitle>
          </CardHeader>
          <CardContent>
            {balances.length === 0 ? (
              <p className="py-4 text-center text-muted-foreground">暫無庫存記錄</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-sm text-muted-foreground">
                      <th className="pb-2 text-left font-medium">儲位</th>
                      <th className="pb-2 text-left font-medium">批次</th>
                      <th className="pb-2 text-right font-medium">現有</th>
                      <th className="pb-2 text-right font-medium">預留</th>
                      <th className="pb-2 text-right font-medium">可用</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((balance) => (
                      <tr key={balance.id} className="border-b">
                        <td className="py-2">儲位 #{balance.locationId}</td>
                        <td className="py-2">
                          {balance.lotId ? `批次 #${balance.lotId}` : '-'}
                        </td>
                        <td className="py-2 text-right">{balance.onHand.toLocaleString()}</td>
                        <td className="py-2 text-right">{balance.reserved.toLocaleString()}</td>
                        <td className="py-2 text-right font-medium">
                          {balance.available.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
