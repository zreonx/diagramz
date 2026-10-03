import { z } from 'zod';

export const presignUploadSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  folder: z.enum(['thumbnails', 'exports', 'avatars']).default('thumbnails'),
});
export type PresignUploadDto = z.infer<typeof presignUploadSchema>;

export interface PresignUploadResponseDto {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}
