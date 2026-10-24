import { DEFAULT_STENCIL_VIEW_BOX, type StencilDefinition } from './types';

/**
 * A lookup table of the artwork the engine knows how to draw.
 *
 * The registry is the single place a stencil id is resolved, so the canvas, the
 * library panel and the exporter cannot drift apart about what an id means.
 * It is immutable once built: stencils are registered at construction, which
 * makes a duplicate id a startup error rather than a last-one-wins surprise at
 * render time.
 */
export interface StencilRegistry {
  /** The stencil with this id, or `undefined` if nothing is registered under it. */
  get(id: string): StencilDefinition | undefined;
  has(id: string): boolean;
  /** Every registered stencil, in registration order. */
  list(): readonly StencilDefinition[];
  /** Registered stencils grouped by category, in registration order within each. */
  byCategory(): ReadonlyMap<string, readonly StencilDefinition[]>;
  /** Case-insensitive match over id, title, subtitle and description. */
  search(query: string): readonly StencilDefinition[];
}

/**
 * Builds a registry over `definitions`.
 *
 * @throws if two definitions share an id — a collision would otherwise surface
 * as one stencil silently rendering as another, which is far harder to place.
 */
export function createStencilRegistry(
  definitions: readonly StencilDefinition[]
): StencilRegistry {
  const byId = new Map<string, StencilDefinition>();

  for (const definition of definitions) {
    if (byId.has(definition.id)) {
      throw new Error(`Duplicate stencil id: ${definition.id}`);
    }
    byId.set(definition.id, definition);
  }

  const list = Array.from(byId.values());

  const index = (query: string): string => query.toLowerCase().trim();

  const COMMON_ALIASES: Record<string, string> = {
    // Gateways & Ingress
    'arch-api-gateway': 'arch-gateway',
    'api-gateway': 'arch-gateway',
    'apigateway': 'arch-gateway',
    'gateway': 'arch-gateway',
    'arch-apigateway': 'arch-gateway',
    'arch-ingress': 'arch-reverse-proxy',
    'ingress': 'arch-reverse-proxy',
    'reverse-proxy': 'arch-reverse-proxy',
    'proxy': 'arch-reverse-proxy',
    'load-balancer': 'arch-load-balancer',
    'lb': 'arch-load-balancer',
    'alb': 'arch-load-balancer',
    'nlb': 'arch-load-balancer',
    'arch-alb': 'arch-load-balancer',
    'arch-nlb': 'arch-load-balancer',
    'envoy': 'arch-reverse-proxy',
    'traefik': 'arch-reverse-proxy',

    // Payments & Checkout (Stripe)
    'arch-stripe': 'arch-payment-gateway',
    'stripe': 'tech-stripe',
    'tech-stripe-gateway': 'tech-stripe',
    'tech-stripe-logo': 'tech-stripe',
    'arch-stripe-gateway': 'arch-payment-gateway',
    'arch-checkout': 'arch-payment-gateway',
    'payment-gateway': 'arch-payment-gateway',
    'payment': 'arch-payment-gateway',
    'payments': 'arch-payment-gateway',

    // Serverless / Compute / Workers
    'arch-lambda': 'arch-microservice',
    'lambda': 'tech-aws-lambda',
    'aws-lambda': 'tech-aws-lambda',
    'tech-lambda': 'tech-aws-lambda',
    'aws-ec2': 'tech-aws-ec2',
    'aws-ecs': 'tech-aws-ecs',
    'aws-eks': 'tech-aws-eks',
    'aws-fargate': 'tech-aws-fargate',
    'serverless': 'arch-microservice',
    'function': 'arch-microservice',
    'cloud-function': 'arch-microservice',
    'worker': 'arch-worker',
    'background-worker': 'arch-worker',
    'job': 'arch-cron',
    'cron-job': 'arch-cron',
    'server': 'arch-server',
    'host': 'arch-server',
    'ec2': 'tech-aws-ec2',
    'arch-ec2': 'arch-server',
    'vm': 'arch-vm',
    'virtual-machine': 'arch-vm',
    'container': 'arch-container',
    'pod': 'arch-pod',
    'k8s-pod': 'arch-pod',
    'microservice': 'arch-microservice',
    'service': 'arch-microservice',

    // Storage & Databases
    'arch-s3': 'arch-object-storage',
    's3': 'tech-aws-s3',
    'aws-s3': 'tech-aws-s3',
    'tech-s3': 'tech-aws-s3',
    'aws-ebs': 'tech-aws-ebs',
    'aws-efs': 'tech-aws-efs',
    's3-bucket': 'arch-object-storage',
    'bucket': 'arch-object-storage',
    'object-storage': 'arch-object-storage',
    'blob-storage': 'arch-object-storage',
    'storage': 'arch-object-storage',
    'cloud-storage': 'arch-object-storage',
    'gcs': 'arch-object-storage',
    'azure-blob': 'arch-object-storage',
    'arch-dynamodb': 'arch-database',
    'dynamodb': 'tech-aws-dynamodb',
    'aws-dynamodb': 'tech-aws-dynamodb',
    'tech-dynamodb': 'tech-aws-dynamodb',
    'database': 'arch-database',
    'db': 'arch-database',
    'rdbms': 'arch-database',
    'rds': 'tech-aws-rds',
    'aws-rds': 'tech-aws-rds',
    'aws-aurora': 'tech-aws-aurora',
    'aws-elasticache': 'tech-aws-elasticache',
    'arch-rds': 'arch-database',
    'cache': 'arch-cache',
    'redis-cache': 'tech-redis',
    'memcached': 'arch-cache',

    // Messaging & Events
    'arch-topic': 'arch-pubsub',
    'topic': 'arch-pubsub',
    'pubsub': 'arch-pubsub',
    'sns': 'arch-pubsub',
    'arch-sns': 'arch-pubsub',
    'sqs': 'arch-queue',
    'arch-sqs': 'arch-queue',
    'queue': 'arch-queue',
    'message-queue': 'arch-queue',
    'event-bus': 'arch-event-bus',
    'eventbus': 'arch-event-bus',
    'eventbridge': 'arch-event-bus',
    'arch-eventbridge': 'arch-event-bus',
    'kinesis': 'arch-event-bus',
    'arch-kinesis': 'arch-event-bus',
    'kafka-pipeline': 'tech-kafka',
    'arch-kafka': 'tech-kafka',
    'rabbitmq-queue': 'arch-rabbitmq-queue',
    'arch-rabbitmq': 'tech-rabbitmq',

    // Security, IAM, Auth & Boundaries
    'arch-auth': 'arch-security',
    'auth': 'arch-security',
    'authentication': 'arch-security',
    'cognito': 'arch-security',
    'arch-cognito': 'arch-security',
    'iam': 'arch-security',
    'arch-iam': 'arch-security',
    'firewall': 'arch-security',
    'arch-firewall': 'arch-security',
    'waf': 'arch-security',
    'arch-waf': 'arch-security',
    'security': 'arch-security',
    'vault': 'arch-vault',
    'kms': 'arch-vault',
    'arch-kms': 'arch-vault',
    'secrets': 'arch-vault',

    // Networking, DNS & CDN
    'arch-vpc': 'arch-vpc-boundary',
    'vpc': 'arch-vpc-boundary',
    'subnet': 'arch-public-subnet',
    'public-subnet': 'arch-public-subnet',
    'private-subnet': 'arch-private-subnet',
    'dns': 'arch-dns',
    'route53': 'arch-dns',
    'arch-route53': 'arch-dns',
    'cdn': 'arch-cdn',
    'cloudfront': 'arch-cdn',
    'arch-cloudfront': 'arch-cdn',
    'websocket': 'arch-websocket',
    'webhook': 'arch-webhook',

    // Observability & Monitoring
    'monitoring': 'arch-monitoring',
    'metrics': 'arch-monitoring',
    'cloudwatch': 'arch-monitoring',
    'arch-cloudwatch': 'arch-monitoring',
    'grafana': 'arch-monitoring',
    'tech-grafana': 'arch-monitoring',
    'arch-grafana': 'arch-monitoring',
    'prometheus': 'arch-monitoring',
    'tech-prometheus': 'arch-monitoring',
    'arch-prometheus': 'arch-monitoring',

    // Technology Logos
    'tech-kubernetes': 'tech-k8s',
    'kubernetes': 'tech-k8s',
    'k8s': 'tech-k8s',
    'tech-k8s-node': 'arch-k8s-node',
    'tech-golang': 'tech-go',
    'golang': 'tech-go',
    'go': 'tech-go',
    'tech-postgresql': 'tech-postgres',
    'postgres': 'tech-postgres',
    'postgresql': 'tech-postgres',
    'mysql': 'tech-mysql',
    'redis': 'tech-redis',
    'mongo': 'tech-mongodb',
    'mongodb': 'tech-mongodb',
    'tech-mongo': 'tech-mongodb',
    'sqlite': 'tech-sqlite',
    'elastic': 'tech-elasticsearch',
    'elasticsearch': 'tech-elasticsearch',
    'tech-elastic': 'tech-elasticsearch',
    'docker': 'tech-docker',
    'nginx': 'tech-nginx',
    'kafka': 'tech-kafka',
    'rabbit': 'tech-rabbitmq',
    'rabbitmq': 'tech-rabbitmq',
    'graphql': 'tech-graphql',
    'next': 'tech-nextjs',
    'nextjs': 'tech-nextjs',
    'next.js': 'tech-nextjs',
    'node': 'tech-nodejs',
    'nodejs': 'tech-nodejs',
    'node.js': 'tech-nodejs',
    'python': 'tech-python',
    'react': 'tech-react',
    'reactjs': 'tech-react',
    'react.js': 'tech-react',
    'typescript': 'tech-typescript',
    'ts': 'tech-typescript',
    'rust': 'tech-rust',
    'github': 'tech-github',
    'aws': 'tech-aws',
    'amazon-aws': 'tech-aws',
    'azure': 'tech-azure',
    'microsoft-azure': 'tech-azure',
    'gcp': 'tech-gcp',
    'google-cloud': 'tech-gcp',
    'cloudflare': 'tech-cloudflare',
    'supabase': 'tech-supabase',
    'firebase': 'tech-firebase',
    'vercel': 'tech-vercel',
    'gemini': 'tech-gemini',
    'google-gemini': 'tech-gemini',
    'anthropic': 'tech-anthropic',
    'claude': 'tech-anthropic',
    'terraform': 'tech-terraform',
    'datadog': 'tech-datadog',
    'slack': 'tech-slack-logo',
    'tech-slack': 'tech-slack-logo',
  };

  const resolveId = (rawId: string): StencilDefinition | undefined => {
    if (!rawId || typeof rawId !== 'string') return undefined;
    const id = rawId.trim().toLowerCase();

    // 1. Direct hit
    if (byId.has(id)) return byId.get(id);

    // 2. Explicit alias
    if (COMMON_ALIASES[id] && byId.has(COMMON_ALIASES[id])) {
      return byId.get(COMMON_ALIASES[id]);
    }

    // 3. Try with arch- or tech- prefixes
    const stripped = id.replace(/^(arch-|tech-)/, '');
    if (byId.has(`arch-${stripped}`)) return byId.get(`arch-${stripped}`);
    if (byId.has(`tech-${stripped}`)) return byId.get(`tech-${stripped}`);
    if (COMMON_ALIASES[stripped] && byId.has(COMMON_ALIASES[stripped])) {
      return byId.get(COMMON_ALIASES[stripped]);
    }
    if (COMMON_ALIASES[`arch-${stripped}`] && byId.has(COMMON_ALIASES[`arch-${stripped}`])) {
      return byId.get(COMMON_ALIASES[`arch-${stripped}`]);
    }
    if (COMMON_ALIASES[`tech-${stripped}`] && byId.has(COMMON_ALIASES[`tech-${stripped}`])) {
      return byId.get(COMMON_ALIASES[`tech-${stripped}`]);
    }

    return undefined;
  };

  return {
    get: resolveId,
    has: (id) => Boolean(resolveId(id)),
    list: () => list,

    byCategory() {
      const grouped = new Map<string, StencilDefinition[]>();
      for (const definition of list) {
        const bucket = grouped.get(definition.category);
        if (bucket) bucket.push(definition);
        else grouped.set(definition.category, [definition]);
      }
      return grouped;
    },

    search(query) {
      const needle = index(query);
      if (!needle) return list;
      return list.filter(
        (definition) =>
          index(definition.id).includes(needle) ||
          index(definition.title).includes(needle) ||
          index(definition.subtitle).includes(needle) ||
          index(definition.description).includes(needle)
      );
    },
  };
}

/**
 * The authored space a definition draws in, defaulted.
 *
 * Callers that need to scale a stencil into a node box read this rather than
 * reaching for `definition.viewBox` directly, so the 100×100 default lives in
 * exactly one place.
 */
export function stencilViewBox(
  definition: StencilDefinition
): typeof DEFAULT_STENCIL_VIEW_BOX {
  return definition.viewBox ?? DEFAULT_STENCIL_VIEW_BOX;
}

/**
 * Scales a stencil's authored space into a node box.
 *
 * Uniform, and centred — the same thing SVG means by its default
 * `preserveAspectRatio="xMidYMid meet"`, and the behaviour the exporter has
 * always had. A stencil is artwork, not a fill: stretching a 100×100 glyph into
 * a 140×60 node would distort it, so the box that does not match the artwork's
 * aspect ratio gets margin instead.
 *
 * Applying `translate(t) scale(s)` to a point `p` yields `p * s + t`, so a
 * caller writes one `transform` and does not have to reason about the order.
 */
export function stencilTransform(
  definition: StencilDefinition,
  width: number,
  height: number
): { scale: number; translateX: number; translateY: number } {
  const box = stencilViewBox(definition);

  const scales: number[] = [];
  if (box.width > 0) scales.push(width / box.width);
  if (box.height > 0) scales.push(height / box.height);
  const candidate = scales.length ? Math.min(...scales) : 1;
  const scale = Number.isFinite(candidate) && candidate > 0 ? candidate : 1;

  return {
    scale,
    translateX: -box.x * scale + (width - box.width * scale) / 2,
    translateY: -box.y * scale + (height - box.height * scale) / 2,
  };
}
