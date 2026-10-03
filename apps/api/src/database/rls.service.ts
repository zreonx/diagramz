import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { db, AppDatabase } from './drizzle.client';

@Injectable()
export class RlsContextService {
  async executeWithUser<T>(
    userId: string,
    callback: (tx: Parameters<Parameters<AppDatabase['transaction']>[0]>[0]) => Promise<T>,
  ): Promise<T> {
    return await db.transaction(async (tx) => {
      // Set session variable locally for the current transaction only (is_local = true)
      await tx.execute(sql`SELECT set_config('request.jwt.claim.sub', ${userId}, true)`);
      return await callback(tx);
    });
  }
}
