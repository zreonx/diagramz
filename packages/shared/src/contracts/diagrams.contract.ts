import { z } from 'zod';

export const createDiagramSchema = z.object({
  title: z.string().min(1, 'Diagram title is required').max(150),
  mermaidCode: z.string().optional(),
  canvasData: z.unknown().optional(),
});
export type CreateDiagramDto = z.infer<typeof createDiagramSchema>;

export const updateDiagramSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  mermaidCode: z.string().nullable().optional(),
  canvasData: z.unknown().optional(),
  thumbnailKey: z.string().nullable().optional(),
});
export type UpdateDiagramDto = z.infer<typeof updateDiagramSchema>;

export const createDiagramVersionSchema = z.object({
  versionName: z.string().max(100).optional(),
  mermaidCode: z.string().nullable().optional(),
  canvasData: z.unknown().optional(),
});
export type CreateDiagramVersionDto = z.infer<typeof createDiagramVersionSchema>;

export const updateShareSettingsSchema = z.object({
  isPublic: z.boolean(),
});
export type UpdateShareSettingsDto = z.infer<typeof updateShareSettingsSchema>;
