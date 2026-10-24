'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Boxes,
  X,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ARCHITECTURE_STENCIL_META,
  type ArchitectureStencilMeta,
} from '@/lib/zcanvaskit/stencils/architecture';
import { TECH_ICON_STENCILS } from '@/lib/zcanvaskit/stencils/tech-icons';
import {
  STANDARD_DRAWIO_SHAPES,
  writeDragItem,
  type StandardDrawioShapeDef,
  type ZCanvasDragItem,
} from '@/lib/zcanvaskit/stencils';
import type { StencilDefinition } from '@/lib/zcanvaskit/stencils/types';
import { ZCanvasStencilGraphic } from '@/lib/zcanvaskit/react/ZCanvasArtwork';
import { useTheme } from '@/hooks/use-theme';
import type { ZCanvasNodeType } from '@/lib/zcanvaskit/core/schema';

export interface ArchitecturePatternNode {
  id: string;
  type: ZCanvasNodeType;
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  fields?: Array<{
    name: string;
    type: string;
    pk?: boolean;
    fk?: boolean;
    nullable?: boolean;
    unique?: boolean;
  }>;
}

export interface ArchitecturePatternEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  color?: string;
  style?: 'bezier' | 'step' | 'straight';
  startArrowhead?: 'er-one' | 'er-zero-one' | 'er-many' | 'er-zero-many';
  endArrowhead?: 'er-one' | 'er-zero-one' | 'er-many' | 'er-zero-many';
  sourceOffset?: number;
  targetOffset?: number;
}

export interface ArchitecturePatternDef {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  category: string;
  flowPreview: string[];
  nodes: ArchitecturePatternNode[];
  edges: ArchitecturePatternEdge[];
}

export const BUILTIN_ARCHITECTURE_PATTERNS: ArchitecturePatternDef[] = [
  {
    id: 'pattern-3tier',
    title: '3-Tier Web Application',
    subtitle: 'Client, Load Balancer, App Server, DB & Cache',
    badge: '3-Tier Flow',
    category: 'Architecture Diagrams',
    flowPreview: ['Web Client', 'ALB', 'Web Server', 'PostgreSQL + Redis'],
    nodes: [
      { id: 'client', type: 'card', title: 'Web Client', subtitle: 'Next.js 15 SPA', badge: 'Client', icon: 'browser', x: 0, y: 130, width: 210, height: 76, color: '#3b82f6' },
      { id: 'lb', type: 'card', title: 'Load Balancer', subtitle: 'AWS ALB / Nginx Proxy', badge: 'ALB', icon: 'load-balancer', x: 380, y: 130, width: 210, height: 76, color: '#3b82f6' },
      { id: 'server', type: 'card', title: 'Web App Server', subtitle: 'Node.js / Express Cluster', badge: 'App', icon: 'web-server', x: 760, y: 130, width: 210, height: 76, color: '#10b981' },
      { id: 'redis', type: 'card', title: 'Redis Cache', subtitle: 'In-Memory Session Store', badge: 'Cache', icon: 'redis', x: 1150, y: 10, width: 210, height: 76, color: '#ef4444' },
      { id: 'postgres', type: 'card', title: 'PostgreSQL DB', subtitle: 'Primary Relational Database', badge: 'SQL', icon: 'postgres', x: 1150, y: 250, width: 210, height: 76, color: '#3b82f6' },
    ],
    edges: [
      { id: 'e1', source: 'client', target: 'lb', label: 'HTTPS :443', color: '#3b82f6' },
      { id: 'e2', source: 'lb', target: 'server', label: 'Proxy Pass', color: '#10b981' },
      { id: 'e3', source: 'server', target: 'redis', label: 'Get / Set Cache', color: '#ef4444' },
      { id: 'e4', source: 'server', target: 'postgres', label: 'SQL Query / Write', color: '#3b82f6' },
    ],
  },
  {
    id: 'pattern-microservices-kafka',
    title: 'Microservices & Event Bus',
    subtitle: 'API Gateway, Domain Services & Kafka Streaming',
    badge: 'Event-Driven',
    category: 'Architecture Diagrams',
    flowPreview: ['API Gateway', 'Orders & Payments', 'Kafka Event Bus', 'Database'],
    nodes: [
      { id: 'gw', type: 'card', title: 'API Gateway', subtitle: 'Ingress & Rate Limiter', badge: 'Gateway', icon: 'api-gateway', x: 0, y: 130, width: 210, height: 76, color: '#3b82f6' },
      { id: 'order', type: 'card', title: 'Order Service', subtitle: 'Go / gRPC Microservice', badge: 'Service', icon: 'microservice', x: 380, y: 10, width: 210, height: 76, color: '#8b5cf6' },
      { id: 'payment', type: 'card', title: 'Payment Gateway', subtitle: 'Stripe Webhook & Checkout', badge: 'Stripe', icon: 'stripe', x: 380, y: 250, width: 210, height: 76, color: '#635BFF' },
      { id: 'kafka', type: 'card', title: 'Apache Kafka', subtitle: 'Distributed Event Bus', badge: 'Kafka', icon: 'kafka', x: 770, y: 130, width: 210, height: 76, color: '#f97316' },
      { id: 'db', type: 'card', title: 'PostgreSQL Store', subtitle: 'Ledger & Transaction DB', badge: 'DB', icon: 'postgres', x: 1160, y: 130, width: 210, height: 76, color: '#3b82f6' },
    ],
    edges: [
      { id: 'e1', source: 'gw', target: 'order', label: 'POST /orders', color: '#8b5cf6' },
      { id: 'e2', source: 'gw', target: 'payment', label: 'POST /checkout', color: '#10b981' },
      { id: 'e3', source: 'order', target: 'kafka', label: 'order.created', color: '#f97316' },
      { id: 'e4', source: 'payment', target: 'kafka', label: 'payment.success', color: '#f97316' },
      { id: 'e5', source: 'kafka', target: 'db', label: 'Sink Events', color: '#3b82f6' },
    ],
  },
  {
    id: 'pattern-serverless-cloud',
    title: 'Serverless Cloud Architecture',
    subtitle: 'CloudFront CDN, API Gateway, Lambda & DynamoDB',
    badge: 'Serverless',
    category: 'Architecture Diagrams',
    flowPreview: ['CloudFront', 'API Gateway', 'AWS Lambda', 'DynamoDB + S3'],
    nodes: [
      { id: 'client', type: 'card', title: 'Web & Mobile Client', subtitle: 'Next.js 15 & iOS Client', badge: 'Client', icon: 'mobile', x: 0, y: 130, width: 210, height: 76, color: '#06b6d4' },
      { id: 'cdn', type: 'card', title: 'AWS CloudFront', subtitle: 'Global Edge CDN', badge: 'CDN', icon: 'cdn', x: 370, y: 130, width: 210, height: 76, color: '#06b6d4' },
      { id: 'apigw', type: 'card', title: 'AWS API Gateway', subtitle: 'HTTP REST Ingress', badge: 'Gateway', icon: 'api-gateway', x: 740, y: 130, width: 210, height: 76, color: '#8b5cf6' },
      { id: 'lambda', type: 'card', title: 'AWS Lambda', subtitle: 'Serverless Execution Engine', badge: 'Lambda', icon: 'lambda', x: 1110, y: 130, width: 210, height: 76, color: '#f59e0b' },
      { id: 'dynamo', type: 'card', title: 'AWS DynamoDB', subtitle: 'Single-Digit Latency NoSQL', badge: 'NoSQL', icon: 'database', x: 1490, y: 10, width: 210, height: 76, color: '#6366f1' },
      { id: 's3', type: 'card', title: 'AWS S3 Storage', subtitle: 'Asset & Media Buckets', badge: 'Storage', icon: 's3', x: 1490, y: 250, width: 210, height: 76, color: '#eab308' },
    ],
    edges: [
      { id: 'e1', source: 'client', target: 'cdn', label: 'HTTPS Global', color: '#06b6d4' },
      { id: 'e2', source: 'cdn', target: 'apigw', label: 'Origin Route', color: '#8b5cf6' },
      { id: 'e3', source: 'apigw', target: 'lambda', label: 'Invoke Function', color: '#f59e0b' },
      { id: 'e4', source: 'lambda', target: 'dynamo', label: 'Query / Put', color: '#6366f1' },
      { id: 'e5', source: 'lambda', target: 's3', label: 'Store Media', color: '#eab308' },
    ],
  },
  {
    id: 'pattern-cache-aside',
    title: 'Cache-Aside DB Pattern',
    subtitle: 'App Server, Redis Fast Cache & DB Replication',
    badge: 'Caching',
    category: 'Architecture Diagrams',
    flowPreview: ['App Server', 'Redis Cache', 'Primary SQL DB', 'Read Replica'],
    nodes: [
      { id: 'app', type: 'card', title: 'Application Server', subtitle: 'Backend API Service', badge: 'App', icon: 'app-server', x: 0, y: 130, width: 210, height: 76, color: '#10b981' },
      { id: 'redis', type: 'card', title: 'Redis Cache', subtitle: 'Sub-millisecond Read Cache', badge: 'Cache', icon: 'redis', x: 400, y: 10, width: 210, height: 76, color: '#ef4444' },
      { id: 'primary', type: 'card', title: 'Primary PostgreSQL', subtitle: 'Master Write Instance', badge: 'Master', icon: 'postgres', x: 400, y: 250, width: 210, height: 76, color: '#3b82f6' },
      { id: 'replica', type: 'card', title: 'Read Replica DB', subtitle: 'Read-Only Slave Instance', badge: 'Replica', icon: 'postgres', x: 800, y: 250, width: 210, height: 76, color: '#0284c7' },
    ],
    edges: [
      { id: 'e1', source: 'app', target: 'redis', label: '1. Cache Check', color: '#ef4444' },
      { id: 'e2', source: 'app', target: 'primary', label: '2. Fallback / Write', color: '#3b82f6' },
      { id: 'e3', source: 'primary', target: 'replica', label: 'WAL Streaming Sync', color: '#0284c7' },
    ],
  },
  {
    id: 'pattern-auth-flow',
    title: 'Authentication & OAuth2 Gateway',
    subtitle: 'Client, Ingress Gateway, Auth Issuer & Session DB',
    badge: 'Security',
    category: 'Architecture Diagrams',
    flowPreview: ['Client', 'API Gateway', 'Auth Service', 'Redis Session Store'],
    nodes: [
      { id: 'client', type: 'card', title: 'User Client', subtitle: 'Web & Mobile Client', badge: 'Client', icon: 'browser', x: 0, y: 130, width: 210, height: 76, color: '#3b82f6' },
      { id: 'gw', type: 'card', title: 'API Gateway', subtitle: 'Token Introspection & Proxy', badge: 'Gateway', icon: 'api-gateway', x: 380, y: 130, width: 210, height: 76, color: '#3b82f6' },
      { id: 'auth', type: 'card', title: 'Auth Service', subtitle: 'OAuth2 / RS256 JWT Issuer', badge: 'Auth', icon: 'auth', x: 770, y: 10, width: 210, height: 76, color: '#8b5cf6' },
      { id: 'session', type: 'card', title: 'Session DB (Redis)', subtitle: 'Refresh Tokens & Blacklist', badge: 'Redis', icon: 'redis', x: 1160, y: 10, width: 210, height: 76, color: '#ef4444' },
      { id: 'api', type: 'card', title: 'Core Resource API', subtitle: 'Protected Business Logic', badge: 'API', icon: 'microservice', x: 770, y: 250, width: 210, height: 76, color: '#10b981' },
    ],
    edges: [
      { id: 'e1', source: 'client', target: 'gw', label: 'Bearer Token', color: '#3b82f6' },
      { id: 'e2', source: 'gw', target: 'auth', label: 'Validate Token', color: '#8b5cf6' },
      { id: 'e3', source: 'auth', target: 'session', label: 'Store Session', color: '#ef4444' },
      { id: 'e4', source: 'gw', target: 'api', label: 'Authorized Request', color: '#10b981' },
    ],
  },
  {
    id: 'pattern-erd-ecommerce',
    title: 'Relational ERD Schema (Crow\'s Foot)',
    subtitle: 'Users, Orders, Pivot Table & Products with PK/FK',
    badge: 'ERD 1:N / N:M',
    category: 'Architecture Diagrams',
    flowPreview: ['users (PK)', 'orders (FK)', 'order_items (PK/FK)', 'products (PK)'],
    nodes: [
      {
        id: 'users',
        type: 'table',
        title: 'users',
        x: 0,
        y: 60,
        width: 230,
        height: 196,
        color: '#0d9488',
        fields: [
          { name: 'id', type: 'uuid', pk: true },
          { name: 'email', type: 'varchar(255)', unique: true },
          { name: 'full_name', type: 'varchar(120)' },
          { name: 'created_at', type: 'timestamptz' },
        ],
      },
      {
        id: 'orders',
        type: 'table',
        title: 'orders',
        x: 340,
        y: 60,
        width: 230,
        height: 196,
        color: '#3b82f6',
        fields: [
          { name: 'id', type: 'uuid', pk: true },
          { name: 'user_id', type: 'uuid', fk: true },
          { name: 'status', type: 'varchar(32)' },
          { name: 'total_cents', type: 'integer' },
        ],
      },
      {
        id: 'order_items',
        type: 'table',
        title: 'order_items',
        x: 680,
        y: 60,
        width: 240,
        height: 196,
        color: '#8b5cf6',
        fields: [
          { name: 'order_id', type: 'uuid', pk: true, fk: true },
          { name: 'product_id', type: 'uuid', pk: true, fk: true },
          { name: 'quantity', type: 'integer' },
          { name: 'unit_price', type: 'integer' },
        ],
      },
      {
        id: 'products',
        type: 'table',
        title: 'products',
        x: 1030,
        y: 60,
        width: 230,
        height: 196,
        color: '#10b981',
        fields: [
          { name: 'id', type: 'uuid', pk: true },
          { name: 'sku', type: 'varchar(64)', unique: true },
          { name: 'title', type: 'varchar(255)' },
          { name: 'price_cents', type: 'integer' },
        ],
      },
    ],
    edges: [
      {
        id: 'e-user-orders',
        source: 'users',
        target: 'orders',
        label: '1 : N',
        color: '#0d9488',
        style: 'step',
        startArrowhead: 'er-one',
        endArrowhead: 'er-many',
      },
      {
        id: 'e-order-items',
        source: 'orders',
        target: 'order_items',
        label: '1 : N',
        color: '#3b82f6',
        style: 'step',
        startArrowhead: 'er-one',
        endArrowhead: 'er-many',
      },
      {
        id: 'e-product-items',
        source: 'products',
        target: 'order_items',
        label: '1 : N',
        color: '#10b981',
        style: 'step',
        startArrowhead: 'er-one',
        endArrowhead: 'er-zero-many',
      },
    ],
  },
];

export const ERD_TABLE_PRESETS: Array<{
  id: string;
  title: string;
  badge: string;
  subtitle: string;
  node: ArchitecturePatternNode;
}> = [
  {
    id: 'erd-preset-entity',
    title: 'Entity Table (PK/FK)',
    badge: '1:N Entity',
    subtitle: 'id PK, parent_id FK, timestamps',
    node: {
      id: 'entity_table',
      type: 'table',
      title: 'entities',
      x: 0,
      y: 0,
      width: 235,
      height: 196,
      color: '#0d9488',
      fields: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'parent_id', type: 'uuid', fk: true },
        { name: 'name', type: 'varchar(255)' },
        { name: 'created_at', type: 'timestamptz' },
      ],
    },
  },
  {
    id: 'erd-preset-join',
    title: 'Join / Pivot Table',
    badge: 'N:M Join',
    subtitle: 'Composite PK + FK join table',
    node: {
      id: 'pivot_table',
      type: 'table',
      title: 'entity_memberships',
      x: 0,
      y: 0,
      width: 240,
      height: 172,
      color: '#8b5cf6',
      fields: [
        { name: 'left_id', type: 'uuid', pk: true, fk: true },
        { name: 'right_id', type: 'uuid', pk: true, fk: true },
        { name: 'role', type: 'varchar(64)' },
      ],
    },
  },
];

export interface IndividualFlowComponentDef {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  badge: string;
  icon: string;
  color: string;
}

export const INDIVIDUAL_FLOW_COMPONENTS: IndividualFlowComponentDef[] = [
  // ─── 1. 3-TIER WEB ARCHITECTURE COMPONENTS ───
  { id: 'flow-client', category: '3-Tier Components', title: 'Web Client', subtitle: 'Next.js 15 SPA', badge: 'Client', icon: 'browser', color: '#3b82f6' },
  { id: 'flow-alb', category: '3-Tier Components', title: 'Load Balancer', subtitle: 'AWS ALB / Nginx Proxy', badge: 'ALB', icon: 'load-balancer', color: '#3b82f6' },
  { id: 'flow-app-server', category: '3-Tier Components', title: 'Web App Server', subtitle: 'Node.js / Express Cluster', badge: 'App', icon: 'web-server', color: '#10b981' },
  { id: 'flow-redis', category: '3-Tier Components', title: 'Redis Cache', subtitle: 'In-Memory Session Store', badge: 'Cache', icon: 'redis', color: '#ef4444' },
  { id: 'flow-postgres', category: '3-Tier Components', title: 'PostgreSQL DB', subtitle: 'Primary Relational Database', badge: 'SQL', icon: 'postgres', color: '#3b82f6' },

  // ─── 2. MICROSERVICES & EVENT STREAMING ───
  { id: 'flow-api-gw', category: 'Microservices & Events', title: 'API Gateway', subtitle: 'Ingress & Rate Limiter', badge: 'Gateway', icon: 'api-gateway', color: '#3b82f6' },
  { id: 'flow-order-svc', category: 'Microservices & Events', title: 'Order Service', subtitle: 'Go / gRPC Microservice', badge: 'Service', icon: 'microservice', color: '#8b5cf6' },
  { id: 'flow-payment-svc', category: 'Microservices & Events', title: 'Payment Gateway', subtitle: 'Stripe Webhook & Checkout', badge: 'Stripe', icon: 'stripe', color: '#635BFF' },
  { id: 'flow-kafka', category: 'Microservices & Events', title: 'Apache Kafka', subtitle: 'Distributed Event Bus', badge: 'Kafka', icon: 'kafka', color: '#f97316' },
  { id: 'flow-ledger-db', category: 'Microservices & Events', title: 'PostgreSQL Store', subtitle: 'Ledger & Transaction DB', badge: 'DB', icon: 'postgres', color: '#3b82f6' },

  // ─── 3. SERVERLESS CLOUD TOPOLOGY ───
  { id: 'flow-mobile-client', category: 'Serverless Cloud', title: 'Web & Mobile Client', subtitle: 'Next.js 15 & iOS Client', badge: 'Client', icon: 'mobile', color: '#06b6d4' },
  { id: 'flow-cloudfront', category: 'Serverless Cloud', title: 'AWS CloudFront', subtitle: 'Global Edge CDN', badge: 'CDN', icon: 'cdn', color: '#06b6d4' },
  { id: 'flow-aws-apigw', category: 'Serverless Cloud', title: 'AWS API Gateway', subtitle: 'HTTP REST Ingress', badge: 'Gateway', icon: 'api-gateway', color: '#8b5cf6' },
  { id: 'flow-lambda', category: 'Serverless Cloud', title: 'AWS Lambda', subtitle: 'Serverless Execution Engine', badge: 'Lambda', icon: 'lambda', color: '#f59e0b' },
  { id: 'flow-dynamo', category: 'Serverless Cloud', title: 'AWS DynamoDB', subtitle: 'Single-Digit Latency NoSQL', badge: 'NoSQL', icon: 'database', color: '#6366f1' },
  { id: 'flow-s3', category: 'Serverless Cloud', title: 'AWS S3 Storage', subtitle: 'Asset & Media Buckets', badge: 'Storage', icon: 's3', color: '#eab308' },

  // ─── 4. CACHE-ASIDE & REPLICATION ───
  { id: 'flow-app-backend', category: 'Cache-Aside & Replication', title: 'Application Server', subtitle: 'Backend API Service', badge: 'App', icon: 'app-server', color: '#10b981' },
  { id: 'flow-redis-fast', category: 'Cache-Aside & Replication', title: 'Redis Cache', subtitle: 'Sub-millisecond Read Cache', badge: 'Cache', icon: 'redis', color: '#ef4444' },
  { id: 'flow-primary-db', category: 'Cache-Aside & Replication', title: 'Primary PostgreSQL', subtitle: 'Master Write Instance', badge: 'Master', icon: 'postgres', color: '#3b82f6' },
  { id: 'flow-read-replica', category: 'Cache-Aside & Replication', title: 'Read Replica DB', subtitle: 'Read-Only Slave Instance', badge: 'Replica', icon: 'postgres', color: '#0284c7' },

  // ─── 5. SECURITY & AUTH GATEWAY ───
  { id: 'flow-auth-client', category: 'Auth & Security', title: 'User Client', subtitle: 'Web & Mobile Client', badge: 'Client', icon: 'browser', color: '#3b82f6' },
  { id: 'flow-auth-gw', category: 'Auth & Security', title: 'API Gateway', subtitle: 'Token Introspection & Proxy', badge: 'Gateway', icon: 'api-gateway', color: '#3b82f6' },
  { id: 'flow-auth-svc', category: 'Auth & Security', title: 'Auth Service', subtitle: 'OAuth2 / RS256 JWT Issuer', badge: 'Auth', icon: 'auth', color: '#8b5cf6' },
  { id: 'flow-session-db', category: 'Auth & Security', title: 'Session DB (Redis)', subtitle: 'Refresh Tokens & Blacklist', badge: 'Redis', icon: 'redis', color: '#ef4444' },
  { id: 'flow-core-api', category: 'Auth & Security', title: 'Core Resource API', subtitle: 'Protected Business Logic', badge: 'API', icon: 'microservice', color: '#10b981' },
];

export interface ComponentLibraryPanelProps {
  /**
   * Inserts an item at the centre of the view, for a click on a tile.
   *
   * A click hands over exactly the payload a drag would, so the host has one
   * insertion path rather than one for clicks and one for drops.
   */
  onInsertItem?: (item: ZCanvasDragItem) => void;
  onClose?: () => void;
}

export function ComponentLibraryPanel({
  onInsertItem,
  onClose,
}: ComponentLibraryPanelProps) {
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<'essential' | 'aws' | 'drawio' | 'patterns'>('essential');
  const [searchQuery, setSearchQuery] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'AWS (Amazon Web Services)': true,
    'Compute & Containers': true,
    'Cloud & Infrastructure': true,
    'Databases & Storage': true,
    'Networking & Traffic': true,
    'Messaging & Streaming': true,
    'Clients & Apps': true,
    'Security & DevOps': true,
    'Cloud Providers & Infra Logos': true,
    'Databases & Storage Logos': true,
    'Standard Shapes': true,
    'Networking & Ingress': true,
    'Security & Specs': true,
    'Cloud & Edge Services': true,
    'AI & Application Stack': true,
    'Software Architecture': true,
    'Architecture diagram components': true,
    'Software Logos & Infra': true,
    'Cloud Components': true,
    'Architecture Diagrams': true,
  });

  const toggleSection = (category: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Group essential software architecture components by category
  const filteredEssentialArch = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = q
      ? ARCHITECTURE_STENCIL_META.filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.subtitle.toLowerCase().includes(q) ||
            c.category.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q)
        )
      : ARCHITECTURE_STENCIL_META;

    const groups: Record<string, ArchitectureStencilMeta[]> = {};
    for (const item of list) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [searchQuery]);

  // Group tech logos by category. The artwork and the brand colour come from
  // the engine's registry, so the tile, the canvas and the exporter all draw
  // the same path.
  const techIconCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const filtered = q
      ? TECH_ICON_STENCILS.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q) ||
            t.id.toLowerCase().includes(q)
        )
      : TECH_ICON_STENCILS;

    const groups: Record<string, StencilDefinition[]> = {};
    for (const item of filtered) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [searchQuery]);

  const filteredStandardShapes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return STANDARD_DRAWIO_SHAPES;
    return STANDARD_DRAWIO_SHAPES.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.type.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const filteredPatterns = useMemo(() => {
    if (!searchQuery.trim()) return BUILTIN_ARCHITECTURE_PATTERNS;
    const q = searchQuery.toLowerCase();
    return BUILTIN_ARCHITECTURE_PATTERNS.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        p.badge.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Group individual flow components by category
  const filteredFlowComponents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = q
      ? INDIVIDUAL_FLOW_COMPONENTS.filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.subtitle.toLowerCase().includes(q) ||
            c.category.toLowerCase().includes(q) ||
            c.badge.toLowerCase().includes(q)
        )
      : INDIVIDUAL_FLOW_COMPONENTS;

    const groups: Record<string, IndividualFlowComponentDef[]> = {};
    for (const item of list) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [searchQuery]);

  /**
   * Every tile drags the same way: a `ZCanvasDragItem` handed to the engine's
   * one writer.
   *
   * The payload describes *what* is being dragged, so the canvas never has to
   * work out which panel produced a drag from the mimetype it arrived under.
   * That indirection is what the old four-mimetype scheme lacked, and it is why
   * nothing from this panel used to reach the canvas at all.
   *
   * No `title`. A payload title is the name the node lands with, and the
   * catalogue's title is this panel's own label for a tile — sending it named
   * every shape on the canvas after the library entry it came from. A dropped
   * stencil is the drawing alone; the user names it if the diagram needs a name.
   */
  const handleDragEssentialArch = (e: React.DragEvent, item: ArchitectureStencilMeta) => {
    writeDragItem(e.dataTransfer, {
      kind: 'stencil',
      stencilId: item.id,
      category: item.category,
      accentColor: item.accentColor,
      width: item.width,
      height: item.height,
    });
  };

  const handleDragTechIcon = (e: React.DragEvent, item: StencilDefinition) => {
    writeDragItem(e.dataTransfer, {
      kind: 'stencil',
      stencilId: item.id,
      category: item.category,
      accentColor: item.accentColor,
      width: item.defaultWidth,
      height: item.defaultHeight,
    });
  };

  const handleDragStandardShape = (e: React.DragEvent, shape: StandardDrawioShapeDef) => {
    writeDragItem(e.dataTransfer, {
      kind: 'tool',
      tool: shape.type,
      width: shape.width,
      height: shape.height,
    });
  };

  const handleDragPattern = (e: React.DragEvent, pattern: ArchitecturePatternDef) => {
    writeDragItem(e.dataTransfer, {
      kind: 'pattern',
      pattern: {
        id: pattern.id,
        title: pattern.title,
        nodes: pattern.nodes,
        edges: pattern.edges,
      },
    });
  };

  const handleDragFlowComponent = (e: React.DragEvent, comp: IndividualFlowComponentDef) => {
    writeDragItem(e.dataTransfer, {
      kind: 'node',
      node: {
        id: comp.id,
        type: 'card',
        title: comp.title,
        subtitle: comp.subtitle,
        badge: comp.badge,
        icon: comp.icon,
        x: 0,
        y: 0,
        width: 210,
        height: 76,
        color: comp.color,
      },
    });
  };

  return (
    <div className="w-80 h-full border-r border-border bg-card flex flex-col select-none z-20">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Boxes className="w-4 h-4 text-primary" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Architecture Stencils
          </h2>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Tabs Selector: Architecture (Clean Vector) vs AWS vs Tech Logos vs Flows */}
      <div className="p-2 border-b border-border bg-muted/20">
        <div className="flex p-0.5 rounded-lg bg-muted/50 border border-border/50 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('essential')}
            className={cn(
              'flex-1 py-1 px-1 rounded-md font-medium text-[10.5px] transition-all text-center truncate',
              activeTab === 'essential'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="Clean Vector Software Architecture Components"
          >
            Architecture
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('aws')}
            className={cn(
              'flex-1 py-1 px-1 rounded-md font-medium text-[10.5px] transition-all text-center truncate',
              activeTab === 'aws'
                ? 'bg-background text-[#FF9900] font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="AWS Cloud Architecture Icons (EC2, Lambda, S3, RDS, VPC, SQS...)"
          >
            AWS
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('drawio')}
            className={cn(
              'flex-1 py-1 px-1 rounded-md font-medium text-[10.5px] transition-all text-center truncate',
              activeTab === 'drawio'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="Clean Draw.io Tech Logos"
          >
            Tech Logos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('patterns')}
            className={cn(
              'flex-1 py-1 px-1 rounded-md font-medium text-[10.5px] transition-all text-center truncate',
              activeTab === 'patterns'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="Pre-built Architecture Flow Templates"
          >
            Flows
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Database, Cache, Event Bus, Queue, Server..."
            className="pl-8 h-8 text-xs bg-muted/30 focus-visible:ring-1"
          />
        </div>
      </div>

      {/* List Categories */}
      <div className="flex-1 eraser-doc-scroll overflow-y-auto p-2.5 space-y-4">
        {/* ─── TAB 1: ESSENTIAL SOFTWARE ARCHITECTURE (CLEAN VECTOR) ─── */}
        {activeTab === 'essential' && (
          <>
            {/* Categorized Essential Architecture Components */}
            {Object.entries(filteredEssentialArch).map(([category, items]) => {
              const isOpen = openSections[category] !== false;

              return (
                <div key={category} className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => toggleSection(category)}
                    className="w-full flex items-center justify-between px-1.5 py-1 text-[11px] font-semibold text-foreground hover:text-primary transition-colors group"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{category}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-mono shrink-0">
                        {items.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                      {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={(e) => handleDragEssentialArch(e, item)}
                          onClick={() =>
                            onInsertItem?.({
                              kind: 'stencil',
                              stencilId: item.id,
                              category: item.category,
                              accentColor: item.accentColor,
                              width: item.width,
                              height: item.height,
                            })
                          }
                          className={cn(
                            'group flex flex-col items-center justify-center p-2 rounded-xl border border-border/70 bg-background/60',
                            'hover:bg-accent/40 hover:border-primary/50 cursor-grab active:cursor-grabbing hover:shadow-xs transition-all text-center'
                          )}
                          title={`Click or drag "${item.title}" onto canvas`}
                        >
                          <div className="w-8 h-8 flex items-center justify-center mb-1.5 pointer-events-none group-hover:scale-105 transition-transform">
                            <ZCanvasStencilGraphic
                              id={item.id}
                              width={26}
                              height={26}
                              isDark={isDark}
                              className="w-6.5 h-6.5 drop-shadow-xs"
                            />
                          </div>
                          <span className="text-[11px] font-medium text-foreground truncate w-full block group-hover:text-primary transition-colors pointer-events-none">
                            {item.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}



            {/* AWS (Amazon Web Services) Stencils inside Architecture tab as well */}
            {techIconCategories['AWS (Amazon Web Services)'] &&
              techIconCategories['AWS (Amazon Web Services)'].length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => toggleSection('AWS (Amazon Web Services)')}
                    className="w-full flex items-center justify-between px-1.5 py-1 text-[11px] font-semibold text-foreground hover:text-primary transition-colors group"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate">AWS (Amazon Web Services)</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#FF9900]/15 text-[#FF9900] font-mono shrink-0">
                        {techIconCategories['AWS (Amazon Web Services)'].length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                      {openSections['AWS (Amazon Web Services)'] !== false ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                    </div>
                  </button>

                  {openSections['AWS (Amazon Web Services)'] !== false && (
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      {techIconCategories['AWS (Amazon Web Services)'].map((item) => (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={(e) => handleDragTechIcon(e, item)}
                          onClick={() =>
                            onInsertItem?.({
                              kind: 'stencil',
                              stencilId: item.id,
                              category: item.category,
                              accentColor: item.accentColor,
                              width: item.defaultWidth,
                              height: item.defaultHeight,
                            })
                          }
                          className={cn(
                            'group flex flex-col items-center justify-center p-2 rounded-xl border border-border/70 bg-background/60',
                            'hover:bg-accent/40 hover:border-primary/50 cursor-grab active:cursor-grabbing hover:shadow-xs transition-all text-center'
                          )}
                          title={`Click or drag "${item.title}" onto canvas`}
                        >
                          <div className="w-8 h-8 flex items-center justify-center mb-1.5 pointer-events-none group-hover:scale-105 transition-transform">
                            <ZCanvasStencilGraphic
                              id={item.id}
                              width={26}
                              height={26}
                              isDark={isDark}
                              className="w-6.5 h-6.5 drop-shadow-xs"
                            />
                          </div>
                          <span className="text-[11px] font-medium text-foreground truncate w-full block group-hover:text-primary transition-colors pointer-events-none">
                            {item.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            {/* Standard Draw.io Primitives and Components (Cylinder, Cloud,
                Server Box, Database Table, VPC Container) */}
            {filteredStandardShapes.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => toggleSection('Standard Shapes')}
                  className="w-full flex items-center justify-between px-1.5 py-1 text-[11px] font-semibold text-foreground hover:text-primary transition-colors group"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate">Standard Shapes (Shapes, Tables, VPC)</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-mono shrink-0">
                      {filteredStandardShapes.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                    {openSections['Standard Shapes'] ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </div>
                </button>

                {openSections['Standard Shapes'] && (
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    {filteredStandardShapes.map((shape) => (
                      <div
                        key={shape.id}
                        draggable
                        onDragStart={(e) => handleDragStandardShape(e, shape)}
                        onClick={() =>
                          onInsertItem?.({
                            kind: 'tool',
                            tool: shape.type,
                            width: shape.width,
                            height: shape.height,
                          })
                        }
                        className={cn(
                          'group flex flex-col justify-between p-2 rounded-xl border border-border/70 bg-background/60',
                          'hover:bg-accent/40 hover:border-primary/50 cursor-grab active:cursor-grabbing hover:shadow-xs transition-all text-left'
                        )}
                        title={`Click or drag "${shape.title}" onto canvas`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1.5 w-full pointer-events-none">
                          <div className="w-8 h-8 rounded-lg bg-muted/30 border border-border/60 flex items-center justify-center p-1">
                            {shape.type === 'cylinder' && (
                              <svg viewBox="0 0 100 110" className="w-5 h-5 stroke-primary fill-primary/15 stroke-2">
                                <path d="M 10 24 L 10 86 A 40 16 0 0 0 90 86 L 90 24 A 40 16 0 0 0 10 24 Z" />
                                <ellipse cx="50" cy="24" rx="40" ry="16" fill="none" />
                              </svg>
                            )}
                            {shape.type === 'cloud' && (
                              <svg viewBox="0 0 120 80" className="w-6 h-5 stroke-sky-500 fill-sky-500/15 stroke-2">
                                <path d="M 28 66 C 10 66 2 52 8 36 C 4 20 18 6 34 12 C 44 2 64 2 72 14 C 88 8 100 24 95 40 C 102 54 90 68 76 66 C 62 76 42 76 28 66 Z" />
                              </svg>
                            )}
                            {shape.type === 'rectangle' && (
                              <div className="w-5 h-4 rounded-sm border-2 border-primary bg-primary/15" />
                            )}
                            {shape.type === 'circle' && (
                              <div className="w-5 h-5 rounded-full border-2 border-primary bg-primary/15" />
                            )}
                            {shape.type === 'table' && (
                              <div className="w-6 h-5 rounded-sm border border-teal-500 overflow-hidden bg-teal-500/10 flex flex-col">
                                <div className="h-1.5 bg-teal-500/35 border-b border-teal-500 shrink-0" />
                              </div>
                            )}
                            {shape.type === 'container' && (
                              <div className="w-6 h-5 rounded-sm border border-dashed border-primary/70 bg-primary/5 flex flex-col overflow-hidden">
                                <div className="h-1.5 bg-primary/25 border-b border-primary/50 shrink-0" />
                              </div>
                            )}
                          </div>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-muted/80 text-muted-foreground font-mono">
                            Shape
                          </span>
                        </div>
                        <div className="min-w-0 w-full">
                          <span className="text-[11px] font-semibold text-foreground truncate block group-hover:text-primary transition-colors">
                            {shape.title}
                          </span>
                        </div>
                      </div>
                    ))}
                    {ERD_TABLE_PRESETS.map((preset) => (
                      <div
                        key={preset.id}
                        draggable
                        onDragStart={(e) =>
                          writeDragItem(e.dataTransfer, {
                            kind: 'node',
                            node: preset.node,
                          })
                        }
                        onClick={() =>
                          onInsertItem?.({
                            kind: 'node',
                            node: preset.node,
                          })
                        }
                        className={cn(
                          'group flex flex-col justify-between p-2 rounded-xl border border-teal-500/40 bg-teal-500/5',
                          'hover:bg-teal-500/10 hover:border-teal-500/70 cursor-grab active:cursor-grabbing hover:shadow-xs transition-all text-left'
                        )}
                        title={`Click or drag "${preset.title}" (${preset.subtitle})`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1.5 w-full pointer-events-none">
                          <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/40 flex items-center justify-center p-1">
                            <div className="w-6 h-5 rounded-sm border border-teal-500 overflow-hidden bg-teal-500/10 flex flex-col">
                              <div className="h-1.5 bg-teal-500/45 border-b border-teal-500 shrink-0" />
                              <div className="flex items-center gap-0.5 px-0.5 pt-0.5">
                                <span className="w-1.5 h-1 rounded-xs bg-amber-500" />
                                <span className="w-1.5 h-1 rounded-xs bg-sky-500" />
                              </div>
                            </div>
                          </div>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-teal-500/15 text-teal-600 dark:text-teal-400 font-mono">
                            {preset.badge}
                          </span>
                        </div>
                        <div className="min-w-0 w-full">
                          <span className="text-[11px] font-semibold text-foreground truncate block group-hover:text-teal-500 transition-colors">
                            {preset.title}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ─── TAB 1.5: DEDICATED AWS ARCHITECTURE STENCILS ─── */}
        {activeTab === 'aws' && (
          <div className="space-y-3">
            <div className="px-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-foreground">
                AWS Cloud Services
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#FF9900]/15 text-[#FF9900] font-mono">
                {(techIconCategories['AWS (Amazon Web Services)']?.length ?? 0) +
                  (TECH_ICON_STENCILS.some((s) => s.id === 'tech-aws') ? 1 : 0)}{' '}
                icons
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TECH_ICON_STENCILS.filter(
                (item) =>
                  (item.category === 'AWS (Amazon Web Services)' || item.id === 'tech-aws') &&
                  (!searchQuery.trim() ||
                    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.id.toLowerCase().includes(searchQuery.toLowerCase()))
              ).map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragTechIcon(e, item)}
                  onClick={() =>
                    onInsertItem?.({
                      kind: 'stencil',
                      stencilId: item.id,
                      category: item.category,
                      accentColor: item.accentColor,
                      width: item.defaultWidth,
                      height: item.defaultHeight,
                    })
                  }
                  className={cn(
                    'group flex flex-col items-center justify-center p-2.5 rounded-xl border border-border/70 bg-background/60',
                    'hover:bg-accent/40 hover:border-[#FF9900]/60 cursor-grab active:cursor-grabbing hover:shadow-xs transition-all text-center'
                  )}
                  title={`Click or drag "${item.title}" onto canvas`}
                >
                  <div className="w-8 h-8 flex items-center justify-center mb-1.5 pointer-events-none group-hover:scale-105 transition-transform">
                    <ZCanvasStencilGraphic
                      id={item.id}
                      width={26}
                      height={26}
                      isDark={isDark}
                      className="w-6.5 h-6.5 drop-shadow-xs"
                    />
                  </div>
                  <span className="text-[11px] font-medium text-foreground truncate w-full block group-hover:text-primary transition-colors pointer-events-none">
                    {item.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── TAB 2: DRAW.IO CRISP TECH LOGOS ─── */}
        {activeTab === 'drawio' && (
          <>
            {/* Standard Draw.io Primitives and Components (Cylinder, Cloud,
                Server Box, Database Table, VPC Container) */}
            {filteredStandardShapes.length > 0 && (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => toggleSection('Standard Shapes')}
                  className="w-full flex items-center justify-between px-1.5 py-1 text-[11px] font-semibold text-foreground hover:text-primary transition-colors group"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate">Standard Shapes (Shapes, Tables, VPC)</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-mono shrink-0">
                      {filteredStandardShapes.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                    {openSections['Standard Shapes'] ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </div>
                </button>

                {openSections['Standard Shapes'] && (
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    {filteredStandardShapes.map((shape) => (
                      <div
                        key={shape.id}
                        draggable
                        onDragStart={(e) => handleDragStandardShape(e, shape)}
                        onClick={() =>
                          onInsertItem?.({
                            kind: 'tool',
                            tool: shape.type,
                            width: shape.width,
                            height: shape.height,
                          })
                        }
                        className={cn(
                          'group flex flex-col justify-between p-2 rounded-xl border border-border/70 bg-background/60',
                          'hover:bg-accent/40 hover:border-primary/50 cursor-grab active:cursor-grabbing hover:shadow-xs transition-all text-left'
                        )}
                        title={`Click or drag "${shape.title}" onto canvas`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1.5 w-full pointer-events-none">
                          <div className="w-8 h-8 rounded-lg bg-muted/30 border border-border/60 flex items-center justify-center p-1">
                            {shape.type === 'cylinder' && (
                              <svg viewBox="0 0 100 110" className="w-5 h-5 stroke-primary fill-primary/15 stroke-2">
                                <path d="M 10 24 L 10 86 A 40 16 0 0 0 90 86 L 90 24 A 40 16 0 0 0 10 24 Z" />
                                <ellipse cx="50" cy="24" rx="40" ry="16" fill="none" />
                              </svg>
                            )}
                            {shape.type === 'cloud' && (
                              <svg viewBox="0 0 120 80" className="w-6 h-5 stroke-sky-500 fill-sky-500/15 stroke-2">
                                <path d="M 28 66 C 10 66 2 52 8 36 C 4 20 18 6 34 12 C 44 2 64 2 72 14 C 88 8 100 24 95 40 C 102 54 90 68 76 66 C 62 76 42 76 28 66 Z" />
                              </svg>
                            )}
                            {shape.type === 'rectangle' && (
                              <div className="w-5 h-4 rounded-sm border-2 border-primary bg-primary/15" />
                            )}
                            {shape.type === 'circle' && (
                              <div className="w-5 h-5 rounded-full border-2 border-primary bg-primary/15" />
                            )}
                            {shape.type === 'table' && (
                              <div className="w-6 h-5 rounded-sm border border-teal-500 overflow-hidden bg-teal-500/10 flex flex-col">
                                <div className="h-1.5 bg-teal-500/35 border-b border-teal-500 shrink-0" />
                              </div>
                            )}
                            {shape.type === 'container' && (
                              <div className="w-6 h-5 rounded-sm border border-dashed border-primary/70 bg-primary/5 flex flex-col overflow-hidden">
                                <div className="h-1.5 bg-primary/25 border-b border-primary/50 shrink-0" />
                              </div>
                            )}
                          </div>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-muted/80 text-muted-foreground font-mono">
                            Shape
                          </span>
                        </div>
                        <div className="min-w-0 w-full">
                          <span className="text-[11px] font-semibold text-foreground truncate block group-hover:text-primary transition-colors">
                            {shape.title}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Categorized Draw.io Crisp Tech SVGs */}
            {Object.entries(techIconCategories).map(([category, items]) => {
              const isOpen = openSections[category] !== false;

              return (
                <div key={category} className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => toggleSection(category)}
                    className="w-full flex items-center justify-between px-1.5 py-1 text-[11px] font-semibold text-foreground hover:text-primary transition-colors group"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{category}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-mono shrink-0">
                        {items.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                      {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={(e) => handleDragTechIcon(e, item)}
                          onClick={() =>
                            onInsertItem?.({
                              kind: 'stencil',
                              stencilId: item.id,
                              category: item.category,
                              accentColor: item.accentColor,
                              width: item.defaultWidth,
                              height: item.defaultHeight,
                            })
                          }
                          className={cn(
                            'group flex flex-col items-center justify-center p-2 rounded-xl border border-border/70 bg-background/60',
                            'hover:bg-accent/40 hover:border-primary/50 cursor-grab active:cursor-grabbing hover:shadow-xs transition-all text-center'
                          )}
                          title={`Click or drag "${item.title}" onto canvas`}
                        >
                          <div className="w-8 h-8 flex items-center justify-center mb-1.5 pointer-events-none group-hover:scale-105 transition-transform">
                            <ZCanvasStencilGraphic
                              id={item.id}
                              width={26}
                              height={26}
                              isDark={isDark}
                              className="w-6.5 h-6.5 drop-shadow-xs"
                            />
                          </div>
                          <span className="text-[11px] font-medium text-foreground truncate w-full block group-hover:text-primary transition-colors pointer-events-none">
                            {item.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ─── TAB 3: DEFAULT ARCHITECTURE DIAGRAMS (PRE-BUILT FLOWS & INDIVIDUAL COMPONENTS) ─── */}
        {activeTab === 'patterns' && (
          <div className="space-y-4">
            {/* Section A: Individual Flow Components (Categorized, un-grouped, un-connected) */}
            {Object.keys(filteredFlowComponents).length > 0 && (
              <div className="space-y-3">
                <div className="px-1 text-[11px] font-semibold text-foreground flex items-center justify-between">
                  <span>Individual Flow Components</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Single Cards</span>
                </div>

                {Object.entries(filteredFlowComponents).map(([category, items]) => {
                  const isOpen = openSections[category] !== false;

                  return (
                    <div key={category} className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => toggleSection(category)}
                        className="w-full flex items-center justify-between px-1.5 py-1 text-[11px] font-semibold text-foreground hover:text-primary transition-colors group"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{category}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-mono shrink-0">
                            {items.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                          {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              draggable
                              onDragStart={(e) => handleDragFlowComponent(e, item)}
                              onClick={() =>
                                onInsertItem?.({
                                  kind: 'node',
                                  node: {
                                    id: item.id,
                                    type: 'card',
                                    title: item.title,
                                    subtitle: item.subtitle,
                                    badge: item.badge,
                                    icon: item.icon,
                                    x: 0,
                                    y: 0,
                                    width: 210,
                                    height: 76,
                                    color: item.color,
                                  },
                                })
                              }
                              className={cn(
                                'group flex flex-col justify-between p-2 rounded-xl border border-border/70 bg-background/70',
                                'hover:bg-accent/40 hover:border-primary/50 cursor-grab active:cursor-grabbing hover:shadow-xs transition-all text-left'
                              )}
                              title={`Click or drag "${item.title}" onto canvas as single component`}
                            >
                              <div className="flex items-start justify-between gap-1 mb-1">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="text-[9px] px-1 py-0.2 rounded bg-muted/80 text-muted-foreground font-mono truncate max-w-[65px]">
                                  {item.badge}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-[11px] font-semibold text-foreground truncate block group-hover:text-primary transition-colors">
                                  {item.title}
                                </span>
                                <span className="text-[9.5px] text-muted-foreground truncate block font-mono">
                                  {item.subtitle}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Section B: Pre-built Connected Flow Topologies */}
            {filteredPatterns.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/40">
                <div className="px-1 text-[11px] font-semibold text-foreground flex items-center justify-between">
                  <span>Pre-Built Flow Topologies</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Full Flow</span>
                </div>
                <div className="grid grid-cols-1 gap-2 pt-1">
                  {filteredPatterns.map((pattern) => (
                    <div
                      key={pattern.id}
                      draggable
                      onDragStart={(e) => handleDragPattern(e, pattern)}
                      onClick={() =>
                        onInsertItem?.({
                          kind: 'pattern',
                          pattern: {
                            id: pattern.id,
                            title: pattern.title,
                            nodes: pattern.nodes,
                            edges: pattern.edges,
                          },
                        })
                      }
                      className={cn(
                        'group flex flex-col p-2.5 rounded-lg border border-border/70 bg-background/60',
                        'hover:bg-accent/40 hover:border-primary/50 cursor-pointer active:scale-[0.99] transition-all'
                      )}
                      title="Click or drag to place full architecture diagram"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 border border-primary/30 bg-primary/10 text-primary">
                            <Sparkles className="w-3 h-3" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors block">
                              {pattern.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate block font-mono">
                              {pattern.subtitle}
                            </span>
                          </div>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-muted text-muted-foreground border border-border shrink-0">
                          {pattern.badge}
                        </span>
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center gap-1 overflow-hidden text-[9px] text-muted-foreground/80 font-mono">
                        {pattern.flowPreview.map((step, idx) => (
                          <React.Fragment key={idx}>
                            <span className="truncate max-w-[80px] bg-muted/40 px-1 py-0.5 rounded">
                              {step}
                            </span>
                            {idx < pattern.flowPreview.length - 1 && (
                              <ArrowRight className="w-2.5 h-2.5 shrink-0 text-muted-foreground/40" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {Object.keys(techIconCategories).length === 0 &&
          filteredPatterns.length === 0 &&
          Object.keys(filteredEssentialArch).length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No components or libraries matched "{searchQuery}"
            </div>
          )}
      </div>
    </div>
  );
}
