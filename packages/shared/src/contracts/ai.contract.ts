import { z } from 'zod';

export const AI_PROVIDERS = ['gemini', 'openai', 'anthropic'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const aiGenerateSchema = z.object({
  prompt: z.string().min(5, 'Prompt must be at least 5 characters long').max(2000),
  provider: z.enum(AI_PROVIDERS).optional(),
  currentMermaidCode: z.string().optional(),
});
export type AiGenerateDto = z.infer<typeof aiGenerateSchema>;

export const aiChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});
export type AiChatMessage = z.infer<typeof aiChatMessageSchema>;

export const aiChatSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(2000),
  history: z.array(aiChatMessageSchema).default([]),
  currentMermaidCode: z.string().optional(),
  provider: z.enum(AI_PROVIDERS).optional(),
});
export type AiChatDto = z.infer<typeof aiChatSchema>;

export interface AiGenerationResult {
  mermaidCode: string;
  explanation: string;
  diagramType: string;
  canvasData?: Record<string, any>;
}
