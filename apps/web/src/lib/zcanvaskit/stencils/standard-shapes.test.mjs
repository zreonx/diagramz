import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTsResolver } from '../../../../test/register-ts-resolver.mjs';

registerTsResolver();

const { STANDARD_DRAWIO_SHAPES } = await import('./standard-shapes.ts');
const { createIdFactory, placeDragItem } = await import('./placement.ts');
const { isToolName, readDragItem, writeDragItem } = await import('./drag-payload.ts');

/** The slice of `DataTransfer` the protocol uses, without a browser. */
function transfer(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get types() {
      return [...store.keys()];
    },
    getData: (format) => store.get(format) ?? '',
    setData: (format, data) => {
      store.set(format, data);
    },
    effectAllowed: 'none',
  };
}

const tile = (id) => STANDARD_DRAWIO_SHAPES.find((shape) => shape.id === id);

/**
 * Places a tile the way the panel does.
 *
 * The panel's only job is to name the tool and the size; everything after that
 * is the engine's, so the test drives the same two calls the drag and the click
 * both end in and reads the node that comes out.
 */
function drop(tileDef, at = 400) {
  return placeDragItem(
    { kind: 'tool', tool: tileDef.type, width: tileDef.width, height: tileDef.height },
    { x: at, y: at, createId: createIdFactory({ now: () => 0 }) }
  );
}

test('every tile names a tool the engine can place', () => {
  // A tile is only a shortcut, so a typo in one is a tile that drops nothing.
  // Checking the name here is what keeps "Standard Shapes" from quietly
  // growing an entry the canvas has never heard of.
  for (const shape of STANDARD_DRAWIO_SHAPES) {
    assert.equal(isToolName(shape.type), true, `${shape.id} names "${shape.type}"`);
  }
});

test('no two tiles share an id', () => {
  const ids = STANDARD_DRAWIO_SHAPES.map((shape) => shape.id);

  assert.equal(new Set(ids).size, ids.length, ids.join(', '));
});

test('every tile has something to draw and a size to draw it at', () => {
  for (const shape of STANDARD_DRAWIO_SHAPES) {
    assert.ok(shape.title.length > 0, shape.id);
    assert.ok(shape.description.length > 0, shape.id);
    assert.ok(shape.category.length > 0, shape.id);
    assert.ok(shape.width > 0 && shape.height > 0, shape.id);
  }
});

test('the Database Table tile drops the editable table', () => {
  const def = tile('shape-table');
  assert.ok(def, 'the Standard Shapes section has a table tile');

  const placement = drop(def, 400);
  const node = placement.nodes[0];

  assert.equal(node.type, 'table');
  // What makes it the component the user meant rather than a blank box: a title
  // to rename and columns to edit.
  assert.ok(node.title.length > 0, 'it lands with a title');
  assert.ok(Array.isArray(node.fields) && node.fields.length > 0, 'it lands with columns');
  assert.ok(node.fields.some((f) => f.pk), 'one of them is a primary key');
  assert.equal(placement.selectedIds[0], node.id, 'it lands selected, ready to edit');
});

test('the table tile lands the size the tile asks for', () => {
  const def = tile('shape-table');
  const node = drop(def, 400).nodes[0];

  // The component tools build their own node, so the tile's numbers only hold if
  // they are the same ones that node uses — this is what catches them drifting
  // apart when either is changed.
  assert.equal(node.width, def.width);
  assert.equal(node.height, def.height);
});

test('the VPC Container tile drops a boundary, beneath what is already there', () => {
  const def = tile('shape-container');
  assert.ok(def, 'the Standard Shapes section has a container tile');

  const placement = drop(def);
  const node = placement.nodes[0];

  assert.equal(node.type, 'container');
  assert.equal(node.width, def.width);
  assert.equal(node.height, def.height);
  assert.ok(node.title.length > 0, 'it lands with a title to rename');
  // A boundary is a plate, so it goes in underneath: dropped over a diagram it
  // has to paint behind it, which is what makes the header and the frame — and
  // not the interior — the parts that take a press.
  assert.equal(placement.prepend, true);
});

test('the Database Drum is still a bare cylinder', () => {
  // The one the user asked to leave alone: a geometric shape with no fields, no
  // title of its own and no editing affordances.
  const def = tile('shape-cylinder');
  const node = drop(def).nodes[0];

  assert.equal(node.type, 'cylinder');
  assert.equal(node.fields, undefined);
  assert.equal(node.width, def.width);
  assert.equal(node.height, def.height);
});

test('a tile survives the drag the panel writes', () => {
  // The panel hands the canvas a payload, not a node: this is the whole path a
  // drag takes, so a tile that reads correctly can still be a tile that drops
  // nothing if either end of the protocol disagrees about the shape of a
  // payload.
  const dt = transfer();
  const def = tile('shape-table');
  writeDragItem(dt, { kind: 'tool', tool: def.type, width: def.width, height: def.height });

  const item = readDragItem(dt);
  assert.deepEqual(item, { kind: 'tool', tool: 'table', width: def.width, height: def.height });

  const placement = placeDragItem(item, { x: 0, y: 0, createId: createIdFactory({ now: () => 0 }) });
  assert.equal(placement.nodes[0].type, 'table');
});
