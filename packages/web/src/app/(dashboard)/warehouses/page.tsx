'use client';

import { useEffect, useState } from 'react';
import { Plus, Warehouse, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { warehousesApi, locationsApi } from '@/lib/api';

interface Warehouse {
  id: number;
  tenantKey: string;
  name: string;
  createdAt: string;
}

interface Location {
  id: number;
  tenantKey: string;
  warehouseId: number;
  name: string;
  locationType: string;
}

const locationTypeLabels: Record<string, string> = {
  receiving: '收貨區',
  storage: '存儲區',
  production: '生產區',
  qc_hold: '待檢區',
  shipping: '出貨區',
  scrap: '報廢區',
};

const locationTypeColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  receiving: 'secondary',
  storage: 'default',
  production: 'secondary',
  qc_hold: 'outline',
  shipping: 'secondary',
  scrap: 'destructive',
};

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [warehousesRes, locationsRes] = await Promise.all([
          warehousesApi.list({ pageSize: 100 }),
          locationsApi.list({ pageSize: 100 }),
        ]);
        setWarehouses((warehousesRes as any).data.items || []);
        setLocations((locationsRes as any).data.items || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getLocationsForWarehouse = (warehouseId: number) => {
    return locations.filter((loc) => loc.warehouseId === warehouseId);
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">載入中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">倉庫管理</h1>
          <p className="text-muted-foreground">管理倉庫與儲位</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            新增儲位
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新增倉庫
          </Button>
        </div>
      </div>

      {warehouses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Warehouse className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">尚無倉庫資料</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {warehouses.map((warehouse) => {
            const warehouseLocations = getLocationsForWarehouse(warehouse.id);
            return (
              <Card key={warehouse.id}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Warehouse className="h-5 w-5 text-muted-foreground" />
                    <CardTitle>{warehouse.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {warehouseLocations.length === 0 ? (
                    <p className="text-muted-foreground">尚無儲位</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {warehouseLocations.map((location) => (
                        <div
                          key={location.id}
                          className="flex items-center justify-between rounded-md border p-3"
                        >
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{location.name}</span>
                          </div>
                          <Badge variant={locationTypeColors[location.locationType] || 'default'}>
                            {locationTypeLabels[location.locationType] || location.locationType}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
