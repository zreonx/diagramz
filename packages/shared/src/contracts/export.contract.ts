import { z } from 'zod';
import { EXPORT_FORMATS } from '../types/export.js';

export const queueExportSchema = z.object({
  diagramId: z.string().uuid(),
  format: z.enum(EXPORT_FORMATS).default('png'),
  scale: z.number().min(1).max(4).default(2),
  mermaidCode: z.string().optional(),
  canvasData: z.unknown().optional(),
});
export type QueueExportDto = z.infer<typeof queueExportSchema>;

export const exportStatusResponseSchema = z.object({
  jobId: z.string(),
  status: z.enum(['waiting', 'active', 'completed', 'failed']),
  downloadUrl: z.string().url().optional(),
  error: z.string().optional(),
});
export type ExportStatusResponseDto = z.infer<typeof exportStatusResponseSchema>;
