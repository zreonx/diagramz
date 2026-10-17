import { z } from 'zod';

export const createFolderSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(100),
  parentId: z.string().uuid().nullable().optional(),
  icon: z.string().nullable().optional(),
});
export type CreateFolderDto = z.infer<typeof createFolderSchema>;

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().nullable().optional(),
  position: z.number().int().optional(),
});
export type UpdateFolderDto = z.infer<typeof updateFolderSchema>;

export const moveFolderSchema = z.object({
  parentId: z.string().uuid().nullable(),
});
export type MoveFolderDto = z.infer<typeof moveFolderSchema>;

export const moveDiagramSchema = z.object({
  folderId: z.string().uuid().nullable(),
});
export type MoveDiagramDto = z.infer<typeof moveDiagramSchema>;
