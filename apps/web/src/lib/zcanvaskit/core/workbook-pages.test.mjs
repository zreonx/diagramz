import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZCanvasPageSchema,
  ZCanvasDocumentSchema,
  ZCanvasEdgeSchema,
} from './schema.ts';

test('ZCanvasPageSchema validates valid page document structure', () => {
  const page = {
    id: 'page-1',
    name: 'Overview Architecture',
    nodes: [
      {
        id: 'node-1',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 140,
        height: 60,
        title: 'API Gateway',
      },
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        sourceLabel: '1',
        targetLabel: '0..*',
        lineJumps: 'arc',
      },
    ],
    viewport: { zoom: 1.2, panX: 20, panY: 40 },
  };

  const parsed = ZCanvasPageSchema.parse(page);
  assert.equal(parsed.id, 'page-1');
  assert.equal(parsed.name, 'Overview Architecture');
  assert.equal(parsed.nodes.length, 1);
  assert.equal(parsed.edges.length, 1);
  assert.equal(parsed.edges[0].sourceLabel, '1');
  assert.equal(parsed.edges[0].targetLabel, '0..*');
  assert.equal(parsed.edges[0].lineJumps, 'arc');
});

test('ZCanvasDocumentSchema supports multi-page sheets and activePageId', () => {
  const doc = {
    version: 1,
    nodes: [],
    edges: [],
    pages: [
      {
        id: 'p-1',
        name: 'Slide 1: Cloud Infra',
        nodes: [{ id: 'n1', type: 'rectangle', title: 'Infra Box', x: 0, y: 0, width: 100, height: 50 }],
        edges: [],
      },
      {
        id: 'p-2',
        name: 'Slide 2: Database Schema',
        nodes: [{ id: 'n2', type: 'table', title: 'users', x: 200, y: 100, width: 180, height: 120 }],
        edges: [],
      },
    ],
    activePageId: 'p-2',
  };

  const parsed = ZCanvasDocumentSchema.parse(doc);
  assert.equal(parsed.pages?.length, 2);
  assert.equal(parsed.activePageId, 'p-2');
  assert.equal(parsed.pages?.[0].name, 'Slide 1: Cloud Infra');
  assert.equal(parsed.pages?.[1].name, 'Slide 2: Database Schema');
});

test('ZCanvasEdgeSchema supports sourceLabel, targetLabel, and lineJumps options', () => {
  const edgeNoJumps = ZCanvasEdgeSchema.parse({
    id: 'e1',
    source: 'a',
    target: 'b',
  });
  assert.equal(edgeNoJumps.lineJumps, undefined);
  assert.equal(edgeNoJumps.sourceLabel, undefined);

  const edgeWithJumps = ZCanvasEdgeSchema.parse({
    id: 'e2',
    source: 'a',
    target: 'b',
    sourceLabel: 'pk',
    targetLabel: 'fk',
    lineJumps: 'gap',
  });
  assert.equal(edgeWithJumps.lineJumps, 'gap');
  assert.equal(edgeWithJumps.sourceLabel, 'pk');
  assert.equal(edgeWithJumps.targetLabel, 'fk');
});

test('ZCanvasDocumentSchema handles document without pages defaulting gracefully', () => {
  const legacyDoc = {
    version: 1,
    nodes: [],
    edges: [],
  };
  const parsed = ZCanvasDocumentSchema.parse(legacyDoc);
  assert.equal(parsed.pages, undefined);
  assert.equal(parsed.activePageId, undefined);
});
