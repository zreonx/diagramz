'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Columns2,
  FileText,
  Palette,
  Sparkles,
  Cloud,
  Check,
  ShieldCheck,
  Database,
  ArrowRight,
  GitBranch,
  Layers,
  Code2,
  FileCode2,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { getEraserTemplate } from '@/lib/eraser-templates';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export type StarterTemplateKey =
  | 'global-payment-system'
  | 'cloud-architecture'
  | 'auth-sequence'
  | 'event-pipeline'
  | 'database-erd'
  | 'engineering-rfc'
  | 'blank';

export interface StarterTemplate {
  key: StarterTemplateKey;
  category: 'architecture' | 'sequence' | 'database' | 'rfc';
  title: string;
  badge: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultTitle: string;
  defaultViewMode: 'both' | 'canvas' | 'doc';
  docContent: string;
  mermaidCode: string;
}

export const ERASER_STARTER_TEMPLATES: StarterTemplate[] = [
  {
    key: 'global-payment-system',
    category: 'architecture',
    title: 'Payment System (Landing)',
    badge: 'Landing Spec',
    desc: 'Distributed payment flow with Next.js Client, API Gateway, Auth, Checkout Svc, Kafka & PostgreSQL',
    icon: Cloud,
    defaultTitle: 'Global Payment System (RFC-104)',
    defaultViewMode: 'both',
    docContent: `# RFC-104: Global Payment System Architecture

## 1. Executive Summary
High-throughput distributed payment processing topology with sub-50ms ingress, idempotent state machine orchestration, and asynchronous event streaming.

## 2. Component Inventory
| Component | Technology | Responsibility |
| :--- | :--- | :--- |
| **Web Client** | Next.js 15 / React SPA | End-user checkout UI with PCI-compliant tokenization |
| **API Gateway** | Envoy / Kong | Rate limiting, token verification routing, telemetry |
| **Auth Service** | Go / Node.js | OAuth2 PKCE verification & RS256 JWT validation |
| **Payment Service** | Go / gRPC | Order state machine & payment orchestration |
| **Kafka Event Bus** | Apache Kafka | Asynchronous order.created domain event streaming |
| **PostgreSQL DB** | PostgreSQL 16 (Primary) | ACID transaction ledger & persistence |

## 3. Data Flow & Communication
1. **Web Client** sends encrypted checkout intent via \`POST /v1/checkout\` with \`Idempotency-Key\`.
2. **API Gateway** intercepts request, validates rate-limits, and queries **Auth Service** for token validity.
3. Authenticated request routes downstream to **Payment Service**.
4. **Payment Service** writes ledger transaction to **PostgreSQL DB** within an atomic transaction.
5. Domain event is published to **Kafka Event Bus** for fulfillment and notification workers.

## 4. Resilience & SLAs
- Target 99.999% uptime with active-active regional replication.
- Strictly enforced idempotency keys prevent duplicate credit card charges.
- End-to-end telemetry and distributed tracing via OpenTelemetry.`,
    mermaidCode: `flowchart LR
    Client[Web Client\\nNext.js 15] --> Gateway[API Gateway\\nRate Limiter / Envoy]
    Gateway --> Auth[Auth Service\\nJWT & OAuth]
    Gateway --> Payment[Payment Service\\nGo / gRPC Checkout]
    Payment --> Kafka[(Kafka Event Bus)]
    Payment --> DB[(PostgreSQL Primary)]`,
  },
  {
    key: 'cloud-architecture',
    category: 'architecture',
    title: 'Cloud Microservices',
    badge: 'Architecture',
    desc: 'Multi-tier cloud topology with Edge CDN, Ingress, Services, Cache & DB',
    icon: Cloud,
    defaultTitle: 'Cloud Microservices Architecture',
    defaultViewMode: 'both',
    docContent: `# Cloud Microservices Architecture RFC

## 1. Executive Summary
High-availability, horizontally scalable microservices topology deployed across multi-AZ container clusters with managed caching and persistent storage.

## 2. Component Inventory
| Component | Technology | Responsibility |
| :--- | :--- | :--- |
| **Edge CDN** | CloudFront / Fastly | Global static asset caching & TLS termination |
| **API Gateway** | Kong / Envoy | Authentication routing, rate limiting, telemetry |
| **Auth Service** | Node.js / Go | JWT issuance, OAuth2 PKCE verification |
| **Order Service** | NestJS | Transaction orchestration and state machine |
| **Event Bus** | Apache Kafka | Asynchronous event streaming & pub/sub |
| **Cache Layer** | Redis Cluster | Low-latency session & query caching |
| **Primary DB** | PostgreSQL | Relational ACID transaction persistence |
| **Blob Storage** | S3 / GCS | Unstructured asset and export storage |

## 3. Data Flow & Communication
1. External requests hit the **Edge CDN** and resolve to the **API Gateway**.
2. Gateway validates Bearer tokens against the **Auth Service**.
3. Request is reverse-proxied to downstream **Order Service**.
4. Mutations publish domain events to the **Kafka Event Bus** for async consumer processing.

## 4. Resilience & SLAs
- Circuit breakers configured on all inter-service gRPC calls.
- 99.99% uptime target with automated multi-zone failover.`,
    mermaidCode: `flowchart TD
    subgraph Edge["Internet & Edge CDN"]
        Client[Web & Mobile Clients] --> CDN[Cloud CDN / WAF]
    end

    subgraph GatewayLayer["API Ingress"]
        CDN --> GW[API Gateway / Ingress]
        GW -.-> Auth[Auth Service]
    end

    subgraph Microservices["Core Application Services"]
        GW --> SvcA[Order Service]
        GW --> SvcB[Payment Service]
        GW --> SvcC[User Service]
    end

    subgraph EventStream["Message Broker & Cache"]
        SvcA -->|Publish Event| Queue[(Kafka Event Stream)]
        Queue --> Worker[Fulfillment Worker]
        SvcA <--> Redis[(Redis Cache)]
    end

    subgraph Persistence["Storage & Database"]
        SvcA --> PG[(PostgreSQL Cluster)]
        SvcB --> PG
        Worker --> S3[(S3 Object Storage)]
    end`,
  },
  {
    key: 'auth-sequence',
    category: 'sequence',
    title: 'OAuth2 & JWT Auth',
    badge: 'Sequence',
    desc: 'Secure authentication flow with PKCE, tokens, and verification',
    icon: ShieldCheck,
    defaultTitle: 'OAuth2 & JWT Authentication Flow',
    defaultViewMode: 'both',
    docContent: `# OAuth2 & JWT Authentication Flow Spec

## 1. Context & Objectives
Secure authentication flow utilizing Authorization Code Grant with PKCE for single-page applications and mobile clients.

## 2. Token Specifications
- **Access Token**: Short-lived JWT (15-minute expiration) with RS256 signature.
- **Refresh Token**: Long-lived cryptographic token stored in secure \`HttpOnly\`, \`SameSite=Strict\` cookie.

## 3. Security Considerations
> [!IMPORTANT]
> Never store access tokens in localStorage to prevent XSS exfiltration. Utilize in-memory store with silent refresh via iframe or background worker.

## 4. Protocol Steps
1. Client initiates authorization code request with code challenge (PKCE).
2. User authorizes application via Identity Provider.
3. Identity Provider issues auth code to redirect URI.
4. Client exchanges code + code verifier for access token and refresh token.
5. Subsequent requests carry Authorization Bearer token.`,
    mermaidCode: `sequenceDiagram
    autonumber
    actor User as User / Browser
    participant Client as Web App (SPA)
    participant Gateway as API Gateway
    participant Auth as Auth Service
    participant DB as User Database

    User->>Client: 1. Click Login (PKCE Challenge)
    Client->>Auth: 2. Redirect /oauth/authorize
    Auth-->>User: 3. Render Login Prompt
    User->>Auth: 4. Submit Credentials
    Auth->>DB: 5. Verify User & Hash
    DB-->>Auth: 6. User Validated
    Auth-->>Client: 7. Redirect with Auth Code
    Client->>Gateway: 8. POST /oauth/token (Code + Verifier)
    Gateway->>Auth: 9. Validate PKCE & Issue Tokens
    Auth-->>Client: 10. Return JWT Access Token + HttpOnly Cookie
    Client->>Gateway: 11. Request /api/protected (Bearer JWT)
    Gateway-->>Client: 12. 200 OK + Resource Data`,
  },
  {
    key: 'event-pipeline',
    category: 'architecture',
    title: 'Event-Driven Pipeline',
    badge: 'Pub/Sub',
    desc: 'High-throughput async pub/sub event pipeline with failure sinks',
    icon: GitBranch,
    defaultTitle: 'Event-Driven Data Pipeline',
    defaultViewMode: 'both',
    docContent: `# Event-Driven Data Pipeline Design Doc

## 1. Overview
High-throughput asynchronous message processing architecture designed for decoupled downstream service consumption.

## 2. Topic Architecture
- **orders.events.v1**: Canonical domain events emitted upon order state changes.
- **payments.processed.v1**: Transaction outcomes emitted by payment gateway.
- **dead-letter-queue**: Poison pills and unrecoverable delivery failures.

## 3. Guarantees
- At-least-once message delivery.
- Partition keying by \`tenantId\` + \`aggregateId\` for in-order processing.`,
    mermaidCode: `flowchart LR
    subgraph Ingestion["Event Producers"]
        Web[Checkout API] -->|order.created| Bus[(Kafka Event Bus)]
        Cron[Scheduled Jobs] -->|batch.sync| Bus
    end

    subgraph Processing["Event Consumers"]
        Bus -->|Partition 0| PayWorker[Payment Worker]
        Bus -->|Partition 1| MailWorker[Notification Worker]
        Bus -->|Partition 2| AnalyticsWorker[Analytics Ingester]
    end

    subgraph DeadLetter["Failure Handling"]
        PayWorker -.->|Retries Exhausted| DLQ[(Dead Letter Queue)]
    end

    subgraph Sinks["Storage Sinks"]
        PayWorker --> Ledger[(Ledger DB)]
        AnalyticsWorker --> ClickHouse[(ClickHouse Data Lake)]
    end`,
  },
  {
    key: 'database-erd',
    category: 'database',
    title: 'Database Schema (ERD)',
    badge: 'Database',
    desc: 'Relational entities, foreign keys, cardinality, and constraints',
    icon: Database,
    defaultTitle: 'Database Entity Relationship Schema',
    defaultViewMode: 'both',
    docContent: `# Database Entity Relationship Schema

## 1. Domain Entities
- **Workspaces**: Top-level multi-tenant isolation boundary.
- **Users**: Account credentials, profile metadata, system roles.
- **Memberships**: Many-to-many relationship linking users to workspaces with RBAC permissions.
- **Folders**: Hierarchical organizational units with self-referencing parentId.
- **Diagrams**: Dual-mode documents containing markdown specs, canvas scene blobs, and version history.

## 2. Indexing Strategy
- Unique composite index on \`memberships(workspace_id, user_id)\`.
- B-Tree index on \`diagrams(workspace_id, updated_at DESC)\` for fast dashboard queries.`,
    mermaidCode: `erDiagram
    WORKSPACES ||--o{ MEMBERSHIPS : contains
    USERS ||--o{ MEMBERSHIPS : belongs_to
    WORKSPACES ||--o{ FOLDERS : organizes
    FOLDERS ||--o{ FOLDERS : "parent of"
    WORKSPACES ||--o{ DIAGRAMS : contains
    FOLDERS ||--o{ DIAGRAMS : holds
    DIAGRAMS ||--|| DIAGRAM_CANVASES : has
    DIAGRAMS ||--o{ DIAGRAM_VERSIONS : tracks

    WORKSPACES {
        uuid id PK
        string name
        string slug UK
        timestamp created_at
    }
    USERS {
        uuid id PK
        string email UK
        string name
        timestamp created_at
    }
    DIAGRAMS {
        uuid id PK
        uuid workspace_id FK
        uuid folder_id FK
        string title
        string view_mode
        text document_content
        text mermaid_code
        boolean is_public
        timestamp updated_at
    }`,
  },
  {
    key: 'engineering-rfc',
    category: 'rfc',
    title: 'Technical Design Doc (RFC)',
    badge: 'Design Doc',
    desc: 'Structured engineering RFC with context, trade-offs, and architecture',
    icon: FileCode2,
    defaultTitle: 'RFC: System Architecture Spec',
    defaultViewMode: 'both',
    docContent: `# RFC-042: System Architecture Refactor

**Status**: Proposed  
**Authors**: Engineering Team  
**Date**: October 2026  

## 1. Context & Problem Statement
Current monolithic API encounters performance bottlenecks during peak ingestion traffic. We propose decoupling core services into event-driven workers.

## 2. Goals & Non-Goals
- **Goal**: Sub-100ms P99 latency for read operations.
- **Goal**: Zero message loss during worker redeployments.
- **Non-Goal**: Rewriting frontend client SDKs.

## 3. Proposed Solution
Deconstruct heavy background synchronization jobs into asynchronous worker queues orchestrated by Redis/Kafka.

## 4. Security & Compliance
- All inter-service traffic encrypted in transit via mTLS.
- Audit logging for all administrative schema migrations.

## 5. Rollout & Rollback Plan
1. Phase 1: Deploy new event bus in shadow mode.
2. Phase 2: Canary rollout (10% traffic routing).
3. Phase 3: Full cutover with 1-click fallback trigger.`,
    mermaidCode: `flowchart TD
    RFC[RFC-042: Architecture Spec] --> Proposed[Proposed Micro-Workers]
    Proposed --> Service1[Worker A: Auth & Tokens]
    Proposed --> Service2[Worker B: Canvas Sync]
    Proposed --> Service3[Worker C: Export Renderer]
    Service1 --> Redis[(Redis Queue)]
    Service2 --> Redis
    Service3 --> Redis`,
  },
  {
    key: 'blank',
    category: 'architecture',
    title: 'Blank Canvas & Doc',
    badge: 'Starter',
    desc: 'Start clean with a minimal starter canvas and markdown notes',
    icon: Layers,
    defaultTitle: 'Untitled System Design',
    defaultViewMode: 'both',
    docContent: `# System Architecture Notes

## Overview
Write your system specification, API contracts, and design considerations here.

## Key Components
- **Client**: Web / Mobile client
- **Service**: Core backend application
- **Database**: Primary persistence store

## Tasks
- [ ] Define data models
- [ ] Diagram system interactions
- [ ] Review security policies`,
    mermaidCode: `flowchart TD
    Client[Web Client] --> Gateway[API Gateway]
    Gateway --> Service[Core Service]
    Service --> DB[(Database)]`,
  },
];

interface CreateDiagramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  folderId?: string | null;
  initialTemplateKey?: StarterTemplateKey;
  onSuccess?: (diagramId: string) => void;
}

export function CreateDiagramDialog({
  open,
  onOpenChange,
  projectId,
  folderId,
  initialTemplateKey,
  onSuccess,
}: CreateDiagramDialogProps) {
  const router = useRouter();
  const { isDark } = useTheme();

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<StarterTemplateKey>('global-payment-system');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'architecture' | 'sequence' | 'database' | 'rfc'>('all');
  const [viewMode, setViewMode] = useState<'both' | 'canvas' | 'doc'>('both');
  const [title, setTitle] = useState(ERASER_STARTER_TEMPLATES[0].defaultTitle);
  const [customMermaid, setCustomMermaid] = useState(ERASER_STARTER_TEMPLATES[0].mermaidCode);
  const [customDoc, setCustomDoc] = useState(ERASER_STARTER_TEMPLATES[0].docContent);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state when dialog opens or initialTemplateKey is selected from dashboard
  React.useEffect(() => {
    if (open && initialTemplateKey) {
      const tpl = ERASER_STARTER_TEMPLATES.find((t) => t.key === initialTemplateKey);
      if (tpl) {
        setSelectedTemplateKey(tpl.key);
        setTitle(tpl.defaultTitle);
        setViewMode(tpl.defaultViewMode);
        setCustomMermaid(tpl.mermaidCode);
        setCustomDoc(tpl.docContent);
      }
    }
  }, [open, initialTemplateKey]);

  const selectedTemplate = ERASER_STARTER_TEMPLATES.find((t) => t.key === selectedTemplateKey) || ERASER_STARTER_TEMPLATES[0];

  const handleSelectTemplate = (template: StarterTemplate) => {
    setSelectedTemplateKey(template.key);
    setTitle(template.defaultTitle);
    setViewMode(template.defaultViewMode);
    setCustomMermaid(template.mermaidCode);
    setCustomDoc(template.docContent);
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);
    try {
      const res = await apiClient.post('/ai/generate', { prompt: aiPrompt.trim() });
      if (res.data?.mermaidCode) {
        setCustomMermaid(res.data.mermaidCode);
        const generatedTitle = aiPrompt.slice(0, 40).trim() || 'AI Generated Architecture';
        setTitle(generatedTitle);
        setCustomDoc(`# ${generatedTitle}\n\n**Generated Specification from prompt:**\n> "${aiPrompt}"\n\n## Overview\nSystem architecture generated with Diagramz AI Copilot.\n\n## Components\n- Core services configured according to architectural specifications.\n\n## Next Steps\n- [ ] Review connection topology\n- [ ] Customize node properties\n- [ ] Export technical documentation`);
        toast.success('Architecture generated with AI!');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'AI generation failed. Please try again.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a diagram title');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Resolve Project ID if not supplied
      let targetProjectId = projectId;
      if (!targetProjectId) {
        const wsRes = await apiClient.get('/workspaces');
        if (wsRes.data?.length > 0) {
          const wsId = wsRes.data[0].id;
          const projRes = await apiClient.get(`/workspaces/${wsId}/projects`);
          if (projRes.data?.length > 0) {
            targetProjectId = projRes.data[0].id;
          } else {
            const newProj = await apiClient.post(`/workspaces/${wsId}/projects`, { name: 'Main Diagrams' });
            targetProjectId = newProj.data.id;
          }
        }
      }

      if (!targetProjectId) throw new Error('Could not find active workspace project');

      // 2. Generate initial canvas data
      const initialCanvasData = getEraserTemplate(selectedTemplateKey);

      // 3. Post diagram creation with dual documentContent + canvasData + viewMode
      const res = await apiClient.post(`/projects/${targetProjectId}/diagrams`, {
        title: title.trim(),
        folderId: folderId || null,
        viewMode: viewMode,
        documentContent: customDoc,
        mermaidCode: customMermaid,
        canvasData: initialCanvasData,
      });

      toast.success('Diagram & Spec created!');
      onOpenChange(false);

      if (onSuccess) {
        onSuccess(res.data.id);
      } else {
        router.push(`/diagram/${res.data.id}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to create diagram');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTemplates = ERASER_STARTER_TEMPLATES.filter((t) =>
    categoryFilter === 'all' ? true : t.category === categoryFilter,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl rounded-2xl border-border/60 bg-background/98 backdrop-blur-xl p-0 shadow-2xl overflow-hidden gap-0">
        {/* Header Bar */}
        <div className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Columns2 className="size-4.5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <span>Create Diagram & Spec</span>
                  <Badge variant="outline" className="text-[10px] font-medium py-0 px-2 border-border/70 text-muted-foreground">
                    Eraser Mode
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Dual-entity technical workspace: Markdown documentation linked with an infinite diagram canvas.
                </DialogDescription>
              </div>
            </div>

            {/* Eraser-Style Starting View Mode Toggle */}
            <div className="flex items-center p-0.5 rounded-lg bg-muted/60 border border-border/50">
              <button
                type="button"
                onClick={() => setViewMode('both')}
                className={cn(
                  'h-7 px-2.5 text-xs rounded-md font-medium flex items-center gap-1.5 transition-all cursor-pointer',
                  viewMode === 'both'
                    ? 'bg-background text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                title="Split View: Markdown Doc on Left, Canvas on Right"
              >
                <Columns2 className="size-3.5" />
                <span>Both</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('canvas')}
                className={cn(
                  'h-7 px-2.5 text-xs rounded-md font-medium flex items-center gap-1.5 transition-all cursor-pointer',
                  viewMode === 'canvas'
                    ? 'bg-background text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                title="Canvas Only Mode"
              >
                <Palette className="size-3.5" />
                <span>Canvas</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('doc')}
                className={cn(
                  'h-7 px-2.5 text-xs rounded-md font-medium flex items-center gap-1.5 transition-all cursor-pointer',
                  viewMode === 'doc'
                    ? 'bg-background text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                title="Document Only Mode"
              >
                <FileText className="size-3.5" />
                <span>Doc</span>
              </button>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreate} className="flex flex-col">
          <div className="p-6 space-y-5 max-h-[68vh] overflow-y-auto">
            {/* Title & Suggested Names */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="diagram-name" className="text-xs font-semibold text-foreground">
                  Diagram Title
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono border border-border/60">Enter</kbd> to launch
                </span>
              </div>
              <Input
                id="diagram-name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Auth Microservice & Token Exchange"
                required
                className="h-9.5 text-xs rounded-xl border-border/70 bg-muted/20 focus:bg-background transition-colors font-medium"
              />
            </div>

            {/* AI Architecture Fast-Prompt */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" />
                  <span>AI Architecture Copilot</span>
                </span>
                <span className="text-[10px] text-muted-foreground">Generate architecture & spec from text</span>
              </div>
              <div className="flex gap-2">
                <Input
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. E-commerce checkout with Stripe webhook, inventory worker, and PostgreSQL"
                  className="h-8.5 text-xs rounded-lg border-primary/20 bg-background/80 focus:bg-background"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAiGenerate();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={isGeneratingAi || !aiPrompt.trim()}
                  onClick={handleAiGenerate}
                  className="h-8.5 px-3 text-xs gap-1.5 rounded-lg shrink-0 font-medium cursor-pointer"
                >
                  {isGeneratingAi ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-primary" />}
                  <span>{isGeneratingAi ? 'Generating...' : 'Generate'}</span>
                </Button>
              </div>
            </div>

            {/* Template Category Filters */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">
                  Starter Architecture Templates
                </Label>
                <div className="flex items-center gap-1">
                  {(['all', 'architecture', 'sequence', 'database', 'rfc'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={cn(
                        'px-2 py-0.5 rounded-md text-[11px] font-medium capitalize transition-colors cursor-pointer',
                        categoryFilter === cat
                          ? 'bg-muted text-foreground font-semibold'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {filteredTemplates.map((tpl) => {
                  const Icon = tpl.icon;
                  const isSelected = selectedTemplateKey === tpl.key;
                  return (
                    <button
                      key={tpl.key}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl)}
                      className={cn(
                        'relative p-3 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between h-[106px] cursor-pointer group',
                        isSelected
                          ? 'bg-primary/10 border-primary/50 ring-1 ring-primary/40 shadow-xs'
                          : 'bg-card/50 border-border/60 hover:bg-muted/40 hover:border-border text-muted-foreground',
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              'size-6 rounded-lg flex items-center justify-center transition-colors',
                              isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground group-hover:bg-primary/10 group-hover:text-primary',
                            )}>
                              <Icon className="size-3.5" />
                            </div>
                            <span className={cn('text-xs font-semibold leading-tight line-clamp-1', isSelected ? 'text-foreground' : 'text-foreground/90')}>
                              {tpl.title}
                            </span>
                          </div>
                          {isSelected && (
                            <span className="size-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground shrink-0">
                              <Check className="size-2.5 stroke-[3]" />
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">
                          {tpl.desc}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 mt-2">
                        <Badge variant="outline" className="text-[9px] py-0 px-1.5 font-medium border-border/60 bg-background/50">
                          {tpl.badge}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground/70">
                          Doc + Canvas
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Template Inspector Accordion (Mermaid & Doc Preview) */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] font-semibold">
                    {selectedTemplate.badge}
                  </Badge>
                  <span className="text-xs font-medium text-foreground">
                    Included in this diagram
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCodeEditor(!showCodeEditor)}
                  className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Code2 className="size-3" />
                  <span>{showCodeEditor ? 'Hide Code' : 'Customize Code & Notes'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5 bg-background/60 p-2 rounded-lg border border-border/40">
                  <FileText className="size-3.5 text-primary shrink-0" />
                  <span className="truncate">Auto-generated Technical RFC document</span>
                </div>
                <div className="flex items-center gap-1.5 bg-background/60 p-2 rounded-lg border border-border/40">
                  <Palette className="size-3.5 text-emerald-500 shrink-0" />
                  <span className="truncate">Pre-rendered visual canvas nodes</span>
                </div>
              </div>

              {showCodeEditor && (
                <div className="pt-2 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-mono text-muted-foreground">
                      Mermaid Diagram Definition
                    </Label>
                    <Textarea
                      rows={4}
                      value={customMermaid}
                      onChange={(e) => setCustomMermaid(e.target.value)}
                      className="resize-none font-mono text-xs rounded-lg border-border/60 bg-background/90"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-mono text-muted-foreground">
                      Markdown Document Initial Notes
                    </Label>
                    <Textarea
                      rows={3}
                      value={customDoc}
                      onChange={(e) => setCustomDoc(e.target.value)}
                      className="resize-none font-mono text-xs rounded-lg border-border/60 bg-background/90"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Bar */}
          <DialogFooter className="px-6 py-3.5 border-t border-border/50 bg-muted/20 flex items-center justify-between sm:justify-between gap-3">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span>Mode:</span>
              <strong className="text-foreground capitalize">{viewMode}</strong>
              <span>•</span>
              <span>Template:</span>
              <strong className="text-foreground">{selectedTemplate.title}</strong>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8.5 text-xs rounded-xl border-border/70"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="h-8.5 px-4 text-xs gap-1.5 rounded-xl font-medium shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Launching Workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Create & Open</span>
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
