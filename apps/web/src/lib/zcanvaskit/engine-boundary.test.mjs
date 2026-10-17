import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { registerTsResolver } from '../../../test/register-ts-resolver.mjs';

registerTsResolver();

const { resolveIconMap, ZCANVAS_DEFAULT_ICONS } = await import('./react/renderers.ts');
const { placeDragItem } = await import('./stencils/placement.ts');

const ENGINE_ROOT = import.meta.dirname;

/** Every engine source file, at any depth. */
function engineSources(dir = ENGINE_ROOT) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...engineSources(path));
    } else if (/\.tsx?$/.test(entry)) {
      found.push(path);
    }
  }
  return found;
}

test('the engine does not reach into the app', () => {
  // The dependence that made the artwork wrong is structural: while the engine
  // imported the app's canvas components, a stencil lived in two places and
  // neither was the engine's. Artwork now belongs to `stencils/`, and this is
  // what keeps it there.
  //
  // A shadcn primitive (`@/components/ui/*`) is allowed: it is generic UI, not
  // app canvas, and it travels with the engine. `@/components/canvas/**` is the
  // line — that is the layer that draws the diagram, and the engine is what it
  // draws with.
  const offenders = [];
  for (const file of engineSources()) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/from\s+'(@\/components\/canvas\/[^']+)'/g)) {
      offenders.push(`${file.replace(ENGINE_ROOT, '.')} imports ${match[1]}`);
    }
  }

  assert.deepEqual(offenders, []);
});

test('the engine defaults cover the icons its own components are created with', () => {
  // Anti-drift: `createComponentNode` names an icon, and it must be a name the
  // engine can draw, or a component it creates draws a fallback the user did
  // not ask for.
  const node = placeDragItem({ kind: 'tool', tool: 'service' }, { x: 0, y: 0 }).nodes[0];

  assert.ok(node.icon, 'a new component names an icon');
  assert.ok(
    ZCANVAS_DEFAULT_ICONS[node.icon],
    `${node.icon} is drawn by the engine's own default map`
  );
});

test('a canvas with no host renderers draws from the engine table, unchanged', () => {
  // By identity, so a canvas that was lent nothing does not allocate a new map
  // on every render and invalidate the nodes that read it.
  assert.equal(resolveIconMap(), ZCANVAS_DEFAULT_ICONS);
  assert.equal(resolveIconMap({}), ZCANVAS_DEFAULT_ICONS);
  assert.equal(resolveIconMap({ icons: undefined }), ZCANVAS_DEFAULT_ICONS);
});

test("a host's icons are merged over the engine's, and win on a shared name", () => {
  const HostServer = () => null;
  const HostOnly = () => null;
  const merged = resolveIconMap({ icons: { server: HostServer, postgres: HostOnly } });

  assert.equal(merged.server, HostServer, 'the host decides how a shared name draws');
  assert.equal(merged.postgres, HostOnly, 'a name only the host knows is available');
  assert.equal(merged.queue, ZCANVAS_DEFAULT_ICONS.queue, 'the rest of the table survives');
});

test('resolving a host map does not mutate the engine defaults', () => {
  const before = { ...ZCANVAS_DEFAULT_ICONS };
  resolveIconMap({ icons: { server: () => null, invented: () => null } });

  assert.deepEqual({ ...ZCANVAS_DEFAULT_ICONS }, before);
  assert.equal(ZCANVAS_DEFAULT_ICONS.invented, undefined);
});
