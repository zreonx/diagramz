import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5433/diagramz?sslmode=disable';

export const queryClient = new Pool({
  connectionString,
  max: 10,
});

export const db = drizzle(queryClient, { schema });
export type AppDatabase = typeof db;
