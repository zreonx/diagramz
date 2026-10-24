import { z } from 'zod';
import { DEFAULT_PEN_STYLE, PEN_MIN_OPACITY } from './style-models';

export const ZCanvasGridStyleSchema = z.enum(['dots', 'mesh', 'cross', 'none']);
export type ZCanvasGridStyle = z.infer<typeof ZCanvasGridStyleSchema>;

export const ZCanvasGridSizeSchema = z.union([
  z.literal(16),
  z.literal(20),
  z.literal(24),
  z.literal(32),
  z.literal(48),
]);
export type ZCanvasGridSize = z.infer<typeof ZCanvasGridSizeSchema>;

export const ZCanvasBackgroundToneSchema = z.enum(['default', 'warm', 'cool', 'contrast']);
export type ZCanvasBackgroundTone = z.infer<typeof ZCanvasBackgroundToneSchema>;

export const ZCanvasFontFamilySchema = z.enum(['sans', 'mono', 'serif', 'handwriting']);
export type ZCanvasFontFamily = z.infer<typeof ZCanvasFontFamilySchema>;

export const ZCanvasStylePresetSchema = z.enum(['clean', 'sketch', 'soft', 'technical']);
export type ZCanvasStylePreset = z.infer<typeof ZCanvasStylePresetSchema>;

export const ZCanvasStrokePresetSchema = z.enum(['precise', 'natural', 'sketch', 'marker']);
export type ZCanvasStrokePreset = z.infer<typeof ZCanvasStrokePresetSchema>;

export const ZCanvasSloppinessSchema = z.enum(['architectural', 'artist', 'cartoonist']);
export type ZCanvasSloppiness = z.infer<typeof ZCanvasSloppinessSchema>;

export const ZCanvasSettingsSchema = z.object({
  gridStyle: ZCanvasGridStyleSchema.default('dots'),
  gridSize: ZCanvasGridSizeSchema.default(24),
  snapToGrid: z.boolean().default(true),
  snapSize: z.number().default(12),
  showGuides: z.boolean().default(true),
  showMinimap: z.boolean().default(true),
  edgeRouting: z.enum(['bezier', 'step', 'straight']).default('bezier'),
  backgroundTone: ZCanvasBackgroundToneSchema.default('default'),
  fontFamily: ZCanvasFontFamilySchema.default('sans'),
  fontSize: z.number().min(8).max(120).default(16),
  strokeWidth: z.number().min(1).max(10).default(2),
  strokeStyle: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
  stylePreset: ZCanvasStylePresetSchema.default('clean'),
  strokePreset: ZCanvasStrokePresetSchema.default('natural'),
  sloppiness: ZCanvasSloppinessSchema.default('architectural'),
  /**
   * The freehand pen's own appearance — what the pen draws next. Kept here
   * rather than in the document because it is a tool preference: it belongs to
   * the person drawing, survives a reload, and applies to whatever diagram
   * they open next.
   */
  penColor: z.string().default(DEFAULT_PEN_STYLE.color),
  penSloppiness: ZCanvasSloppinessSchema.default(DEFAULT_PEN_STYLE.sloppiness),
  penStrokeStyle: z
    .enum(['solid', 'dashed', 'dotted'])
    .default(DEFAULT_PEN_STYLE.strokeStyle),
  penOpacity: z
    .number()
    .min(PEN_MIN_OPACITY)
    .max(1)
    .default(DEFAULT_PEN_STYLE.opacity),
});

export type ZCanvasSettings = z.infer<typeof ZCanvasSettingsSchema>;

export const DEFAULT_CANVAS_SETTINGS: ZCanvasSettings = {
  gridStyle: 'dots',
  gridSize: 24,
  snapToGrid: true,
  snapSize: 12,
  showGuides: true,
  showMinimap: true,
  edgeRouting: 'bezier',
  backgroundTone: 'default',
  fontFamily: 'sans',
  fontSize: 16,
  strokeWidth: 2,
  strokeStyle: 'solid',
  stylePreset: 'clean',
  strokePreset: 'natural',
  sloppiness: 'architectural',
  penColor: DEFAULT_PEN_STYLE.color,
  penSloppiness: DEFAULT_PEN_STYLE.sloppiness,
  penStrokeStyle: DEFAULT_PEN_STYLE.strokeStyle,
  penOpacity: DEFAULT_PEN_STYLE.opacity,
};

const STORAGE_KEY = 'zcanvas_user_settings_v1';

export function loadCanvasSettings(): ZCanvasSettings {
  if (typeof window === 'undefined') return DEFAULT_CANVAS_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CANVAS_SETTINGS;
    const parsed = JSON.parse(raw);
    const result = ZCanvasSettingsSchema.safeParse(parsed);
    return result.success ? result.data : DEFAULT_CANVAS_SETTINGS;
  } catch {
    return DEFAULT_CANVAS_SETTINGS;
  }
}

export function saveCanvasSettings(settings: ZCanvasSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}
