const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'An error occurred');
  }

  return data;
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ success: boolean; data: { user: unknown } }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  logout: () => api<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  me: () => api<{ success: boolean; data: unknown }>('/auth/me'),

  refresh: () => api<{ success: boolean }>('/auth/refresh', { method: 'POST' }),
};

export const productsApi = {
  list: (params?: Record<string, unknown>) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return api<{ success: boolean; data: unknown }>(`/products${query ? `?${query}` : ''}`);
  },

  get: (id: number) => api<{ success: boolean; data: unknown }>(`/products/${id}`),

  create: (data: unknown) =>
    api<{ success: boolean; data: unknown }>('/products', { method: 'POST', body: data }),

  update: (id: number, data: unknown) =>
    api<{ success: boolean; data: unknown }>(`/products/${id}`, { method: 'PATCH', body: data }),

  delete: (id: number) =>
    api<{ success: boolean }>(`/products/${id}`, { method: 'DELETE' }),
};

export const warehousesApi = {
  list: (params?: Record<string, unknown>) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return api<{ success: boolean; data: unknown }>(`/warehouses${query ? `?${query}` : ''}`);
  },

  get: (id: number) => api<{ success: boolean; data: unknown }>(`/warehouses/${id}`),

  create: (data: unknown) =>
    api<{ success: boolean; data: unknown }>('/warehouses', { method: 'POST', body: data }),
};

export const locationsApi = {
  list: (params?: Record<string, unknown>) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return api<{ success: boolean; data: unknown }>(`/locations${query ? `?${query}` : ''}`);
  },

  get: (id: number) => api<{ success: boolean; data: unknown }>(`/locations/${id}`),

  create: (data: unknown) =>
    api<{ success: boolean; data: unknown }>('/locations', { method: 'POST', body: data }),
};

export const stockApi = {
  balances: (params?: Record<string, unknown>) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return api<{ success: boolean; data: unknown }>(`/stock/balances${query ? `?${query}` : ''}`);
  },

  entries: (params?: Record<string, unknown>) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return api<{ success: boolean; data: unknown }>(`/stock/entries${query ? `?${query}` : ''}`);
  },

  adjust: (data: unknown) =>
    api<{ success: boolean; data: unknown }>('/stock/adjust', { method: 'POST', body: data }),

  transfer: (data: unknown) =>
    api<{ success: boolean; data: unknown }>('/stock/transfer', { method: 'POST', body: data }),
};

export const lotsApi = {
  list: (params?: Record<string, unknown>) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return api<{ success: boolean; data: unknown }>(`/lots${query ? `?${query}` : ''}`);
  },

  get: (id: number) => api<{ success: boolean; data: unknown }>(`/lots/${id}`),

  create: (data: unknown) =>
    api<{ success: boolean; data: unknown }>('/lots', { method: 'POST', body: data }),

  update: (id: number, data: unknown) =>
    api<{ success: boolean; data: unknown }>(`/lots/${id}`, { method: 'PATCH', body: data }),
};
