import { measureArtwork } from './artwork-bounds';
import type { StencilDefinition, StencilRenderContext, StencilViewBox } from './types';

/**
 * The 51 built-in architecture stencils.
 *
 * This file is the single source of the artwork. It used to exist twice — once
 * as a React component and once as a markup string — which meant every visual
 * fix had to be made in two places and they had already drifted. Markup is the
 * surviving form because the exporter needs it without React and the canvas can
 * render it through a one-line wrapper.
 *
 * The artwork is authored in a 100×100 square, and each fragment is measured
 * from its own markup rather than assumed to fill that square: a drawing that
 * covers 62 of the 100 units would otherwise land in a node with two fifths of
 * it empty, and the empty part would grow with every resize. The measurement
 * gives both the view box the artwork is scaled from and the aspect ratio a
 * placed node takes, so what is dropped is exactly the drawing at the size the
 * tile offered it.
 */

/** Catalogue entry for one architecture stencil. */
export interface ArchitectureStencilMeta {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  /**
   * The size a placed node takes, and the size the panel's tile offers.
   *
   * Authored as the stencil's nominal footprint — the long edge — and resolved
   * against the artwork's own aspect ratio when the catalogue is built, so the
   * two dimensions always describe the picture rather than a box it was
   * centred in.
   */
  width: number;
  height: number;
  accentColor: string;
  description: string;
}

/**
 * The catalogue as authored: what a tile is called, where it is grouped, and
 * how large it is asked to be.
 *
 * Not exported. The resolved catalogue below is what every consumer reads, and
 * the only difference between the two is that a size here is a nominal
 * footprint while a size there is one a node can actually take.
 */
const ARCHITECTURE_CATALOGUE: ArchitectureStencilMeta[] = [
  // ─── 1. COMPUTE & CONTAINERS ───
  {
    id: 'arch-server',
    title: 'Server / Host Machine',
    subtitle: 'Compute Blade / Rack Server',
    category: 'Compute & Containers',
    width: 85,
    height: 85,
    accentColor: '#0ea5e9',
    description: 'Dual-chassis 2U rack server blade with hot-swap drives and status LEDs',
  },
  {
    id: 'arch-microservice',
    title: 'Microservice Cluster',
    subtitle: 'Decoupled Service Instances',
    category: 'Compute & Containers',
    width: 90,
    height: 90,
    accentColor: '#ef4444',
    description: 'Modular diamond service cluster connected via mesh bus',
  },
  {
    id: 'arch-container',
    title: 'Docker / Container',
    subtitle: 'Isolated Application Container',
    category: 'Compute & Containers',
    width: 85,
    height: 85,
    accentColor: '#0284c7',
    description: 'Standardized shipping cargo container with ribbed panels and corner castings',
  },
  {
    id: 'arch-pod',
    title: 'Kubernetes Pod',
    subtitle: 'Container Replicas Capsule',
    category: 'Compute & Containers',
    width: 85,
    height: 85,
    accentColor: '#3b82f6',
    description: 'Kubernetes pod boundary enclosing multi-container replica units with health check',
  },
  {
    id: 'arch-k8s-node',
    title: 'K8s Worker Node',
    subtitle: 'Cluster Node & Kubelet Host',
    category: 'Compute & Containers',
    width: 90,
    height: 90,
    accentColor: '#6366f1',
    description: 'Worker node chassis running internal pods with kubelet management agent',
  },
  {
    id: 'arch-vm',
    title: 'Virtual Machine (VM)',
    subtitle: 'Virtualized Compute Instance',
    category: 'Compute & Containers',
    width: 90,
    height: 90,
    accentColor: '#8b5cf6',
    description: 'Guest virtual machine environment layered atop host hypervisor engine',
  },
  {
    id: 'arch-worker',
    title: 'Background Worker',
    subtitle: 'Async Job & Worker Thread',
    category: 'Compute & Containers',
    width: 85,
    height: 85,
    accentColor: '#a855f7',
    description: 'Async worker engine with interlocking precision processor gears',
  },
  {
    id: 'arch-cron',
    title: 'Scheduled Task / Cron',
    subtitle: 'Periodic Job & Timer Engine',
    category: 'Compute & Containers',
    width: 85,
    height: 85,
    accentColor: '#f59e0b',
    description: 'Precision schedule clock with recurring circular execution cycle arrows',
  },
  {
    id: 'arch-server-rack',
    title: 'Server Rack Tower',
    subtitle: 'Data Center Rack Enclosure',
    category: 'Compute & Containers',
    width: 90,
    height: 90,
    accentColor: '#0284c7',
    description: 'Tiered vertical server rack unit with ventilated blades and activity beacons',
  },
  {
    id: 'arch-cpu-chip',
    title: 'Microchip / CPU Core',
    subtitle: 'Hardware Processor & Silicon',
    category: 'Compute & Containers',
    width: 85,
    height: 85,
    accentColor: '#0ea5e9',
    description: 'Precision silicon microprocessor die with gold connector pins and substrate core',
  },
  {
    id: 'arch-nginx-server',
    title: 'Nginx Web Server',
    subtitle: 'High-Performance HTTP Proxy',
    category: 'Compute & Containers',
    width: 85,
    height: 85,
    accentColor: '#10b981',
    description: 'High-concurrency Nginx reverse proxy server engine with upstream routing',
  },

  // ─── 2. CLOUD & INFRASTRUCTURE ───
  {
    id: 'arch-vpc-boundary',
    title: 'VPC Cloud Boundary',
    subtitle: 'Virtual Private Cloud Perimeter',
    category: 'Cloud & Infrastructure',
    width: 100,
    height: 100,
    accentColor: '#38bdf8',
    description: 'Isolated virtual network enclosure with multi-lobe cloud badge and security perimeter',
  },
  {
    id: 'arch-public-subnet',
    title: 'Public Subnet',
    subtitle: 'DMZ / Ingress Subnet Tier',
    category: 'Cloud & Infrastructure',
    width: 90,
    height: 90,
    accentColor: '#10b981',
    description: 'Internet-facing subnet partition with direct gateway egress route and active link',
  },
  {
    id: 'arch-private-subnet',
    title: 'Private Subnet',
    subtitle: 'Internal Isolated Tier',
    category: 'Cloud & Infrastructure',
    width: 90,
    height: 90,
    accentColor: '#f59e0b',
    description: 'Internal isolated network segment shielded from direct external internet access',
  },
  {
    id: 'arch-multi-cloud',
    title: 'Multi-Cloud Topology',
    subtitle: 'Hybrid Multi-Provider Network',
    category: 'Cloud & Infrastructure',
    width: 85,
    height: 85,
    accentColor: '#0ea5e9',
    description: 'Interconnected multi-cloud cluster bridging multiple cloud vendor domains',
  },
  {
    id: 'arch-cloud-cluster',
    title: 'Cloud Cluster Node',
    subtitle: 'High-Availability Cluster Node',
    category: 'Cloud & Infrastructure',
    width: 90,
    height: 90,
    accentColor: '#6366f1',
    description: 'Clustered failover compute node with distributed node satellites',
  },
  {
    id: 'arch-api-endpoint',
    title: 'Cloud API Endpoint',
    subtitle: 'Public / Microservice API Hook',
    category: 'Cloud & Infrastructure',
    width: 85,
    height: 85,
    accentColor: '#ec4899',
    description: 'REST / GraphQL ingress endpoint socket with bidirectional query pins',
  },
  {
    id: 'arch-route-connector',
    title: 'Service Route Connector',
    subtitle: 'Cross-Domain Route Bridge',
    category: 'Cloud & Infrastructure',
    width: 80,
    height: 80,
    accentColor: '#8b5cf6',
    description: 'Orthogonal transit router bridging service networks and VPC peering connections',
  },
  {
    id: 'arch-slack',
    title: 'Slack / Webhook Alerts',
    subtitle: 'Team Ops ChatOps Bot',
    category: 'Cloud & Infrastructure',
    width: 85,
    height: 85,
    accentColor: '#4a154b',
    description: 'ChatOps webhook integration notifying team Slack channels of cluster alerts',
  },
  {
    id: 'arch-cloud-disk',
    title: 'Persistent Cloud Volume',
    subtitle: 'Block Storage / EBS / SAN',
    category: 'Cloud & Infrastructure',
    width: 85,
    height: 85,
    accentColor: '#06b6d4',
    description: 'Attached persistent storage block disk with platter spindle and read/write actuator head',
  },

  // ─── 3. DATABASES & STORAGE ───
  {
    id: 'arch-database',
    title: 'Database / Storage',
    subtitle: 'Relational & NoSQL Storage Drum',
    category: 'Databases & Storage',
    width: 90,
    height: 90,
    accentColor: '#10b981',
    description: '3D cylinder storage drum with layered disk platters and activity LEDs',
  },
  {
    id: 'arch-db-cluster',
    title: 'Database Cluster',
    subtitle: 'Primary & Read Replica Shards',
    category: 'Databases & Storage',
    width: 90,
    height: 90,
    accentColor: '#059669',
    description: 'Multi-node database cluster with primary write master and streaming read replicas',
  },
  {
    id: 'arch-cache',
    title: 'In-Memory Cache',
    subtitle: 'Redis / Memcached Fast Store',
    category: 'Databases & Storage',
    width: 90,
    height: 90,
    accentColor: '#0284c7',
    description: 'Tiered high-speed cache memory stack with indicator lights',
  },
  {
    id: 'arch-object-storage',
    title: 'Object Storage / S3',
    subtitle: 'Cloud Asset Bucket & Blob Store',
    category: 'Databases & Storage',
    width: 90,
    height: 90,
    accentColor: '#f59e0b',
    description: 'Durable object storage bucket with file chunk ingress and asset containment',
  },
  {
    id: 'arch-search',
    title: 'Search Engine / Index',
    subtitle: 'Elasticsearch / Inverted Index',
    category: 'Databases & Storage',
    width: 90,
    height: 90,
    accentColor: '#14b8a6',
    description: 'High-speed search index with inverted document segments and query optics',
  },
  {
    id: 'arch-archive-storage',
    title: 'Cold Storage Archive',
    subtitle: 'Tape Backup / Glacier Vault',
    category: 'Databases & Storage',
    width: 85,
    height: 85,
    accentColor: '#64748b',
    description: 'Magnetic tape vault and cold tier long-term backup data repository',
  },

  // ─── 4. NETWORKING & TRAFFIC ───
  {
    id: 'arch-gateway',
    title: 'API Gateway',
    subtitle: 'Ingress & Routing Proxy Hub',
    category: 'Networking & Traffic',
    width: 90,
    height: 90,
    accentColor: '#6366f1',
    description: 'Routing hub directing incoming traffic into backend microservices',
  },
  {
    id: 'arch-payment-gateway',
    title: 'Stripe Payment Gateway',
    subtitle: 'Checkout & Transaction Gateway',
    category: 'Networking & Traffic',
    width: 85,
    height: 85,
    accentColor: '#635BFF',
    description: 'Payment gateway for credit card checkout, Stripe webhooks, and secure transaction processing',
  },
  {
    id: 'arch-load-balancer',
    title: 'Load Balancer',
    subtitle: 'Traffic Distributor / Reverse Proxy',
    category: 'Networking & Traffic',
    width: 90,
    height: 90,
    accentColor: '#06b6d4',
    description: 'Balanced distribution hub routing traffic across multiple nodes',
  },
  {
    id: 'arch-cdn',
    title: 'CDN / Edge Network',
    subtitle: 'Global Content Delivery Network',
    category: 'Networking & Traffic',
    width: 90,
    height: 90,
    accentColor: '#0284c7',
    description: 'Global wireframe network caching content at distributed worldwide points of presence',
  },
  {
    id: 'arch-router',
    title: 'Edge Router / Switch',
    subtitle: 'Network Routing & Core Gateway',
    category: 'Networking & Traffic',
    width: 85,
    height: 85,
    accentColor: '#0ea5e9',
    description: 'Network gateway router chassis with Ethernet port array and wireless signal transmitters',
  },
  {
    id: 'arch-dns',
    title: 'DNS Resolver',
    subtitle: 'Domain Lookup & Route53 Resolver',
    category: 'Networking & Traffic',
    width: 90,
    height: 90,
    accentColor: '#6366f1',
    description: 'Domain naming directory mapping user hostnames to internal IP addresses',
  },
  {
    id: 'arch-cloud',
    title: 'Cloud / VPC Network',
    subtitle: 'Virtual Private Cloud Perimeter',
    category: 'Networking & Traffic',
    width: 80,
    height: 80,
    accentColor: '#38bdf8',
    description: 'Clean multi-lobe cloud boundary for VPC clusters and internet zones',
  },
  {
    id: 'arch-reverse-proxy',
    title: 'Reverse Proxy / Ingress',
    subtitle: 'Traffic Inspection & SSL Termination',
    category: 'Networking & Traffic',
    width: 85,
    height: 85,
    accentColor: '#0ea5e9',
    description: 'Frontline reverse proxy shield inspecting client traffic and dispatching upstreams',
  },
  {
    id: 'arch-service-mesh',
    title: 'Service Mesh / Link',
    subtitle: 'Istio / Envoy Interconnect Mesh',
    category: 'Networking & Traffic',
    width: 85,
    height: 85,
    accentColor: '#8b5cf6',
    description: 'Interconnected microservice mesh fabric orchestrating service discovery and mTLS',
  },

  // ─── 5. MESSAGING & STREAMING ───
  {
    id: 'arch-event-bus',
    title: 'Event Bus / Pipeline',
    subtitle: 'Streaming Conduit / Kafka Bus',
    category: 'Messaging & Streaming',
    width: 80,
    height: 80,
    accentColor: '#8b5cf6',
    description: 'High-throughput stream conduit with directed flow indicators',
  },
  {
    id: 'arch-queue',
    title: 'Message Queue',
    subtitle: 'FIFO Queue / RabbitMQ / SQS',
    category: 'Messaging & Streaming',
    width: 80,
    height: 80,
    accentColor: '#f59e0b',
    description: 'Sequential message queue buffer with packet transfers',
  },
  {
    id: 'arch-pubsub',
    title: 'Pub/Sub Topic',
    subtitle: 'Broadcast Event Notification',
    category: 'Messaging & Streaming',
    width: 90,
    height: 90,
    accentColor: '#ec4899',
    description: 'Event broadcaster radiating topic notifications to multiple subscribers',
  },
  {
    id: 'arch-websocket',
    title: 'WebSocket / Live Stream',
    subtitle: 'Bidirectional Real-Time Stream',
    category: 'Messaging & Streaming',
    width: 90,
    height: 90,
    accentColor: '#8b5cf6',
    description: 'Full-duplex continuous live connection conduit with bidirectional data flow',
  },
  {
    id: 'arch-webhook',
    title: 'Webhook / Event Hook',
    subtitle: 'HTTP Event Notification Trigger',
    category: 'Messaging & Streaming',
    width: 85,
    height: 85,
    accentColor: '#d946ef',
    description: 'Event-driven HTTP callback hook dispatched upon asynchronous system triggers',
  },

  // ─── 5. CLIENTS & APPS ───
  {
    id: 'arch-browser',
    title: 'Web Browser / Client',
    subtitle: 'Desktop Application / Web App',
    category: 'Clients & Apps',
    width: 85,
    height: 85,
    accentColor: '#3b82f6',
    description: 'Clean desktop browser window with traffic lights, URL bar, and content viewport',
  },
  {
    id: 'arch-mobile',
    title: 'Mobile Device / App',
    subtitle: 'iOS / Android Native Client',
    category: 'Clients & Apps',
    width: 80,
    height: 80,
    accentColor: '#8b5cf6',
    description: 'Modern smartphone frame with dynamic island notch and screen surface',
  },
  {
    id: 'arch-user',
    title: 'Client / User Actor',
    subtitle: 'Single User / Client Stakeholder',
    category: 'Clients & Apps',
    width: 85,
    height: 85,
    accentColor: '#3b82f6',
    description: 'Clean modern human avatar silhouette representing the client actor',
  },
  {
    id: 'arch-team',
    title: 'Users / Team Group',
    subtitle: 'Multi-User Team & Organization',
    category: 'Clients & Apps',
    width: 85,
    height: 85,
    accentColor: '#2563eb',
    description: 'Group of connected users representing an organization, tenant, or team cohort',
  },
  {
    id: 'arch-email',
    title: 'Email Notification',
    subtitle: 'Transactional Mail & Alerts',
    category: 'Clients & Apps',
    width: 85,
    height: 85,
    accentColor: '#f43f5e',
    description: 'Notification postal envelope dispatching outgoing emails, digests, and SMS alerts',
  },

  // ─── 6. SECURITY & DEVOPS ───
  {
    id: 'arch-security',
    title: 'Firewall / Security',
    subtitle: 'WAF / Auth Shield & Keyhole',
    category: 'Security & DevOps',
    width: 85,
    height: 85,
    accentColor: '#f59e0b',
    description: 'Protective security shield with padlock keyhole and safety grid',
  },
  {
    id: 'arch-vault',
    title: 'Secrets Vault / KMS',
    subtitle: 'Encrypted Credentials & HSM',
    category: 'Security & DevOps',
    width: 85,
    height: 85,
    accentColor: '#eab308',
    description: 'Hardened safe with rotary dial locking mechanisms protecting API keys and secrets',
  },
  {
    id: 'arch-git-repo',
    title: 'Git / Repository',
    subtitle: 'Version Control & Branch DAG',
    category: 'Security & DevOps',
    width: 85,
    height: 85,
    accentColor: '#f97316',
    description: 'Source code repository with commit history nodes and feature branch merge tracks',
  },
  {
    id: 'arch-document',
    title: 'Architecture Spec',
    subtitle: 'Code / Configuration Spec',
    category: 'Security & DevOps',
    width: 85,
    height: 85,
    accentColor: '#64748b',
    description: 'Dog-eared spec sheet with structured code lines and syntax tags',
  },
  {
    id: 'arch-monitoring',
    title: 'Monitoring & Metrics',
    subtitle: 'Observability & Live Telemetry',
    category: 'Security & DevOps',
    width: 85,
    height: 85,
    accentColor: '#22c55e',
    description: 'Observability workstation displaying real-time metrics telemetry and system heartbeat ECG',
  },
  {
    id: 'arch-json-payload',
    title: 'JSON API / Payload',
    subtitle: 'Data Schema & JSON Contract',
    category: 'Security & DevOps',
    width: 85,
    height: 85,
    accentColor: '#3b82f6',
    description: 'Structured JSON data payload document with syntax curly brackets and property tree',
  },
  {
    id: 'arch-rabbitmq-queue',
    title: 'RabbitMQ Message Broker',
    subtitle: 'AMQP Exchange & Routing Key',
    category: 'Messaging & Streaming',
    width: 85,
    height: 85,
    accentColor: '#ff6600',
    description: 'RabbitMQ message broker exchange with direct, topic, and fanout routing queues',
  },
];;

/**
 * The artwork, one fragment per catalogue id.
 *
 * Each entry returns a `<g>` sized to the 100×100 authored square. The two
 * locals are the palette's two fixed tones, hoisted out of the fragments so a
 * colour changes in one place.
 */
const ARCHITECTURE_RENDERERS: Record<string, (ctx: StencilRenderContext) => string> = {
  'arch-server': ({ isDark }) => {
    return `
      <g>
        <rect x="14" y="22" width="72" height="24" rx="3" fill="${isDark ? '#0f172a' : '#f8fafc'}" stroke="#0ea5e9" stroke-width="2.5" />
        <rect x="20" y="27" width="22" height="14" rx="2" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#0ea5e9" stroke-width="1.5" />
        <line x1="24" y1="34" x2="34" y2="34" stroke="#0ea5e9" stroke-width="1.5" stroke-linecap="round" />
        <rect x="46" y="27" width="22" height="14" rx="2" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#0ea5e9" stroke-width="1.5" />
        <line x1="50" y1="34" x2="60" y2="34" stroke="#0ea5e9" stroke-width="1.5" stroke-linecap="round" />
        <circle cx="76" cy="34" r="2.5" fill="#10b981" />
        <circle cx="81" cy="34" r="1.5" fill="#38bdf8" />
        <rect x="14" y="54" width="72" height="24" rx="3" fill="${isDark ? '#0f172a' : '#f8fafc'}" stroke="#0ea5e9" stroke-width="2.5" />
        <rect x="20" y="59" width="22" height="14" rx="2" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#0ea5e9" stroke-width="1.5" />
        <line x1="24" y1="66" x2="34" y2="66" stroke="#0ea5e9" stroke-width="1.5" stroke-linecap="round" />
        <rect x="46" y="59" width="22" height="14" rx="2" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#0ea5e9" stroke-width="1.5" />
        <line x1="50" y1="66" x2="60" y2="66" stroke="#0ea5e9" stroke-width="1.5" stroke-linecap="round" />
        <circle cx="76" cy="66" r="2.5" fill="#10b981" />
        <circle cx="81" cy="66" r="1.5" fill="#38bdf8" />
        <rect x="10" y="25" width="4" height="18" rx="1" fill="#0ea5e9" />
        <rect x="86" y="25" width="4" height="18" rx="1" fill="#0ea5e9" />
        <rect x="10" y="57" width="4" height="18" rx="1" fill="#0ea5e9" />
        <rect x="86" y="57" width="4" height="18" rx="1" fill="#0ea5e9" />
      </g>
    `;
  },

  'arch-microservice': ({ isDark }) => {
    return `
      <g>
        <line x1="50" y1="28" x2="50" y2="72" stroke="#ef444480" stroke-width="2" stroke-dasharray="3 3" />
        <line x1="28" y1="50" x2="72" y2="50" stroke="#ef444480" stroke-width="2" stroke-dasharray="3 3" />
        <line x1="33" y1="33" x2="67" y2="67" stroke="#ef444460" stroke-width="1.5" />
        <line x1="67" y1="33" x2="33" y2="67" stroke="#ef444460" stroke-width="1.5" />
        <polygon points="50,14 62,26 50,38 38,26" fill="${isDark ? '#7f1d1d50' : '#fee2e2'}" stroke="#ef4444" stroke-width="2.5" stroke-linejoin="round" />
        <polygon points="26,38 38,50 26,62 14,50" fill="${isDark ? '#7f1d1d50' : '#fee2e2'}" stroke="#ef4444" stroke-width="2.5" stroke-linejoin="round" />
        <polygon points="74,38 86,50 74,62 62,50" fill="${isDark ? '#7f1d1d50' : '#fee2e2'}" stroke="#ef4444" stroke-width="2.5" stroke-linejoin="round" />
        <polygon points="50,62 62,74 50,86 38,74" fill="${isDark ? '#7f1d1d50' : '#fee2e2'}" stroke="#ef4444" stroke-width="2.5" stroke-linejoin="round" />
      </g>
    `;
  },

  'arch-container': ({ isDark }) => {
    return `
      <g>
        <rect x="16" y="24" width="68" height="52" rx="4" fill="${isDark ? '#0369a130' : '#e0f2fe'}" stroke="#0284c7" stroke-width="2.5" />
        <line x1="16" y1="32" x2="84" y2="32" stroke="#0284c7" stroke-width="1.5" />
        <line x1="16" y1="68" x2="84" y2="68" stroke="#0284c7" stroke-width="1.5" />
        <rect x="25" y="34" width="7" height="32" rx="1" fill="${isDark ? '#0c4a6e50' : '#bae6fd'}" stroke="#0284c7" stroke-width="1.5" />
        <rect x="37" y="34" width="7" height="32" rx="1" fill="${isDark ? '#0c4a6e50' : '#bae6fd'}" stroke="#0284c7" stroke-width="1.5" />
        <rect x="56" y="34" width="7" height="32" rx="1" fill="${isDark ? '#0c4a6e50' : '#bae6fd'}" stroke="#0284c7" stroke-width="1.5" />
        <rect x="68" y="34" width="7" height="32" rx="1" fill="${isDark ? '#0c4a6e50' : '#bae6fd'}" stroke="#0284c7" stroke-width="1.5" />
        <circle cx="20" cy="28" r="2" fill="#0284c7" />
        <circle cx="80" cy="28" r="2" fill="#0284c7" />
        <circle cx="20" cy="72" r="2" fill="#0284c7" />
        <circle cx="80" cy="72" r="2" fill="#0284c7" />
      </g>
    `;
  },

  'arch-pod': ({ isDark }) => {
    return `
      <g>
        <rect x="16" y="18" width="68" height="64" rx="18" fill="${isDark ? '#1e3a8a30' : '#dbeafe'}" stroke="#3b82f6" stroke-width="2.5" />
        <circle cx="50" cy="27" r="3" fill="#10b981" />
        <rect x="25" y="36" width="14" height="28" rx="3" fill="${isDark ? '#1d4ed850' : '#bfdbfe'}" stroke="#3b82f6" stroke-width="1.5" />
        <rect x="43" y="36" width="14" height="28" rx="3" fill="${isDark ? '#1d4ed850' : '#bfdbfe'}" stroke="#3b82f6" stroke-width="1.5" />
        <rect x="61" y="36" width="14" height="28" rx="3" fill="${isDark ? '#1d4ed850' : '#bfdbfe'}" stroke="#3b82f6" stroke-width="1.5" />
        <line x1="28" y1="44" x2="36" y2="44" stroke="#3b82f6" stroke-width="1" stroke-linecap="round" />
        <line x1="46" y1="44" x2="54" y2="44" stroke="#3b82f6" stroke-width="1" stroke-linecap="round" />
        <line x1="64" y1="44" x2="72" y2="44" stroke="#3b82f6" stroke-width="1" stroke-linecap="round" />
      </g>
    `;
  },

  'arch-k8s-node': ({ isDark }) => {
    return `
      <g>
        <polygon points="50,14 84,32 84,68 50,86 16,68 16,32" fill="${isDark ? '#312e8130' : '#e0e7ff'}" stroke="#6366f1" stroke-width="2.5" stroke-linejoin="round" />
        <rect x="28" y="36" width="44" height="32" rx="4" fill="${isDark ? '#3730a350' : '#c7d2fe'}" stroke="#6366f1" stroke-width="1.5" />
        <rect x="34" y="42" width="13" height="20" rx="2" fill="#6366f1" fill-opacity="0.4" />
        <rect x="53" y="42" width="13" height="20" rx="2" fill="#6366f1" fill-opacity="0.4" />
        <circle cx="50" cy="25" r="3.5" fill="#10b981" />
      </g>
    `;
  },

  'arch-vm': ({ isDark }) => {
    return `
      <g>
        <rect x="16" y="16" width="68" height="68" rx="6" fill="${isDark ? '#3b076420' : '#f3e8ff'}" stroke="#8b5cf6" stroke-width="2.5" />
        <rect x="22" y="22" width="56" height="36" rx="3" fill="${isDark ? '#4c1d9540' : '#ede9fe'}" stroke="#8b5cf6" stroke-width="1.5" />
        <rect x="42" y="32" width="16" height="16" rx="2" fill="#8b5cf6" fill-opacity="0.3" stroke="#8b5cf6" stroke-width="1.5" />
        <rect x="22" y="64" width="56" height="14" rx="2" fill="${isDark ? '#2e1065' : '#ddd6fe'}" stroke="#8b5cf6" stroke-width="1.5" />
        <line x1="28" y1="71" x2="72" y2="71" stroke="#8b5cf6" stroke-width="2" stroke-dasharray="4 3" stroke-linecap="round" />
      </g>
    `;
  },

  'arch-worker': ({ isDark }) => {
    return `
      <g>
        <circle cx="44" cy="46" r="20" fill="${isDark ? '#581c8730' : '#f3e8ff'}" stroke="#a855f7" stroke-width="2.5" />
        <circle cx="44" cy="46" r="7" fill="${isDark ? '#18181b' : '#ffffff'}" stroke="#a855f7" stroke-width="2" />
        <line x1="44" y1="21" x2="44" y2="27" stroke="#a855f7" stroke-width="3.5" stroke-linecap="round" />
        <line x1="44" y1="65" x2="44" y2="71" stroke="#a855f7" stroke-width="3.5" stroke-linecap="round" />
        <line x1="19" y1="46" x2="25" y2="46" stroke="#a855f7" stroke-width="3.5" stroke-linecap="round" />
        <line x1="63" y1="46" x2="69" y2="46" stroke="#a855f7" stroke-width="3.5" stroke-linecap="round" />
        <line x1="26" y1="28" x2="31" y2="33" stroke="#a855f7" stroke-width="3.5" stroke-linecap="round" />
        <line x1="57" y1="59" x2="62" y2="64" stroke="#a855f7" stroke-width="3.5" stroke-linecap="round" />
        <circle cx="70" cy="70" r="12" fill="${isDark ? '#581c8730' : '#f3e8ff'}" stroke="#c084fc" stroke-width="2" />
        <circle cx="70" cy="70" r="4" fill="${isDark ? '#18181b' : '#ffffff'}" stroke="#c084fc" stroke-width="1.5" />
        <line x1="70" y1="55" x2="70" y2="59" stroke="#c084fc" stroke-width="2.5" stroke-linecap="round" />
        <line x1="70" y1="81" x2="70" y2="85" stroke="#c084fc" stroke-width="2.5" stroke-linecap="round" />
        <line x1="55" y1="70" x2="59" y2="70" stroke="#c084fc" stroke-width="2.5" stroke-linecap="round" />
        <line x1="81" y1="70" x2="85" y2="70" stroke="#c084fc" stroke-width="2.5" stroke-linecap="round" />
      </g>
    `;
  },

  'arch-cron': ({ isDark }) => {
    return `
      <g>
        <circle cx="50" cy="50" r="28" fill="${isDark ? '#78350f30' : '#fef3c7'}" stroke="#f59e0b" stroke-width="2.5" />
        <line x1="50" y1="50" x2="50" y2="32" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" />
        <line x1="50" y1="50" x2="64" y2="50" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" />
        <circle cx="50" cy="50" r="3" fill="#f59e0b" />
        <path d="M 20 36 A 36 36 0 0 1 80 36" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" fill="none" />
        <polygon points="78,30 84,36 78,42" fill="#fbbf24" />
        <path d="M 80 64 A 36 36 0 0 1 20 64" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" fill="none" />
        <polygon points="22,70 16,64 22,58" fill="#fbbf24" />
      </g>
    `;
  },

  'arch-server-rack': ({ isDark }) => {
    return `
      <g>
        <rect x="18" y="14" width="64" height="72" rx="4" fill="${isDark ? '#0f172a' : '#f8fafc'}" stroke="#0284c7" stroke-width="2.5" />
        <line x1="24" y1="14" x2="24" y2="86" stroke="#0284c7" stroke-width="1.5" stroke-dasharray="3 3" />
        <line x1="76" y1="14" x2="76" y2="86" stroke="#0284c7" stroke-width="1.5" stroke-dasharray="3 3" />
        <rect x="28" y="20" width="44" height="12" rx="2" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#0284c7" stroke-width="1.5" />
        <circle cx="34" cy="26" r="2" fill="#10b981" />
        <line x1="42" y1="26" x2="66" y2="26" stroke="#0284c7" stroke-width="1.5" stroke-linecap="round" />
        <rect x="28" y="36" width="44" height="12" rx="2" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#0284c7" stroke-width="1.5" />
        <circle cx="34" cy="42" r="2" fill="#38bdf8" />
        <line x1="42" y1="42" x2="66" y2="42" stroke="#0284c7" stroke-width="1.5" stroke-linecap="round" />
        <rect x="28" y="52" width="44" height="12" rx="2" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#0284c7" stroke-width="1.5" />
        <circle cx="34" cy="58" r="2" fill="#10b981" />
        <line x1="42" y1="58" x2="66" y2="58" stroke="#0284c7" stroke-width="1.5" stroke-linecap="round" />
        <rect x="28" y="68" width="44" height="12" rx="2" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#0284c7" stroke-width="1.5" />
        <circle cx="34" cy="74" r="2" fill="#f59e0b" />
        <line x1="42" y1="74" x2="66" y2="74" stroke="#0284c7" stroke-width="1.5" stroke-linecap="round" />
      </g>
    `;
  },

  'arch-cpu-chip': ({ isDark }) => {
    return `
      <g>
        <rect x="26" y="26" width="48" height="48" rx="6" fill="${isDark ? '#082f4940' : '#e0f2fe'}" stroke="#0ea5e9" stroke-width="2.5" />
        <rect x="36" y="36" width="28" height="28" rx="3" fill="#0284c7" fill-opacity="0.25" stroke="#0ea5e9" stroke-width="1.5" />
        <circle cx="50" cy="50" r="4" fill="#0ea5e9" />
        <line x1="34" y1="16" x2="34" y2="26" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
        <line x1="44" y1="16" x2="44" y2="26" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
        <line x1="56" y1="16" x2="56" y2="26" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
        <line x1="66" y1="16" x2="66" y2="26" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
        <line x1="34" y1="74" x2="34" y2="84" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
        <line x1="44" y1="74" x2="44" y2="84" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
        <line x1="56" y1="74" x2="56" y2="84" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
        <line x1="66" y1="74" x2="66" y2="84" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
        <line x1="16" y1="34" x2="26" y2="34" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
        <line x1="16" y1="44" x2="26" y2="44" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
        <line x1="16" y1="56" x2="26" y2="56" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
        <line x1="16" y1="66" x2="26" y2="66" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
        <line x1="74" y1="34" x2="84" y2="34" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
        <line x1="74" y1="44" x2="84" y2="44" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
        <line x1="74" y1="56" x2="84" y2="56" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
        <line x1="74" y1="66" x2="84" y2="66" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
      </g>
    `;
  },

  'arch-nginx-server': ({ isDark }) => {
    return `
      <g>
        <polygon points="50,14 82,32 82,68 50,86 18,68 18,32" fill="${isDark ? '#064e3b30' : '#ecfdf5'}" stroke="#10b981" stroke-width="2.5" stroke-linejoin="round" />
        <path d="M 36 66 V 34 L 64 66 V 34" stroke="#10b981" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="50" cy="22" r="2.5" fill="#34d399" />
        <circle cx="50" cy="78" r="2.5" fill="#34d399" />
      </g>
    `;
  },

  'arch-vpc-boundary': ({ isDark }) => {
    return `
      <g>
        <rect x="8" y="16" width="84" height="70" rx="8" stroke="#38bdf8" stroke-width="2" stroke-dasharray="5 3" fill="${isDark ? '#0284c715' : '#e0f2fe40'}" />
        <path d="M 22 28 C 22 23 27 21 31 23 C 33 19 39 19 42 22 C 45 20 50 22 50 26 C 53 26 55 29 54 32 C 54 35 51 37 48 37 L 24 37 C 21 37 19 34 20 31 C 20 30 21 29 22 28 Z" fill="${isDark ? '#0369a180' : '#bae6fd'}" stroke="#38bdf8" stroke-width="1.5" />
        <rect x="70" y="24" width="12" height="10" rx="2" fill="#38bdf8" fill-opacity="0.4" stroke="#38bdf8" stroke-width="1.5" />
        <path d="M 73 24 V 20 C 73 18 79 18 79 20 V 24" stroke="#38bdf8" stroke-width="1.5" fill="none" />
        <line x1="16" y1="52" x2="84" y2="52" stroke="#38bdf8" stroke-width="1" stroke-dasharray="3 3" opacity="0.4" />
      </g>
    `;
  },

  'arch-public-subnet': ({ isDark }) => {
    return `
      <g>
        <rect x="10" y="18" width="80" height="66" rx="6" stroke="#10b981" stroke-width="2" stroke-dasharray="4 2" fill="${isDark ? '#064e3b20' : '#ecfdf5'}" />
        <rect x="18" y="25" width="28" height="12" rx="3" fill="#10b981" fill-opacity="0.25" stroke="#10b981" stroke-width="1.5" />
        <text x="32" y="34" font-size="7" font-weight="bold" fill="#10b981" text-anchor="middle" dominant-baseline="middle">PUB</text>
        <circle cx="72" cy="31" r="5" fill="#10b981" fill-opacity="0.3" stroke="#10b981" stroke-width="1.5" />
        <line x1="72" y1="22" x2="72" y2="40" stroke="#10b981" stroke-width="1.5" />
        <path d="M 24 58 L 50 58 L 68 58" stroke="#10b981" stroke-width="2" stroke-linecap="round" />
        <polyline points="62,54 68,58 62,62" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    `;
  },

  'arch-private-subnet': ({ isDark }) => {
    return `
      <g>
        <rect x="10" y="18" width="80" height="66" rx="6" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4 2" fill="${isDark ? '#78350f20' : '#fffbeb'}" />
        <rect x="18" y="25" width="30" height="12" rx="3" fill="#f59e0b" fill-opacity="0.25" stroke="#f59e0b" stroke-width="1.5" />
        <text x="33" y="34" font-size="7" font-weight="bold" fill="#f59e0b" text-anchor="middle" dominant-baseline="middle">PRIV</text>
        <rect x="68" y="27" width="10" height="9" rx="1.5" fill="#f59e0b" fill-opacity="0.4" stroke="#f59e0b" stroke-width="1.5" />
        <path d="M 70.5 27 V 23.5 C 70.5 21.5 75.5 21.5 75.5 23.5 V 27" stroke="#f59e0b" stroke-width="1.5" fill="none" />
        <line x1="24" y1="58" x2="76" y2="58" stroke="#f59e0b" stroke-width="2" stroke-dasharray="3 3" />
        <circle cx="36" cy="58" r="3" fill="#f59e0b" />
        <circle cx="64" cy="58" r="3" fill="#f59e0b" />
      </g>
    `;
  },

  'arch-multi-cloud': ({ isDark }) => {
    return `
      <g>
        <path d="M 22 34 C 22 28 28 26 32 28 C 35 23 42 23 46 27 C 49 24 56 26 56 31 C 60 31 62 35 61 39 C 61 43 57 45 53 45 L 24 45 C 20 45 18 41 19 37 C 20 35 21 34 22 34 Z" fill="${isDark ? '#0284c730' : '#e0f2fe'}" stroke="#0ea5e9" stroke-width="2" />
        <path d="M 46 64 C 46 58 52 56 56 58 C 59 53 66 53 70 57 C 73 54 80 56 80 61 C 84 61 86 65 85 69 C 85 73 81 75 77 75 L 48 75 C 44 75 42 71 43 67 C 44 65 45 64 46 64 Z" fill="${isDark ? '#3b076430' : '#f3e8ff'}" stroke="#8b5cf6" stroke-width="2" />
        <path d="M 44 45 C 40 54 48 56 54 62" stroke="#38bdf8" stroke-width="2.5" stroke-dasharray="3 2" />
        <polygon points="52,65 58,62 55,56" fill="#38bdf8" />
      </g>
    `;
  },

  'arch-cloud-cluster': ({ isDark }) => {
    return `
      <g>
        <circle cx="50" cy="50" r="16" fill="${isDark ? '#312e8140' : '#e0e7ff'}" stroke="#6366f1" stroke-width="2.5" />
        <circle cx="50" cy="50" r="5" fill="#6366f1" />
        <circle cx="22" cy="28" r="9" fill="${isDark ? '#1e1b4b' : '#c7d2fe'}" stroke="#6366f1" stroke-width="1.8" />
        <circle cx="78" cy="28" r="9" fill="${isDark ? '#1e1b4b' : '#c7d2fe'}" stroke="#6366f1" stroke-width="1.8" />
        <circle cx="22" cy="72" r="9" fill="${isDark ? '#1e1b4b' : '#c7d2fe'}" stroke="#6366f1" stroke-width="1.8" />
        <circle cx="78" cy="72" r="9" fill="${isDark ? '#1e1b4b' : '#c7d2fe'}" stroke="#6366f1" stroke-width="1.8" />
        <line x1="30" y1="34" x2="40" y2="42" stroke="#6366f1" stroke-width="1.8" stroke-dasharray="3 2" />
        <line x1="70" y1="34" x2="60" y2="42" stroke="#6366f1" stroke-width="1.8" stroke-dasharray="3 2" />
        <line x1="30" y1="66" x2="40" y2="58" stroke="#6366f1" stroke-width="1.8" stroke-dasharray="3 2" />
        <line x1="70" y1="66" x2="60" y2="58" stroke="#6366f1" stroke-width="1.8" stroke-dasharray="3 2" />
      </g>
    `;
  },

  'arch-api-endpoint': ({ isDark }) => {
    return `
      <g>
        <rect x="22" y="24" width="56" height="52" rx="10" fill="${isDark ? '#83184330' : '#fce7f3'}" stroke="#ec4899" stroke-width="2.5" />
        <rect x="30" y="33" width="40" height="14" rx="3" fill="#ec4899" fill-opacity="0.2" stroke="#ec4899" stroke-width="1.5" />
        <text x="50" y="42" font-size="7.5" font-weight="bold" fill="#ec4899" text-anchor="middle" dominant-baseline="middle">/api/v1</text>
        <line x1="8" y1="50" x2="22" y2="50" stroke="#ec4899" stroke-width="2.5" stroke-linecap="round" />
        <circle cx="8" cy="50" r="3" fill="#ec4899" />
        <line x1="78" y1="50" x2="92" y2="50" stroke="#ec4899" stroke-width="2.5" stroke-linecap="round" />
        <circle cx="92" cy="50" r="3" fill="#ec4899" />
        <circle cx="50" cy="62" r="3" fill="#10b981" />
      </g>
    `;
  },

  'arch-route-connector': ({ isDark }) => {
    return `
      <g>
        <circle cx="50" cy="50" r="28" fill="${isDark ? '#3b076425' : '#ede9fe'}" stroke="#8b5cf6" stroke-width="2.5" />
        <path d="M 50 28 L 50 72" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" />
        <polyline points="45,34 50,28 55,34" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <polyline points="45,66 50,72 55,66" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M 28 50 L 72 50" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" />
        <polyline points="34,45 28,50 34,55" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <polyline points="66,45 72,50 66,55" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="50" cy="50" r="4.5" fill="#8b5cf6" />
      </g>
    `;
  },

  'arch-slack': ({ isDark }) => {
    return `
      <g>
        <rect x="18" y="18" width="64" height="64" rx="14" fill="${isDark ? '#3b076430' : '#fae8ff'}" stroke="#a855f7" stroke-width="2.5" />
        <line x1="36" y1="28" x2="36" y2="72" stroke="#a855f7" stroke-width="3" stroke-linecap="round" />
        <line x1="64" y1="28" x2="64" y2="72" stroke="#a855f7" stroke-width="3" stroke-linecap="round" />
        <line x1="26" y1="40" x2="74" y2="40" stroke="#a855f7" stroke-width="3" stroke-linecap="round" />
        <line x1="26" y1="60" x2="74" y2="60" stroke="#a855f7" stroke-width="3" stroke-linecap="round" />
        <circle cx="36" cy="33" r="2.5" fill="#e879f9" />
        <circle cx="64" cy="67" r="2.5" fill="#e879f9" />
      </g>
    `;
  },

  'arch-cloud-disk': ({ isDark }) => {
    return `
      <g>
        <rect x="20" y="20" width="60" height="60" rx="8" fill="${isDark ? '#08334430' : '#cffafe'}" stroke="#06b6d4" stroke-width="2.5" />
        <circle cx="50" cy="50" r="18" fill="${isDark ? '#164e6340' : '#a5f3fc'}" stroke="#06b6d4" stroke-width="2" />
        <circle cx="50" cy="50" r="6" fill="#06b6d4" />
        <line x1="30" y1="30" x2="46" y2="46" stroke="#06b6d4" stroke-width="2.5" stroke-linecap="round" />
        <circle cx="30" cy="30" r="3" fill="#06b6d4" />
        <circle cx="28" cy="72" r="2" fill="#10b981" />
        <circle cx="34" cy="72" r="2" fill="#06b6d4" />
      </g>
    `;
  },

  'arch-database': ({ isDark }) => {
    return `
      <g>
        <path d="M 18 26 L 18 72 A 32 12 0 0 0 82 72 L 82 26" fill="${isDark ? '#10b98114' : '#10b98110'}" stroke="#10b981" stroke-width="2.5" stroke-linejoin="round" />
        <ellipse cx="50" cy="26" rx="32" ry="12" fill="${isDark ? '#064e3b40' : '#d1fae5'}" stroke="#10b981" stroke-width="2.5" />
        <path d="M 18 41 A 32 12 0 0 0 82 41" stroke="#10b981" stroke-width="2" stroke-dasharray="4 2" />
        <path d="M 18 56 A 32 12 0 0 0 82 56" stroke="#10b981" stroke-width="2" />
        <circle cx="28" cy="33" r="2.5" fill="#34d399" />
        <circle cx="28" cy="48" r="2.5" fill="#34d399" />
        <circle cx="28" cy="64" r="2.5" fill="#34d399" />
      </g>
    `;
  },

  'arch-db-cluster': ({ isDark }) => {
    return `
      <g>
        <ellipse cx="36" cy="26" rx="22" ry="8" fill="${isDark ? '#064e3b40' : '#d1fae5'}" stroke="#10b981" stroke-width="2" />
        <path d="M 14 26 L 14 58 A 22 8 0 0 0 58 58 L 58 26" fill="${isDark ? '#10b98115' : '#d1fae580'}" stroke="#10b981" stroke-width="2" />
        <path d="M 14 42 A 22 8 0 0 0 58 42" stroke="#10b981" stroke-width="1.5" />
        <circle cx="22" cy="33" r="2" fill="#34d399" />
        <circle cx="22" cy="49" r="2" fill="#34d399" />
        <ellipse cx="72" cy="46" rx="18" ry="7" fill="${isDark ? '#04785730' : '#a7f3d0'} stroke="#059669" stroke-width="2" />
        <path d="M 54 46 L 54 74 A 18 7 0 0 0 90 74 L 90 46" fill="${isDark ? '#05966915' : '#a7f3d080'}" stroke="#059669" stroke-width="2" />
        <path d="M 54 60 A 18 7 0 0 0 90 60" stroke="#059669" stroke-width="1.5" />
        <circle cx="60" cy="52" r="1.5" fill="#34d399" />
        <circle cx="60" cy="66" r="1.5" fill="#34d399" />
        <path d="M 44 64 Q 52 74 60 70" stroke="#10b981" stroke-width="2" stroke-dasharray="3 2" fill="none" />
        <polygon points="62,67 66,72 60,74" fill="#10b981" />
      </g>
    `;
  },

  'arch-cache': ({ isDark }) => {
    return `
      <g>
        <ellipse cx="50" cy="24" rx="34" ry="10" fill="${isDark ? '#0284c728' : '#e0f2fe'}" stroke="#0284c7" stroke-width="2.5" />
        <path d="M 16 24 L 16 35 A 34 10 0 0 0 84 35 L 84 24" fill="${isDark ? '#0284c718' : '#e0f2fe80'}" stroke="#0284c7" stroke-width="2.5" />
        <path d="M 16 43 L 16 54 A 34 10 0 0 0 84 54 L 84 43" fill="${isDark ? '#0284c718' : '#e0f2fe80'}" stroke="#0284c7" stroke-width="2.5" />
        <path d="M 16 62 L 16 73 A 34 10 0 0 0 84 73 L 84 62" fill="${isDark ? '#0284c718' : '#e0f2fe80'}" stroke="#0284c7" stroke-width="2.5" />
        <circle cx="48" cy="29" r="2.5" fill="#38bdf8" />
        <circle cx="58" cy="29" r="2.5" fill="#38bdf8" />
        <circle cx="48" cy="48" r="2.5" fill="#38bdf8" />
        <circle cx="58" cy="48" r="2.5" fill="#38bdf8" />
        <circle cx="48" cy="67" r="2.5" fill="#38bdf8" />
        <circle cx="58" cy="67" r="2.5" fill="#38bdf8" />
      </g>
    `;
  },

  'arch-object-storage': ({ isDark }) => {
    return `
      <g>
        <path d="M 22 36 L 30 80 A 20 6 0 0 0 70 80 L 78 36" fill="${isDark ? '#78350f30' : '#fef3c7'}" stroke="#f59e0b" stroke-width="2.5" />
        <ellipse cx="50" cy="36" rx="28" ry="9" fill="${isDark ? '#92400e40' : '#fde68a'}" stroke="#f59e0b" stroke-width="2.5" />
        <rect x="42" y="14" width="16" height="16" rx="3" fill="#f59e0b" fill-opacity="0.4" stroke="#f59e0b" stroke-width="2" />
        <path d="M 50 12 L 50 24" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" />
        <polygon points="47,22 50,26 53,22" fill="#f59e0b" />
        <line x1="38" y1="58" x2="62" y2="58" stroke="#f59e0b" stroke-width="2" stroke-dasharray="3 3" />
      </g>
    `;
  },

  'arch-search': ({ isDark }) => {
    return `
      <g>
        <rect x="18" y="24" width="40" height="52" rx="4" fill="${isDark ? '#134e4a30' : '#ccfbf1'}" stroke="#14b8a6" stroke-width="2" />
        <line x1="24" y1="34" x2="48" y2="34" stroke="#14b8a6" stroke-width="2" stroke-linecap="round" />
        <line x1="24" y1="44" x2="44" y2="44" stroke="#14b8a6" stroke-width="2" stroke-linecap="round" />
        <line x1="24" y1="54" x2="50" y2="54" stroke="#14b8a6" stroke-width="2" stroke-linecap="round" />
        <line x1="24" y1="64" x2="40" y2="64" stroke="#14b8a6" stroke-width="2" stroke-linecap="round" />
        <circle cx="62" cy="48" r="16" fill="${isDark ? '#042f2e50' : '#99f6e4'}" stroke="#0d9488" stroke-width="3" />
        <circle cx="62" cy="48" r="9" stroke="#14b8a6" stroke-width="1.5" stroke-dasharray="3 2" />
        <line x1="74" y1="60" x2="86" y2="76" stroke="#0d9488" stroke-width="5" stroke-linecap="round" />
      </g>
    `;
  },

  'arch-archive-storage': ({ isDark }) => {
    return `
      <g>
        <rect x="18" y="22" width="64" height="56" rx="6" fill="${isDark ? '#33415530' : '#f1f5f9'}" stroke="#64748b" stroke-width="2.5" />
        <rect x="26" y="30" width="48" height="26" rx="4" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#64748b" stroke-width="1.5" />
        <circle cx="38" cy="43" r="7" fill="${isDark ? '#0f172a' : '#cbd5e1'}" stroke="#64748b" stroke-width="1.5" />
        <circle cx="38" cy="43" r="2.5" fill="#64748b" />
        <circle cx="62" cy="43" r="7" fill="${isDark ? '#0f172a' : '#cbd5e1'}" stroke="#64748b" stroke-width="1.5" />
        <circle cx="62" cy="43" r="2.5" fill="#64748b" />
        <line x1="38" y1="50" x2="62" y2="50" stroke="#64748b" stroke-width="1.5" />
        <line x1="28" y1="66" x2="32" y2="66" stroke="#64748b" stroke-width="2" stroke-linecap="round" />
        <line x1="36" y1="66" x2="44" y2="66" stroke="#64748b" stroke-width="2" stroke-linecap="round" />
        <line x1="48" y1="66" x2="56" y2="66" stroke="#64748b" stroke-width="2" stroke-linecap="round" />
        <line x1="60" y1="66" x2="72" y2="66" stroke="#64748b" stroke-width="2" stroke-linecap="round" />
      </g>
    `;
  },

  'arch-gateway': ({ isDark }) => {
    return `
      <g>
        <polygon points="50,14 84,32 84,68 50,86 16,68 16,32" fill="${isDark ? '#312e8130' : '#e0e7ff'}" stroke="#6366f1" stroke-width="2.5" stroke-linejoin="round" />
        <circle cx="50" cy="50" r="14" fill="${isDark ? '#4338ca50' : '#c7d2fe'}" stroke="#6366f1" stroke-width="2.5" />
        <path d="M 50 36 L 50 20" stroke="#818cf8" stroke-width="2.5" stroke-linecap="round" />
        <path d="M 60 58 L 74 72" stroke="#818cf8" stroke-width="2.5" stroke-linecap="round" />
        <path d="M 40 58 L 26 72" stroke="#818cf8" stroke-width="2.5" stroke-linecap="round" />
        <circle cx="50" cy="50" r="4" fill="#6366f1" />
      </g>
    `;
  },

  'arch-payment-gateway': ({ isDark }) => {
    return `
      <g>
        <rect x="12" y="22" width="76" height="52" rx="7" fill="${isDark ? '#312e8130' : '#ede9fe'}" stroke="#635BFF" stroke-width="2.5" />
        <rect x="12" y="32" width="76" height="11" fill="${isDark ? '#4338ca50' : '#c4b5fd'}" />
        <rect x="20" y="52" width="16" height="12" rx="2.5" fill="${isDark ? '#ca8a0440' : '#fef08a'}" stroke="#eab308" stroke-width="1.5" />
        <line x1="20" y1="58" x2="36" y2="58" stroke="#ca8a04" stroke-width="1" />
        <line x1="28" y1="52" x2="28" y2="64" stroke="#ca8a04" stroke-width="1" />
        <line x1="42" y1="55" x2="62" y2="55" stroke="#635BFF" stroke-width="2" stroke-linecap="round" />
        <line x1="42" y1="61" x2="54" y2="61" stroke="#635BFF" stroke-width="1.5" stroke-linecap="round" opacity="0.7" />
        <path d="M 68 15 C 74 11, 80 11, 86 15" fill="none" stroke="#635BFF" stroke-width="2" stroke-linecap="round" opacity="0.6" />
        <path d="M 72 19 C 75 17, 79 17, 82 19" fill="none" stroke="#635BFF" stroke-width="1.8" stroke-linecap="round" />
        <circle cx="74" cy="58" r="6" fill="${isDark ? '#065f4640' : '#d1fae5'}" stroke="#10b981" stroke-width="1.5" />
        <path d="M 71 58 L 73 60 L 77 56" fill="none" stroke="#10b981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    `;
  },

  'arch-stripe': ({ isDark }) => {
    return `
      <g>
        <rect x="12" y="22" width="76" height="52" rx="7" fill="${isDark ? '#312e8130' : '#ede9fe'}" stroke="#635BFF" stroke-width="2.5" />
        <rect x="12" y="32" width="76" height="11" fill="${isDark ? '#4338ca50' : '#c4b5fd'}" />
        <rect x="20" y="52" width="16" height="12" rx="2.5" fill="${isDark ? '#ca8a0440' : '#fef08a'}" stroke="#eab308" stroke-width="1.5" />
        <line x1="20" y1="58" x2="36" y2="58" stroke="#ca8a04" stroke-width="1" />
        <line x1="28" y1="52" x2="28" y2="64" stroke="#ca8a04" stroke-width="1" />
        <line x1="42" y1="55" x2="62" y2="55" stroke="#635BFF" stroke-width="2" stroke-linecap="round" />
        <line x1="42" y1="61" x2="54" y2="61" stroke="#635BFF" stroke-width="1.5" stroke-linecap="round" opacity="0.7" />
        <path d="M 68 15 C 74 11, 80 11, 86 15" fill="none" stroke="#635BFF" stroke-width="2" stroke-linecap="round" opacity="0.6" />
        <path d="M 72 19 C 75 17, 79 17, 82 19" fill="none" stroke="#635BFF" stroke-width="1.8" stroke-linecap="round" />
        <circle cx="74" cy="58" r="6" fill="${isDark ? '#065f4640' : '#d1fae5'}" stroke="#10b981" stroke-width="1.5" />
        <path d="M 71 58 L 73 60 L 77 56" fill="none" stroke="#10b981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    `;
  },

  'arch-load-balancer': ({ isDark }) => {
    return `
      <g>
        <circle cx="50" cy="50" r="34" fill="${isDark ? '#08334430' : '#cffafe'}" stroke="#06b6d4" stroke-width="2.5" />
        <line x1="22" y1="50" x2="42" y2="50" stroke="#06b6d4" stroke-width="3" stroke-linecap="round" />
        <polygon points="42,46 48,50 42,54" fill="#06b6d4" />
        <path d="M 48 50 Q 58 50 68 36" stroke="#0891b2" stroke-width="2.5" stroke-linecap="round" fill="none" />
        <polygon points="66,32 72,36 67,40" fill="#0891b2" />
        <line x1="48" y1="50" x2="72" y2="50" stroke="#0891b2" stroke-width="2.5" stroke-linecap="round" />
        <polygon points="70,47 76,50 70,53" fill="#0891b2" />
        <path d="M 48 50 Q 58 50 68 64" stroke="#0891b2" stroke-width="2.5" stroke-linecap="round" fill="none" />
        <polygon points="67,60 72,64 66,68" fill="#0891b2" />
      </g>
    `;
  },

  'arch-cdn': ({ isDark }) => {
    return `
      <g>
        <circle cx="50" cy="50" r="26" fill="${isDark ? '#0369a130' : '#e0f2fe'}" stroke="#0284c7" stroke-width="2.5" />
        <ellipse cx="50" cy="50" rx="13" ry="26" stroke="#0284c7" stroke-width="1.5" />
        <line x1="24" y1="50" x2="76" y2="50" stroke="#0284c7" stroke-width="1.5" />
        <line x1="28" y1="36" x2="72" y2="36" stroke="#0284c7" stroke-width="1" />
        <line x1="28" y1="64" x2="72" y2="64" stroke="#0284c7" stroke-width="1" />
        <circle cx="18" cy="22" r="4.5" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5" />
        <circle cx="82" cy="22" r="4.5" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5" />
        <circle cx="18" cy="78" r="4.5" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5" />
        <circle cx="82" cy="78" r="4.5" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5" />
        <line x1="22" y1="26" x2="33" y2="35" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="2 2" />
        <line x1="78" y1="26" x2="67" y2="35" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="2 2" />
        <line x1="22" y1="74" x2="33" y2="65" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="2 2" />
        <line x1="78" y1="74" x2="67" y2="65" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="2 2" />
      </g>
    `;
  },

  'arch-router': ({ isDark }) => {
    return `
      <g>
        <rect x="14" y="38" width="72" height="34" rx="4" fill="${isDark ? '#0f172a' : '#f8fafc'}" stroke="#0ea5e9" stroke-width="2.5" />
        <rect x="22" y="48" width="10" height="13" rx="1.5" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#0ea5e9" stroke-width="1.5" />
        <rect x="36" y="48" width="10" height="13" rx="1.5" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#0ea5e9" stroke-width="1.5" />
        <rect x="50" y="48" width="10" height="13" rx="1.5" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#0ea5e9" stroke-width="1.5" />
        <rect x="64" y="48" width="10" height="13" rx="1.5" fill="${isDark ? '#1e293b' : '#e2e8f0'}" stroke="#0ea5e9" stroke-width="1.5" />
        <line x1="28" y1="38" x2="22" y2="18" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
        <circle cx="21" cy="16" r="2.5" fill="#0ea5e9" />
        <line x1="72" y1="38" x2="78" y2="18" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
        <circle cx="79" cy="16" r="2.5" fill="#0ea5e9" />
        <circle cx="80" cy="44" r="2" fill="#10b981" />
      </g>
    `;
  },

  'arch-dns': ({ isDark }) => {
    const strokeDefault = isDark ? '#f4f4f5' : '#18181b';
    const fillSurface = isDark ? '#18181b' : '#ffffff';
    return `
      <g>
        <rect x="18" y="20" width="64" height="60" rx="6" fill="${fillSurface}" stroke="#6366f1" stroke-width="2.5" />
        <rect x="26" y="30" width="48" height="18" rx="9" fill="${isDark ? '#312e8140' : '#e0e7ff'}" stroke="#6366f1" stroke-width="1.5" />
        <circle cx="34" cy="39" r="3" fill="#6366f1" />
        <line x1="42" y1="39" x2="66" y2="39" stroke="#6366f1" stroke-width="2" stroke-linecap="round" />
        <path d="M 32 58 L 50 58" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" />
        <path d="M 50 58 L 68 58" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" />
        <polygon points="66,54 72,58 66,62" fill="#10b981" />
        <line x1="26" y1="68" x2="56" y2="68" stroke="${strokeDefault}" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 3" />
      </g>
    `;
  },

  'arch-cloud': ({ isDark }) => {
    return `
      <g>
        <path d="M 30 70 L 72 70 A 16 16 0 0 0 80 48 A 18 18 0 0 0 62 28 A 22 22 0 0 0 28 36 A 18 18 0 0 0 16 56 A 14 14 0 0 0 30 70 Z" fill="${isDark ? '#0284c720' : '#e0f2fe'}" stroke="#0284c7" stroke-width="2.5" stroke-linejoin="round" />
        <circle cx="40" cy="50" r="3.5" fill="#38bdf8" />
        <circle cx="62" cy="46" r="3.5" fill="#38bdf8" />
        <circle cx="50" cy="60" r="3" fill="#38bdf8" />
        <line x1="40" y1="50" x2="62" y2="46" stroke="#38bdf880" stroke-width="1.5" stroke-dasharray="3 3" />
        <line x1="40" y1="50" x2="50" y2="60" stroke="#38bdf880" stroke-width="1.5" stroke-dasharray="3 3" />
        <line x1="62" y1="46" x2="50" y2="60" stroke="#38bdf880" stroke-width="1.5" stroke-dasharray="3 3" />
      </g>
    `;
  },

  'arch-reverse-proxy': ({ isDark }) => {
    return `
      <g>
        <path d="M 50 16 L 80 28 C 80 58 50 78 50 84 C 50 78 20 58 20 28 Z" fill="${isDark ? '#0369a130' : '#e0f2fe'}" stroke="#0ea5e9" stroke-width="2.5" stroke-linejoin="round" />
        <path d="M 36 44 L 64 44" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
        <polygon points="60,40 66,44 60,48" fill="#0ea5e9" />
        <path d="M 64 56 L 36 56" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" />
        <polygon points="40,52 34,56 40,60" fill="#10b981" />
        <circle cx="50" cy="34" r="3" fill="#0ea5e9" />
      </g>
    `;
  },

  'arch-service-mesh': ({ isDark }) => {
    return `
      <g>
        <circle cx="50" cy="24" r="10" fill="${isDark ? '#3b076430' : '#f3e8ff'}" stroke="#8b5cf6" stroke-width="2" />
        <circle cx="50" cy="24" r="3.5" fill="#8b5cf6" />
        <circle cx="26" cy="68" r="10" fill="${isDark ? '#3b076430' : '#f3e8ff'}" stroke="#8b5cf6" stroke-width="2" />
        <circle cx="26" cy="68" r="3.5" fill="#8b5cf6" />
        <circle cx="74" cy="68" r="10" fill="${isDark ? '#3b076430' : '#f3e8ff'}" stroke="#8b5cf6" stroke-width="2" />
        <circle cx="74" cy="68" r="3.5" fill="#8b5cf6" />
        <line x1="43" y1="31" x2="33" y2="60" stroke="#8b5cf6" stroke-width="2" stroke-dasharray="3 2" />
        <line x1="57" y1="31" x2="67" y2="60" stroke="#8b5cf6" stroke-width="2" stroke-dasharray="3 2" />
        <line x1="36" y1="68" x2="64" y2="68" stroke="#8b5cf6" stroke-width="2" stroke-dasharray="3 2" />
        <circle cx="50" cy="54" r="6" fill="#10b981" fill-opacity="0.25" stroke="#10b981" stroke-width="1.5" />
        <circle cx="50" cy="54" r="2" fill="#10b981" />
      </g>
    `;
  },

  'arch-event-bus': ({ isDark }) => {
    return `
      <g>
        <path d="M 22 28 L 76 28 A 10 22 0 0 1 76 72 L 22 72 A 10 22 0 0 1 22 28" fill="${isDark ? '#8b5cf620' : '#ede9fe'}" stroke="#8b5cf6" stroke-width="2.5" />
        <ellipse cx="22" cy="50" rx="9" ry="22" fill="${isDark ? '#6d28d940' : '#ddd6fe'}" stroke="#8b5cf6" stroke-width="2.5" />
        <ellipse cx="76" cy="50" rx="9" ry="22" fill="${isDark ? '#6d28d940' : '#ddd6fe'}" stroke="#8b5cf6" stroke-width="2.5" />
        <path d="M 38 42 L 46 50 L 38 58" stroke="#a78bfa" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M 54 42 L 62 50 L 54 58" stroke="#c4b5fd" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    `;
  },

  'arch-queue': ({ isDark }) => {
    return `
      <g>
        <path d="M 12 34 L 88 34" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" />
        <path d="M 12 66 L 88 66" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" />
        <rect x="22" y="39" width="17" height="22" rx="3" fill="${isDark ? '#78350f40' : '#fef3c7'}" stroke="#f59e0b" stroke-width="2" />
        <line x1="26" y1="46" x2="35" y2="46" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round" />
        <line x1="26" y1="52" x2="32" y2="52" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round" />
        <rect x="43" y="39" width="17" height="22" rx="3" fill="${isDark ? '#78350f40' : '#fef3c7'}" stroke="#f59e0b" stroke-width="2" />
        <line x1="47" y1="46" x2="56" y2="46" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round" />
        <line x1="47" y1="52" x2="53" y2="52" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round" />
        <rect x="64" y="39" width="17" height="22" rx="3" fill="${isDark ? '#78350f40' : '#fef3c7'}" stroke="#f59e0b" stroke-width="2" />
        <line x1="68" y1="46" x2="77" y2="46" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round" />
        <line x1="68" y1="52" x2="74" y2="52" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round" />
        <path d="M 88 47 L 93 50 L 88 53" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    `;
  },

  'arch-pubsub': ({ isDark }) => {
    return `
      <g>
        <circle cx="50" cy="50" r="10" fill="${isDark ? '#83184350' : '#fce7f3'}" stroke="#ec4899" stroke-width="2.5" />
        <circle cx="50" cy="50" r="4" fill="#ec4899" />
        <path d="M 32 36 A 20 20 0 0 0 32 64" stroke="#f472b6" stroke-width="2.5" stroke-linecap="round" />
        <path d="M 22 26 A 34 34 0 0 0 22 74" stroke="#f472b6" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="4 3" />
        <path d="M 68 36 A 20 20 0 0 1 68 64" stroke="#f472b6" stroke-width="2.5" stroke-linecap="round" />
        <path d="M 78 26 A 34 34 0 0 1 78 74" stroke="#f472b6" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="4 3" />
      </g>
    `;
  },

  'arch-websocket': ({ isDark }) => {
    return `
      <g>
        <circle cx="50" cy="50" r="32" fill="${isDark ? '#3b076420' : '#ede9fe'}" stroke="#8b5cf6" stroke-width="2.5" />
        <line x1="28" y1="40" x2="66" y2="40" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" />
        <polygon points="64,36 72,40 64,44" fill="#8b5cf6" />
        <line x1="72" y1="60" x2="34" y2="60" stroke="#a855f7" stroke-width="2.5" stroke-linecap="round" />
        <polygon points="36,56 28,60 36,64" fill="#a855f7" />
        <polygon points="50,30 44,48 53,48 48,68 60,46 51,46" fill="#c084fc" />
      </g>
    `;
  },

  'arch-webhook': ({ isDark }) => {
    return `
      <g>
        <polygon points="50,16 80,33 80,67 50,84 20,67 20,33" fill="${isDark ? '#701a7530' : '#fae8ff'}" stroke="#d946ef" stroke-width="2.5" stroke-linejoin="round" />
        <rect x="42" y="34" width="16" height="22" rx="3" fill="${isDark ? '#86198f50' : '#f5d0fe'}" stroke="#d946ef" stroke-width="2" />
        <line x1="46" y1="56" x2="46" y2="68" stroke="#d946ef" stroke-width="2" stroke-linecap="round" />
        <line x1="54" y1="56" x2="54" y2="68" stroke="#d946ef" stroke-width="2" stroke-linecap="round" />
        <polygon points="50,22 45,34 52,34 47,46 56,31 49,31" fill="#f0abfc" />
      </g>
    `;
  },

  'arch-browser': ({ isDark }) => {
    const strokeDefault = isDark ? '#f4f4f5' : '#18181b';
    const fillSurface = isDark ? '#18181b' : '#ffffff';
    return `
      <g>
        <rect x="14" y="18" width="72" height="64" rx="6" fill="${fillSurface}" stroke="${strokeDefault}" stroke-width="2.5" />
        <line x1="14" y1="34" x2="86" y2="34" stroke="${strokeDefault}" stroke-width="1.5" />
        <circle cx="23" cy="26" r="2.5" fill="#ef4444" />
        <circle cx="30" cy="26" r="2.5" fill="#f59e0b" />
        <circle cx="37" cy="26" r="2.5" fill="#10b981" />
        <rect x="45" y="22" width="34" height="8" rx="4" fill="${isDark ? '#27272a' : '#f4f4f5'}" stroke="${isDark ? '#3f3f46' : '#e4e4e7'}" stroke-width="1" />
        <rect x="22" y="42" width="24" height="32" rx="3" fill="${isDark ? '#3b82f620' : '#dbeafe'}" stroke="#3b82f6" stroke-width="1.5" />
        <rect x="52" y="42" width="26" height="14" rx="3" fill="${isDark ? '#27272a' : '#f4f4f5'}" stroke="${isDark ? '#3f3f46' : '#e4e4e7'}" stroke-width="1" />
        <rect x="52" y="60" width="26" height="14" rx="3" fill="${isDark ? '#27272a' : '#f4f4f5'}" stroke="${isDark ? '#3f3f46' : '#e4e4e7'}" stroke-width="1" />
      </g>
    `;
  },

  'arch-mobile': ({ isDark }) => {
    const strokeDefault = isDark ? '#f4f4f5' : '#18181b';
    const fillSurface = isDark ? '#18181b' : '#ffffff';
    return `
      <g>
        <rect x="28" y="12" width="44" height="76" rx="9" fill="${fillSurface}" stroke="${strokeDefault}" stroke-width="2.5" />
        <rect x="44" y="16" width="12" height="3.5" rx="1.75" fill="${isDark ? '#f4f4f5' : '#18181b'}" />
        <rect x="32" y="23" width="36" height="56" rx="4" fill="${isDark ? '#8b5cf618' : '#ede9fe'}" stroke="#8b5cf6" stroke-width="1.5" />
        <rect x="36" y="28" width="28" height="18" rx="2" fill="#8b5cf640" />
        <line x1="36" y1="52" x2="58" y2="52" stroke="#8b5cf6" stroke-width="1.5" stroke-linecap="round" />
        <line x1="36" y1="58" x2="52" y2="58" stroke="#8b5cf6" stroke-width="1.5" stroke-linecap="round" />
        <line x1="36" y1="64" x2="62" y2="64" stroke="#8b5cf6" stroke-width="1.5" stroke-linecap="round" />
        <rect x="44" y="82" width="12" height="2" rx="1" fill="${strokeDefault}" />
      </g>
    `;
  },

  'arch-user': ({ isDark }) => {
    return `
      <g>
        <circle cx="50" cy="32" r="15" fill="${isDark ? '#1e3a8a30' : '#dbeafe'}" stroke="#3b82f6" stroke-width="2.5" />
        <path d="M 22 76 C 22 58 35 54 50 54 C 65 54 78 58 78 76" fill="${isDark ? '#1e3a8a20' : '#eff6ff'}" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" />
        <circle cx="50" cy="32" r="6" fill="#3b82f6" />
      </g>
    `;
  },

  'arch-team': ({ isDark }) => {
    return `
      <g>
        <circle cx="30" cy="38" r="11" fill="${isDark ? '#1e3a8a30' : '#dbeafe'}" stroke="#2563eb" stroke-width="2" />
        <path d="M 12 76 C 12 62 20 60 30 60 C 35 60 40 61 44 63" stroke="#2563eb" stroke-width="2" stroke-linecap="round" />
        <circle cx="70" cy="38" r="11" fill="${isDark ? '#1e3a8a30' : '#dbeafe'}" stroke="#2563eb" stroke-width="2" />
        <path d="M 88 76 C 88 62 80 60 70 60 C 65 60 60 61 56 63" stroke="#2563eb" stroke-width="2" stroke-linecap="round" />
        <circle cx="50" cy="32" r="13" fill="${isDark ? '#1d4ed850' : '#bfdbfe'}" stroke="#2563eb" stroke-width="2.5" />
        <path d="M 26 76 C 26 59 36 56 50 56 C 64 56 74 59 74 76" fill="${isDark ? '#1d4ed820' : '#eff6ff'}" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" />
      </g>
    `;
  },

  'arch-email': ({ isDark }) => {
    const fillSurface = isDark ? '#18181b' : '#ffffff';
    return `
      <g>
        <rect x="16" y="28" width="68" height="48" rx="6" fill="${fillSurface}" stroke="#f43f5e" stroke-width="2.5" />
        <path d="M 16 32 L 50 56 L 84 32" stroke="#f43f5e" stroke-width="2.5" stroke-linejoin="round" />
        <circle cx="76" cy="24" r="8" fill="#f43f5e" />
        <circle cx="76" cy="24" r="3" fill="#ffffff" />
      </g>
    `;
  },

  'arch-security': ({ isDark }) => {
    return `
      <g>
        <path d="M 50 16 L 80 28 C 80 58 50 78 50 84 C 50 78 20 58 20 28 Z" fill="${isDark ? '#78350f30' : '#fef3c7'}" stroke="#f59e0b" stroke-width="2.5" stroke-linejoin="round" />
        <path d="M 43 46 V 40 A 7 7 0 0 1 57 40 V 46" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" />
        <rect x="39" y="46" width="22" height="18" rx="3" fill="${isDark ? '#b45309' : '#fbbf24'}" stroke="#f59e0b" stroke-width="2" />
        <circle cx="50" cy="53" r="2" fill="${isDark ? '#18181b' : '#ffffff'}" />
        <line x1="50" y1="54" x2="50" y2="59" stroke="${isDark ? '#18181b' : '#ffffff'}" stroke-width="1.5" stroke-linecap="round" />
      </g>
    `;
  },

  'arch-vault': ({ isDark }) => {
    return `
      <g>
        <rect x="18" y="18" width="64" height="64" rx="8" fill="${isDark ? '#713f1230' : '#fef9c3'}" stroke="#eab308" stroke-width="2.5" />
        <circle cx="50" cy="50" r="22" fill="${isDark ? '#854d0e40' : '#fef08a'}" stroke="#eab308" stroke-width="2" />
        <circle cx="50" cy="50" r="9" fill="${isDark ? '#a16207' : '#ca8a04'}" stroke="#eab308" stroke-width="2" />
        <line x1="50" y1="36" x2="50" y2="41" stroke="#eab308" stroke-width="2.5" stroke-linecap="round" />
        <line x1="50" y1="59" x2="50" y2="64" stroke="#eab308" stroke-width="2.5" stroke-linecap="round" />
        <line x1="36" y1="50" x2="41" y2="50" stroke="#eab308" stroke-width="2.5" stroke-linecap="round" />
        <line x1="59" y1="50" x2="64" y2="50" stroke="#eab308" stroke-width="2.5" stroke-linecap="round" />
        <circle cx="76" cy="50" r="2" fill="#eab308" />
      </g>
    `;
  },

  'arch-git-repo': ({ isDark }) => {
    return `
      <g>
        <line x1="32" y1="20" x2="32" y2="80" stroke="#f97316" stroke-width="2.5" stroke-linecap="round" />
        <circle cx="32" cy="26" r="6" fill="${isDark ? '#7c2d12' : '#ffedd5'}" stroke="#f97316" stroke-width="2.5" />
        <circle cx="32" cy="50" r="6" fill="${isDark ? '#7c2d12' : '#ffedd5'}" stroke="#f97316" stroke-width="2.5" />
        <circle cx="32" cy="74" r="6" fill="${isDark ? '#7c2d12' : '#ffedd5'}" stroke="#f97316" stroke-width="2.5" />
        <path d="M 32 50 C 60 50 68 40 68 30" stroke="#f97316" stroke-width="2.5" fill="none" />
        <circle cx="68" cy="30" r="6" fill="#f97316" />
        <path d="M 68 30 C 68 56 60 74 32 74" stroke="#f97316" stroke-width="2.5" stroke-dasharray="3 2" fill="none" />
      </g>
    `;
  },

  'arch-document': ({ isDark }) => {
    const strokeDefault = isDark ? '#f4f4f5' : '#18181b';
    const fillSurface = isDark ? '#18181b' : '#ffffff';
    return `
      <g>
        <path d="M 24 16 L 62 16 L 76 30 L 76 84 L 24 84 Z" fill="${fillSurface}" stroke="${strokeDefault}" stroke-width="2.5" stroke-linejoin="round" />
        <path d="M 62 16 L 62 30 L 76 30" fill="${isDark ? '#27272a' : '#f4f4f5'}" stroke="${strokeDefault}" stroke-width="2" stroke-linejoin="round" />
        <line x1="32" y1="38" x2="54" y2="38" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" />
        <line x1="32" y1="48" x2="68" y2="48" stroke="${strokeDefault}" stroke-width="1.5" stroke-linecap="round" />
        <line x1="38" y1="58" x2="64" y2="58" stroke="${strokeDefault}" stroke-width="1.5" stroke-linecap="round" />
        <line x1="38" y1="68" x2="56" y2="68" stroke="${strokeDefault}" stroke-width="1.5" stroke-linecap="round" />
      </g>
    `;
  },

  'arch-monitoring': ({ isDark }) => {
    return `
      <g>
        <rect x="14" y="20" width="72" height="52" rx="6" fill="${isDark ? '#052e1630' : '#f0fdf4'}" stroke="#22c55e" stroke-width="2.5" />
        <path d="M 42 72 L 36 82 L 64 82 L 58 72" stroke="#22c55e" stroke-width="2" fill="none" stroke-linejoin="round" />
        <path d="M 20 46 L 36 46 L 42 32 L 48 60 L 54 40 L 60 50 L 66 46 L 80 46" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="78" cy="28" r="2" fill="#22c55e" />
      </g>
    `;
  },

  'arch-json-payload': ({ isDark }) => {
    const strokeDefault = isDark ? '#f4f4f5' : '#18181b';
    const fillSurface = isDark ? '#18181b' : '#ffffff';
    return `
      <g>
        <rect x="20" y="16" width="60" height="68" rx="6" fill="${fillSurface}" stroke="#3b82f6" stroke-width="2.5" />
        <path d="M 58 16 L 80 38 L 58 38 Z" fill="${isDark ? '#1e3a8a40' : '#dbeafe'}" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round" />
        <rect x="28" y="24" width="26" height="12" rx="3" fill="#3b82f6" fill-opacity="0.2" stroke="#3b82f6" stroke-width="1.5" />
        <text x="41" y="32" font-size="7" font-weight="bold" fill="#3b82f6" text-anchor="middle" dominant-baseline="middle">JSON</text>
        <text x="32" y="52" font-size="11" font-weight="bold" fill="#3b82f6" text-anchor="middle" dominant-baseline="middle">{</text>
        <line x1="38" y1="52" x2="68" y2="52" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" />
        <line x1="38" y1="62" x2="58" y2="62" stroke="${strokeDefault}" stroke-width="1.5" stroke-linecap="round" />
        <line x1="38" y1="72" x2="64" y2="72" stroke="${strokeDefault}" stroke-width="1.5" stroke-linecap="round" />
        <text x="72" y="72" font-size="11" font-weight="bold" fill="#3b82f6" text-anchor="middle" dominant-baseline="middle">}</text>
      </g>
    `;
  },

  'arch-rabbitmq-queue': ({ isDark }) => {
    return `
      <g>
        <rect x="18" y="22" width="64" height="56" rx="10" fill="${isDark ? '#7c2d1230' : '#ffedd5'}" stroke="#ff6600" stroke-width="2.5" />
        <path d="M 38 22 C 34 10 44 8 46 22" fill="${isDark ? '#9a341250' : '#fed7aa'}" stroke="#ff6600" stroke-width="2" />
        <path d="M 54 22 C 56 8 66 10 62 22" fill="${isDark ? '#9a341250' : '#fed7aa'}" stroke="#ff6600" stroke-width="2" />
        <rect x="26" y="38" width="12" height="26" rx="2" fill="#ff6600" fill-opacity="0.3" stroke="#ff6600" stroke-width="1.5" />
        <rect x="44" y="38" width="12" height="26" rx="2" fill="#ff6600" fill-opacity="0.3" stroke="#ff6600" stroke-width="1.5" />
        <rect x="62" y="38" width="12" height="26" rx="2" fill="#ff6600" fill-opacity="0.3" stroke="#ff6600" stroke-width="1.5" />
        <circle cx="32" cy="51" r="2" fill="#ff6600" />
        <circle cx="50" cy="51" r="2" fill="#ff6600" />
        <circle cx="68" cy="51" r="2" fill="#ff6600" />
      </g>
    `;
  },
};

/** Fallback for a catalogue id that somehow has no artwork — a plain frame. */
const MISSING_ARTWORK = ({ isDark }: StencilRenderContext): string => {
  const stroke = isDark ? '#f4f4f5' : '#18181b';
  return `<g><rect x="20" y="20" width="60" height="60" rx="8" fill="none" stroke="${stroke}" stroke-width="2" /></g>`;
};

/** The artwork of one catalogue entry, or the placeholder when it has none. */
function artworkFor(id: string): (ctx: StencilRenderContext) => string {
  return ARCHITECTURE_RENDERERS[id] ?? MISSING_ARTWORK;
}

/** The square every architecture fragment is authored on. */
const DEFAULT_VIEW_BOX_SIZE = 100;

/**
 * The box each fragment actually paints in, measured from the markup once.
 *
 * Measured in the light theme and at the catalogue's own size because neither
 * changes a fragment's geometry — the theme only picks colours, and the size
 * never reaches the artwork at all, which `builtin.test.mjs` asserts of every
 * stencil in both themes and at both extremes of size.
 */
const ARCHITECTURE_VIEW_BOXES: Map<string, StencilViewBox> = new Map(
  ARCHITECTURE_CATALOGUE.map((meta) => {
    const markup = artworkFor(meta.id)({
      width: meta.width,
      height: meta.height,
      isDark: false,
    });
    // A fragment that draws nothing measurable keeps the authored square: it
    // is the one answer that cannot crop a drawing nobody could measure.
    const measured =
      measureArtwork(markup) ??
      ({ x: 0, y: 0, width: DEFAULT_VIEW_BOX_SIZE, height: DEFAULT_VIEW_BOX_SIZE } as const);
    return [meta.id, measured] as const;
  })
);

/**
 * The size a node takes for an entry: the artwork's own aspect ratio, at the
 * catalogue's nominal scale.
 *
 * The long edge is what the catalogue asked for, so a stencil keeps the weight
 * it was designed at, and the short edge follows the drawing. That is what
 * makes a drop fill its node exactly: any box of another shape leaves a band of
 * empty canvas on the shorter axis, which is the margin this whole file exists
 * to remove.
 */
function placedSize(
  meta: ArchitectureStencilMeta,
  viewBox: StencilViewBox
): { width: number; height: number } {
  const nominal = Math.max(meta.width, meta.height, 1);
  const longest = Math.max(viewBox.width, viewBox.height);

  if (!Number.isFinite(longest) || longest <= 0) {
    return { width: Math.round(nominal), height: Math.round(nominal) };
  }

  const width = Math.max(1, Math.round((viewBox.width / longest) * nominal));
  const height = Math.max(1, Math.round(width * (viewBox.height / viewBox.width)));

  return { width, height };
}

/**
 * The library browser's catalogue: titles, grouping, chip colours and the size
 * a placed node takes.
 *
 * Derived from {@link ARCHITECTURE_CATALOGUE} so a tile and the node it drops
 * cannot disagree: the panel reads its drag payload's size straight off an
 * entry here, and the engine reads the same numbers as the definition's
 * defaults.
 */
export const ARCHITECTURE_STENCIL_META: ArchitectureStencilMeta[] = ARCHITECTURE_CATALOGUE.map(
  (meta) => {
    const viewBox = ARCHITECTURE_VIEW_BOXES.get(meta.id);
    if (!viewBox) return meta;
    return { ...meta, ...placedSize(meta, viewBox) };
  }
);

/** The architecture stencils, as the registry's definitions. */
export const ARCHITECTURE_STENCILS: StencilDefinition[] = ARCHITECTURE_STENCIL_META.map(
  (meta) => ({
    id: meta.id,
    title: meta.title,
    subtitle: meta.subtitle,
    description: meta.description,
    category: meta.category,
    defaultWidth: meta.width,
    defaultHeight: meta.height,
    accentColor: meta.accentColor,
    viewBox: ARCHITECTURE_VIEW_BOXES.get(meta.id),
    render: artworkFor(meta.id),
  })
);
