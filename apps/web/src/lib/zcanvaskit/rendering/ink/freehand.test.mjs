import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTsResolver } from '../../../../../test/register-ts-resolver.mjs';

// The module reaches `../sketch/rough-svg`, `../../geometry` and
// `../../core/style-models` without file extensions, which Node cannot resolve
// on its own.
registerTsResolver();

const {
  cleanPoints,
  getInkOutline,
  inkPoints,
  inkRadii,
  outlineToPath,
  resolveInkRender,
  roughenPoints,
  streamlinePoints,
  subdivideOutline,
} = await import('./freehand.ts');

const { STROKE_PRESETS } = await import('../../core/style-models.ts');

/** A nib with no smoothing, wander or taper — the simplest possible ink. */
const PLAIN = { width: 4, smoothing: 0, roughness: 0, taper: 0 };

/** A straight trail of `count` points, one pixel apart, along the x axis. */
function trail(count) {
  return Array.from({ length: count }, (_, i) => ({ x: i, y: 0 }));
}

/** The length of a polyline. */
function length(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

/** A trail with visible tremor on it: the shape a shaky hand leaves. */
function shakyTrail(count) {
  return Array.from({ length: count }, (_, i) => ({
    x: i,
    y: (i % 2 === 0 ? 1 : -1) * 1.5,
  }));
}

/** A circle of `radius`, sampled every `spacing` pixels along its edge. */
function circlePoints(cx, cy, radius, spacing) {
  const step = (spacing / radius) * (180 / Math.PI);
  const points = [];

  for (let angle = 0; angle <= 360; angle += step) {
    const t = (angle * Math.PI) / 180;
    points.push({ x: cx + Math.cos(t) * radius, y: cy + Math.sin(t) * radius });
  }

  return points;
}

/** How far the furthest sample of a trail strays off a circle. */
function maxDeviation(points, cx, cy, radius) {
  const interior = points.slice(1, -1);
  return Math.max(...interior.map((p) => Math.abs(Math.hypot(p.x - cx, p.y - cy) - radius)));
}

test('samples the pointer did not move for are dropped', () => {
  const cleaned = cleanPoints([
    { x: 0, y: 0 },
    { x: 0.1, y: 0 },
    { x: 0.2, y: 0 },
    { x: 5, y: 0 },
    { x: 5.1, y: 0 },
  ]);

  // The real move — 0 to 5 — survives, along with the release position at the
  // end. The four resting samples in between are the pointer sitting still.
  assert.deepEqual(cleaned, [
    { x: 0, y: 0 },
    { x: 5.1, y: 0 },
  ]);
});

test('a stroke still ends where the pointer was released', () => {
  // The release position is a sub-pixel move away, so a naive cleaner would
  // drop it and stop the ink short of the hand.
  const cleaned = cleanPoints([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10.2, y: 0.1 },
  ]);

  assert.deepEqual(cleaned[cleaned.length - 1], { x: 10.2, y: 0.1 });
});

test('a stroke that never moved is a single sample, not nothing', () => {
  const cleaned = cleanPoints([
    { x: 4, y: 4 },
    { x: 4, y: 4 },
    { x: 4.1, y: 4 },
  ]);

  assert.deepEqual(cleaned, [{ x: 4, y: 4 }, { x: 4.1, y: 4 }]);
  assert.equal(cleanPoints([{ x: 4, y: 4 }]).length, 1);
});

test('streamlining takes the tremor out of a shaky trail', () => {
  const raw = shakyTrail(40);
  const smoothed = streamlinePoints(raw, 0.8);

  // The trail stops zig-zagging: its length collapses towards the straight
  // line the hand meant to draw.
  assert.ok(
    length(smoothed) < length(raw) * 0.5,
    `${length(smoothed)} should be well under ${length(raw)}`
  );
});

test('streamlining is anchored at both ends of the stroke', () => {
  const raw = shakyTrail(30);
  const smoothed = streamlinePoints(raw, 0.9);

  assert.deepEqual(smoothed[0], raw[0]);
  assert.deepEqual(smoothed[smoothed.length - 1], raw[raw.length - 1]);
});

test('smoothing 0 leaves the stroke as the hand drew it', () => {
  const raw = shakyTrail(20);

  assert.deepEqual(streamlinePoints(raw, 0), raw);
});

test('a very short trail is never smoothed into a different shape', () => {
  const raw = [{ x: 0, y: 0 }, { x: 1, y: 1 }];

  assert.deepEqual(streamlinePoints(raw, 0.9), raw);
});

test('smoothing does not pull a curve off the path the hand drew', () => {
  // The reason the smoother averages a sample's *neighbours* rather than easing
  // towards each new one: an easing filter can only lag, so on a curve drawn at
  // speed it lands several pixels inside the path the hand actually took.
  // Averaging is symmetric, so what comes out sits on the path.
  for (const radius of [40, 20]) {
    for (const spacing of [3, 6]) {
      const drawn = circlePoints(80, 80, radius, spacing);
      const smoothed = streamlinePoints(drawn, 0.8);
      const drift = maxDeviation(smoothed, 80, 80, radius);

      assert.ok(drift < 0.5, `radius ${radius} sampled every ${spacing}px drifted ${drift}px`);
    }
  }
});

test('a tight letter loop stays a loop rather than collapsing inwards', () => {
  // An 8px loop is about as tight as a handwritten 'o' gets, and it is the
  // worst case for averaging: a window of `reach` pixels across a curve of
  // radius r pulls the line in by about reach²/8r. That is around a pixel at
  // the pen's window — a slightly smaller 'o', never a different letter.
  const drawn = circlePoints(50, 50, 8, 2);
  const smoothed = streamlinePoints(drawn, 0.8);
  const drift = maxDeviation(smoothed, 50, 50, 8);

  assert.ok(drift < 1.2, `drifted ${drift}px`);
});

test('a straight run of samples stays exactly on its line', () => {
  // A weighted average of collinear points is a point on the same line. Any
  // weight that is not applied to both coordinates equally would bow the line.
  const straight = Array.from({ length: 30 }, (_, i) => ({ x: i * 4, y: 7 }));

  for (const smoothing of [0.5, 0.8, 1]) {
    for (const point of streamlinePoints(straight, smoothing)) {
      assert.ok(Math.abs(point.y - 7) < 1e-9, `y=${point.y} at smoothing ${smoothing}`);
    }
  }
});

test('the same path draws the same line however densely it was sampled', () => {
  // Two pointers, one reporting every 3px and one every 6px, traced the same
  // circle. The drawn line must not depend on which of them was holding the
  // pen — a filter measured in samples rather than in pixels would smooth the
  // slower hand twice as hard and draw two different letters.
  const coarse = circlePoints(80, 80, 40, 6);
  const fine = [];
  for (let i = 0; i < coarse.length; i++) {
    const next = coarse[(i + 1) % coarse.length];
    fine.push(coarse[i], { x: (coarse[i].x + next.x) / 2, y: (coarse[i].y + next.y) / 2 });
  }

  const fromCoarse = streamlinePoints(coarse, 0.8);
  const fromFine = streamlinePoints(fine, 0.8);

  for (let i = 1; i < fromCoarse.length - 1; i++) {
    const twin = fromFine[i * 2]; // the same position on the path
    const gap = Math.hypot(fromCoarse[i].x - twin.x, fromCoarse[i].y - twin.y);
    assert.ok(gap < 0.1, `sample ${i} moved ${gap}px`);
  }
});

test('samples spaced wider than the window are left where the hand put them', () => {
  // The window is a physical size, not a smoothing strength to be scaled up
  // until it bites: a stroke drawn fast enough that consecutive samples are
  // 20px apart is a line the hand meant, and re-drawing it smoother would be
  // inventing a stroke the user did not make.
  const fast = circlePoints(80, 80, 40, 20);

  assert.deepEqual(streamlinePoints(fast, 0.8), fast);
});

test('the sloppiness wander is identical on every repaint', () => {
  // A stroke whose wobble changed each time it was painted would visibly boil.
  const raw = trail(20);
  const once = roughenPoints(raw, 2.5, 'stroke-abc');
  const twice = roughenPoints(raw, 2.5, 'stroke-abc');
  const other = roughenPoints(raw, 2.5, 'stroke-xyz');

  assert.deepEqual(once, twice);
  assert.notDeepEqual(once, other);
});

test('clean ink is not wandered at all', () => {
  const raw = trail(20);

  assert.deepEqual(roughenPoints(raw, 0, 'seed'), raw);
});

test('the wander stays within the sloppiness it was asked for', () => {
  const raw = trail(40);
  const wandered = roughenPoints(raw, 2.5, 'seed');

  // 2.5 is the loosest level; the offset is capped at reach / 2 either side.
  for (const point of wandered) {
    assert.ok(Math.abs(point.y) <= 2.5 * 0.7 * 0.5 + 1e-9, `y=${point.y}`);
  }
  // …and it did wander, rather than silently doing nothing.
  assert.ok(wandered.some((p) => Math.abs(p.y) > 0.1));
});

test('the wander meanders rather than buzzing from sample to sample', () => {
  // Per-sample noise would turn every other sample into a spike. A walk moves
  // the line a little at a time, so consecutive offsets stay close. The ends are
  // skipped: they are pinned to the hand, so they jump back by construction.
  const wandered = roughenPoints(trail(60), 2.5, 'seed');
  let biggestJump = 0;
  for (let i = 2; i < wandered.length - 1; i++) {
    biggestJump = Math.max(biggestJump, Math.abs(wandered[i].y - wandered[i - 1].y));
  }

  assert.ok(biggestJump < 0.3, `largest step ${biggestJump}`);
});

test('the wander is anchored to where the stroke began and ended', () => {
  const raw = trail(20);
  const wandered = roughenPoints(raw, 2.5, 'seed');

  assert.deepEqual(wandered[0], raw[0]);
  assert.deepEqual(wandered[wandered.length - 1], raw[raw.length - 1]);
});

test('a blunt nib keeps its full width from end to end', () => {
  const points = trail(60);
  const radii = inkRadii(points, { ...PLAIN, taper: 0 });

  assert.deepEqual(new Set(radii), new Set([2]));
});

test('a tapered nib is thin at the tips and full through the body', () => {
  const points = trail(80);
  const radii = inkRadii(points, { ...PLAIN, taper: 1 });
  const middle = radii[Math.floor(radii.length / 2)];

  assert.ok(radii[0] < middle, `tip ${radii[0]} should be under body ${middle}`);
  assert.ok(radii[radii.length - 1] < middle);
  // Never a degenerate point: the outline has to be fillable.
  assert.ok(radii[0] > 0);
});

test('taper scales with the stroke, so a short flick keeps a body', () => {
  const short = inkRadii(trail(8), { ...PLAIN, taper: 1 });
  const middle = short[Math.floor(short.length / 2)];

  // A 7px stroke that tapered over a fixed 24px would be all tip and no body.
  assert.equal(middle, 2);
});

test('every nib the pen offers lays down one width from end to end', () => {
  // Handwriting is not calligraphy. A nib that thins at the tips blobs the end
  // of every letter — at a 3px nib and a 40px letter, more than half of each
  // stroke is thinned — so whatever nib is selected, the mark is one width.
  for (const [preset, nib] of Object.entries(STROKE_PRESETS)) {
    const radii = new Set(
      inkRadii(trail(60), {
        width: nib.width,
        smoothing: nib.smoothing,
        roughness: 0,
        taper: nib.taper,
      })
    );

    assert.equal(radii.size, 1, `${preset} nib drew ${radii.size} widths: ${[...radii]}`);
  }
});

test('the outline closes with a cap at each end, not a fold', () => {
  const points = trail(5);
  const outline = getInkOutline(points, [2, 2, 2, 2, 2]);

  // One vertex pair per sample, plus a cap at each end. A cap samples its half
  // turn with 13 points and drops the two the sides already supply, so it
  // contributes 11 — with no duplicate of the vertices it hands back to.
  assert.equal(outline.length, 5 * 2 + 11 * 2);

  // The path opens on the left of the first sample and closes back beside it,
  // so the closing edge finishes the cap rather than crossing it.
  assert.deepEqual(outline[0], { x: 0, y: 2 });
  assert.ok(Math.hypot(outline[outline.length - 1].x - 0, outline[outline.length - 1].y - 2) < 1);

  // The start cap sweeps *behind* the stroke — no vertex of it lands in front
  // of the first sample, which would fold the cap back over the body.
  for (const point of outline.slice(21)) {
    assert.ok(point.x <= 1e-9, `start cap vertex at x=${point.x}`);
  }
  // …and the end cap sweeps ahead of the last sample, for the same reason.
  for (const point of outline.slice(5, 16)) {
    assert.ok(point.x >= 4 - 1e-9, `end cap vertex at x=${point.x}`);
  }
});

test('a straight stroke outlines as a band of the nib’s width', () => {
  const points = trail(10);
  const radii = inkRadii(points, PLAIN);
  const outline = getInkOutline(points, radii);

  // Two pixels either side of the centreline, everywhere: a horizontal stroke
  // is a 4px-tall band.
  assert.ok(outline.every((p) => Math.abs(p.y) <= 2 + 1e-9));
  assert.ok(outline.some((p) => p.y > 1.9));
  assert.ok(outline.some((p) => p.y < -1.9));
});

test('the caps round the ends of the stroke rather than cutting them', () => {
  const points = trail(3);
  const outline = getInkOutline(points, [2, 2, 2]);

  // The start cap reaches half a nib behind the first sample.
  assert.ok(Math.min(...outline.map((p) => p.x)) < -1.5);
  // …and the end cap the same distance past the last.
  assert.ok(Math.max(...outline.map((p) => p.x)) > 3.5);
});

test('a tap of the pen outlines as a dot', () => {
  const outline = getInkOutline([{ x: 10, y: 10 }], [3]);

  assert.equal(outline.length, 24);
  for (const point of outline) {
    assert.ok(Math.abs(Math.hypot(point.x - 10, point.y - 10) - 3) < 1e-9);
  }
});

test('an outline with no points produces no path', () => {
  assert.equal(getInkOutline([], []).length, 0);
  assert.equal(outlineToPath([]), '');
  assert.equal(outlineToPath([{ x: 0, y: 0 }, { x: 1, y: 1 }]), '');
});

test('an outline becomes one closed path', () => {
  const outline = getInkOutline(trail(4), [2, 2, 2, 2]);
  const d = outlineToPath(outline);

  assert.match(d, /^M /);
  assert.match(d, / Z$/);
  // Straight segments, not a spline: an outline's vertices are unevenly spaced,
  // and a Catmull-Rom through them flings control points off the caps.
  assert.doesNotMatch(d, /C /);
  // One line per densified vertex, wrapping back round to the start.
  const densified = subdivideOutline(outline);
  assert.equal((d.match(/L /g) ?? []).length, densified.length - 1);
});

test('solid ink is a filled body, not a stroked line', () => {
  const ink = resolveInkRender({
    id: 's1',
    points: trail(30),
    color: '#635BFF',
    width: 4,
    smoothing: 0.6,
    roughness: 0,
    taper: 0.6,
    strokeStyle: 'solid',
  });

  assert.equal(ink.fill, '#635BFF');
  assert.equal(ink.stroke, 'none');
  assert.equal(ink.strokeWidth, 0);
  assert.equal(ink.strokeDasharray, undefined);
  assert.match(ink.d, /^M /);
  assert.match(ink.d, / Z$/);
});

test('a dashed nib is a stroked centreline, because a dash describes a line', () => {
  const ink = resolveInkRender({
    id: 's1',
    points: trail(30),
    color: '#635BFF',
    width: 4,
    smoothing: 0.6,
    roughness: 0,
    taper: 0.6,
    strokeStyle: 'dashed',
  });

  assert.equal(ink.fill, 'none');
  assert.equal(ink.stroke, '#635BFF');
  assert.equal(ink.strokeWidth, 4);
  assert.equal(ink.strokeDasharray, '12 8');
  assert.doesNotMatch(ink.d, / Z$/);
});

test('a tap of a dashed nib is still visible', () => {
  const ink = resolveInkRender({
    id: 's1',
    points: [{ x: 5, y: 5 }],
    color: '#635BFF',
    width: 4,
    strokeStyle: 'dotted',
  });

  assert.notEqual(ink.d, '');
  assert.equal(ink.fill, 'none');
});

test('a tap of a solid nib is a filled dot', () => {
  const ink = resolveInkRender({
    id: 's1',
    points: [{ x: 5, y: 5 }],
    color: '#635BFF',
    width: 6,
    taper: 0.6,
  });

  assert.equal(ink.fill, '#635BFF');
  assert.match(ink.d, / Z$/);
  // Full width, not tapered to nothing: there is no body to thin. A 6px nib
  // centred on (5, 5) reaches from x=8 round to x=2.
  assert.match(ink.d, /^M 8 5 /);
  assert.match(ink.d, /L 2 5 /);
});

test('ink with no points paints nothing at all', () => {
  const ink = resolveInkRender({ id: 's1', points: [], color: '#635BFF', width: 4 });

  assert.deepEqual(ink, { d: '', fill: 'none', stroke: 'none', strokeWidth: 0 });
});

test('legacy ink with no nib settings still draws as a plain line', () => {
  // Documents written before ink had smoothing, taper or sloppiness.
  const ink = resolveInkRender({
    id: 'legacy',
    points: trail(10),
    color: '#635BFF',
    width: 2,
  });

  assert.equal(ink.fill, '#635BFF');
  assert.notEqual(ink.d, '');
});

test('the drawn trail is quantised, so a document stays small', () => {
  const points = inkPoints(
    [
      { x: 0.123456789, y: 0 },
      { x: 10.987654321, y: 4.44444444 },
    ],
    { ...PLAIN, smoothing: 0 },
    'seed'
  );

  assert.deepEqual(points, [
    { x: 0.1, y: 0 },
    { x: 11, y: 4.4 },
  ]);
});

test('the same stroke always resolves to the same geometry', () => {
  const stroke = {
    id: 's1',
    points: shakyTrail(60),
    color: '#635BFF',
    width: 3,
    smoothing: 0.6,
    roughness: 1.4,
    taper: 0.6,
    strokeStyle: 'solid',
  };

  assert.deepEqual(resolveInkRender(stroke), resolveInkRender(stroke));
});

test('a runaway gesture is capped rather than unbounded', () => {
  const points = inkPoints(trail(5000), PLAIN, 'seed');

  assert.ok(points.length <= 2000, `${points.length} samples`);
});
