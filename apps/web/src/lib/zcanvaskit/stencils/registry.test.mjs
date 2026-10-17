import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTsResolver } from '../../../../test/register-ts-resolver.mjs';

registerTsResolver();

const { createStencilRegistry, stencilTransform, stencilViewBox } = await import(
  './registry.ts'
);
const { DEFAULT_STENCIL_VIEW_BOX } = await import('./types.ts');

/** A definition with only the fields under test spelled out. */
function stencil(overrides = {}) {
  return {
    id: 's1',
    title: 'Stencil',
    subtitle: '',
    description: '',
    category: 'Test',
    defaultWidth: 100,
    defaultHeight: 100,
    accentColor: '#000000',
    render: () => '<g />',
    ...overrides,
  };
}

test('a registered stencil is found by its id', () => {
  const registry = createStencilRegistry([stencil({ id: 'a' }), stencil({ id: 'b' })]);

  assert.equal(registry.get('a')?.id, 'a');
  assert.equal(registry.get('b')?.id, 'b');
  assert.equal(registry.get('c'), undefined);
});

test('an unknown id is absent rather than throwing', () => {
  const registry = createStencilRegistry([]);

  assert.equal(registry.has('nope'), false);
  assert.equal(registry.get('nope'), undefined);
});

test('a duplicate id is a construction error, not a last-one-wins surprise', () => {
  assert.throws(
    () => createStencilRegistry([stencil({ id: 'dup' }), stencil({ id: 'dup' })]),
    /Duplicate stencil id: dup/
  );
});

test('list keeps registration order, so a library renders in a stable order', () => {
  const registry = createStencilRegistry([
    stencil({ id: 'c' }),
    stencil({ id: 'a' }),
    stencil({ id: 'b' }),
  ]);

  assert.deepEqual(
    registry.list().map((s) => s.id),
    ['c', 'a', 'b']
  );
});

test('list is not a window onto the registry internals', () => {
  const registry = createStencilRegistry([stencil({ id: 'a' })]);
  const list = registry.list();

  assert.equal(list.length, 1);
  assert.equal(registry.get('a')?.id, 'a');
});

test('stencils group by their category', () => {
  const registry = createStencilRegistry([
    stencil({ id: 'a', category: 'Compute' }),
    stencil({ id: 'b', category: 'Storage' }),
    stencil({ id: 'c', category: 'Compute' }),
  ]);

  const grouped = registry.byCategory();
  assert.deepEqual([...grouped.keys()], ['Compute', 'Storage']);
  assert.deepEqual(
    grouped.get('Compute')?.map((s) => s.id),
    ['a', 'c']
  );
  assert.deepEqual(
    grouped.get('Storage')?.map((s) => s.id),
    ['b']
  );
});

test('an empty query returns everything rather than nothing', () => {
  const registry = createStencilRegistry([stencil({ id: 'a' }), stencil({ id: 'b' })]);

  assert.equal(registry.search('').length, 2);
  assert.equal(registry.search('   ').length, 2, 'whitespace is not a search term');
});

test('search matches the id, title, subtitle and description', () => {
  const registry = createStencilRegistry([
    stencil({ id: 'arch-server', title: 'Server', subtitle: 'Blade', description: 'Rack' }),
    stencil({ id: 'arch-db', title: 'Database', subtitle: 'SQL', description: 'Storage' }),
  ]);

  assert.deepEqual(registry.search('arch-server').map((s) => s.id), ['arch-server']);
  assert.deepEqual(registry.search('server').map((s) => s.id), ['arch-server']);
  assert.deepEqual(registry.search('blade').map((s) => s.id), ['arch-server']);
  assert.deepEqual(registry.search('rack').map((s) => s.id), ['arch-server']);
  assert.deepEqual(registry.search('sql').map((s) => s.id), ['arch-db']);
});

test('search ignores case and surrounding whitespace', () => {
  const registry = createStencilRegistry([stencil({ id: 'arch-Server', title: 'Host' })]);

  assert.equal(registry.search('SERVER').length, 1);
  assert.equal(registry.search('  server  ').length, 1);
});

test('a query matching nothing returns an empty list', () => {
  const registry = createStencilRegistry([stencil({ id: 'a' })]);

  assert.deepEqual(registry.search('zzz'), []);
});

test('a stencil with no view box gets the engine default', () => {
  assert.deepEqual(stencilViewBox(stencil()), DEFAULT_STENCIL_VIEW_BOX);
  assert.deepEqual(DEFAULT_STENCIL_VIEW_BOX, { x: 0, y: 0, width: 100, height: 100 });
});

test('a stencil that declares a view box keeps it', () => {
  const box = { x: 0, y: 0, width: 24, height: 24 };

  assert.deepEqual(stencilViewBox(stencil({ viewBox: box })), box);
});

test('a square stencil fills a square box at a scale of one', () => {
  const { scale, translateX, translateY } = stencilTransform(stencil(), 100, 100);

  assert.equal(scale, 1);
  assert.equal(translateX, 0);
  assert.equal(translateY, 0);
});

test('a wider box scales a square stencil uniformly and centres it', () => {
  const { scale, translateX, translateY } = stencilTransform(stencil(), 200, 100);

  assert.equal(scale, 1, 'the limiting dimension is the height, so nothing grows');
  assert.equal(translateX, 50, 'the spare width becomes equal margins');
  assert.equal(translateY, 0);
});

test('artwork is never stretched out of shape', () => {
  // A 100x100 stencil in a 140x60 box: uniform, so 60 is the limiting side.
  const { scale, translateX, translateY } = stencilTransform(stencil(), 140, 60);

  assert.equal(scale, 0.6);
  assert.equal(translateX, (140 - 100 * 0.6) / 2);
  assert.equal(translateY, 0);
});

test('a non-square authored box scales on its own aspect ratio', () => {
  const { scale } = stencilTransform(
    stencil({ viewBox: { x: 0, y: 0, width: 24, height: 24 } }),
    48,
    48
  );

  assert.equal(scale, 2);
});

test('an offset view box is translated back to the box origin', () => {
  const { translateX, translateY } = stencilTransform(
    stencil({ viewBox: { x: 10, y: 20, width: 100, height: 100 } }),
    100,
    100
  );

  assert.equal(translateX, -10, 'the authored origin lands at the node origin');
  assert.equal(translateY, -20);
});

test('applying the transform places the authored box at the node box', () => {
  // The contract in one assertion: `p * scale + translate` maps the view box
  // onto the destination, centred. Anything else is a stencil drawn off-centre.
  const definition = stencil({ viewBox: { x: 5, y: 5, width: 50, height: 50 } });
  const { scale, translateX, translateY } = stencilTransform(definition, 300, 120);

  const left = 5 * scale + translateX;
  const top = 5 * scale + translateY;
  const right = 55 * scale + translateX;
  const bottom = 55 * scale + translateY;

  assert.equal(right - left, 50 * scale, 'the width is the authored width, scaled');
  assert.equal(bottom - top, 50 * scale);
  assert.equal(left, (300 - 50 * scale) / 2, 'centred horizontally');
  assert.equal(top, (120 - 50 * scale) / 2, 'centred vertically');
});

test('a zero-sized view box falls back to a scale of one rather than dividing by zero', () => {
  const degenerate = stencil({ viewBox: { x: 0, y: 0, width: 0, height: 0 } });
  const { scale, translateX, translateY } = stencilTransform(degenerate, 100, 100);

  assert.ok(Number.isFinite(scale), 'an infinite scale would poison every coordinate');
  assert.equal(scale, 1);
  assert.ok(Number.isFinite(translateX));
  assert.ok(Number.isFinite(translateY));
});

test('a zero-sized node box still yields a finite transform', () => {
  const { scale } = stencilTransform(stencil(), 0, 0);

  assert.equal(scale, 1);
});
