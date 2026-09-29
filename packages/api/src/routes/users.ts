import { Router } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { authenticate, requireAdmin, requireManagerOrAbove } from '../middleware/auth.js';
import { createUserSchema, updateUserSchema, paginationSchema, USER_ROLES, USER_STATUSES } from '@davall/shared';
import * as userService from '../services/user.service.js';

export const usersRouter = Router();

const userFiltersSchema = paginationSchema.extend({
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  search: z.string().optional(),
});

usersRouter.get(
  '/',
  authenticate,
  requireManagerOrAbove,
  validateQuery(userFiltersSchema),
  async (req, res) => {
    const query = req.query as unknown as z.infer<typeof userFiltersSchema>;
    const { page, pageSize, ...filters } = query;
    const result = await userService.listUsers(req.tenantKey!, { page, pageSize }, filters);
    res.status(result.success ? 200 : result.statusCode || 500).json(result);
  }
);

usersRouter.get('/:id', authenticate, async (req, res) => {
  const userId = parseInt(req.params.id as string, 10);
  
  if (req.user!.role !== 'admin' && req.user!.role !== 'manager' && req.user!.id !== userId) {
    res.status(403).json({ success: false, error: 'Insufficient permissions' });
    return;
  }

  const result = await userService.getUser(req.tenantKey!, userId);
  res.status(result.success ? 200 : result.statusCode || 404).json(result);
});

usersRouter.post(
  '/',
  authenticate,
  requireAdmin,
  validateBody(createUserSchema),
  async (req, res) => {
    const result = await userService.createUser(req.tenantKey!, req.body);
    res.status(result.success ? 201 : result.statusCode || 400).json(result);
  }
);

usersRouter.patch(
  '/:id',
  authenticate,
  requireAdmin,
  validateBody(updateUserSchema),
  async (req, res) => {
    const userId = parseInt(req.params.id as string, 10);
    const result = await userService.updateUser(req.tenantKey!, userId, req.body);
    res.status(result.success ? 200 : result.statusCode || 400).json(result);
  }
);

usersRouter.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id as string, 10);

  if (userId === req.user!.id) {
    res.status(400).json({ success: false, error: 'Cannot delete yourself' });
    return;
  }

  const result = await userService.deleteUser(req.tenantKey!, userId);
  res.status(result.success ? 200 : result.statusCode || 400).json(result);
});

const setPasswordSchema = z.object({
  password: z.string().min(12),
});

usersRouter.post(
  '/:id/password',
  authenticate,
  requireAdmin,
  validateBody(setPasswordSchema),
  async (req, res) => {
    const userId = parseInt(req.params.id as string, 10);
    const result = await userService.setPassword(req.tenantKey!, userId, req.body.password);
    res.status(result.success ? 200 : result.statusCode || 400).json(result);
  }
);
