import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { RenderModule } from '../render/render.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [RenderModule, StorageModule],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
