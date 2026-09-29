'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Package,
  Warehouse,
  ClipboardList,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  Users,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api';

interface User {
  id: number;
  tenantKey: string;
  email: string;
  role: string;
}

const navigation = [
  { name: '儀表板', href: '/dashboard', icon: LayoutDashboard },
  { name: '產品', href: '/products', icon: Package },
  { name: '倉庫', href: '/warehouses', icon: Warehouse },
  { name: '庫存', href: '/stock', icon: ClipboardList },
  { name: '使用者', href: '/users', icon: Users, roles: ['admin'] },
  { name: '設定', href: '/settings', icon: Settings, roles: ['admin'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await authApi.me();
        setUser((response as { data: User }).data);
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors
    }
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">載入中...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const filteredNav = navigation.filter(
    (item) => !item.roles || item.roles.includes(user.role)
  );

  return (
    <div className="min-h-screen bg-muted">
      {/* Mobile sidebar */}
      <div
        className={`fixed inset-0 z-50 bg-black/80 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white shadow-lg transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          <span className="text-lg font-semibold text-primary">Davall ERP</span>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-4">
          <div className="mb-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{user.email}</p>
            <p>{user.tenantKey}</p>
          </div>
          <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            登出
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-white px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
        </header>

        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
