'use client';

import { useEffect, useState } from 'react';
import { Package, Warehouse, ClipboardList, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { productsApi, warehousesApi, stockApi } from '@/lib/api';

interface Stats {
  totalProducts: number;
  totalWarehouses: number;
  totalStock: number;
  lowStockItems: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0,
    totalWarehouses: 0,
    totalStock: 0,
    lowStockItems: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [productsRes, warehousesRes, stockRes] = await Promise.all([
          productsApi.list({ pageSize: 1 }),
          warehousesApi.list({ pageSize: 1 }),
          stockApi.balances({ pageSize: 1, hasStock: true }),
        ]);

        setStats({
          totalProducts: (productsRes as any).data.total || 0,
          totalWarehouses: (warehousesRes as any).data.total || 0,
          totalStock: (stockRes as any).data.total || 0,
          lowStockItems: 0,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const cards = [
    {
      title: '產品總數',
      value: stats.totalProducts,
      icon: Package,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      title: '倉庫',
      value: stats.totalWarehouses,
      icon: Warehouse,
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    {
      title: '庫存記錄',
      value: stats.totalStock,
      icon: ClipboardList,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
    },
    {
      title: '低庫存警示',
      value: stats.lowStockItems,
      icon: AlertTriangle,
      color: 'text-orange-600',
      bg: 'bg-orange-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">儀表板</h1>
        <p className="text-muted-foreground">歡迎使用 Davall Limit ERP 系統</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`rounded-md p-2 ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '...' : card.value.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>快速操作</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <a
              href="/products/new"
              className="flex items-center gap-2 rounded-md border p-3 hover:bg-muted"
            >
              <Package className="h-5 w-5 text-muted-foreground" />
              <span>新增產品</span>
            </a>
            <a
              href="/stock/movements"
              className="flex items-center gap-2 rounded-md border p-3 hover:bg-muted"
            >
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
              <span>庫存異動</span>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>系統資訊</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">版本</span>
              <span>0.1.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">租戶</span>
              <span>ATC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">時區</span>
              <span>Asia/Taipei</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
