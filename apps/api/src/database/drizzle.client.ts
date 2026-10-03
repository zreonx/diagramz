import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/diagramz?sslmode=disable';

// Configure postgres.js client
export const queryClient = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false, // Required for transaction connection pooling in serverless/pgBouncer
});

export const db = drizzle(queryClient, { schema });
export type AppDatabase = typeof db;
