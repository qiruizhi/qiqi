'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { productsApi } from '@/lib/api';
import { ITEM_TYPES } from '@davall/shared';

interface Product {
  id: number;
  tenantKey: string;
  fullId: string;
  name: string;
  itemType: string;
  uom: string;
  canPurchase: boolean;
  canSell: boolean;
  canManufacture: boolean;
  isStocked: boolean;
  stockQuantity: number;
  reorderPoint: number;
}

interface PaginatedResult {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const itemTypeLabels: Record<string, string> = {
  finished_good: '成品',
  raw_material: '原料',
  consumable: '耗材',
  spare: '備品',
  wip: '在製品',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<PaginatedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [itemType, setItemType] = useState<string>('');
  const [page, setPage] = useState(1);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await productsApi.list({
        page,
        pageSize: 20,
        search: search || undefined,
        itemType: itemType || undefined,
      });
      setProducts((response as any).data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, itemType]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">產品管理</h1>
          <p className="text-muted-foreground">管理所有產品與物料</p>
        </div>
        <Link href="/products/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新增產品
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row">
            <form onSubmit={handleSearch} className="flex flex-1 gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜尋產品名稱..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="secondary">
                搜尋
              </Button>
            </form>
            <Select value={itemType} onValueChange={setItemType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="物料類型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                {ITEM_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {itemTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">載入中...</div>
          ) : !products?.items.length ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Package className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">尚無產品資料</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>產品編號</TableHead>
                      <TableHead>名稱</TableHead>
                      <TableHead>類型</TableHead>
                      <TableHead>單位</TableHead>
                      <TableHead className="text-right">庫存</TableHead>
                      <TableHead>屬性</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.items.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <Link
                            href={`/products/${product.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {product.fullId}
                          </Link>
                        </TableCell>
                        <TableCell>{product.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {itemTypeLabels[product.itemType] || product.itemType}
                          </Badge>
                        </TableCell>
                        <TableCell>{product.uom}</TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              product.stockQuantity < product.reorderPoint
                                ? 'text-destructive'
                                : ''
                            }
                          >
                            {product.stockQuantity.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {product.canPurchase && (
                              <Badge variant="outline" className="text-xs">
                                採購
                              </Badge>
                            )}
                            {product.canSell && (
                              <Badge variant="outline" className="text-xs">
                                銷售
                              </Badge>
                            )}
                            {product.canManufacture && (
                              <Badge variant="outline" className="text-xs">
                                生產
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {products.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    共 {products.total} 筆，第 {products.page} / {products.totalPages} 頁
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
                      disabled={page >= products.totalPages}
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
