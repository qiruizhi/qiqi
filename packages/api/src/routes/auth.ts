import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { loginSchema, registerSchema } from '@davall/shared';
import * as authService from '../services/auth.service.js';

export const authRouter = Router();

authRouter.post('/login', validateBody(loginSchema), async (req, res) => {
  const result = await authService.login(req.body.email, req.body.password);

  if (!result.success) {
    res.status(result.statusCode || 401).json(result);
    return;
  }

  res.cookie('accessToken', result.data!.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  });

  res.cookie('refreshToken', result.data!.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    data: {
      user: result.data!.user,
    },
  });
});

authRouter.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    res.status(401).json({ success: false, error: 'No refresh token' });
    return;
  }

  const result = await authService.refresh(refreshToken);

  if (!result.success) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.status(result.statusCode || 401).json(result);
    return;
  }

  res.cookie('accessToken', result.data!.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  });

  res.cookie('refreshToken', result.data!.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ success: true });
});

authRouter.post('/logout', authenticate, async (req, res) => {
  const accessToken = req.cookies?.accessToken || req.headers.authorization?.replace('Bearer ', '');
  const refreshToken = req.cookies?.refreshToken;

  if (accessToken && req.tenantKey) {
    await authService.logout(req.tenantKey, accessToken, refreshToken);
  }

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ success: true });
});

authRouter.get('/me', authenticate, (req, res) => {
  res.json({ success: true, data: req.user });
});

authRouter.post('/register', validateBody(registerSchema), async (req, res) => {
  const tenantKey = req.headers['x-tenant-key'] as string;

  if (!tenantKey) {
    res.status(400).json({ success: false, error: 'Tenant key required' });
    return;
  }

  const result = await authService.register(
    tenantKey,
    req.body.email,
    req.body.password,
    req.body.name
  );

  res.status(result.success ? 201 : result.statusCode || 400).json(result);
});
