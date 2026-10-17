import { z } from 'zod';

export const createDiagramSchema = z.object({
  title: z.string().min(1, 'Diagram title is required').max(150),
  mermaidCode: z.string().optional(),
  canvasData: z.unknown().optional(),
  folderId: z.string().uuid().nullable().optional(),
  documentContent: z.string().nullable().optional(),
  viewMode: z.enum(['both', 'doc', 'canvas']).optional(),
});
export type CreateDiagramDto = z.infer<typeof createDiagramSchema>;

export const updateDiagramSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  mermaidCode: z.string().nullable().optional(),
  canvasData: z.unknown().optional(),
  thumbnailKey: z.string().nullable().optional(),
  folderId: z.string().uuid().nullable().optional(),
  documentContent: z.string().nullable().optional(),
  viewMode: z.enum(['both', 'doc', 'canvas']).optional(),
  isStarred: z.boolean().optional(),
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
  shareRole: z.enum(['viewer', 'editor']).optional().default('viewer'),
});
export type UpdateShareSettingsDto = z.infer<typeof updateShareSettingsSchema>;

export const addDiagramCollaboratorSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.enum(['viewer', 'editor']).default('viewer'),
});
export type AddDiagramCollaboratorDto = z.infer<typeof addDiagramCollaboratorSchema>;

export const updateDiagramCollaboratorSchema = z.object({
  role: z.enum(['viewer', 'editor']),
});
export type UpdateDiagramCollaboratorDto = z.infer<typeof updateDiagramCollaboratorSchema>;

export const updateSharedDiagramSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  mermaidCode: z.string().nullable().optional(),
  canvasData: z.unknown().optional(),
  documentContent: z.string().nullable().optional(),
  viewMode: z.enum(['both', 'doc', 'canvas']).optional(),
});
export type UpdateSharedDiagramDto = z.infer<typeof updateSharedDiagramSchema>;
