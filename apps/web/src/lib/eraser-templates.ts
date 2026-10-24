import { stockLibrary, stockTemplates, BASE_CSS } from '@eraserlabs/diagram-templates';
import { createResolver, parseTemplate } from '@eraserlabs/resolve';
import { buildHtmlDocument } from '@eraserlabs/render';

export interface EraserDiagramData {
  entities: any[];
  connections: any[];
  width?: number;
  height?: number;
  direction?: 'LR' | 'TB';
}


export const STARTER_ERASER_TEMPLATES: Record<string, EraserDiagramData> = {
  'cloud-architecture': {
    width: 1200,
    height: 700,
    direction: 'LR',
    entities: [
      {
        id: 'vpc',
        tag: 'GroupBoundary',
        label: 'Production VPC (us-east-1)',
        x: 350,
        y: 40,
        width: 1180,
        height: 560,
        style: { stroke: '#6366f1', fill: '#6366f110' },
      },
      {
        id: 'client',
        tag: 'Service',
        label: 'Web & Mobile Client',
        subtitle: 'Next.js 15 / iOS',
        badge: 'Client',
        icon: 'globe',
        x: 40,
        y: 230,
        width: 210,
        height: 76,
        style: { stroke: '#06b6d4', fill: '#06b6d415' },
      },
      {
        id: 'gateway',
        tag: 'Service',
        label: 'API Gateway',
        subtitle: 'Envoy / Rate Limiter',
        badge: 'Gateway',
        icon: 'layers',
        x: 420,
        y: 230,
        width: 210,
        height: 76,
        style: { stroke: '#3b82f6', fill: '#3b82f615' },
      },
      {
        id: 'auth',
        tag: 'Service',
        label: 'Auth Service',
        subtitle: 'Rust / JWT & OAuth2',
        badge: 'Auth',
        icon: 'shield',
        x: 800,
        y: 110,
        width: 210,
        height: 76,
        style: { stroke: '#8b5cf6', fill: '#8b5cf615' },
      },
      {
        id: 'payment',
        tag: 'Service',
        label: 'Payment Engine',
        subtitle: 'Go / Stripe Webhook',
        badge: 'Worker',
        icon: 'server',
        x: 800,
        y: 350,
        width: 210,
        height: 76,
        style: { stroke: '#10b981', fill: '#10b98115' },
      },
      {
        id: 'postgres',
        tag: 'Service',
        label: 'PostgreSQL DB',
        subtitle: 'HA Primary + Replicas',
        badge: 'SQL',
        icon: 'database',
        x: 1200,
        y: 110,
        width: 210,
        height: 76,
        style: { stroke: '#3b82f6', fill: '#3b82f615' },
      },
      {
        id: 'redis',
        tag: 'Service',
        label: 'Redis Cache',
        subtitle: 'Sessions & Locks',
        badge: 'Cache',
        icon: 'database',
        x: 1200,
        y: 350,
        width: 210,
        height: 76,
        style: { stroke: '#ef4444', fill: '#ef444415' },
      },
    ],
    connections: [
      {
        id: 'c1',
        from: 'client',
        to: 'gateway',
        label: 'HTTPS / WSS',
        color: '#06b6d4',
      },
      {
        id: 'c2',
        from: 'gateway',
        to: 'auth',
        label: 'Validate Token',
        color: '#8b5cf6',
      },
      {
        id: 'c3',
        from: 'gateway',
        to: 'payment',
        label: 'Process Charge',
        color: '#10b981',
      },
      {
        id: 'c4',
        from: 'payment',
        to: 'postgres',
        label: 'Write Ledger',
        color: '#3b82f6',
      },
      {
        id: 'c5',
        from: 'payment',
        to: 'redis',
        label: 'Idempotency Key',
        color: '#ef4444',
      },
      {
        id: 'c6',
        from: 'auth',
        to: 'redis',
        label: 'Store Session',
        color: '#8b5cf6',
      },
    ],
  },
  'database-erd': {
    width: 1100,
    height: 600,
    direction: 'LR',
    entities: [
      {
        id: 'users',
        tag: 'DatabaseTable',
        label: 'users',
        x: 60,
        y: 100,
        width: 220,
        height: 180,
        columns: [
          { name: 'id', type: 'uuid', pk: true },
          { name: 'email', type: 'varchar(255)' },
          { name: 'name', type: 'varchar(100)' },
          { name: 'created_at', type: 'timestamp' },
        ],
        style: { stroke: '#3b82f6', fill: '#3b82f615' },
      },
      {
        id: 'organizations',
        tag: 'DatabaseTable',
        label: 'organizations',
        x: 420,
        y: 100,
        width: 220,
        height: 180,
        columns: [
          { name: 'id', type: 'uuid', pk: true },
          { name: 'owner_id', type: 'uuid', fk: true },
          { name: 'slug', type: 'varchar(50)' },
          { name: 'name', type: 'varchar(100)' },
        ],
        style: { stroke: '#8b5cf6', fill: '#8b5cf615' },
      },
      {
        id: 'diagrams',
        tag: 'DatabaseTable',
        label: 'diagrams',
        x: 780,
        y: 100,
        width: 230,
        height: 180,
        columns: [
          { name: 'id', type: 'uuid', pk: true },
          { name: 'org_id', type: 'uuid', fk: true },
          { name: 'title', type: 'varchar(255)' },
          { name: 'canvas_data', type: 'jsonb' },
        ],
        style: { stroke: '#10b981', fill: '#10b98115' },
      },
    ],
    connections: [
      {
        id: 'c-user-org',
        from: 'users',
        to: 'organizations',
        label: '1 : N',
        color: '#8b5cf6',
        style: 'step',
        startArrowhead: 'er-one',
        endArrowhead: 'er-many',
      },
      {
        id: 'c-org-diagram',
        from: 'organizations',
        to: 'diagrams',
        label: '1 : N',
        color: '#10b981',
        style: 'step',
        startArrowhead: 'er-one',
        endArrowhead: 'er-many',
      },
    ],
  },
  'blank': {
    width: 1200,
    height: 700,
    direction: 'LR',
    entities: [],
    connections: [],
  },
};

export function getEraserTemplate(key: string): EraserDiagramData {
  return (
    STARTER_ERASER_TEMPLATES[key] ||
    STARTER_ERASER_TEMPLATES['cloud-architecture']
  );
}

export function normalizeEraserCanvasData(raw: unknown): EraserDiagramData {
  if (!raw || typeof raw !== 'object') {
    return getEraserTemplate('cloud-architecture');
  }

  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.entities) && Array.isArray(obj.connections)) {
    return {
      entities: obj.entities,
      connections: obj.connections,
      width: (obj.width as number) || 1200,
      height: (obj.height as number) || 700,
      direction: (obj.direction as any) || 'LR',
    };
  }

  return getEraserTemplate('cloud-architecture');
}

function inferNodeMeta(id: string, label: string, isCylinder = false) {
  const text = `${id} ${label}`.toLowerCase();

  // Specific database tech logos and stencils
  if (text.includes('postgres') || text.includes('postgresql') || text.includes('pgsql')) {
    return { icon: 'database', badge: 'Database', color: '#4169E1', techLogoId: 'tech-postgres', stencilId: 'arch-database' };
  }
  if (text.includes('mysql')) {
    return { icon: 'database', badge: 'Database', color: '#4479A1', techLogoId: 'tech-mysql', stencilId: 'arch-database' };
  }
  if (text.includes('redis') || text.includes('elasticache')) {
    return { icon: 'database', badge: 'Cache', color: '#FF4438', techLogoId: 'tech-redis', stencilId: 'arch-cache' };
  }
  if (text.includes('mongo') || text.includes('mongodb')) {
    return { icon: 'database', badge: 'Database', color: '#47A248', techLogoId: 'tech-mongodb', stencilId: 'arch-database' };
  }
  if (text.includes('sqlite')) {
    return { icon: 'database', badge: 'Database', color: '#003B57', techLogoId: 'tech-sqlite', stencilId: 'arch-database' };
  }

  // Event streaming & Message Queues
  if (text.includes('kafka')) {
    return { icon: 'workflow', badge: 'Kafka', color: '#231F20', techLogoId: 'tech-kafka', stencilId: 'arch-topic' };
  }
  if (text.includes('rabbit') || text.includes('rabbitmq')) {
    return { icon: 'workflow', badge: 'RabbitMQ', color: '#FF6600', techLogoId: 'tech-rabbitmq', stencilId: 'arch-queue' };
  }

  // Containers & Kubernetes
  if (text.includes('docker')) {
    return { icon: 'package', badge: 'Docker', color: '#2496ED', techLogoId: 'tech-docker', stencilId: 'arch-docker' };
  }
  if (text.includes('k8s') || text.includes('kubernetes')) {
    return { icon: 'layers', badge: 'Kubernetes', color: '#326CE5', techLogoId: 'tech-kubernetes', stencilId: 'arch-kubernetes' };
  }

  // Frontend frameworks
  if (text.includes('next') || text.includes('nextjs') || text.includes('next.js')) {
    return { icon: 'globe', badge: 'Next.js', color: '#000000', techLogoId: 'tech-nextjs' };
  }
  if (text.includes('react')) {
    return { icon: 'globe', badge: 'React', color: '#06b6d4', techLogoId: 'tech-react' };
  }
  if (text.includes('graphql')) {
    return { icon: 'layers', badge: 'GraphQL', color: '#E10098', techLogoId: 'tech-graphql' };
  }
  if (text.includes('nginx')) {
    return { icon: 'server', badge: 'NGINX', color: '#009639', techLogoId: 'tech-nginx', stencilId: 'arch-load-balancer' };
  }
  if (text.includes('node') || text.includes('nodejs') || text.includes('express') || text.includes('nest')) {
    return { icon: 'server', badge: 'Node.js', color: '#5FA04E', techLogoId: 'tech-nodejs', stencilId: 'arch-microservice' };
  }
  if (text.includes('python') || text.includes('fastapi') || text.includes('django') || text.includes('flask')) {
    return { icon: 'server', badge: 'Python', color: '#3776AB', techLogoId: 'tech-python', stencilId: 'arch-microservice' };
  }
  if (text.includes('golang') || text.includes('go service')) {
    return { icon: 'server', badge: 'Go', color: '#00ADD8', techLogoId: 'tech-golang', stencilId: 'arch-microservice' };
  }

  // Cloud & Serverless
  if (text.includes('lambda')) {
    return { icon: 'server', badge: 'Compute', color: '#f59e0b', stencilId: 'arch-lambda' };
  }
  if (text.includes('s3') || text.includes('bucket') || text.includes('storage') || text.includes('r2') || text.includes('blob')) {
    return { icon: 'cloud', badge: 'Storage', color: '#10b981', stencilId: 'arch-s3' };
  }
  if (text.includes('gateway') || text.includes('api gateway') || text.includes('kong') || text.includes('envoy')) {
    return { icon: 'layers', badge: 'Gateway', color: '#3b82f6', stencilId: 'arch-api-gateway' };
  }
  if (text.includes('load balancer') || text.includes('alb') || text.includes('elb') || text.includes('balancer')) {
    return { icon: 'shuffle', badge: 'Load Balancer', color: '#3b82f6', stencilId: 'arch-load-balancer' };
  }
  if (text.includes('auth') || text.includes('cognito') || text.includes('oauth') || text.includes('jwt') || text.includes('iam')) {
    return { icon: 'shield', badge: 'Security', color: '#ef4444', stencilId: 'arch-auth' };
  }
  if (text.includes('firewall') || text.includes('waf') || text.includes('security group')) {
    return { icon: 'shield', badge: 'Firewall', color: '#ef4444', stencilId: 'arch-firewall' };
  }
  if (text.includes('cdn') || text.includes('cloudflare') || text.includes('cloudfront')) {
    return { icon: 'globe', badge: 'CDN', color: '#F38020', techLogoId: 'tech-cloudflare', stencilId: 'arch-cdn' };
  }
  if (text.includes('prometheus')) {
    return { icon: 'activity', badge: 'Prometheus', color: '#E6522C', techLogoId: 'tech-prometheus', stencilId: 'arch-monitoring' };
  }
  if (text.includes('grafana')) {
    return { icon: 'activity', badge: 'Grafana', color: '#F46800', techLogoId: 'tech-grafana', stencilId: 'arch-monitoring' };
  }
  if (text.includes('stripe')) {
    return { icon: 'stripe', badge: 'Stripe', color: '#635BFF', techLogoId: 'tech-stripe', stencilId: 'arch-payment-gateway' };
  }
  if (text.includes('payment') || text.includes('checkout') || text.includes('billing')) {
    return { icon: 'payment', badge: 'Payment', color: '#635BFF', techLogoId: 'tech-stripe', stencilId: 'arch-payment-gateway' };
  }
  if (text.includes('elastic') || text.includes('opensearch')) {
    return { icon: 'search', badge: 'Search', color: '#005571', techLogoId: 'tech-elasticsearch' };
  }

  // Generic Storage & Object store
  if (
    text.includes('archive') ||
    text.includes('volume')
  ) {
    return { icon: 'harddrive', badge: 'Storage', color: '#10b981', stencilId: 'arch-s3' };
  }

  // Generic Compute & Functions
  if (
    text.includes('compute') ||
    text.includes('worker') ||
    text.includes('function') ||
    text.includes('ecs') ||
    text.includes('pod')
  ) {
    return { icon: 'server', badge: 'Compute', color: '#f59e0b', stencilId: 'arch-microservice' };
  }

  // Generic Databases & Caches
  if (
    isCylinder ||
    text.includes('db') ||
    text.includes('database') ||
    text.includes('dynamo') ||
    text.includes('sql') ||
    text.includes('cache') ||
    text.includes('aurora')
  ) {
    return { icon: 'database', badge: 'Database', color: '#8b5cf6', stencilId: 'arch-database' };
  }

  // Clients & Frontends
  if (
    text.includes('client') ||
    text.includes('web') ||
    text.includes('mobile') ||
    text.includes('browser') ||
    text.includes('user') ||
    text.includes('app')
  ) {
    return { icon: 'globe', badge: 'Client', color: '#06b6d4' };
  }

  // Queues & Messaging
  if (
    text.includes('queue') ||
    text.includes('event') ||
    text.includes('pubsub')
  ) {
    return { icon: 'workflow', badge: 'Queue', color: '#0ea5e9', stencilId: 'arch-queue' };
  }

  return { icon: 'server', badge: 'Service', color: '#3b82f6', stencilId: 'arch-server' };
}

function parseMermaidErDiagram(code: string): EraserDiagramData {
  const lines = code.split('\n');
  const tables = new Map<
    string,
    {
      id: string;
      title: string;
      fields: Array<{ name: string; type: string; pk?: boolean; fk?: boolean }>;
    }
  >();
  const connections: any[] = [];

  let currentTable: {
    id: string;
    title: string;
    fields: Array<{ name: string; type: string; pk?: boolean; fk?: boolean }>;
  } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('erDiagram') || line.startsWith('%%')) continue;

    // Inside table definition block
    if (currentTable) {
      if (line === '}') {
        currentTable = null;
        continue;
      }
      // Field format: type name [keys] ["comment"]
      // e.g. "uuid id PK", "varchar(255) email", "uuid user_id FK", "int id PK,FK"
      const cleanLine = line.replace(/["'].*?["']/, '').trim();
      const parts = cleanLine.split(/\s+/);
      if (parts.length >= 2) {
        const type = parts[0];
        const name = parts[1];
        const keys = parts.slice(2).join(' ').toUpperCase();
        const pk = keys.includes('PK');
        const fk = keys.includes('FK');
        currentTable.fields.push({
          name,
          type,
          pk: pk || undefined,
          fk: fk || undefined,
        });
      }
      continue;
    }

    // Table definition block start: ENTITY {
    const tableBlockMatch = line.match(/^([A-Za-z0-9_-]+)\s*\{$/);
    if (tableBlockMatch) {
      const id = tableBlockMatch[1];
      if (!tables.has(id)) {
        tables.set(id, { id, title: id, fields: [] });
      }
      currentTable = tables.get(id)!;
      continue;
    }

    // Relationship line: ENTITY1 ||--o{ ENTITY2 : "label"
    const relMatch = line.match(/^([A-Za-z0-9_-]+)\s+([|o}{.-]+)\s+([A-Za-z0-9_-]+)(?:\s*:\s*"?([^"\n]*)"?)?/);
    if (relMatch) {
      const [, src, rel, tgt, label] = relMatch;
      if (!tables.has(src)) tables.set(src, { id: src, title: src, fields: [] });
      if (!tables.has(tgt)) tables.set(tgt, { id: tgt, title: tgt, fields: [] });

      // Parse Mermaid erDiagram cardinality markers into Crow's Foot arrowheads
      const [leftSide = '', rightSide = ''] = rel.split(/--|\.\./);
      const parseErSide = (
        token: string
      ): 'er-one' | 'er-zero-one' | 'er-many' | 'er-zero-many' => {
        const hasMany = token.includes('{') || token.includes('}');
        const hasZero = token.includes('o');
        if (hasMany && hasZero) return 'er-zero-many';
        if (hasMany) return 'er-many';
        if (hasZero) return 'er-zero-one';
        return 'er-one';
      };

      connections.push({
        id: `c-${src}-${tgt}-${connections.length}`,
        from: src,
        to: tgt,
        label: label ? label.trim() : rel,
        color: '#0d9488',
        style: 'step',
        startArrowhead: parseErSide(leftSide),
        endArrowhead: parseErSide(rightSide),
      });
      continue;
    }

    // Standalone entity name: ENTITY
    const entityMatch = line.match(/^([A-Za-z0-9_-]+)$/);
    if (entityMatch && !tables.has(entityMatch[1])) {
      tables.set(entityMatch[1], { id: entityMatch[1], title: entityMatch[1], fields: [] });
    }
  }

  // Layout ERD tables in a clean multi-column grid
  const entities: any[] = [];
  const tableWidth = 260;
  const tableGapX = 140;
  const tableGapY = 120;
  const cols = tables.size > 4 ? 3 : 2;

  let idx = 0;
  for (const [, table] of tables) {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const tableHeight = Math.max(160, 44 + table.fields.length * 28 + 20);

    entities.push({
      id: table.id,
      tag: 'DatabaseTable',
      type: 'table',
      label: table.title,
      title: table.title,
      fields: table.fields,
      columns: table.fields,
      x: 60 + col * (tableWidth + tableGapX),
      y: 60 + row * (220 + tableGapY),
      width: tableWidth,
      height: tableHeight,
      color: '#0d9488',
      style: { stroke: '#0d9488', fill: '#0d948815' },
    });
    idx++;
  }

  return {
    entities,
    connections,
    width: 1400,
    height: 900,
    direction: 'LR',
  };
}

function parseMermaidSequenceDiagram(code: string): EraserDiagramData {
  const lines = code.split('\n');
  const participants = new Map<string, { id: string; title: string; isActor: boolean }>();
  const connections: any[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('sequenceDiagram') || line.startsWith('autonumber') || line.startsWith('%%')) continue;

    // Participant or Actor declaration: participant/actor ID [as "Title"]
    const partMatch = line.match(/^(participant|actor)\s+([A-Za-z0-9_-]+)(?:\s+as\s+["']?(.*?)["']?)?$/i);
    if (partMatch) {
      const isActor = partMatch[1].toLowerCase() === 'actor';
      const id = partMatch[2];
      const title = (partMatch[3] || id).replace(/["']/g, '').trim();
      participants.set(id, { id, title, isActor });
      continue;
    }

    // Message line: Src->>Tgt: Label or Src-->>Tgt: Label or Src->Tgt: Label
    const msgMatch = line.match(/^([A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*)\s*(-->>|->>|-->|->)\s*([A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*)\s*:\s*(.*)$/);
    if (msgMatch) {
      const [, srcId, , tgtId, label] = msgMatch;
      if (!participants.has(srcId)) {
        participants.set(srcId, { id: srcId, title: srcId, isActor: false });
      }
      if (!participants.has(tgtId)) {
        participants.set(tgtId, { id: tgtId, title: tgtId, isActor: false });
      }
      connections.push({
        id: `c-${srcId}-${tgtId}-${connections.length}`,
        from: srcId,
        to: tgtId,
        label: label.trim(),
        color: '#6366f1',
      });
    }
  }

  const entities: any[] = [];
  const cardWidth = 200;
  const cardHeight = 72;
  const gap = 60;
  let idx = 0;

  for (const [, p] of participants) {
    const meta = inferNodeMeta(p.id, p.title, false);
    entities.push({
      id: p.id,
      tag: 'Service',
      label: p.title,
      badge: p.isActor ? 'Actor' : meta.badge,
      icon: p.isActor ? 'users' : meta.icon,
      stencilId: meta.stencilId,
      techLogo: meta.techLogoId,
      x: 60 + idx * (cardWidth + gap),
      y: 80,
      width: cardWidth,
      height: cardHeight,
      style: { stroke: meta.color, fill: `${meta.color}15` },
    });
    idx++;
  }

  return {
    entities,
    connections,
    width: Math.max(1000, 120 + idx * (cardWidth + gap)),
    height: 600,
    direction: 'LR',
  };
}

export function parseMermaidToEraser(mermaidCode: string): EraserDiagramData {
  const trimmed = mermaidCode.trim();
  if (trimmed.startsWith('erDiagram')) {
    return parseMermaidErDiagram(trimmed);
  }
  if (trimmed.startsWith('sequenceDiagram')) {
    return parseMermaidSequenceDiagram(trimmed);
  }

  const lines = mermaidCode.split('\n');
  const subgraphs = new Map<string, { id: string; title: string; nodeIds: string[] }>();
  const nodes = new Map<
    string,
    {
      id: string;
      title: string;
      subtitle?: string;
      icon: string;
      badge: string;
      color: string;
      stencilId?: string;
      techLogoId?: string;
      parentId?: string;
    }
  >();
  const connections: any[] = [];

  let currentSubgraphId: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (
      !line ||
      line.startsWith('flowchart') ||
      line.startsWith('graph') ||
      line.startsWith('%%') ||
      line.startsWith('classDef') ||
      line.startsWith('class ')
    ) {
      continue;
    }

    // Subgraph start: subgraph Name ["Title"]
    const sgMatch = line.match(/^subgraph\s+([A-Za-z0-9_-]+)(?:\s+\["?(.*?)"?\])?/i);
    if (sgMatch) {
      const [, sgId, sgTitle] = sgMatch;
      currentSubgraphId = sgId;
      subgraphs.set(sgId, {
        id: sgId,
        title: (sgTitle || sgId).replace(/["']/g, '').trim(),
        nodeIds: [],
      });
      continue;
    }

    if (line.match(/^end\b/i)) {
      currentSubgraphId = null;
      continue;
    }

    // Arrow edge check: A -->|"label"| B or A -.-> B or A ==> B
    const arrowRegex = /\s*(-{2,3}>?|={2,3}>?|-\.-+>?|\.-+->?|--+|-\.-+)\s*(?:\|(.*?)\|)?\s*/;
    const arrowMatch = line.match(arrowRegex);

    if (arrowMatch && arrowMatch.index !== undefined) {
      const leftPart = line.slice(0, arrowMatch.index).trim();
      const edgeLabel = arrowMatch[2] ? arrowMatch[2].replace(/^["']|["']$/g, '').trim() : undefined;
      const rightPart = line.slice(arrowMatch.index + arrowMatch[0].length).trim();

      const parseNodeToken = (token: string) => {
        const idM = token.match(/^([A-Za-z0-9_-]+)/);
        if (!idM) return null;
        const id = idM[1];
        let rawLabel = id;
        let isCyl = false;

        if (token.includes('[(') && token.includes(')]')) {
          rawLabel = token.slice(token.indexOf('[(') + 2, token.lastIndexOf(')]'));
          isCyl = true;
        } else if (token.includes('{{') && token.includes('}}')) {
          rawLabel = token.slice(token.indexOf('{{') + 2, token.lastIndexOf('}}'));
        } else if (token.includes('([') && token.includes('])')) {
          rawLabel = token.slice(token.indexOf('([') + 2, token.lastIndexOf('])'));
        } else if (token.includes('[[') && token.includes(']]')) {
          rawLabel = token.slice(token.indexOf('[[') + 2, token.lastIndexOf(']]'));
        } else if (token.includes('((') && token.includes('))')) {
          rawLabel = token.slice(token.indexOf('((') + 2, token.lastIndexOf('))'));
        } else if (token.includes('[') && token.includes(']')) {
          rawLabel = token.slice(token.indexOf('[') + 1, token.lastIndexOf(']'));
        } else if (token.includes('(') && token.includes(')')) {
          rawLabel = token.slice(token.indexOf('(') + 1, token.lastIndexOf(')'));
        } else if (token.includes('{') && token.includes('}')) {
          rawLabel = token.slice(token.indexOf('{') + 1, token.lastIndexOf('}'));
        }

        rawLabel = rawLabel.replace(/^["']|["']$/g, '').replace(/:::([A-Za-z0-9_-]+)/, '').trim();
        return { id, rawLabel, isCyl };
      };

      const src = parseNodeToken(leftPart);
      const tgt = parseNodeToken(rightPart);

      if (src && tgt) {
        if (!nodes.has(src.id)) {
          const spl = src.rawLabel.split(/<br\s*\/?>|\n/i).map((s) => s.replace(/["']/g, '').trim()).filter(Boolean);
          const meta = inferNodeMeta(src.id, src.rawLabel, src.isCyl);
          nodes.set(src.id, {
            id: src.id,
            title: spl[0] || src.id,
            subtitle: spl.slice(1).join(' ') || undefined,
            icon: meta.icon,
            badge: meta.badge,
            color: meta.color,
            stencilId: meta.stencilId,
            techLogoId: meta.techLogoId,
            parentId: currentSubgraphId || undefined,
          });
          if (currentSubgraphId && subgraphs.has(currentSubgraphId)) {
            subgraphs.get(currentSubgraphId)!.nodeIds.push(src.id);
          }
        }

        if (!nodes.has(tgt.id)) {
          const spl = tgt.rawLabel.split(/<br\s*\/?>|\n/i).map((s) => s.replace(/["']/g, '').trim()).filter(Boolean);
          const meta = inferNodeMeta(tgt.id, tgt.rawLabel, tgt.isCyl);
          nodes.set(tgt.id, {
            id: tgt.id,
            title: spl[0] || tgt.id,
            subtitle: spl.slice(1).join(' ') || undefined,
            icon: meta.icon,
            badge: meta.badge,
            color: meta.color,
            stencilId: meta.stencilId,
            techLogoId: meta.techLogoId,
            parentId: currentSubgraphId || undefined,
          });
          if (currentSubgraphId && subgraphs.has(currentSubgraphId)) {
            subgraphs.get(currentSubgraphId)!.nodeIds.push(tgt.id);
          }
        }

        connections.push({
          id: `c-${src.id}-${tgt.id}-${connections.length}`,
          from: src.id,
          to: tgt.id,
          label: edgeLabel,
          color: '#3b82f6',
        });
        continue;
      }
    }

    // Node declaration without arrow (e.g. DDB[("...")]:::db)
    const idM = line.match(/^([A-Za-z0-9_-]+)/);
    if (idM) {
      const id = idM[1];
      let rawLabel = id;
      let isCyl = false;

      if (line.includes('[(') && line.includes(')]')) {
        rawLabel = line.slice(line.indexOf('[(') + 2, line.lastIndexOf(')]'));
        isCyl = true;
      } else if (line.includes('{{') && line.includes('}}')) {
        rawLabel = line.slice(line.indexOf('{{') + 2, line.lastIndexOf('}}'));
      } else if (line.includes('[') && line.includes(']')) {
        rawLabel = line.slice(line.indexOf('[') + 1, line.lastIndexOf(']'));
      } else if (line.includes('(') && line.includes(')')) {
        rawLabel = line.slice(line.indexOf('(') + 1, line.lastIndexOf(')'));
      }

      rawLabel = rawLabel.replace(/^["']|["']$/g, '').replace(/:::([A-Za-z0-9_-]+)/, '').trim();
      const spl = rawLabel.split(/<br\s*\/?>|\n/i).map((s) => s.replace(/["']/g, '').trim()).filter(Boolean);
      const meta = inferNodeMeta(id, rawLabel, isCyl);

      nodes.set(id, {
        id,
        title: spl[0] || id,
        subtitle: spl.slice(1).join(' ') || undefined,
        icon: meta.icon,
        badge: meta.badge,
        color: meta.color,
        stencilId: meta.stencilId,
        techLogoId: meta.techLogoId,
        parentId: currentSubgraphId || undefined,
      });

      if (currentSubgraphId && subgraphs.has(currentSubgraphId)) {
        subgraphs.get(currentSubgraphId)!.nodeIds.push(id);
      }
    }
  }

  // Layout entities
  const entities: any[] = [];
  const cardWidth = 220;
  const cardHeight = 76;
  const cardGap = 20;
  const padding = 24;
  const headerHeight = 44;

  if (subgraphs.size > 0) {
    let currentX = 50;
    for (const [, sg] of subgraphs) {
      const sgNodes = sg.nodeIds.map((nid) => nodes.get(nid)).filter(Boolean) as Array<{
        id: string;
        title: string;
        subtitle?: string;
        icon: string;
        badge: string;
        color: string;
        stencilId?: string;
        techLogoId?: string;
      }>;
      const count = Math.max(1, sgNodes.length);
      const sgWidth = cardWidth + padding * 2;
      const sgHeight = headerHeight + count * cardHeight + (count - 1) * cardGap + padding;

      // Add container entity (VPC / Subnet / Tier boundary)
      entities.push({
        id: sg.id,
        tag: 'GroupBoundary',
        label: sg.title,
        x: currentX,
        y: 50,
        width: sgWidth,
        height: sgHeight,
        style: { stroke: '#6366f1', fill: '#6366f10c' },
      });

      // Add child architecture cards inside
      sgNodes.forEach((node, idx) => {
        entities.push({
          id: node.id,
          tag: 'Service',
          label: node.title,
          subtitle: node.subtitle,
          badge: node.badge,
          icon: node.icon,
          stencilId: node.stencilId,
          techLogo: node.techLogoId,
          parentId: sg.id,
          x: currentX + padding,
          y: 50 + headerHeight + idx * (cardHeight + cardGap),
          width: cardWidth,
          height: cardHeight,
          style: { stroke: node.color, fill: `${node.color}15` },
        });
      });

      currentX += sgWidth + 60;
    }
  } else {
    // Flow layout in 3 columns
    let idx = 0;
    for (const [, node] of nodes) {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      entities.push({
        id: node.id,
        tag: 'Service',
        label: node.title,
        subtitle: node.subtitle,
        badge: node.badge,
        icon: node.icon,
        stencilId: node.stencilId,
        techLogo: node.techLogoId,
        x: 60 + col * (cardWidth + 70),
        y: 60 + row * (cardHeight + 60),
        width: cardWidth,
        height: cardHeight,
        style: { stroke: node.color, fill: `${node.color}15` },
      });
      idx++;
    }
  }

  return {
    entities,
    connections,
    width: 1400,
    height: 800,
    direction: 'TB',
  };
}
