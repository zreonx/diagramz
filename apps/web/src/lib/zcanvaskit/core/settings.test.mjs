import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_CANVAS_SETTINGS,
  ZCanvasSettingsSchema,
  loadCanvasSettings,
} from './settings.ts';
import { DEFAULT_PEN_STYLE, STROKE_PRESETS } from './style-models.ts';

test('a settings object with nothing stored fills in every default', () => {
  const parsed = ZCanvasSettingsSchema.parse({});

  assert.deepEqual(parsed, DEFAULT_CANVAS_SETTINGS);
});

test('the pen arrives at the library default colour, style and opacity', () => {
  const parsed = ZCanvasSettingsSchema.parse({});

  assert.equal(parsed.penColor, DEFAULT_PEN_STYLE.color);
  assert.equal(parsed.penStrokeStyle, DEFAULT_PEN_STYLE.strokeStyle);
  assert.equal(parsed.penOpacity, DEFAULT_PEN_STYLE.opacity);
  // The nib is the shared stroke preset, not a pen setting of its own: storing
  // a width here too is what let the panel and the settings dialog disagree
  // about how wide the pen draws.
  assert.equal(parsed.penWidth, undefined);
  assert.equal(parsed.strokePreset, DEFAULT_PEN_STYLE.preset);
});

test('settings saved before the pen had options keep what they held', () => {
  // The shape a previous version wrote to localStorage: no pen fields at all.
  const parsed = ZCanvasSettingsSchema.parse({
    gridStyle: 'mesh',
    gridSize: 32,
    showMinimap: false,
    strokePreset: 'marker',
  });

  assert.equal(parsed.gridStyle, 'mesh');
  assert.equal(parsed.gridSize, 32);
  assert.equal(parsed.showMinimap, false);
  assert.equal(parsed.strokePreset, 'marker');
  // …and the pen simply gains its defaults rather than failing the parse.
  assert.equal(parsed.penOpacity, DEFAULT_PEN_STYLE.opacity);
});

test('every nib the pen offers parses, and an invented one does not', () => {
  for (const preset of Object.keys(STROKE_PRESETS)) {
    assert.equal(
      ZCanvasSettingsSchema.safeParse({ strokePreset: preset }).success,
      true,
      preset
    );
  }
  assert.equal(ZCanvasSettingsSchema.safeParse({ strokePreset: 'quill' }).success, false);
});

test('the pen cannot be set to invisible ink', () => {
  assert.equal(ZCanvasSettingsSchema.safeParse({ penOpacity: 0 }).success, false);
  assert.equal(ZCanvasSettingsSchema.safeParse({ penOpacity: 0.1 }).success, true);
});

test('an unknown pen style fails the parse instead of reaching the renderer', () => {
  // Anything already stored is untrusted: a hand-edited localStorage entry
  // must not put the pen into a state it cannot draw. `loadCanvasSettings`
  // drops the whole object and falls back to the defaults when this fails.
  assert.equal(ZCanvasSettingsSchema.safeParse({ penStrokeStyle: 'wavy' }).success, false);
});

test('reading settings with no browser storage yields the defaults', () => {
  // The canvas also renders on the server, where there is no localStorage.
  assert.deepEqual(loadCanvasSettings(), DEFAULT_CANVAS_SETTINGS);
});
