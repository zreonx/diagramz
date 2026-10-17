import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTsResolver } from '../../../../test/register-ts-resolver.mjs';

registerTsResolver();

const { measureArtwork } = await import('./artwork-bounds.ts');

/** Measures one fragment and asserts the box, so a failure prints both. */
function measured(markup) {
  return measureArtwork(markup);
}

test('a basic shape is measured by its own geometry', () => {
  assert.deepEqual(measured('<rect x="10" y="20" width="30" height="40" />'), {
    x: 10,
    y: 20,
    width: 30,
    height: 40,
  });
  assert.deepEqual(measured('<circle cx="50" cy="50" r="20" />'), {
    x: 30,
    y: 30,
    width: 40,
    height: 40,
  });
  assert.deepEqual(measured('<ellipse cx="10" cy="20" rx="5" ry="15" />'), {
    x: 5,
    y: 5,
    width: 10,
    height: 30,
  });
  assert.deepEqual(measured('<line x1="0" y1="0" x2="10" y2="10" />'), {
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  });
  assert.deepEqual(measured('<polygon points="0,0 10,0 10,10" />'), {
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  });
  assert.deepEqual(measured('<polyline points="10 10, 30 10, 30 25" />'), {
    x: 10,
    y: 10,
    width: 20,
    height: 15,
  });
});

test('a rectangle is measured from its own corner, rounded corners included', () => {
  // `rx` and `ry` cut the corners inwards, so they can never reach past these
  // four points; measuring the arc would be work that cannot change the answer.
  assert.deepEqual(measured('<rect x="20" y="20" width="60" height="60" rx="8" />'), {
    x: 20,
    y: 20,
    width: 60,
    height: 60,
  });
});

test('a stroke reaches half its width past the outline it follows', () => {
  // Half the stroke lies outside the outline, which is the edge a person sees.
  assert.deepEqual(measured('<line x1="0" y1="0" x2="10" y2="0" stroke="#000" stroke-width="4" />'), {
    x: -2,
    y: -2,
    width: 14,
    height: 4,
  });
  assert.deepEqual(measured('<rect x="10" y="20" width="30" height="40" stroke="#000" stroke-width="1.5" />'), {
    x: 9.25,
    y: 19.25,
    width: 31.5,
    height: 41.5,
  });
});

test('a stroke with no width is one wide, and width zero is no ink', () => {
  // SVG's own rule: `stroke-width` defaults to 1 once a stroke paint is set.
  assert.deepEqual(measured('<rect x="0" y="0" width="10" height="10" stroke="#000" />'), {
    x: -0.5,
    y: -0.5,
    width: 11,
    height: 11,
  });
  assert.deepEqual(measured('<rect x="0" y="0" width="10" height="10" stroke="#000" stroke-width="0" />'), {
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  });
});

test('fill is not paint, and neither is a stroke of none', () => {
  assert.deepEqual(measured('<rect x="0" y="0" width="10" height="10" fill="#f00" />'), {
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  });
  assert.deepEqual(measured('<line x1="0" y1="0" x2="10" y2="10" stroke="none" stroke-width="4" />'), {
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  });
});

test('an element inherits the paint of the group it is in', () => {
  // Presentation attributes are inherited, so a group that strokes paints its
  // children. A box measured per element would sit inside that ink, and the box
  // is what the artwork is scaled by — the stroke would be cropped.
  assert.deepEqual(measured('<g stroke="#000" stroke-width="4"><circle cx="50" cy="50" r="10" /></g>'), {
    x: 38,
    y: 38,
    width: 24,
    height: 24,
  });
  // …unless the child says otherwise, in which case its own attributes win.
  assert.deepEqual(
    measured('<g stroke="#000" stroke-width="4"><circle cx="50" cy="50" r="10" stroke="#f00" stroke-width="1" /></g>'),
    { x: 39.5, y: 39.5, width: 21, height: 21 }
  );
});

test('the innermost group decides, and a group ends with its element', () => {
  assert.deepEqual(
    measured('<g stroke="#000" stroke-width="6"><g stroke-width="2"><rect x="10" y="10" width="20" height="20" /></g></g>'),
    { x: 9, y: 9, width: 22, height: 22 }
  );
  // The second rectangle is a sibling of the group, not a child of it.
  assert.deepEqual(
    measured('<g stroke="#000" stroke-width="4"><rect x="0" y="0" width="10" height="10" /></g><rect x="20" y="20" width="10" height="10" />'),
    { x: -2, y: -2, width: 32, height: 32 }
  );
});

test('a width with no stroke anywhere is not paint', () => {
  assert.deepEqual(
    measured('<g fill="#f00" stroke-width="8"><rect x="0" y="0" width="10" height="10" /></g>'),
    { x: 0, y: 0, width: 10, height: 10 }
  );
});

test('a group is transparent: only the shapes inside it are measured', () => {
  assert.deepEqual(measured('<g><g><circle cx="5" cy="5" r="5" /></g></g>'), {
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  });
  assert.deepEqual(measured('<circle cx="5" cy="5" r="5" /><rect x="40" y="40" width="10" height="10" />'), {
    x: 0,
    y: 0,
    width: 50,
    height: 50,
  });
});

test('a definition is not painted, so it is not measured', () => {
  // A `<defs>` is a shelf, not a drawing: nothing on it reaches the screen until
  // something references it. Measuring it would put the box around ink that is
  // never painted, which is how a fragment ends up with padding again.
  assert.deepEqual(
    measured('<defs><rect x="0" y="0" width="100" height="100" /></defs><circle cx="50" cy="50" r="10" />'),
    { x: 40, y: 40, width: 20, height: 20 }
  );
  assert.deepEqual(measured('<defs><rect x="0" y="0" width="100" height="100" /></defs>'), null);
});

test('an attribute may be quoted either way, and hold any spacing', () => {
  assert.deepEqual(measured("<rect x='10' y='20' width='30' height='40'/>"), {
    x: 10,
    y: 20,
    width: 30,
    height: 40,
  });
  assert.deepEqual(measured('<polygon points="0 , 0  10,0\n10,10" />'), {
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  });
});

test('a path draws with the commands it is written in, absolute or relative', () => {
  assert.deepEqual(measured('<path d="M 10 10 L 40 10 L 40 30" />'), {
    x: 10,
    y: 10,
    width: 30,
    height: 20,
  });
  assert.deepEqual(measured('<path d="m 10 10 l 30 0 l 0 20" />'), {
    x: 10,
    y: 10,
    width: 30,
    height: 20,
  });
  assert.deepEqual(measured('<path d="M 10 10 H 40 V 30" />'), {
    x: 10,
    y: 10,
    width: 30,
    height: 20,
  });
  assert.deepEqual(measured('<path d="m 10 10 h 30 v 20" />'), {
    x: 10,
    y: 10,
    width: 30,
    height: 20,
  });
});

test('parameters after a moveto are linetos, and the move itself is not one', () => {
  // The first pair of an `M` starts a subpath; every pair after it, up to the
  // next command letter, is a lineto. Reading the whole run as linetos would
  // draw a line from the origin; reading it all as moves would draw nothing.
  assert.deepEqual(measured('<path d="M 10 10 20 20 30 10" />'), {
    x: 10,
    y: 10,
    width: 20,
    height: 10,
  });
});

test('closing a subpath returns the pen to where it started', () => {
  assert.deepEqual(measured('<path d="M 10 10 L 40 10 Z l 10 10" />'), {
    x: 10,
    y: 10,
    width: 30,
    height: 10,
  });
});

test('a curve is measured by its extrema, not by its control points', () => {
  // Control points pull the curve without being on it: this one reaches y=75
  // halfway along, where its controls sit at y=100.
  assert.deepEqual(measured('<path d="M 0 0 C 0 100 100 100 100 0" />'), {
    x: 0,
    y: 0,
    width: 100,
    height: 75,
  });
  assert.deepEqual(measured('<path d="M 0 0 Q 50 100 100 0" />'), {
    x: 0,
    y: 0,
    width: 100,
    height: 50,
  });
});

test('a smooth continuation reflects the control point before it', () => {
  // `S` and `T` take one control point and mirror the previous one through the
  // current point. Without that, the second half of each of these is measured
  // as if it were pulled a shorter way, and the box comes out inside the curve.
  assert.deepEqual(measured('<path d="M 0 0 C 10 20 30 20 40 0 S 70 -20 80 0" />'), {
    x: 0,
    y: -15,
    width: 80,
    height: 30,
  });
  assert.deepEqual(measured('<path d="M 0 0 Q 25 50 50 0 T 100 0" />'), {
    x: 0,
    y: -25,
    width: 100,
    height: 50,
  });
});

test('an arc is measured by the extremes it sweeps through', () => {
  // An arc is stated by its endpoints, so the far side of the curve is written
  // down nowhere. These two are half-turns: measured by their endpoints alone
  // they would be flat lines, and both are a semicircle.
  assert.deepEqual(measured('<path d="M 0 50 A 50 50 0 0 1 100 50" />'), {
    x: 0,
    y: 0,
    width: 100,
    height: 50,
  });
  assert.deepEqual(measured('<path d="M 0 50 A 50 50 0 0 0 100 50" />'), {
    x: 0,
    y: 50,
    width: 100,
    height: 50,
  });
});

test('arc flags may be written without separators', () => {
  // `a50 50 0 01100 0` is legal path data: the two flags are single characters
  // and the run after them is one number. Splitting on separators would read
  // the flags as part of `1100` and put the endpoint 1100 units away.
  assert.deepEqual(measured('<path d="M 0 50 a50 50 0 01100 0" />'), {
    x: 0,
    y: 0,
    width: 100,
    height: 50,
  });
});

test('radii too small to span their endpoints are grown, as a renderer grows them', () => {
  assert.deepEqual(measured('<path d="M 0 0 A 1 1 0 0 1 100 0" />'), {
    x: 0,
    y: -50,
    width: 100,
    height: 50,
  });
});

test('an arc with a zero radius is the line the grammar says it is', () => {
  assert.deepEqual(measured('<path d="M 0 0 A 0 0 0 0 1 60 60" />'), {
    x: 0,
    y: 0,
    width: 60,
    height: 60,
  });
});

test('a path command the grammar does not have is an error, not a guess', () => {
  // A typo in an artwork fragment should stop the build rather than quietly
  // produce a box that crops the drawing or puts it off-centre.
  assert.throws(
    () => measured('<path d="M 0 0 X 10 10" />'),
    /Unsupported path command "X"/
  );
  assert.throws(() => measured('<path d="10 10 L 40 40" />'), /without a command/);
});

test('a label is measured around the point it is anchored to', () => {
  // Text is the module's one approximation: without a font there is no exact
  // answer, so a glyph is taken as 0.6 of the font size wide and the em box as
  // the font size tall.
  assert.deepEqual(
    measured('<text x="50" y="40" font-size="10" text-anchor="middle" dominant-baseline="middle">/api/v1</text>'),
    { x: 29, y: 35, width: 42, height: 10 }
  );
  // The defaults: anchored at its start, sitting on its baseline.
  assert.deepEqual(measured('<text x="10" y="20" font-size="10">Hi</text>'), {
    x: 10,
    y: 12,
    width: 12,
    height: 10,
  });
  // Font size defaults to 16, as in CSS.
  assert.deepEqual(measured('<text x="0" y="0">ab</text>'), {
    x: 0,
    y: -12.8,
    width: 19.2,
    height: 16,
  });
});

test('the characters a label says cannot end its element early', () => {
  assert.deepEqual(measured('<text x="1" y="2" font-size="10">a > b</text>'), {
    x: 1,
    y: -6,
    width: 30,
    height: 10,
  });
});

test('the characters an attribute says cannot end its element early', () => {
  // A `>` inside a colour or a path is not the end of the tag.
  assert.deepEqual(
    measured('<path d="M 0 0 L 30 30" stroke="#000" stroke-width="4" />'),
    { x: -2, y: -2, width: 34, height: 34 }
  );
});

test('markup that draws nothing says so rather than guessing', () => {
  assert.equal(measured(''), null);
  assert.equal(measured('<g></g>'), null);
  assert.equal(measured('<title>A title</title>'), null);
  assert.equal(measured('<style>.a { fill: red }</style>'), null);
  assert.equal(measured('<path />'), null);
  // A label that says nothing still says where it is, so it is a box: empty,
  // but placed.
  assert.deepEqual(measured('<text x="10" y="10" font-size="10"></text>'), {
    x: 10,
    y: 2,
    width: 0,
    height: 10,
  });
});

test('a shape with no extent anywhere is a box with no extent', () => {
  // Still a box rather than `null`: it says where the drawing is, which is
  // something the caller can act on. Both callers guard the degenerate case —
  // `stencilTransform` falls back to a scale of one and `placedSize` to a
  // square — so a fragment like this lands a small node rather than nothing.
  assert.deepEqual(measured('<rect x="10" y="10" width="0" height="0" />'), {
    x: 10,
    y: 10,
    width: 0,
    height: 0,
  });
});

test('every number comes back with at most two decimals', () => {
  const box = measured('<circle cx="10" cy="10" r="3.333" stroke="#000" stroke-width="1.5" />');

  assert.deepEqual(box, { x: 5.92, y: 5.92, width: 8.17, height: 8.17 });
  for (const value of Object.values(box)) {
    assert.equal(value, Math.round(value * 100) / 100, `${value} is not rounded`);
  }
});
