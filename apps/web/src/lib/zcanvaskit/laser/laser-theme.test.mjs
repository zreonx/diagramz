import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LASER_COLOR_PRESETS,
  DEFAULT_LASER_COLOR,
  LASER_WIDTH_CONFIGS,
  LASER_DURATION_CONFIGS,
  parseHexRgb,
  resolveLaserPalette,
} from './laser-theme.ts';

test('laser presets contain expected default ruby and emerald colors', () => {
  assert.equal(DEFAULT_LASER_COLOR, '#ff1744');
  assert.equal(LASER_COLOR_PRESETS.length >= 5, true);
  const ruby = LASER_COLOR_PRESETS.find((p) => p.id === 'ruby');
  assert.ok(ruby);
  assert.equal(ruby.color, '#ff1744');
  assert.equal(ruby.glow, '#ff2a6d');

  const emerald = LASER_COLOR_PRESETS.find((p) => p.id === 'emerald');
  assert.ok(emerald);
  assert.equal(emerald.color, '#10b981');
});

test('parseHexRgb parses 6-char, 3-char, and fallback hex strings', () => {
  assert.deepEqual(parseHexRgb('#ff1744'), { r: 255, g: 23, b: 68 });
  assert.deepEqual(parseHexRgb('#f00'), { r: 255, g: 0, b: 0 });
  // Invalid string falls back safely without throwing
  assert.deepEqual(parseHexRgb('invalid'), { r: 255, g: 23, b: 68 });
});

test('resolveLaserPalette builds matching RGBA and glow values', () => {
  const palette = resolveLaserPalette('#10b981');
  assert.equal(palette.core, '#10b981');
  assert.equal(palette.glow, '#34d399');
  assert.equal(palette.rgba(0.5), 'rgba(16, 185, 129, 0.5)');
});

test('laser width and duration configs define valid parameters', () => {
  assert.ok(LASER_WIDTH_CONFIGS.thin.activeWidth < LASER_WIDTH_CONFIGS.normal.activeWidth);
  assert.ok(LASER_WIDTH_CONFIGS.normal.activeWidth < LASER_WIDTH_CONFIGS.thick.activeWidth);

  assert.ok(LASER_DURATION_CONFIGS.short.activeFadeMs < LASER_DURATION_CONFIGS.normal.activeFadeMs);
  assert.ok(LASER_DURATION_CONFIGS.normal.activeFadeMs < LASER_DURATION_CONFIGS.long.activeFadeMs);
});
