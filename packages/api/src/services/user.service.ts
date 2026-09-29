import { prisma } from '../lib/prisma.js';
import { allocateId } from '../lib/id-counter.js';
import { hashPassword } from '../lib/auth.js';
import type {
  ServiceResult,
  PaginatedResult,
  AuthUser,
  UserRole,
  UserStatus,
} from '@davall/shared';
import type { CreateUserInput, UpdateUserInput, PaginationInput } from '@davall/shared';

interface User {
  id: number;
  tenantKey: string;
  email: string;
  name: string;
  role: UserRole;
  language: string | null;
  status: UserStatus;
  workerId: number | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

function toUser(record: {
  id: number;
  tenantKey: string;
  email: string;
  name: string;
  role: string;
  language: string | null;
  status: string;
  workerId: number | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}): User {
  return {
    id: record.id,
    tenantKey: record.tenantKey,
    email: record.email,
    name: record.name,
    role: record.role as UserRole,
    language: record.language,
    status: record.status as UserStatus,
    workerId: record.workerId,
    lastLoginAt: record.lastLoginAt,
    createdAt: record.createdAt,
  };
}

export async function createUser(
  tenantKey: string,
  input: CreateUserInput,
  password?: string
): Promise<ServiceResult<User>> {
  try {
    const existing = await prisma.user.findUnique({
      where: { tenantKey_email: { tenantKey, email: input.email } },
    });

    if (existing) {
      return { success: false, error: 'Email already exists', statusCode: 409 };
    }

    const idResult = await allocateId(tenantKey, 'user');
    if (!idResult.success || idResult.data === undefined) {
      return { success: false, error: 'Failed to allocate ID', statusCode: 500 };
    }

    const passwordHash = password ? await hashPassword(password) : null;

    const user = await prisma.user.create({
      data: {
        tenantKey,
        id: idResult.data,
        email: input.email,
        name: input.name,
        role: input.role,
        language: input.language,
        workerId: input.workerId,
        passwordHash,
        status: password ? 'active' : 'invited',
      },
    });

    return { success: true, data: toUser(user) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to create user: ${message}`, statusCode: 500 };
  }
}

export async function getUser(
  tenantKey: string,
  userId: number
): Promise<ServiceResult<User>> {
  try {
    const user = await prisma.user.findUnique({
      where: { tenantKey_id: { tenantKey, id: userId } },
    });

    if (!user || user.deletedAt) {
      return { success: false, error: 'User not found', statusCode: 404 };
    }

    return { success: true, data: toUser(user) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to get user: ${message}`, statusCode: 500 };
  }
}

export async function listUsers(
  tenantKey: string,
  pagination: PaginationInput,
  filters?: { role?: UserRole; status?: UserStatus; search?: string }
): Promise<ServiceResult<PaginatedResult<User>>> {
  try {
    const where = {
      tenantKey,
      deletedAt: null,
      ...(filters?.role && { role: filters.role }),
      ...(filters?.status && { status: filters.status }),
      ...(filters?.search && {
        OR: [
          { email: { contains: filters.search, mode: 'insensitive' as const } },
          { name: { contains: filters.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items: users.map(toUser),
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to list users: ${message}`, statusCode: 500 };
  }
}

export async function updateUser(
  tenantKey: string,
  userId: number,
  input: UpdateUserInput
): Promise<ServiceResult<User>> {
  try {
    const existing = await prisma.user.findUnique({
      where: { tenantKey_id: { tenantKey, id: userId } },
    });

    if (!existing || existing.deletedAt) {
      return { success: false, error: 'User not found', statusCode: 404 };
    }

    const user = await prisma.user.update({
      where: { tenantKey_id: { tenantKey, id: userId } },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.role !== undefined && { role: input.role }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.language !== undefined && { language: input.language }),
        ...(input.workerId !== undefined && { workerId: input.workerId }),
      },
    });

    return { success: true, data: toUser(user) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to update user: ${message}`, statusCode: 500 };
  }
}

export async function deleteUser(
  tenantKey: string,
  userId: number
): Promise<ServiceResult<void>> {
  try {
    const existing = await prisma.user.findUnique({
      where: { tenantKey_id: { tenantKey, id: userId } },
    });

    if (!existing || existing.deletedAt) {
      return { success: false, error: 'User not found', statusCode: 404 };
    }

    await prisma.user.update({
      where: { tenantKey_id: { tenantKey, id: userId } },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to delete user: ${message}`, statusCode: 500 };
  }
}

export async function setPassword(
  tenantKey: string,
  userId: number,
  password: string
): Promise<ServiceResult<void>> {
  try {
    const existing = await prisma.user.findUnique({
      where: { tenantKey_id: { tenantKey, id: userId } },
    });

    if (!existing || existing.deletedAt) {
      return { success: false, error: 'User not found', statusCode: 404 };
    }

    const passwordHash = await hashPassword(password);

    await prisma.user.update({
      where: { tenantKey_id: { tenantKey, id: userId } },
      data: {
        passwordHash,
        status: existing.status === 'invited' ? 'active' : existing.status,
      },
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to set password: ${message}`, statusCode: 500 };
  }
}
