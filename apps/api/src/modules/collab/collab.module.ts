import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CollabGateway } from './collab.gateway';
import { CollabService } from './collab.service';

@Module({
  imports: [JwtModule],
  providers: [CollabGateway, CollabService],
  exports: [CollabService],
})
export class CollabModule {}
