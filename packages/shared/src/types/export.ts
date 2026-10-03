export const EXPORT_FORMATS = ['png', 'pdf', 'svg'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_JOB_STATUSES = ['waiting', 'active', 'completed', 'failed'] as const;
export type ExportJobStatus = (typeof EXPORT_JOB_STATUSES)[number];

export interface ExportJobData {
  jobId: string;
  diagramId: string;
  format: ExportFormat;
  scale?: number;
  quality?: number;
  userId?: string;
}

export interface ExportJobResult {
  jobId: string;
  status: ExportJobStatus;
  downloadUrl?: string;
  key?: string;
  error?: string;
}
