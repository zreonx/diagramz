import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTsResolver } from '../../../../test/register-ts-resolver.mjs';

registerTsResolver();

const { isExcalidrawElementArray, renderElementArray } = await import(
  './element-array.ts'
);

/** An element array holding one rectangle, with only the fields under test set. */
function arrayOf(overrides = {}) {
  return [
    {
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      strokeColor: '#111111',
      backgroundColor: 'transparent',
      strokeWidth: 2,
      ...overrides,
    },
  ];
}

const DARK = { isDark: true };
const LIGHT = { isDark: false };

test('a well-formed element array is recognised', () => {
  assert.equal(isExcalidrawElementArray(arrayOf()), true);
});

test('an empty array, a non-array and a non-element are all rejected', () => {
  assert.equal(isExcalidrawElementArray([]), false, 'nothing to draw');
  assert.equal(isExcalidrawElementArray(null), false);
  assert.equal(isExcalidrawElementArray(undefined), false);
  assert.equal(isExcalidrawElementArray('rectangle'), false);
  assert.equal(isExcalidrawElementArray([{ x: 0, y: 0 }]), false, 'no type');
  assert.equal(isExcalidrawElementArray([null]), false);
});

test('a rectangle draws a rect on the bounds of the array', () => {
  const { markup } = renderElementArray(arrayOf(), DARK);

  assert.ok(markup.includes('<rect'));
  assert.ok(markup.includes('width="100"'));
  assert.ok(markup.includes('height="50"'));
});

test('the view box is the array bounds plus a margin', () => {
  const { viewBox } = renderElementArray(arrayOf(), DARK);

  assert.ok(viewBox.x < 0, 'the bounds are padded outward');
  assert.ok(viewBox.y < 0);
  assert.ok(viewBox.width > 100);
  assert.ok(viewBox.height > 50);
  assert.ok(Number.isFinite(viewBox.width) && Number.isFinite(viewBox.height));
});

test('a point-list element is measured by its points, not by its width field', () => {
  // Excalidraw writes `width`/`height` on a line too, but the points are what is
  // actually drawn, and they run past those fields often enough to matter.
  const { viewBox } = renderElementArray(
    [
      {
        type: 'line',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        points: [
          [0, 0],
          [200, 120],
        ],
      },
    ],
    DARK
  );

  assert.ok(viewBox.width > 200, 'the far point is inside the box');
  assert.ok(viewBox.height > 120);
});

test('a degenerate array still produces a view box with area', () => {
  // A zero-area viewBox makes the SVG renderer divide by zero and draw nothing.
  const { viewBox } = renderElementArray([{ type: 'rectangle', x: 5, y: 5 }], DARK);

  assert.ok(viewBox.width > 0);
  assert.ok(viewBox.height > 0);
});

test('a rotated element is measured by its rotated corners', () => {
  const upright = renderElementArray(arrayOf({ width: 100, height: 20 }), DARK);
  const turned = renderElementArray(
    arrayOf({ width: 100, height: 20, angle: Math.PI / 2 }),
    DARK
  );

  assert.ok(
    turned.viewBox.width < upright.viewBox.width,
    'a quarter turn swaps the footprint'
  );
  assert.ok(turned.viewBox.height > upright.viewBox.height);
});

test('Excalidraw default ink is mapped onto the theme', () => {
  // A stored stencil usually carries `#1e1e1e`, which would draw black on a
  // dark plate if it were honoured literally.
  for (const ink of ['#000000', '#000', '#1e1e1e']) {
    assert.ok(
      renderElementArray(arrayOf({ strokeColor: ink }), DARK).markup.includes('#f4f4f5'),
      `${ink} should become the dark theme's ink`
    );
    assert.ok(
      renderElementArray(arrayOf({ strokeColor: ink }), LIGHT).markup.includes('#18181b'),
      `${ink} should become the light theme's ink`
    );
  }
});

test('a colour the user actually chose is honoured', () => {
  const { markup } = renderElementArray(arrayOf({ strokeColor: '#ff00ff' }), DARK);

  assert.ok(markup.includes('#ff00ff'));
});

test('a colour that is not a colour is dropped, not escaped', () => {
  // The value comes from persisted JSON. `url(#x)` contains nothing an escaper
  // would touch, so it has to be rejected rather than escaped.
  const { markup } = renderElementArray(
    arrayOf({ strokeColor: 'url(#gradient)' }),
    DARK
  );

  assert.ok(!markup.includes('url('));
  assert.ok(markup.includes('#f4f4f5'), 'it falls back to the theme ink');
});

test('a transparent background draws no fill', () => {
  assert.ok(renderElementArray(arrayOf(), DARK).markup.includes('fill="none"'));
});

test('an element text is escaped, because it is the one field the user writes', () => {
  const { markup } = renderElementArray(
    [{ type: 'text', x: 0, y: 0, width: 40, height: 20, text: 'a & b <c>' }],
    DARK
  );

  assert.ok(markup.includes('a &amp; b &lt;c&gt;'));
  assert.ok(!markup.includes('<c>'), 'no raw markup from a label reaches the document');
});

test('an element with no text exports an empty text node rather than throwing', () => {
  const { markup } = renderElementArray(
    [{ type: 'text', x: 0, y: 0, width: 40, height: 20 }],
    DARK
  );

  assert.ok(markup.includes('></text>'));
});

test('the filled variant of a line is closed and the unfilled one is not', () => {
  const points = [
    [0, 0],
    [50, 50],
    [100, 0],
  ];
  const filled = renderElementArray(
    [{ type: 'line', x: 0, y: 0, backgroundColor: '#ff0000', points }],
    DARK
  ).markup;
  const hollow = renderElementArray(
    [{ type: 'line', x: 0, y: 0, points }],
    DARK
  ).markup;

  assert.ok(filled.includes(' Z"'), 'a filled outline closes back on itself');
  assert.ok(!hollow.includes(' Z"'));
});

test('an arrow is never closed, and never filled', () => {
  const { markup } = renderElementArray(
    [
      {
        type: 'arrow',
        x: 0,
        y: 0,
        backgroundColor: '#ff0000',
        points: [
          [0, 0],
          [50, 50],
        ],
      },
    ],
    DARK
  );

  assert.ok(!markup.includes(' Z"'));
  assert.ok(markup.includes('fill="none"'));
});

test('a dash style becomes a dash pattern', () => {
  assert.ok(
    renderElementArray(arrayOf({ strokeStyle: 'dashed' }), DARK).markup.includes(
      'stroke-dasharray="6,6"'
    )
  );
  assert.ok(
    renderElementArray(arrayOf({ strokeStyle: 'dotted' }), DARK).markup.includes(
      'stroke-dasharray="2,4"'
    )
  );
  assert.ok(
    !renderElementArray(arrayOf({ strokeStyle: 'solid' }), DARK).markup.includes(
      'stroke-dasharray'
    )
  );
});

test('a stroke width below one is raised to one', () => {
  const { markup } = renderElementArray(arrayOf({ strokeWidth: 0 }), DARK);

  assert.ok(markup.includes('stroke-width="1"'));
});

test('an unknown element type draws nothing rather than a wrong shape', () => {
  const { markup } = renderElementArray([{ type: 'freedraw', x: 0, y: 0 }], DARK);

  assert.equal(markup, '');
});

test('a malformed number never reaches the markup as NaN', () => {
  const { markup, viewBox } = renderElementArray(
    [
      {
        type: 'rectangle',
        x: 'nonsense',
        y: null,
        width: NaN,
        height: undefined,
        strokeWidth: 'thick',
      },
    ],
    DARK
  );

  assert.ok(!/\bNaN\b/.test(markup), 'NaN in one attribute invalidates the whole SVG');
  assert.ok(!markup.includes('undefined'));
  assert.ok(Number.isFinite(viewBox.width));
  assert.ok(Number.isFinite(viewBox.height));
});

test('the same array always renders the same markup', () => {
  const elements = arrayOf();
  assert.equal(
    renderElementArray(elements, DARK).markup,
    renderElementArray(elements, DARK).markup
  );
});

test('every shape kind renders without throwing', () => {
  // Cheap insurance against a shape that only fails on a document someone
  // actually saved years ago.
  for (const type of ['rectangle', 'ellipse', 'diamond', 'line', 'draw', 'arrow', 'text']) {
    const { markup } = renderElementArray(
      [
        {
          type,
          x: 4,
          y: 8,
          width: 60,
          height: 30,
          text: 'x',
          points: [
            [0, 0],
            [10, 10],
          ],
        },
      ],
      DARK
    );
    assert.ok(markup.length > 0, `${type} rendered nothing`);
    assert.ok(!/\bNaN\b/.test(markup), `${type} rendered NaN`);
  }
});
