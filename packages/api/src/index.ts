import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { prisma } from './lib/prisma.js';
import { errorHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { tenantsRouter } from './routes/tenants.js';
import { productsRouter } from './routes/products.js';
import { warehousesRouter } from './routes/warehouses.js';
import { locationsRouter } from './routes/locations.js';
import { lotsRouter } from './routes/lots.js';
import { stockRouter } from './routes/stock.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/tenants', tenantsRouter);
app.use('/api/users', usersRouter);
app.use('/api/products', productsRouter);
app.use('/api/warehouses', warehousesRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/lots', lotsRouter);
app.use('/api/stock', stockRouter);

app.use(errorHandler);

async function main() {
  try {
    await prisma.$connect();
    console.log('Connected to database');

    app.listen(PORT, () => {
      console.log(`API server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();

export { app };
