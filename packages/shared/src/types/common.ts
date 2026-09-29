export interface ServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export const DOCUMENT_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'cancelled',
  'closed',
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
