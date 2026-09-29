'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, ArrowRightLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { stockApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

interface StockEntry {
  id: number;
  tenantKey: string;
  fullId: string;
  productId: number;
  lotId: number | null;
  fromLocationId: number | null;
  toLocationId: number | null;
  movementType: string;
  quantity: number;
  unitCost: number | null;
  referenceType: string | null;
  referenceId: number | null;
  reasonCode: string | null;
  createdAt: string;
}

interface PaginatedResult {
  items: StockEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const movementTypeLabels: Record<string, string> = {
  receipt: '收貨',
  issue_to_production: '發料生產',
  production_output: '生產入庫',
  transfer: '調撥',
  adjustment: '調整',
  scrap: '報廢',
  shipment: '出貨',
  return: '退回',
};

const movementTypeColors: Record<string, 'default' | 'secondary' | 'destructive' | 'success' | 'warning'> = {
  receipt: 'success',
  issue_to_production: 'secondary',
  production_output: 'success',
  transfer: 'default',
  adjustment: 'warning',
  scrap: 'destructive',
  shipment: 'secondary',
  return: 'warning',
};

export default function StockPage() {
  const [entries, setEntries] = useState<PaginatedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchEntries = async () => {
      setLoading(true);
      try {
        const response = await stockApi.entries({ page, pageSize: 20 });
        setEntries((response as any).data);
      } catch (error) {
        console.error('Failed to fetch stock entries:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, [page]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">庫存異動</h1>
          <p className="text-muted-foreground">查看所有庫存異動記錄</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            庫存調撥
          </Button>
          <Button>
            <ClipboardList className="mr-2 h-4 w-4" />
            庫存調整
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>異動記錄</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">載入中...</div>
          ) : !entries?.items.length ? (
            <div className="flex flex-col items-center justify-center py-12">
              <ClipboardList className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">尚無異動記錄</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>單號</TableHead>
                      <TableHead>類型</TableHead>
                      <TableHead>產品</TableHead>
                      <TableHead>批次</TableHead>
                      <TableHead className="text-right">數量</TableHead>
                      <TableHead>來源/目的</TableHead>
                      <TableHead>時間</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.items.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.fullId}</TableCell>
                        <TableCell>
                          <Badge variant={movementTypeColors[entry.movementType] || 'default'}>
                            {movementTypeLabels[entry.movementType] || entry.movementType}
                          </Badge>
                        </TableCell>
                        <TableCell>產品 #{entry.productId}</TableCell>
                        <TableCell>
                          {entry.lotId ? `批次 #${entry.lotId}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              entry.quantity > 0 ? 'text-green-600' : 'text-red-600'
                            }
                          >
                            {entry.quantity > 0 ? '+' : ''}
                            {entry.quantity.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.fromLocationId && `從 #${entry.fromLocationId}`}
                          {entry.fromLocationId && entry.toLocationId && ' → '}
                          {entry.toLocationId && `到 #${entry.toLocationId}`}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(entry.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {entries.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    共 {entries.total} 筆，第 {entries.page} / {entries.totalPages} 頁
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      上一頁
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= entries.totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      下一頁
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
