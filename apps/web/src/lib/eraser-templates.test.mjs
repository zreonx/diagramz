import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMermaidToEraser } from './eraser-templates.ts';
import { normalizeToZCanvasDocument } from './zcanvaskit/core/converters.ts';

test('parseMermaidToEraser converts Mermaid subgraphs into VPC containers and child cards', () => {
  const mermaid = `
flowchart TB
    subgraph VPC_Prod ["Production VPC"]
        APIGW["Amazon API Gateway<br/>(REST API)"]
        Lambda["AWS Lambda<br/>(Core API)"]
        DB[("PostgreSQL DB<br/>(Multi-AZ)")]
    end

    APIGW -->|"HTTP"| Lambda
    Lambda -->|"SQL"| DB
  `;

  const result = parseMermaidToEraser(mermaid);
  assert.ok(result.entities.length >= 4, 'Should parse container and 3 cards');

  const container = result.entities.find((e) => e.tag === 'GroupBoundary');
  assert.ok(container, 'Should create GroupBoundary container');
  assert.equal(container.label, 'Production VPC');

  const cards = result.entities.filter((e) => e.tag === 'Service');
  assert.equal(cards.length, 3, 'Should create 3 cards');

  // Verify child parentId
  for (const card of cards) {
    assert.equal(card.parentId, container.id, `Card ${card.id} should reference parent container`);
  }

  // Verify semantic icon detection
  const gwCard = cards.find((c) => c.id === 'APIGW');
  assert.equal(gwCard?.icon, 'layers');
  assert.equal(gwCard?.badge, 'Gateway');

  const lambdaCard = cards.find((c) => c.id === 'Lambda');
  assert.equal(lambdaCard?.icon, 'server');
  assert.equal(lambdaCard?.badge, 'Compute');

  const dbCard = cards.find((c) => c.id === 'DB');
  assert.equal(dbCard?.icon, 'database');
  assert.equal(dbCard?.badge, 'Database');

  // Verify connections
  assert.equal(result.connections.length, 2, 'Should create 2 connections');
  assert.equal(result.connections[0].label, 'HTTP');
  assert.equal(result.connections[1].label, 'SQL');

  // Verify normalization to native ZCanvasDocument
  const zdoc = normalizeToZCanvasDocument(result);
  assert.equal(zdoc.nodes.length, 4, 'Should convert to 4 ZCanvasNodes');
  assert.equal(zdoc.nodes.filter((n) => n.type === 'container').length, 1);
  assert.equal(zdoc.nodes.filter((n) => n.type === 'card').length, 3);
  assert.equal(zdoc.edges.length, 2);
});

test('parseMermaidToEraser handles freeform flowcharts with dotted edges and badges', () => {
  const mermaid = `
flowchart LR
    Client["Next.js Web Client"]
    Auth["Auth0 / JWT Security"]
    S3[("Amazon S3 Bucket")]

    Client -.->|"Authenticate"| Auth
    Client -->|"Direct Upload"| S3
  `;

  const result = parseMermaidToEraser(mermaid);
  assert.equal(result.entities.length, 3);
  assert.equal(result.connections.length, 2);

  const auth = result.entities.find((e) => e.id === 'Auth');
  assert.equal(auth?.icon, 'shield');
  assert.equal(auth?.badge, 'Security');

  const s3 = result.entities.find((e) => e.id === 'S3');
  assert.equal(s3?.icon, 'cloud');
  assert.equal(s3?.badge, 'Storage');
});

test('parseMermaidToEraser accurately parses Mermaid erDiagram into DatabaseTable entities with fields and PK/FK', () => {
  const erMermaid = `
erDiagram
    USERS ||--o{ ORDERS : places
    ORDERS ||--|{ ORDER_ITEMS : contains
    USERS {
        uuid id PK
        varchar email
        text password_hash
        timestamptz created_at
    }
    ORDERS {
        uuid id PK
        uuid user_id FK
        numeric total_amount
        varchar status
    }
    ORDER_ITEMS {
        uuid id PK
        uuid order_id FK
        varchar product_name
        int quantity
    }
  `;

  const result = parseMermaidToEraser(erMermaid);
  assert.equal(result.entities.length, 3, 'Should parse 3 tables');
  assert.equal(result.connections.length, 2, 'Should parse 2 relationships');

  const users = result.entities.find((e) => e.id === 'USERS');
  assert.ok(users, 'USERS table should exist');
  assert.equal(users.tag, 'DatabaseTable');
  assert.equal(users.fields.length, 4);
  assert.equal(users.fields[0].name, 'id');
  assert.equal(users.fields[0].pk, true);
  assert.equal(users.fields[1].name, 'email');

  const orders = result.entities.find((e) => e.id === 'ORDERS');
  assert.ok(orders, 'ORDERS table should exist');
  assert.equal(orders.fields[0].pk, true);
  assert.equal(orders.fields[1].fk, true);

  // Verify normalization into ZCanvasDocument
  const zdoc = normalizeToZCanvasDocument(result);
  assert.equal(zdoc.nodes.length, 3);
  assert.equal(zdoc.nodes.every((n) => n.type === 'table'), true, 'All nodes should have type table');
  assert.equal(zdoc.nodes[0].fields?.length, 4);
  assert.equal(zdoc.edges.length, 2);
  // USERS ||--o{ ORDERS -> er-one to er-zero-many
  assert.equal(zdoc.edges[0].startArrowhead, 'er-one');
  assert.equal(zdoc.edges[0].endArrowhead, 'er-zero-many');
  assert.equal(zdoc.edges[0].style, 'step');
  // ORDERS ||--|{ ORDER_ITEMS -> er-one to er-many
  assert.equal(zdoc.edges[1].startArrowhead, 'er-one');
  assert.equal(zdoc.edges[1].endArrowhead, 'er-many');
});

test('parseMermaidToEraser parses sequenceDiagram into participants and message connectors', () => {
  const seqMermaid = `
sequenceDiagram
    actor User
    participant Gateway as API Gateway
    participant Auth as Auth Service
    User->>Gateway: POST /login
    Gateway->>Auth: Validate Credentials
    Auth-->>Gateway: 200 OK + Token
    Gateway-->>User: Success
  `;

  const result = parseMermaidToEraser(seqMermaid);
  assert.equal(result.entities.length, 3, 'Should create 3 participants');
  assert.equal(result.connections.length, 4, 'Should create 4 message connections');

  const user = result.entities.find((e) => e.id === 'User');
  assert.equal(user?.badge, 'Actor');

  const gw = result.entities.find((e) => e.id === 'Gateway');
  assert.equal(gw?.label, 'API Gateway');

  const zdoc = normalizeToZCanvasDocument(result);
  assert.equal(zdoc.nodes.length, 3);
  assert.equal(zdoc.edges.length, 4);
});

