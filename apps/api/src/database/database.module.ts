import { Global, Module } from '@nestjs/common';
import { db, queryClient } from './drizzle.client';
import { RlsContextService } from './rls.service';

export const DRIZZLE_DB = 'DRIZZLE_DB';
export const POSTGRES_CLIENT = 'POSTGRES_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DB,
      useValue: db,
    },
    {
      provide: POSTGRES_CLIENT,
      useValue: queryClient,
    },
    RlsContextService,
  ],
  exports: [DRIZZLE_DB, POSTGRES_CLIENT, RlsContextService],
})
export class DatabaseModule {}
