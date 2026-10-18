import * as dotenv from 'dotenv';
import * as path from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Explicitly ensure .env is loaded before pool initialization
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5433/diagramz?sslmode=disable';

const maskedUrl = connectionString.replace(/:([^@]+)@/, ':****@');
console.log(`[Database] Connecting to: ${maskedUrl}`);

export const queryClient = new Pool({
  connectionString,
  max: 10,
});

export const db = drizzle(queryClient, { schema });
export type AppDatabase = typeof db;
