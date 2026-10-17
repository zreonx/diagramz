import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beautifyArchitectureLayout } from './layout-beautifier.ts';

test('empty or missing nodes return unchanged', () => {
  const result = beautifyArchitectureLayout([], []);
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
});

test('enforces generous horizontal spacing between adjacent nodes in the same tier', () => {
  const nodes = [
    { id: 'n1', type: 'svg', width: 90, height: 90, x: 50, y: 100 },
    { id: 'n2', type: 'svg', width: 90, height: 90, x: 100, y: 100 },
    { id: 'n3', type: 'svg', width: 90, height: 90, x: 150, y: 100 },
  ];
  const edges = [
    { id: 'e1', source: 'n1', target: 'n2', label: 'Short' },
    { id: 'e2', source: 'n2', target: 'n3', label: 'A very long edge label requiring clearance' },
  ];

  const result = beautifyArchitectureLayout(nodes, edges, {
    minHorizontalGap: 160,
    minVerticalGap: 170,
  });

  const [n1, n2, n3] = result.nodes;
  assert.equal(n1.x, 50);
  assert.equal(n1.y, 100);

  // n2 should be separated by at least 90 + 160 = 250px
  assert.ok(n2.x >= n1.x + 90 + 160);

  // n3 should have dynamic expansion because of the long edge label (> 14 chars)
  const gap2 = n3.x - (n2.x + 90);
  assert.ok(gap2 > 160, `Expected gap2 (${gap2}) to be > 160 for long label`);
});

test('enforces generous vertical spacing between distinct tiers', () => {
  const nodes = [
    { id: 't1_1', type: 'svg', width: 90, height: 90, x: 100, y: 100 },
    { id: 't2_1', type: 'svg', width: 90, height: 90, x: 100, y: 180 },
  ];

  const result = beautifyArchitectureLayout(nodes, [], {
    minHorizontalGap: 160,
    minVerticalGap: 180,
  });

  const [t1, t2] = result.nodes;
  assert.equal(t1.y, 100);
  // t2 must be at least t1.y + 90 + 180 = 370
  assert.ok(t2.y >= t1.y + 90 + 180, `Expected t2.y (${t2.y}) to be >= ${t1.y + 90 + 180}`);
});

test('automatically resizes containers to enclose children with margins and header height', () => {
  const nodes = [
    { id: 'vpc1', type: 'container', width: 200, height: 200, x: 40, y: 40 },
    { id: 'child1', type: 'svg', width: 90, height: 90, x: 100, y: 120, parentId: 'vpc1' },
    { id: 'child2', type: 'svg', width: 90, height: 90, x: 300, y: 120, parentId: 'vpc1' },
  ];

  const result = beautifyArchitectureLayout(nodes, [], {
    containerPadding: 55,
    containerHeaderHeight: 65,
  });

  const container = result.nodes.find((n) => n.id === 'vpc1');
  const children = result.nodes.filter((n) => n.parentId === 'vpc1');

  assert.ok(container, 'Container should be present');
  const minX = Math.min(...children.map((c) => c.x));
  const maxX = Math.max(...children.map((c) => c.x + c.width));
  const minY = Math.min(...children.map((c) => c.y));
  const maxY = Math.max(...children.map((c) => c.y + c.height));

  assert.ok(container.x <= minX - 50, `Container x (${container.x}) should have at least 50px padding before minX (${minX})`);
  assert.ok(container.x + container.width >= maxX + 50, 'Container should span beyond child maxX');
  assert.ok(container.y <= minY - 60, `Container y (${container.y}) should have header clearance before minY (${minY})`);
});

test('routes edge handles optimally for horizontal and vertical flows', () => {
  const nodes = [
    { id: 'left', type: 'svg', width: 90, height: 90, x: 100, y: 100 },
    { id: 'right', type: 'svg', width: 90, height: 90, x: 400, y: 100 },
    { id: 'bottom', type: 'svg', width: 90, height: 90, x: 100, y: 400 },
  ];
  const edges = [
    { id: 'e_horiz', source: 'left', target: 'right' },
    { id: 'e_vert', source: 'left', target: 'bottom' },
  ];

  const result = beautifyArchitectureLayout(nodes, edges);

  const horiz = result.edges.find((e) => e.id === 'e_horiz');
  assert.equal(horiz.sourceHandle, 'right');
  assert.equal(horiz.targetHandle, 'left');

  const vert = result.edges.find((e) => e.id === 'e_vert');
  assert.equal(vert.sourceHandle, 'bottom');
  assert.equal(vert.targetHandle, 'top');
});

test('aligns downstream components in the same column as their upstream caller', () => {
  // Row 1: client (x: 50), gateway (x: 350), worker (x: 650)
  // Row 2: db connected ONLY to worker
  const nodes = [
    { id: 'client', type: 'svg', width: 90, height: 90, x: 50, y: 100 },
    { id: 'gateway', type: 'svg', width: 90, height: 90, x: 350, y: 100 },
    { id: 'worker', type: 'svg', width: 90, height: 90, x: 650, y: 100 },
    { id: 'db', type: 'svg', width: 90, height: 90, x: 50, y: 300 }, // initially misplaced at x: 50
  ];
  const edges = [
    { id: 'e1', source: 'client', target: 'gateway' },
    { id: 'e2', source: 'gateway', target: 'worker' },
    { id: 'e3', source: 'worker', target: 'db' }, // worker connects to db
  ];

  const result = beautifyArchitectureLayout(nodes, edges, {
    minHorizontalGap: 160,
    minVerticalGap: 170,
  });

  const workerNode = result.nodes.find((n) => n.id === 'worker');
  const dbNode = result.nodes.find((n) => n.id === 'db');

  // db should be positioned directly under worker (same column), NOT at the far-left x: 50
  assert.ok(dbNode.x >= workerNode.x - 20, `db.x (${dbNode.x}) should align with worker.x (${workerNode.x})`);
});

test('centers single-parent ingress hub over multiple downstream children', () => {
  // Row 1: api-gw (single node)
  // Row 2: auth-svc (x: 100), order-svc (x: 360), payment-svc (x: 620)
  const nodes = [
    { id: 'api-gw', type: 'svg', width: 90, height: 90, x: 100, y: 100 },
    { id: 'auth-svc', type: 'svg', width: 90, height: 90, x: 100, y: 300 },
    { id: 'order-svc', type: 'svg', width: 90, height: 90, x: 360, y: 300 },
    { id: 'payment-svc', type: 'svg', width: 90, height: 90, x: 620, y: 300 },
  ];
  const edges = [
    { id: 'e1', source: 'api-gw', target: 'auth-svc' },
    { id: 'e2', source: 'api-gw', target: 'order-svc' },
    { id: 'e3', source: 'api-gw', target: 'payment-svc' },
  ];

  const result = beautifyArchitectureLayout(nodes, edges, {
    minHorizontalGap: 160,
    minVerticalGap: 170,
  });

  const gw = result.nodes.find((n) => n.id === 'api-gw');
  const auth = result.nodes.find((n) => n.id === 'auth-svc');
  const payment = result.nodes.find((n) => n.id === 'payment-svc');

  const gwCenter = gw.x + gw.width / 2;
  const childrenSpanCenter = (auth.x + payment.x + payment.width) / 2;

  // The gateway should be centered relative to the span of its 3 child microservices
  assert.ok(
    Math.abs(gwCenter - childrenSpanCenter) < 50,
    `Gateway center (${gwCenter}) should be roughly equal to children span center (${childrenSpanCenter})`
  );
});

test('sequences sibling containers with positive gap and eliminates container collisions', () => {
  const nodes = [
    { id: 'c1', type: 'container', width: 200, height: 200, x: 40, y: 40 },
    { id: 'c1_n1', type: 'svg', width: 90, height: 90, x: 60, y: 100, parentId: 'c1' },
    { id: 'c1_n2', type: 'svg', width: 90, height: 90, x: 160, y: 100, parentId: 'c1' },

    { id: 'c2', type: 'container', width: 200, height: 200, x: 100, y: 40 }, // initially overlapping c1
    { id: 'c2_n1', type: 'svg', width: 90, height: 90, x: 120, y: 100, parentId: 'c2' },
  ];

  const result = beautifyArchitectureLayout(nodes, [], {
    minHorizontalGap: 160,
    containerPadding: 50,
    containerGap: 80,
  });

  const c1 = result.nodes.find((n) => n.id === 'c1');
  const c2 = result.nodes.find((n) => n.id === 'c2');

  // Container 2 must start after Container 1 ends, separated by at least containerGap
  assert.ok(
    c2.x >= c1.x + c1.width + 50,
    `Container 2 x (${c2.x}) must be >= Container 1 end (${c1.x + c1.width + 50})`
  );
});

test('prunes phantom empty containers with no children when other containers exist', () => {
  const nodes = [
    { id: 'c_empty', type: 'container', width: 400, height: 300, x: 40, y: 40 }, // phantom container with 0 children
    { id: 'c_valid', type: 'container', width: 400, height: 300, x: 500, y: 40 },
    { id: 'node_in_c_valid', type: 'svg', width: 90, height: 90, x: 520, y: 100, parentId: 'c_valid' },
  ];

  const result = beautifyArchitectureLayout(nodes, []);

  assert.equal(result.nodes.some((n) => n.id === 'c_empty'), false, 'Empty container should be pruned');
  assert.equal(result.nodes.some((n) => n.id === 'c_valid'), true, 'Valid container should be preserved');
});

test('automatically resizes and positions frames to match their content', () => {
  const nodes = [
    { id: 'f1', type: 'frame', title: 'ERD Frame', width: 1200, height: 800, x: 20, y: 20 },
    { id: 't_users', type: 'table', width: 260, height: 180, x: 60, y: 140 },
    { id: 't_orders', type: 'table', width: 260, height: 180, x: 380, y: 140 },
  ];
  const edges = [
    { id: 'e1', source: 't_users', target: 't_orders', label: '1:N' },
  ];

  const result = beautifyArchitectureLayout(nodes, edges);

  const frame = result.nodes.find((n) => n.id === 'f1');
  const tUsers = result.nodes.find((n) => n.id === 't_users');
  const tOrders = result.nodes.find((n) => n.id === 't_orders');

  assert.ok(frame, 'Frame should be preserved');
  assert.ok(tUsers, 't_users should be present');
  assert.ok(tOrders, 't_orders should be present');

  const minX = Math.min(tUsers.x, tOrders.x);
  const maxX = Math.max(tUsers.x + tUsers.width, tOrders.x + tOrders.width);
  const minY = Math.min(tUsers.y, tOrders.y);
  const maxY = Math.max(tUsers.y + tUsers.height, tOrders.y + tOrders.height);

  // Frame must snugly enclose the tables with padding and header clearance
  assert.equal(frame.x, minX - 36, 'Frame x should be minX - 36');
  assert.equal(frame.y, minY - 44, 'Frame y should be minY - 44');
  assert.equal(frame.width, (maxX - minX) + 36 * 2, 'Frame width should match tables span + padding');
  assert.equal(frame.height, (maxY - minY) + 44 + 36, 'Frame height should match tables height + header + padding');
});

test('separates bidirectional edges into distinct parallel tracks with offset labels', () => {
  const nodes = [
    { id: 'svc_a', type: 'svg', width: 90, height: 90, x: 100, y: 100 },
    { id: 'svc_b', type: 'svg', width: 90, height: 90, x: 400, y: 100 },
  ];
  const edges = [
    { id: 'e_fwd', source: 'svc_a', target: 'svc_b', label: 'HTTP Request' },
    { id: 'e_rev', source: 'svc_b', target: 'svc_a', label: 'Webhook Response' },
  ];

  const result = beautifyArchitectureLayout(nodes, edges);

  const fwd = result.edges.find((e) => e.id === 'e_fwd');
  const rev = result.edges.find((e) => e.id === 'e_rev');

  assert.ok(fwd, 'Forward edge should exist');
  assert.ok(rev, 'Reverse edge should exist');

  // Must have distinct sourceOffsets so the paths do not overlap
  assert.notEqual(fwd.sourceOffset, rev.sourceOffset, 'Bidirectional edges must have distinct sourceOffset');
  assert.notEqual(fwd.stepOffset, rev.stepOffset, 'Bidirectional edges must have distinct stepOffset');

  // Labels must be offset above and below the tracks
  assert.ok(fwd.labelOffset, 'Forward edge should have labelOffset');
  assert.ok(rev.labelOffset, 'Reverse edge should have labelOffset');
  assert.notEqual(Math.sign(fwd.labelOffset.y), Math.sign(rev.labelOffset.y), 'Labels should sit on opposite sides of the centerline');
});

test('sorts multi-connection fan-out geometrically so radiating lines never cross', () => {
  // api-gw at x: 100, y: 300 connects to three services at different Y positions
  const nodes = [
    { id: 'api-gw', type: 'svg', width: 90, height: 90, x: 100, y: 300 },
    { id: 'svc_top', type: 'svg', width: 90, height: 90, x: 500, y: 100 },
    { id: 'svc_mid', type: 'svg', width: 90, height: 90, x: 500, y: 300 },
    { id: 'svc_bot', type: 'svg', width: 90, height: 90, x: 500, y: 500 },
  ];
  const edges = [
    { id: 'e_bot', source: 'api-gw', target: 'svc_bot' },
    { id: 'e_top', source: 'api-gw', target: 'svc_top' },
    { id: 'e_mid', source: 'api-gw', target: 'svc_mid' },
  ];

  const result = beautifyArchitectureLayout(nodes, edges);

  const eTop = result.edges.find((e) => e.id === 'e_top');
  const eMid = result.edges.find((e) => e.id === 'e_mid');
  const eBot = result.edges.find((e) => e.id === 'e_bot');

  assert.ok(eTop && eMid && eBot);

  // Line to top target (smaller Y) must have smaller sourceOffset than bottom target (larger Y)
  assert.ok(
    eTop.sourceOffset < eMid.sourceOffset,
    `Top target offset (${eTop.sourceOffset}) must be < mid target offset (${eMid.sourceOffset})`
  );
  assert.ok(
    eMid.sourceOffset < eBot.sourceOffset,
    `Mid target offset (${eMid.sourceOffset}) must be < bot target offset (${eBot.sourceOffset})`
  );
});

test('offsets vertical edge labels to the side so line stroke does not bisect label badge', () => {
  const nodes = [
    { id: 'worker', type: 'svg', width: 90, height: 90, x: 300, y: 100 },
    { id: 'db', type: 'svg', width: 90, height: 90, x: 300, y: 400 },
  ];
  const edges = [
    { id: 'e_vert', source: 'worker', target: 'db', label: 'SQL Query' },
  ];

  const result = beautifyArchitectureLayout(nodes, edges);
  const edge = result.edges.find((e) => e.id === 'e_vert');

  assert.ok(edge);
  assert.equal(edge.sourceHandle, 'bottom');
  assert.equal(edge.targetHandle, 'top');
  assert.ok(edge.labelOffset, 'Vertical edge must have labelOffset');
  assert.ok(edge.labelOffset.x >= 30, `Label x offset (${edge.labelOffset.x}) should be offset to the side >= 30px`);
});

test('staggers overlapping edge labels on parallel flows', () => {
  // Two parallel services communicating
  const nodes = [
    { id: 'n1', type: 'svg', width: 90, height: 90, x: 100, y: 100 },
    { id: 'n2', type: 'svg', width: 90, height: 90, x: 400, y: 100 },
    { id: 'n3', type: 'svg', width: 90, height: 90, x: 100, y: 130 },
    { id: 'n4', type: 'svg', width: 90, height: 90, x: 400, y: 130 },
  ];
  const edges = [
    { id: 'e1', source: 'n1', target: 'n2', label: 'Parallel Flow One' },
    { id: 'e2', source: 'n3', target: 'n4', label: 'Parallel Flow Two' },
  ];

  const result = beautifyArchitectureLayout(nodes, edges);
  const e1 = result.edges.find((e) => e.id === 'e1');
  const e2 = result.edges.find((e) => e.id === 'e2');

  assert.ok(e1 && e2);
  // Either e1 or e2 should have labelOffset staggered to prevent overlap
  assert.ok(e1.labelOffset || e2.labelOffset, 'At least one parallel edge should have labelOffset to stagger');
});
