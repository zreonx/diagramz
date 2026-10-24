import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ZCanvasDocumentSchema } from '../core/schema.ts';
import { registerTsResolver } from '../../../../test/register-ts-resolver.mjs';

// The exporter reaches `../core/style-models` and `../geometry` without file
// extensions, which Node cannot resolve on its own. Registering here keeps this
// file runnable on its own, not only through `pnpm test`.
registerTsResolver();

// Imported on demand: a static import would be linked before the hook exists.
const { exportDocumentToSvg } = await import('./svg.ts');
const { diamondVertices, getRoundedPolygonPath, triangleVertices } = await import(
  '../rendering/shapes/polygon.ts'
);
const { BUILTIN_STENCIL_REGISTRY } = await import('../stencils/builtin.ts');
const { stencilViewBox } = await import('../stencils/registry.ts');

/** A document holding one node, with no appearance overrides of its own. */
function docWithNode(node) {
  return ZCanvasDocumentSchema.parse({ nodes: [node] });
}

const RECTANGLE = {
  id: 'r1',
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 200,
  height: 100,
  title: 'Box',
};

test('an unstyled node exports the themed tint, not a solid block', () => {
  const svg = exportDocumentToSvg(docWithNode(RECTANGLE));

  // The dark-theme blue family: a #202E45 wash at the default 50% alpha.
  assert.match(svg, /fill="#202E45" fill-opacity="0\.5"/);
  assert.match(svg, /stroke="#3E5F91"/);
  // The old exporter painted every fill `#0f172a`, which vanished into the plate.
  assert.doesNotMatch(svg, /fill="#0f172a"/);
});

test('an unstyled container exports its own, lighter tint', () => {
  const svg = exportDocumentToSvg(
    docWithNode({ ...RECTANGLE, id: 'c1', type: 'container', width: 400, height: 300 })
  );

  assert.match(svg, /fill="#302E4B" fill-opacity="0\.3"/);
  assert.match(svg, /stroke="#625BA8"/);
});

test('each node kind exports its own family, so a shape stays recognisable', () => {
  const families = {
    table: { bg: '#1D3735', border: '#397D72' },
    diamond: { bg: '#403321', border: '#8D6D35' },
    triangle: { bg: '#243828', border: '#4D8052' },
    circle: { bg: '#202E45', border: '#3E5F91' },
  };

  for (const [type, expected] of Object.entries(families)) {
    const svg = exportDocumentToSvg(docWithNode({ ...RECTANGLE, id: type, type }));
    assert.match(svg, new RegExp(`fill="${expected.bg}"`), `${type} fill`);
    assert.match(svg, new RegExp(`stroke="${expected.border}"`), `${type} stroke`);
  }
});

test('a rounded polygon exports the very geometry the canvas draws', () => {
  // The vertices and the rounding live in one module, so the canvas and the
  // exporter cannot drift apart: both render this exact `d`.
  for (const [type, vertices] of [
    ['diamond', diamondVertices(200, 100)],
    ['triangle', triangleVertices(200, 100)],
  ]) {
    const svg = exportDocumentToSvg(docWithNode({ ...RECTANGLE, id: type, type }));
    const expected = getRoundedPolygonPath(vertices);

    assert.ok(svg.includes(`<path d="${expected}"`), `${type} geometry`);
    // Rounded corners, not the sharp `<polygon>` the exporter used to emit.
    assert.doesNotMatch(svg, /<polygon/);
    assert.equal((expected.match(/Q /g) ?? []).length, vertices.length);
  }
});

test('a user colour and opacity override the theme', () => {
  const svg = exportDocumentToSvg(
    docWithNode({ ...RECTANGLE, color: '#EF4444', fill: '#EF4444', fillOpacity: 0.25 })
  );

  assert.match(svg, /fill="#EF4444" fill-opacity="0\.25"/);
  assert.match(svg, /stroke="#EF4444"/);
});

test('a fill with no extra opacity keeps its own alpha instead of turning opaque', () => {
  // Legacy documents stored the tint as `${color}14`; the alpha must survive as
  // `fill-opacity` rather than the colour being painted solid.
  const svg = exportDocumentToSvg(docWithNode({ ...RECTANGLE, fill: '#3b82f614' }));

  assert.match(svg, /fill="#3b82f6" fill-opacity="0\.078"/);
  assert.doesNotMatch(svg, /fill="#3b82f614"/);
});

test('an opaque fill exports without a redundant fill-opacity', () => {
  const svg = exportDocumentToSvg(
    docWithNode({ ...RECTANGLE, fill: '#10B981', fillOpacity: 1 })
  );

  assert.match(svg, /fill="#10B981"/);
  assert.doesNotMatch(svg, /fill="#10B981" fill-opacity/);
});

test('the light canvas swaps the plate and the tokens together', () => {
  const svg = exportDocumentToSvg(docWithNode(RECTANGLE), { isDark: false });

  assert.match(svg, /<rect x="[^"]*" y="[^"]*" width="[^"]*" height="[^"]*" fill="#FFFFFF" \/>/);
  // The light-theme blue family, rather than the dark one.
  assert.match(svg, /fill="#E8F1FF" fill-opacity="0\.5"/);
  assert.match(svg, /stroke="#9ABCF5"/);
});

test('a connector with no colour falls back to the themed grey', () => {
  const doc = ZCanvasDocumentSchema.parse({
    nodes: [
      { ...RECTANGLE, id: 'a' },
      { ...RECTANGLE, id: 'b', x: 400 },
    ],
    edges: [{ id: 'e1', source: 'a', target: 'b' }],
  });

  assert.match(exportDocumentToSvg(doc), /stroke="#9294A0"/);
});

/** A document holding a single freehand stroke. */
function docWithStroke(stroke) {
  return ZCanvasDocumentSchema.parse({
    strokes: [
      {
        id: 's1',
        points: [
          { x: 10, y: 10 },
          { x: 60, y: 40 },
        ],
        color: '#635BFF',
        width: 4,
        ...stroke,
      },
    ],
  });
}

test('solid ink exports as a filled body, not a stroked line', () => {
  // A solid nib is a tapered shape, so it exports the way the canvas paints it:
  // a closed path filled with the ink colour, with no stroke of its own.
  const svg = exportDocumentToSvg(docWithStroke({ strokeStyle: 'solid' }));

  assert.match(svg, /fill="#635BFF" stroke="none"/);
  assert.doesNotMatch(svg, /stroke-dasharray/);
  assert.doesNotMatch(svg, / opacity="/);
});

test('dashed and dotted ink export their dash pattern', () => {
  // The pattern scales with the nib, exactly as the canvas draws it.
  assert.match(
    exportDocumentToSvg(docWithStroke({ strokeStyle: 'dashed' })),
    /stroke-dasharray="12 8"/
  );
  assert.match(
    exportDocumentToSvg(docWithStroke({ strokeStyle: 'dotted' })),
    /stroke-dasharray="4 8"/
  );
});

test('translucent ink exports its alpha, rounded', () => {
  const svg = exportDocumentToSvg(docWithStroke({ opacity: 0.4 }));

  assert.match(svg, / opacity="0\.4"/);
  // Never a seventeen-digit float.
  assert.doesNotMatch(svg, / opacity="0\.4000000000000001"/);
});

test('fully opaque ink carries no redundant opacity attribute', () => {
  assert.doesNotMatch(exportDocumentToSvg(docWithStroke({ opacity: 1 })), / opacity="/);
});

test('legacy ink with no dash or opacity still exports', () => {
  const svg = exportDocumentToSvg(docWithStroke({}));

  assert.match(svg, /fill="#635BFF" stroke="none"/);
  assert.doesNotMatch(svg, /stroke-dasharray/);
});

// ─── stencil nodes ──────────────────────────────────────────────────────────
// A placed stencil is an `svg` node whose identity lives in `data`. Four
// generations of that field exist and every one of them still has to export.

/** A document holding one `svg` node carrying `data`. */
function docWithSvgNode(data, overrides = {}) {
  return docWithNode({
    id: 's1',
    type: 'svg',
    x: 0,
    y: 0,
    width: 120,
    height: 120,
    title: 'Node',
    data,
    ...overrides,
  });
}

test('a stencil node exports the artwork the registry holds for its id', () => {
  const svg = exportDocumentToSvg(docWithSvgNode({ stencilId: 'arch-server' }));

  assert.match(svg, /<path|<rect/, 'the artwork reached the document');
  assert.match(svg, /scale\(/, 'it was scaled into the node box');
  // The server stencil's own accent, which nothing else in the document uses.
  assert.match(svg, /#0ea5e9/);
});

test('a legacy archId node still exports, resolving through the same registry', () => {
  // Documents saved before stencil ids existed carry `archId` instead.
  const legacy = exportDocumentToSvg(docWithSvgNode({ archId: 'arch-server' }));
  const current = exportDocumentToSvg(docWithSvgNode({ stencilId: 'arch-server' }));

  assert.equal(legacy, current, 'the old id and the new one must draw the same thing');
});

test('a stencil is scaled uniformly and centred, never stretched', () => {
  // The server's artwork is wider than it is tall, so a square node gives it
  // spare height rather than spare width. Whatever the spare is, the drawing
  // takes one scale on both axes and the leftover is split evenly — that is
  // what keeps a 200x100 box from pulling the picture into a different shape.
  const width = 200;
  const height = 200;
  const svg = exportDocumentToSvg(
    docWithSvgNode({ stencilId: 'arch-server' }, { width, height })
  );

  const viewBox = stencilViewBox(BUILTIN_STENCIL_REGISTRY.get('arch-server'));
  const scale = Math.min(width / viewBox.width, height / viewBox.height);
  const [, appliedScale] = /scale\(([\d.]+)\)/.exec(svg);
  const [, translateX, translateY] = /translate\((-?[\d.]+), (-?[\d.]+)\) scale/.exec(svg);

  assert.equal(Number(appliedScale), Number(scale.toFixed(2)), 'the limiting dimension sets the scale');

  // One scale, written once: `scale(s)` rather than `scale(sx, sy)`.
  assert.doesNotMatch(svg, /scale\([\d.]+, [\d.]+\)/);

  const left = Number(translateX) + viewBox.x * scale;
  const top = Number(translateY) + viewBox.y * scale;
  const right = left + viewBox.width * scale;
  const bottom = top + viewBox.height * scale;

  assert.ok(Math.abs(left - (width - right)) < 0.05, `left ${left}, right margin ${width - right}`);
  assert.ok(Math.abs(top - (height - bottom)) < 0.05, `top ${top}, bottom margin ${height - bottom}`);
});

test('a tech logo exports its stored path when it has no id', () => {
  const svg = exportDocumentToSvg(
    docWithSvgNode({ svgPath: 'M0 0 L24 24', color: '#336791' })
  );

  assert.match(svg, /<path d="M0 0 L24 24"/);
  assert.match(svg, /#336791/);
});

test('a stored path cannot break out of its attribute', () => {
  // `data` is persisted JSON, so the path is untrusted on the way back in.
  const svg = exportDocumentToSvg(
    docWithSvgNode({ svgPath: 'M0 0" onload="alert(1)' })
  );

  assert.doesNotMatch(svg, /onload="/, 'the quote was escaped, not honoured');
  assert.match(svg, /&quot;/);
});

test('a legacy element array exports instead of vanishing', () => {
  // These used to export as nothing at all: the exporter only understood
  // `archId` and `svgPath`.
  const svg = exportDocumentToSvg(
    docWithSvgNode({
      elements: [{ type: 'rectangle', x: 0, y: 0, width: 40, height: 40 }],
    })
  );

  assert.match(svg, /<svg x="0"/, 'a nested viewport was emitted');
  assert.match(svg, /<rect/);
  assert.match(svg, /viewBox="/);
});

test('an element array with no elements draws nothing rather than crashing', () => {
  const svg = exportDocumentToSvg(docWithSvgNode({ elements: [] }));

  assert.doesNotMatch(svg, /<svg x="0"/);
});

test('an svg node with none of the four payloads exports as an empty frame', () => {
  const svg = exportDocumentToSvg(docWithSvgNode({}));

  assert.ok(svg.includes('<svg '), 'the document itself is still produced');
  assert.doesNotMatch(svg, /undefined|NaN/);
});

test('an id this build does not know degrades to the node title, not a broken glyph', () => {
  const svg = exportDocumentToSvg(
    docWithSvgNode({ stencilId: 'arch-from-a-future-release' })
  );

  assert.match(svg, />Node</, 'the label survives');
  assert.doesNotMatch(svg, /undefined|NaN/);
});

// ─── escaping ───────────────────────────────────────────────────────────────

test('a title containing markup characters exports escaped', () => {
  const svg = exportDocumentToSvg(
    docWithNode({
      id: 'c1',
      type: 'card',
      x: 0,
      y: 0,
      width: 100,
      height: 60,
      title: 'A & B <C>',
      subtitle: 'x > y',
    })
  );

  assert.match(svg, /A &amp; B &lt;C&gt;/);
  assert.match(svg, /x &gt; y/);
  assert.doesNotMatch(svg, /<C>/, 'a raw tag would have truncated the document');
});

test('every user-written string is escaped, not just the title', () => {
  const svg = exportDocumentToSvg(
    ZCanvasDocumentSchema.parse({
      nodes: [
        {
          id: 't1',
          type: 'table',
          x: 0,
          y: 0,
          width: 160,
          height: 80,
          title: '<table>',
          fields: [{ name: 'a&b', type: '<pk>' }],
        },
        { id: 'ct1', type: 'container', x: 200, y: 0, width: 160, height: 80, title: '<container>', badge: '<badge>' },
        { id: 'x1', type: 'text', x: 400, y: 0, width: 100, height: 30, title: '<text>' },
      ],
      edges: [
        {
          id: 'e1',
          source: 't1',
          target: 'ct1',
          label: '<connector>',
        },
      ],
    })
  );

  for (const raw of ['<table>', '<pk>', '<container>', '<badge>', '<text>', '<connector>']) {
    assert.ok(!svg.includes(raw), `${raw} reached the document unescaped`);
  }
  assert.match(svg, /a&amp;b/);
});

test('a colour the user typed cannot inject an attribute', () => {
  const svg = exportDocumentToSvg(
    docWithNode({
      id: 'c1',
      type: 'card',
      x: 0,
      y: 0,
      width: 100,
      height: 60,
      title: 'Card',
      color: '#fff" onload="alert(1)',
    })
  );

  assert.doesNotMatch(svg, /onload="/);
  assert.doesNotMatch(svg, /url\(/);
});

test('a malformed colour falls back to the themed token', () => {
  const svg = exportDocumentToSvg(
    docWithNode({
      id: 'c1',
      type: 'card',
      x: 0,
      y: 0,
      width: 100,
      height: 60,
      title: 'Card',
      color: 'not-a-colour',
    })
  );

  assert.doesNotMatch(svg, /not-a-colour/);
});

// ─── the two parametric shapes ───────────────────────────────────────────────

test('a cylinder exports the drum and its rim', () => {
  const svg = exportDocumentToSvg(
    docWithNode({
      id: 'cy1',
      type: 'cylinder',
      x: 0,
      y: 0,
      width: 100,
      height: 120,
      title: 'Store',
    })
  );

  assert.match(svg, /<path d="M 2 /, 'the drum body');
  assert.match(svg, /<ellipse /, 'the rim');
  assert.match(svg, />Store</);
});

test('a cloud exports its outline', () => {
  const svg = exportDocumentToSvg(
    docWithNode({
      id: 'cl1',
      type: 'cloud',
      x: 0,
      y: 0,
      width: 140,
      height: 90,
      title: 'Edge',
    })
  );

  assert.match(svg, /<path d="M /);
  assert.match(svg, />Edge</);
});

test('a styled shape honours its own colour, not the theme', () => {
  const svg = exportDocumentToSvg(
    docWithNode({
      id: 'cy1',
      type: 'cylinder',
      x: 0,
      y: 0,
      width: 100,
      height: 120,
      title: 'Store',
      color: '#abcdef',
    })
  );

  assert.match(svg, /stroke="#abcdef"/);
});

// ─── the turn a node carries ─────────────────────────────────────────────────

test('a turned node exports inside the turn it carries', () => {
  const svg = exportDocumentToSvg(
    docWithNode({ ...RECTANGLE, x: 100, y: 50, width: 200, height: 100, rotation: 45 })
  );

  // The node's own centre, not the box's corner: the canvas turns a shape about
  // its middle, and an export that turned it about anything else would not be
  // the drawing the user made.
  assert.match(svg, /<g transform="rotate\(45, 200, 100\)">/);
  assert.match(svg, />Box</, 'the label turns with the shape it names');
});

test('an upright node is exported with no turn at all', () => {
  // Not `rotate(0, …)`: nothing turns it, so nothing is written, and a document
  // that never carried an angle exports byte-for-byte as it always did.
  assert.doesNotMatch(exportDocumentToSvg(docWithNode(RECTANGLE)), /rotate\(/);
});

test('the plate is measured by what a turned node covers, not by its box', () => {
  // Placed out towards the far corner, where the shape — not the exporter's
  // 1200x800 minimum — is what sizes the plate. A 200x100 box turned a quarter
  // reaches 100 above and below its own frame, so measuring the upright box
  // would crop its corners off.
  const far = { ...RECTANGLE, x: 1150, y: 750, width: 200, height: 100 };
  const turned = exportDocumentToSvg(docWithNode({ ...far, rotation: 90 }));
  const upright = exportDocumentToSvg(docWithNode(far));

  const heightOf = (svg) => Number(/height="(\d+)"/.exec(svg)[1]);
  const widthOf = (svg) => Number(/width="(\d+)"/.exec(svg)[1]);

  assert.ok(
    heightOf(turned) > heightOf(upright),
    `turned ${widthOf(turned)}x${heightOf(turned)}, upright ${widthOf(upright)}x${heightOf(upright)}`
  );
  // A quarter turn trades one axis for the other, so the plate gains height and
  // gives back width: it follows what the shape covers, not the box it was
  // placed in.
  assert.ok(widthOf(turned) < widthOf(upright), `turned is ${widthOf(turned)} wide, upright ${widthOf(upright)}`);
});

test('a turn is measured from the centre the box has, at any angle', () => {
  // Two shapes, the second turned past a half turn, so a `rotate` that used a
  // negative or unfolded angle would show up on the one and not the other.
  const svg = exportDocumentToSvg(
    ZCanvasDocumentSchema.parse({
      nodes: [
        { ...RECTANGLE, id: 'a' },
        { ...RECTANGLE, id: 'b', x: 400, y: 0, rotation: 270 },
      ],
    })
  );

  assert.match(svg, /<g transform="rotate\(270, 500, 50\)">/);
  // Exactly one turn in the document, wrapped around the one shape that has it.
  assert.equal(svg.match(/rotate\(/g).length, 1);
});

test('an edge with label and labelOffset exports label at offset position', () => {
  const edgeWithoutOffset = {
    id: 'e1',
    source: 'r1',
    target: 'r2',
    sourcePoint: { x: 0, y: 0 },
    targetPoint: { x: 200, y: 0 },
    label: 'Center Label',
  };

  const edgeWithOffset = {
    id: 'e2',
    source: 'r1',
    target: 'r2',
    sourcePoint: { x: 0, y: 0 },
    targetPoint: { x: 200, y: 0 },
    label: 'Slid Label',
    labelOffset: { x: 40, y: -15 },
  };

  const svgNormal = exportDocumentToSvg(
    ZCanvasDocumentSchema.parse({
      nodes: [],
      edges: [edgeWithoutOffset],
    })
  );

  // midPoint of (0,0) to (200,0) is (100, 0)
  assert.match(svgNormal, /transform="translate\(100, 0\)"/);

  const svgShifted = exportDocumentToSvg(
    ZCanvasDocumentSchema.parse({
      nodes: [],
      edges: [edgeWithOffset],
    })
  );

  // midPoint (100, 0) + offset (40, -15) = (140, -15)
  assert.match(svgShifted, /transform="translate\(140, -15\)"/);
});

test('an svg node with raw markup (e.g. Mermaid component) exports its inner SVG', () => {
  const mermaidNode = {
    id: 'm1',
    type: 'svg',
    x: 50,
    y: 50,
    width: 400,
    height: 300,
    title: 'Flowchart',
    data: {
      isMermaid: true,
      svg: '<svg viewBox="0 0 400 300"><g id="mermaid-root"><text>Step A</text></g></svg>',
    },
  };

  const svg = exportDocumentToSvg(docWithNode(mermaidNode));
  assert.match(svg, /Step A/, 'Exports the Mermaid diagram content');
  assert.match(svg, /viewBox="0 0 400 300"/);
});

test('ERD table nodes and Crow\'s Foot relationship markers export cleanly to SVG', () => {
  const doc = ZCanvasDocumentSchema.parse({
    nodes: [
      {
        id: 'users',
        type: 'table',
        x: 0,
        y: 0,
        width: 220,
        height: 160,
        title: 'users',
        fields: [
          { name: 'id', type: 'uuid', pk: true },
          { name: 'org_id', type: 'uuid', fk: true },
        ],
      },
      {
        id: 'orgs',
        type: 'table',
        x: 340,
        y: 0,
        width: 220,
        height: 160,
        title: 'organizations',
        fields: [{ name: 'id', type: 'uuid', pk: true }],
      },
    ],
    edges: [
      {
        id: 'e-erd',
        source: 'orgs',
        target: 'users',
        style: 'step',
        startArrowhead: 'er-one',
        endArrowhead: 'er-zero-many',
      },
    ],
  });

  const svg = exportDocumentToSvg(doc);
  assert.match(svg, /id="zcanvas-head-er-one"/);
  assert.match(svg, /id="zcanvas-head-er-zero-many"/);
  assert.match(svg, /marker-start="url\(#zcanvas-head-er-one\)"/);
  assert.match(svg, /marker-end="url\(#zcanvas-head-er-zero-many\)"/);
  assert.match(svg, /🔑 id/);
  assert.match(svg, /🔗 org_id/);
});


