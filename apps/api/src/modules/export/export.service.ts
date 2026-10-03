import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { RenderService } from '../render/render.service';
import { StorageService } from '../storage/storage.service';
import { db } from '../../database/drizzle.client';
import { diagrams } from '../../database/schema';
import { eq } from 'drizzle-orm';
import {
  QueueExportDto,
  ExportStatusResponseDto,
  ExportJobResult,
} from '@diagramz/shared';

interface InternalExportJob extends ExportJobResult {
  diagramId: string;
  createdAt: number;
  buffer?: Buffer;
  contentType?: string;
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);
  private jobs = new Map<string, InternalExportJob>();

  constructor(
    private renderService: RenderService,
    private storageService: StorageService,
  ) {}

  async enqueueExport(dto: QueueExportDto, userId?: string): Promise<{ jobId: string }> {
    const jobId = crypto.randomUUID();

    // Store in-flight state
    this.jobs.set(jobId, {
      jobId,
      diagramId: dto.diagramId,
      status: 'active',
      createdAt: Date.now(),
    });

    // Execute asynchronously (BullMQ compatible flow)
    this.processJobAsync(jobId, dto, userId).catch((err) => {
      this.logger.error(`Export job ${jobId} failed: ${err.message}`);
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = err.message;
      }
    });

    return { jobId };
  }

  private async processJobAsync(jobId: string, dto: QueueExportDto, userId?: string): Promise<void> {
    const diagram = await db.query.diagrams.findFirst({
      where: eq(diagrams.id, dto.diagramId),
      with: { canvas: true },
    });

    const mermaid = dto.mermaidCode || diagram?.mermaidCode || '';
    const canvas = dto.canvasData || diagram?.canvas?.canvasData;

    const { buffer, contentType } = await this.renderService.renderDiagram(
      dto.format,
      mermaid,
      canvas,
      dto.scale,
    );

    const key = `exports/${dto.diagramId}/${jobId}.${dto.format}`;
    const publicUrl = await this.storageService.uploadBuffer(key, buffer, contentType);

    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'completed';
      job.downloadUrl = publicUrl || `/api/v1/export/download/${jobId}`;
      job.key = key;
      job.buffer = buffer;
      job.contentType = contentType;
    }

    this.logger.log(`Export job ${jobId} completed successfully`);
  }

  getJobStatus(jobId: string): ExportStatusResponseDto {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    return {
      jobId: job.jobId,
      status: job.status,
      downloadUrl: job.downloadUrl,
      error: job.error,
    };
  }

  getJobBuffer(jobId: string): { buffer: Buffer; contentType: string } {
    const job = this.jobs.get(jobId);
    if (!job || !job.buffer || !job.contentType) {
      throw new NotFoundException(`File for job ${jobId} not found`);
    }

    return { buffer: job.buffer, contentType: job.contentType };
  }
}
