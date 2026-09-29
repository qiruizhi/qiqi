import { Router } from 'express';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { authenticate, requireManagerOrAbove } from '../middleware/auth.js';
import {
  createProductSchema,
  updateProductSchema,
  paginationSchema,
  productFilterSchema,
} from '@davall/shared';
import * as productService from '../services/product.service.js';

export const productsRouter = Router();

const listProductsSchema = paginationSchema.merge(productFilterSchema);

productsRouter.get(
  '/',
  authenticate,
  validateQuery(listProductsSchema),
  async (req, res) => {
    const { page, pageSize, ...filters } = req.query as any;
    const result = await productService.listProducts(
      req.tenantKey!,
      { page, pageSize },
      filters
    );
    res.status(result.success ? 200 : result.statusCode || 500).json(result);
  }
);

productsRouter.get('/:id', authenticate, async (req, res) => {
  const productId = parseInt(req.params.id as string, 10);
  const result = await productService.getProduct(req.tenantKey!, productId);
  res.status(result.success ? 200 : result.statusCode || 404).json(result);
});

productsRouter.post(
  '/',
  authenticate,
  requireManagerOrAbove,
  validateBody(createProductSchema),
  async (req, res) => {
    const result = await productService.createProduct(req.tenantKey!, req.body);
    res.status(result.success ? 201 : result.statusCode || 400).json(result);
  }
);

productsRouter.patch(
  '/:id',
  authenticate,
  requireManagerOrAbove,
  validateBody(updateProductSchema),
  async (req, res) => {
    const productId = parseInt(req.params.id as string, 10);
    const result = await productService.updateProduct(req.tenantKey!, productId, req.body);
    res.status(result.success ? 200 : result.statusCode || 400).json(result);
  }
);

productsRouter.delete('/:id', authenticate, requireManagerOrAbove, async (req, res) => {
  const productId = parseInt(req.params.id as string, 10);
  const result = await productService.deleteProduct(req.tenantKey!, productId);
  res.status(result.success ? 200 : result.statusCode || 400).json(result);
});
