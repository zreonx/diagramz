import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_PEN_STYLE,
  PEN_MIN_OPACITY,
  STROKE_PRESETS,
  applyPenStyleToStroke,
  getStrokeDashArray,
  penInkGeometry,
  penStrokeWidth,
  strokeToPenStyle,
  withOpacity,
  colorAlpha,
  resolveNodeFill,
  resolveNodeFillParts,
  resolveNodeStroke,
} from './style-models.ts';

test('solid (and unset) strokes have no dash pattern', () => {
  assert.equal(getStrokeDashArray('solid'), undefined);
  assert.equal(getStrokeDashArray(undefined), undefined);
});

test('dashed strokes scale their pattern with the stroke width', () => {
  assert.equal(getStrokeDashArray('dashed', 2), '6 4');
  assert.equal(getStrokeDashArray('dashed', 4), '12 8');
});

test('dotted strokes stay short even at large widths', () => {
  assert.equal(getStrokeDashArray('dotted', 2), '2 4');
  assert.equal(getStrokeDashArray('dotted', 6), '6 12');
});

test('dash patterns never collapse to zero-length segments', () => {
  // A hairline width must still yield a visible on/off pattern, otherwise the
  // dash and gap both round away and the border renders as a solid line.
  for (const width of [1, 0.5, 0]) {
    const [dash, gap] = getStrokeDashArray('dashed', width).split(' ').map(Number);
    assert.ok(dash >= 4, `dashed on-segment too small at width ${width}: ${dash}`);
    assert.ok(gap >= 3, `dashed gap too small at width ${width}: ${gap}`);

    const [dotDash, dotGap] = getStrokeDashArray('dotted', width).split(' ').map(Number);
    assert.ok(dotDash > 0, `dotted on-segment collapsed at width ${width}`);
    assert.ok(dotGap >= 2, `dotted gap too small at width ${width}: ${dotGap}`);
  }
});

test('the default stroke width matches the 2px border default used on canvas', () => {
  assert.equal(getStrokeDashArray('dashed'), getStrokeDashArray('dashed', 2));
  assert.equal(getStrokeDashArray('dotted'), getStrokeDashArray('dotted', 2));
});

test('an undefined colour passes straight through', () => {
  assert.equal(withOpacity(undefined, 0.5), undefined);
  assert.equal(withOpacity(undefined, 0), undefined);
  assert.equal(withOpacity(undefined, 1), undefined);
});

test('3-, 6- and 8-digit hex colours all become rgba', () => {
  assert.equal(withOpacity('#abc', 0.5), 'rgba(170, 187, 204, 0.5)');
  assert.equal(withOpacity('#aabbcc', 0.5), 'rgba(170, 187, 204, 0.5)');
  assert.equal(withOpacity('#11223344', 0.5), 'rgba(17, 34, 51, 0.5)');
});

test('an existing 8-digit hex alpha is replaced, not multiplied', () => {
  // 0x80 is ~0.502; multiplying would give ~0.502 and replacing gives 1.
  assert.equal(withOpacity('#ff000080', 1), 'rgba(255, 0, 0, 1)');
  assert.equal(withOpacity('#ff000080', 0.25), 'rgba(255, 0, 0, 0.25)');
});

test('rgb() and rgba() inputs keep their numeric channels verbatim', () => {
  assert.equal(withOpacity('rgb(10, 20, 30)', 0.25), 'rgba(10, 20, 30, 0.25)');
  assert.equal(withOpacity('rgba(1, 2, 3, 0.9)', 0.5), 'rgba(1, 2, 3, 0.5)');
});

test('opacity is clamped into the 0..1 range', () => {
  assert.equal(withOpacity('rgb(0, 0, 0)', -1), 'rgba(0, 0, 0, 0)');
  assert.equal(withOpacity('rgb(0, 0, 0)', 5), 'rgba(0, 0, 0, 1)');
  assert.equal(withOpacity('#000000', -1), 'rgba(0, 0, 0, 0)');
});

test('the alpha is rounded to three decimals', () => {
  assert.equal(withOpacity('rgb(0, 0, 0)', 0.1234), 'rgba(0, 0, 0, 0.123)');
});

test('transparent stays fully transparent regardless of opacity', () => {
  assert.equal(withOpacity('transparent', 0.5), 'rgba(0, 0, 0, 0)');
  assert.equal(withOpacity('transparent', 1), 'rgba(0, 0, 0, 0)');
  assert.equal(withOpacity('transparent', 0), 'rgba(0, 0, 0, 0)');
});

test('unparseable colours are returned unchanged', () => {
  assert.equal(withOpacity('rebeccapurple', 0.5), 'rebeccapurple');
  assert.equal(withOpacity('var(--brand)', 0.3), 'var(--brand)');
  assert.equal(withOpacity('linear-gradient(red, blue)', 0.3), 'linear-gradient(red, blue)');
});

test('an opaque 6-digit hex is returned byte-identical', () => {
  assert.equal(withOpacity('#aabbcc', 1), '#aabbcc');
  assert.equal(withOpacity('#AABBCC', 1), '#AABBCC');
  assert.equal(withOpacity('#aabbcc', 1.5), '#aabbcc');
});

test('a 3-digit hex still gains an alpha at full opacity', () => {
  assert.equal(withOpacity('#abc', 1), 'rgba(170, 187, 204, 1)');
});

test('a component with no fill gets the themed translucent default', () => {
  // The default is a see-through panel over the canvas, not an opaque block:
  // the alpha must survive the trip through the fill resolver.
  assert.equal(resolveNodeFill('card', false, undefined, undefined), 'rgba(232, 241, 255, 0.5)');
  assert.equal(resolveNodeFill('card', true, undefined, undefined), 'rgba(32, 46, 69, 0.5)');
  assert.equal(
    resolveNodeFill('container', false, undefined, undefined),
    'rgba(238, 237, 255, 0.3)'
  );
});

test('each shape kind draws its default from a semantic colour family', () => {
  // Blue for generic shapes, amber for decisions, green for the triangle,
  // teal for tables, violet for containers.
  assert.equal(resolveNodeStroke('card', false), '#9ABCF5');
  assert.equal(resolveNodeStroke('card', true), '#3E5F91');
  assert.equal(resolveNodeStroke('diamond', false), '#E8C779');
  assert.equal(resolveNodeStroke('triangle', true), '#4D8052');
  assert.equal(resolveNodeStroke('table', false), '#8CCFC2');
  assert.equal(resolveNodeStroke('container', true), '#625BA8');
});

test('a user-chosen fill is used at full opacity when no opacity is set', () => {
  assert.equal(resolveNodeFill('card', false, '#EF4444', undefined), '#EF4444');
});

test('a user-chosen opacity overrides the default fill alpha', () => {
  assert.equal(resolveNodeFill('card', false, undefined, 0.9), 'rgba(232, 241, 255, 0.9)');
  assert.equal(resolveNodeFill('card', false, undefined, 0), 'rgba(232, 241, 255, 0)');
});

test('a user fill plus a user opacity compose', () => {
  assert.equal(resolveNodeFill('circle', true, '#10B981', 0.08), 'rgba(16, 185, 129, 0.08)');
});

test('colorAlpha reads an 8-digit hex, rgba() and transparent', () => {
  assert.equal(colorAlpha('#3b82f614'), 0.0784313725490196);
  assert.equal(colorAlpha('#FF000080'), 0.5019607843137255);
  assert.equal(colorAlpha('rgba(1, 2, 3, 0.25)'), 0.25);
  assert.equal(colorAlpha('transparent'), 0);
});

test('colorAlpha reports opaque colours as having no alpha', () => {
  for (const opaque of ['#fff', '#ffffff', 'rgb(0, 0, 0)', 'rebeccapurple', 'var(--brand)']) {
    assert.equal(colorAlpha(opaque), undefined, `expected ${opaque} to be opaque`);
  }
});

test('a legacy 8-digit hex fill keeps its own alpha instead of turning opaque', () => {
  // Older documents stored the tint as `${color}14`. Treating that fill as
  // opaque paints a solid saturated bar where a translucent wash belongs.
  assert.equal(resolveNodeFill('card', false, '#3b82f614', undefined), 'rgba(59, 130, 246, 0.078)');
  assert.equal(resolveNodeFill('card', false, '#3b82f614', 0.4), 'rgba(59, 130, 246, 0.4)');
});

test('a fully transparent fill stays invisible', () => {
  assert.equal(resolveNodeFill('card', false, 'transparent', undefined), 'rgba(0, 0, 0, 0)');
});

test('fill parts separate the colour from its opacity', () => {
  // SVG takes `fill` and `fill-opacity` as two attributes, so the colour must
  // arrive with its own alpha already stripped or the two would multiply.
  assert.deepEqual(resolveNodeFillParts('card', false, undefined, undefined), {
    color: '#E8F1FF',
    opacity: 0.5,
  });
  assert.deepEqual(resolveNodeFillParts('card', false, '#3b82f614', undefined), {
    color: '#3b82f6',
    opacity: 0.0784313725490196,
  });
  assert.deepEqual(resolveNodeFillParts('card', false, 'rgba(59, 130, 246, 0.4)', undefined), {
    color: 'rgb(59, 130, 246)',
    opacity: 0.4,
  });
});

test('fill parts and the joined fill agree, at every override combination', () => {
  const kinds = ['card', 'table', 'container', 'rectangle', 'circle', 'diamond', 'triangle', 'text'];
  const fills = [undefined, '#3b82f6', '#3b82f614', 'rgba(1, 2, 3, 0.25)', 'transparent'];
  const opacities = [undefined, 0, 0.35, 1];

  for (const kind of kinds) {
    for (const isDark of [false, true]) {
      for (const fill of fills) {
        for (const fillOpacity of opacities) {
          const parts = resolveNodeFillParts(kind, isDark, fill, fillOpacity);
          assert.equal(
            resolveNodeFill(kind, isDark, fill, fillOpacity),
            withOpacity(parts.color, parts.opacity),
            `${kind}/${isDark}/${fill}/${fillOpacity}`
          );
        }
      }
    }
  }
});

test('the pen nib width comes from the preset it names', () => {
  // One source of truth: the freehand panel and the canvas settings dialog
  // both read the preset, so neither can hold a width the other disagrees with.
  for (const [preset, config] of Object.entries(STROKE_PRESETS)) {
    assert.equal(penStrokeWidth({ preset }), config.width, preset);
  }
});

test('an unrecognised nib falls back to the natural width rather than NaN', () => {
  // `strokePreset` is parsed by zod, but a hand-edited document or a stored
  // settings blob could still reach the renderer with something else.
  assert.equal(penStrokeWidth({ preset: 'quill' }), STROKE_PRESETS.natural.width);
});

test('every nib the pen offers is blunt', () => {
  // A tapered nib is a brush, not a pen. At handwriting sizes it thins the last
  // stretch of every mark — a 40px letter drawn with a 3px nib spends most of
  // its length tapering — and the writing reads as blobby. The taper stays in
  // the schema and the renderer so ink drawn with one still paints as it did.
  for (const [preset, nib] of Object.entries(STROKE_PRESETS)) {
    assert.equal(nib.taper, 0, preset);
  }
});

test('every nib smooths by a distance the ink can actually use', () => {
  // Smoothing is a window measured in canvas pixels — the smoother reads this
  // number as tenths of its maximum reach — and it only bites when the window
  // is wider than the gap between samples. A mouse reports every few pixels, so
  // a window under ~5px smooths nothing, and past ~10px it starts pulling the
  // tight loops of handwriting visibly off the path the hand drew.
  for (const [preset, nib] of Object.entries(STROKE_PRESETS)) {
    assert.ok(nib.smoothing >= 0.5, `${preset} smooths over only ${nib.smoothing * 10}px`);
    assert.ok(nib.smoothing <= 1, `${preset} smooths over ${nib.smoothing * 10}px`);
  }
});

test('the pen arrives ready to draw', () => {
  assert.equal(DEFAULT_PEN_STYLE.preset, 'natural');
  assert.equal(DEFAULT_PEN_STYLE.strokeStyle, 'solid');
  assert.equal(DEFAULT_PEN_STYLE.opacity, 1);
  // Invisible ink reads as a broken pen, so the floor is above zero and below
  // anything the user could mistake for opaque.
  assert.ok(PEN_MIN_OPACITY > 0 && PEN_MIN_OPACITY < 0.5);
});

test('a stroke reads back as the pen settings that would draw it again', () => {
  const pen = strokeToPenStyle({
    color: '#EF4444',
    width: STROKE_PRESETS.marker.width,
    roughness: 2.5,
    strokeStyle: 'dashed',
    opacity: 0.4,
    preset: 'marker',
  });

  assert.deepEqual(pen, {
    color: '#EF4444',
    preset: 'marker',
    sloppiness: 'cartoonist',
    strokeStyle: 'dashed',
    opacity: 0.4,
  });
});

test('a stroke that predates the preset field is matched by its nib width', () => {
  // Ink written by an older version — or by another editor — still has a width,
  // and the width is the visible half of a nib.
  for (const [preset, config] of Object.entries(STROKE_PRESETS)) {
    assert.equal(strokeToPenStyle({ color: '#000', width: config.width }).preset, preset);
  }

  // A width between two presets lands on the nearer one.
  assert.equal(strokeToPenStyle({ color: '#000', width: 2.6 }).preset, 'sketch');
  assert.equal(strokeToPenStyle({ color: '#000', width: 5.8 }).preset, 'marker');
});

test('a stroke with no width at all falls back to the natural nib', () => {
  assert.equal(strokeToPenStyle({ color: '#000' }).preset, 'natural');
  assert.equal(strokeToPenStyle({ color: '#000', width: 0 }).preset, 'natural');
});

test('a nonsense preset in the document is ignored rather than trusted', () => {
  assert.equal(strokeToPenStyle({ color: '#000', width: 6, preset: 'quill' }).preset, 'marker');
});

test('a stroke with no dash or opacity reads as solid and opaque', () => {
  const pen = strokeToPenStyle({ color: '#000', width: 3 });
  assert.equal(pen.strokeStyle, 'solid');
  assert.equal(pen.opacity, 1);
  assert.equal(pen.sloppiness, 'architectural');
});

test('sloppiness is recovered from the roughness the stroke stored', () => {
  assert.equal(strokeToPenStyle({ color: '#000', width: 3, roughness: 0 }).sloppiness, 'architectural');
  assert.equal(strokeToPenStyle({ color: '#000', width: 3, roughness: 1.4 }).sloppiness, 'artist');
  assert.equal(strokeToPenStyle({ color: '#000', width: 3, roughness: 2.5 }).sloppiness, 'cartoonist');
});

test('picking a colour, a dash or an opacity leaves the drawn geometry alone', () => {
  const drawn = { id: 's', points: [{ x: 0, y: 0 }], color: '#000', width: 2.5, preset: 'sketch' };

  for (const patch of [{ color: '#EF4444' }, { strokeStyle: 'dotted' }, { opacity: 0.3 }]) {
    const restyled = applyPenStyleToStroke(drawn, patch);

    // The nib — width, tracking, taper and wander — is what a nib *is*, and a
    // colour change must not quietly redraw the line with a different pen.
    assert.equal(restyled.width, drawn.width);
    assert.equal(restyled.preset, drawn.preset);
    assert.equal(restyled.smoothing, undefined);
    assert.equal(restyled.taper, undefined);
    assert.deepEqual(restyled.points, drawn.points);
    assert.equal(restyled.id, 's');
  }
});

test('picking a nib rewrites the whole nib, not just its width', () => {
  const drawn = { id: 's', points: [{ x: 0, y: 0 }], color: '#000', width: 2, preset: 'precise' };
  const restyled = applyPenStyleToStroke(drawn, { preset: 'marker' });

  // A marker with a fine pen's width would describe a nib that does not exist.
  const nib = penInkGeometry({ preset: 'marker', sloppiness: 'architectural' });
  assert.equal(restyled.width, nib.width);
  assert.equal(restyled.smoothing, nib.smoothing);
  assert.equal(restyled.taper, nib.taper);
  // The stroke's own roughness was unset, i.e. architectural — a nib change
  // neither invents wander nor loses it.
  assert.equal(restyled.roughness, nib.roughness);
  assert.equal(restyled.preset, 'marker');
});

test('picking a sloppiness rewrites the nib too, since wander is part of it', () => {
  const drawn = { id: 's', points: [{ x: 0, y: 0 }], color: '#000', width: 3, preset: 'natural' };
  const restyled = applyPenStyleToStroke(drawn, { sloppiness: 'cartoonist' });

  assert.equal(restyled.roughness, 2.5);
  assert.equal(restyled.width, STROKE_PRESETS.natural.width);
  assert.equal(restyled.preset, 'natural');
});

test('restyling ink keeps every field the patch does not name', () => {
  const drawn = {
    id: 's',
    points: [{ x: 0, y: 0 }],
    color: '#000',
    width: 3,
    preset: 'natural',
    roughness: 1.4,
    smoothing: 0.6,
    taper: 0.6,
    marker: 'kept',
  };
  const restyled = applyPenStyleToStroke(drawn, { color: '#10B981' });

  assert.equal(restyled.color, '#10B981');
  assert.equal(restyled.roughness, 1.4);
  assert.equal(restyled.marker, 'kept');
});

test('resetting ink to the pen default restores the factory nib', () => {
  const drawn = {
    id: 's',
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    color: '#EF4444',
    width: 6,
    preset: 'marker',
    roughness: 2.5,
    strokeStyle: 'dashed',
    opacity: 0.4,
  };
  const reset = applyPenStyleToStroke(drawn, DEFAULT_PEN_STYLE);

  assert.equal(reset.color, DEFAULT_PEN_STYLE.color);
  assert.equal(reset.preset, DEFAULT_PEN_STYLE.preset);
  assert.equal(reset.width, STROKE_PRESETS[DEFAULT_PEN_STYLE.preset].width);
  assert.equal(reset.roughness, 0);
  assert.equal(reset.strokeStyle, 'solid');
  assert.equal(reset.opacity, 1);
  // The mark itself is not redrawn — only how it is painted.
  assert.deepEqual(reset.points, drawn.points);
  assert.equal(reset.id, 's');
});
