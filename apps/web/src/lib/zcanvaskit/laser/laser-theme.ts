/**
 * Laser Pointer Theme, Color Presets, and Radiant Light Palettes.
 *
 * Provides curated presentation laser diode colors (Ruby Red, Emerald Green,
 * Electric Cyan, Solar Gold, Neon Violet, Hot Coral) and dynamic RGBA / Glow
 * calculations for custom hex colors.
 */

export interface LaserColorPreset {
  id: string;
  name: string;
  color: string;
  glow: string;
}

export const DEFAULT_LASER_COLOR = '#ff1744';

export const LASER_COLOR_PRESETS: LaserColorPreset[] = [
  { id: 'ruby', name: 'Ruby Red', color: '#ff1744', glow: '#ff2a6d' },
  { id: 'emerald', name: 'Emerald Green', color: '#10b981', glow: '#34d399' },
  { id: 'cyan', name: 'Electric Cyan', color: '#00e5ff', glow: '#38bdf8' },
  { id: 'amber', name: 'Solar Gold', color: '#ffb300', glow: '#fbbf24' },
  { id: 'violet', name: 'Neon Violet', color: '#d946ef', glow: '#f472b6' },
  { id: 'coral', name: 'Hot Coral', color: '#ff6b6b', glow: '#ff8787' },
];

export type LaserWidthMode = 'thin' | 'normal' | 'thick';
export type LaserDurationMode = 'short' | 'normal' | 'long';

export interface LaserWidthConfig {
  id: LaserWidthMode;
  label: string;
  activeWidth: number;
  hoverWidth: number;
}

export const LASER_WIDTH_CONFIGS: Record<LaserWidthMode, LaserWidthConfig> = {
  thin: { id: 'thin', label: 'Fine', activeWidth: 8, hoverWidth: 4 },
  normal: { id: 'normal', label: 'Normal', activeWidth: 14, hoverWidth: 7 },
  thick: { id: 'thick', label: 'Bold', activeWidth: 22, hoverWidth: 11 },
};

export interface LaserDurationConfig {
  id: LaserDurationMode;
  label: string;
  activeFadeMs: number;
  hoverFadeMs: number;
}

export const LASER_DURATION_CONFIGS: Record<LaserDurationMode, LaserDurationConfig> = {
  short: { id: 'short', label: 'Fast Fade', activeFadeMs: 700, hoverFadeMs: 350 },
  normal: { id: 'normal', label: 'Balanced', activeFadeMs: 1300, hoverFadeMs: 650 },
  long: { id: 'long', label: 'Long Trail', activeFadeMs: 2400, hoverFadeMs: 1200 },
};

export interface LaserPalette {
  core: string;
  glow: string;
  r: number;
  g: number;
  b: number;
  rgba: (alpha: number) => string;
}

/**
 * Parses any hex color `#RGB` or `#RRGGBB` into numeric RGB values.
 */
export function parseHexRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }
  const parsed = parseInt(clean, 16);
  if (isNaN(parsed) || clean.length !== 6) {
    return { r: 255, g: 23, b: 68 }; // fallback ruby
  }
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

/**
 * Resolves a complete glowing laser palette from a hex color.
 */
export function resolveLaserPalette(colorHex: string, explicitGlow?: string): LaserPalette {
  const norm = colorHex.toLowerCase().trim();
  const matched = LASER_COLOR_PRESETS.find((p) => p.color.toLowerCase() === norm);
  const rgb = parseHexRgb(colorHex);

  const glowHex =
    explicitGlow ||
    matched?.glow ||
    `#${Math.min(255, rgb.r + 30).toString(16).padStart(2, '0')}${Math.min(255, rgb.g + 30).toString(16).padStart(2, '0')}${Math.min(255, rgb.b + 30).toString(16).padStart(2, '0')}`;

  return {
    core: colorHex,
    glow: glowHex,
    r: rgb.r,
    g: rgb.g,
    b: rgb.b,
    rgba: (alpha: number) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.max(0, Math.min(1, alpha))})`,
  };
}
