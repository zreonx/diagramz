```markdown
# AGENT DIRECTIVE: Build "Diagramz" (Full-Stack Production System)

> **Role & Objective:** You are an autonomous Principal Full-Stack Engineer and Systems Architect. Your objective is to build, configure, and ship **Diagramz**—an AI-powered, real-time collaborative diagramming workspace combining the fluid canvas UX of Eraser.io, diagram-as-code capabilities of Mermaid.js, and structured LLM generation.
> 
> **Execution Mode:** Implement step-by-step following the phases in Section 13. Maintain strict TypeScript compilation with zero `any` types. Verify each phase before progressing to the next.

---

## 1. Executive Summary & Core Requirements

- **Application Name:** Diagramz
- **Architecture Pattern:** Decoupled Monorepo (`apps/web` for Next.js, `apps/api` for NestJS, `packages/shared` for cross-cutting types/DTOs).
- **Target Deployment:** 
  - `apps/web`: Vercel (Edge/Serverless SSR).
  - `apps/api`: Long-running Linux Container on Railway / Fly.io / Render (Required for stateful WebSocket connections, Yjs synchronization rooms, and BullMQ worker execution).
- **Persistence:** Neon Serverless PostgreSQL with connection pooling & transaction-scoped Row-Level Security (RLS).
- **Object Storage:** Cloudflare R2 (S3-compatible, zero egress costs).
- **Real-Time Collaboration:** Yjs CRDTs over Socket.IO binary streams with ephemeral cursor/presence awareness.
- **AI Engine:** Provider abstraction layer (OpenAI / Anthropic) generating strict, syntactically validated Mermaid code—never unconstrained canvas coordinates.

---

## 2. Monorepo Repository Structure

```text
diagramz/
├── .github/
│   └── workflows/ci.yml
├── apps/
│   ├── web/                         # Next.js 15+ (App Router, React 19)
│   │   ├── src/
│   │   │   ├── app/                 # Routes & Layouts
│   │   │   ├── components/          # shadcn/ui, Canvas, Editor, AI Chat
│   │   │   ├── hooks/               # useCollab, useCanvasSync, useAuth
│   │   │   ├── lib/                 # Axios, Yjs Provider, Canvas Utilities
│   │   │   └── stores/              # Zustand state stores
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   └── api/                         # NestJS 10+ Modular API
│       ├── src/
│       │   ├── common/              # Decorators, Guards, Interceptors, Filters
│       │   ├── database/            # Drizzle client, migrations, schema definitions
│       │   ├── modules/
│       │   │   ├── auth/            # JWT, Refresh tokens, Passport strategies
│       │   │   ├── users/           # User profiles and preferences
│       │   │   ├── workspaces/      # Workspaces, memberships, invites, RBAC
│       │   │   ├── projects/        # Workspace-scoped projects
│       │   │   ├── diagrams/        # Diagram metadata & canvas persistence
│       │   │   ├── collab/          # Socket.IO Gateway & Yjs CRDT sync provider
│       │   │   ├── ai/              # LLM client, prompt engineering, SSE streams
│       │   │   ├── render/          # Mermaid-cli / Puppeteer SVG/PNG renderer
│       │   │   ├── export/          # BullMQ queue producers and background workers
│       │   │   ├── storage/         # Cloudflare R2 S3 SDK client wrapper
│       │   │   └── audit/           # Audit logging event listener
│       │   ├── app.module.ts
│       │   └── main.ts
│       ├── Dockerfile               # Container build with Chromium dependencies
│       └── package.json
│
├── packages/
│   └── shared/                      # Shared types, Zod schemas, API contracts
│       ├── src/
│       │   ├── contracts/
│       │   ├── types/
│       │   └── index.ts
│       └── package.json
│
├── package.json                     # Turborepo / pnpm workspace root
├── pnpm-workspace.yaml
└── turbo.json
```

---

## 3. Data Model & Database Schema (Drizzle ORM)

File path: `apps/api/src/database/schema.ts`

```typescript
import { 
  pgTable, text, timestamp, uuid, boolean, jsonb, 
  pgEnum, unique, index 
} from 'drizzle-orm/pg-core';

export const workspaceRoleEnum = pgEnum('workspace_role', ['owner', 'admin', 'editor', 'viewer']);
export const collaboratorRoleEnum = pgEnum('collaborator_role', ['editor', 'viewer']);

// 1. Users
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Refresh Tokens (Rotation & Session Invalidation)
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 3. Workspaces
export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 4. Workspace Members
export const workspaceMembers = pgTable('workspace_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: workspaceRoleEnum('role').default('editor').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique().on(t.workspaceId, t.userId),
  index('idx_workspace_members_user').on(t.userId),
]);

// 5. Workspace Invitations
export const workspaceInvitations = pgTable('workspace_invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  email: text('email').notNull(),
  role: workspaceRoleEnum('role').default('editor').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 6. Projects
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_projects_workspace').on(t.workspaceId),
]);

// 7. Diagrams (Metadata & References Only)
export const diagrams = pgTable('diagrams', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  mermaidCode: text('mermaid_code'),
  thumbnailKey: text('thumbnail_key'),
  isPublic: boolean('is_public').default(false).notNull(),
  shareToken: text('share_token').unique(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_diagrams_project').on(t.projectId),
]);

// 8. Diagram Canvases (Isolated to prevent heavy JSON query degradation)
export const diagramCanvases = pgTable('diagram_canvases', {
  diagramId: uuid('diagram_id').references(() => diagrams.id, { onDelete: 'cascade' }).primaryKey(),
  canvasData: jsonb('canvas_data').notNull(), // Excalidraw elements & state
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 9. Diagram Versions (Checkpoints)
export const diagramVersions = pgTable('diagram_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  diagramId: uuid('diagram_id').references(() => diagrams.id, { onDelete: 'cascade' }).notNull(),
  canvasData: jsonb('canvas_data').notNull(),
  mermaidCode: text('mermaid_code'),
  versionName: text('version_name'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_diagram_versions_diagram').on(t.diagramId),
]);

// 10. Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_audit_logs_workspace').on(t.workspaceId),
]);
```

---

## 4. Neon RLS Policies & Connection Isolation

Postgres RLS requires an injected session variable when querying through a single connection pool.

### Application Query Wrapper (`apps/api/src/database/rls.service.ts`)
```typescript
import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { db } from './drizzle.client';

@Injectable()
export class RlsContextService {
  async executeWithUser<T>(userId: string, callback: (tx: any) => Promise<T>): Promise<T> {
    return await db.transaction(async (tx) => {
      // Set session variable locally for the current transaction only (is_local = true)
      await tx.execute(sql`SELECT set_config('request.jwt.claim.sub', ${userId}, true)`);
      return await callback(tx);
    });
  }
}
```

### PostgreSQL Policies (`apps/api/src/database/migrations/0001_rls.sql`)
```sql
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagrams ENABLE ROW LEVEL SECURITY;

-- Workspaces: Read if member
CREATE POLICY workspace_member_read ON workspaces
  FOR SELECT
  USING (
    id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );

-- Workspaces: Update/Delete if owner
CREATE POLICY workspace_owner_write ON workspaces
  FOR ALL
  USING (
    owner_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
  );

-- Diagrams: Read if public OR if user belongs to parent workspace
CREATE POLICY diagram_access_policy ON diagrams
  FOR SELECT
  USING (
    is_public = true OR
    project_id IN (
      SELECT p.id FROM projects p
      JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE wm.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
```

---

## 5. Permissions Matrix (RBAC)

Enforce at the application layer via NestJS `WorkspaceRolesGuard` and Drizzle queries:

| Capability | Owner | Admin | Editor | Viewer |
|:---|:---:|:---:|:---:|:---:|
| Delete Workspace |  | ❌ | ❌ | ❌ |
| Manage Workspace Settings & Billing |  | ❌ | ❌ | ❌ |
| Invite Members / Revoke Membership |  |  | ❌ | ❌ |
| Change Member Roles |  |  *(Non-owners only)* | ❌ | ❌ |
| Create / Delete Projects |  |  |  *(Create only)* | ❌ |
| Create & Edit Diagrams |  |  |  | ❌ |
| Delete Diagrams |  |  |  *(Own only)* | ❌ |
| Trigger AI Diagram Generation |  |  |  | ❌ |
| View & Export (PNG/PDF/SVG) |  |  |  |  |

---

## 6. Real-Time Collaboration & Yjs Architecture

The real-time layer operates over WebSockets managed by NestJS `@WebSocketGateway()` with rooms scoped by `diagramId`.

### Room & Sync Lifecycle
1. **Join:** Client sends `diagram:join` with JWT and `diagramId`. Gateway validates access against database/cache.
2. **Initial State (Sync Step 1):** Gateway fetches the Yjs document state vector from Redis / memory, constructs sync update binary, and emits `yjs:sync`.
3. **Continuous Editing:**
   - Client sends binary updates (`yjs:update`, typed as `Uint8Array`).
   - Gateway applies update to server-side `Y.Doc` instance.
   - Gateway broadcasts `yjs:update` to all other sockets in room `diagram:${diagramId}`.
4. **Presence Awareness:**
   - Ephemeral cursor coordinates `(x, y)` and element selections are broadcast via `presence:update` without persisting to database.
5. **Periodic Snapshot Persistence:**
   - Every 30 seconds of inactivity or every 50 updates, the server flushes current `Y.Doc` state to PostgreSQL (`diagram_canvases.canvasData`).

---

## 7. AI Module Design & Prompt Safeguards

The AI engine orchestrates structured diagram generation. It **must never produce raw element coordinates**.

### Generation Flow
1. User provides prompt: *"Create an event-driven architecture using Kafka, Order Service, and Notification Service."*
2. Backend calls LLM provider with system prompts enforcing Mermaid.js grammar.
3. Backend validates Mermaid syntax using an automated syntax-parsing pass before delivering to the client.
4. Response is streamed to the frontend via Server-Sent Events (SSE).

### Strict System Prompt Specification
```text
You are an expert system architect and diagram designer for Diagramz.
Your task is to convert natural language instructions into strict, syntactically valid Mermaid.js diagrams.

Rules:
1. Always output valid Mermaid.js enclosed within ```mermaid and ``` blocks.
2. Never output arbitrary layout coordinates, HTML, or unsupported Markdown styles.
3. Allowed diagram types: flowchart (TD, LR), sequenceDiagram, classDiagram, erDiagram, stateDiagram-v2, mindmap.
4. Maintain clean, descriptive node labels and consistent directionality.
5. Accompany the code with a concise (2-3 sentences) architectural explanation outside the code block.
```

---

## 8. Asynchronous Export Pipeline (BullMQ + Mermaid CLI)

High-resolution PNG and PDF exports require headless browser rendering, handled by BullMQ background workers:

1. **Job Enqueue:** `POST /api/v1/export/queue` enqueues `{ diagramId, format: 'png' | 'pdf', scale: 2 }`.
2. **Job Processing (`export.worker.ts`):**
   - Retrieves latest Mermaid code or Excalidraw JSON.
   - Invokes `@mermaid-js/mermaid-cli` (Chromium running in isolated container sandbox).
   - Generates output buffer.
   - Uploads asset to Cloudflare R2 bucket with key: `exports/${diagramId}/${jobId}.${format}`.
   - Updates job status in Redis with presigned download URL (1 hour expiry).
3. **Client Polling:** Frontend polls `/api/v1/export/status/:jobId` until status is `completed`, then triggers download.

---

## 9. API Reference

All routes are prefixed with `/api/v1`.

### Authentication
- `POST /auth/register` — Create account (`email`, `password`, `name`).
- `POST /auth/login` — Returns JWT Access Token, sets `refresh_token` in secure, HTTP-only cookie.
- `POST /auth/refresh` — Validates refresh token, emits rotated access/refresh pair.
- `POST /auth/logout` — Deletes session from DB and clears cookies.

### Workspaces & Projects
- `GET /workspaces` — Fetch all workspaces user is a member of.
- `POST /workspaces` — Create workspace (assigns creator as `owner`).
- `GET /workspaces/:slug` — Retrieve workspace details.
- `PATCH /workspaces/:id` — Update workspace name/slug (Owner/Admin).
- `DELETE /workspaces/:id` — Delete workspace (Owner only).
- `GET /workspaces/:id/members` — List members and roles.
- `POST /workspaces/:id/invitations` — Create invite link/email.
- `GET /workspaces/:workspaceId/projects` — List projects in workspace.
- `POST /workspaces/:workspaceId/projects` — Create project.

### Diagrams & Canvas
- `GET /projects/:projectId/diagrams` — List diagrams in project.
- `POST /projects/:projectId/diagrams` — Create new diagram.
- `GET /diagrams/:id` — Fetch diagram metadata and canvas JSON.
- `PATCH /diagrams/:id` — Save canvas state, Mermaid code, and title.
- `POST /diagrams/:id/versions` — Create checkpoint version.
- `POST /diagrams/:id/share` — Enable/disable public link sharing.
- `GET /share/:shareToken` — Public view of diagram (read-only).

### AI & Operations
- `POST /ai/generate` — Text prompt $\rightarrow$ validated Mermaid code.
- `POST /ai/chat` — Streaming conversational diagram refinement (SSE).
- `POST /export/queue` — Enqueue async export job.
- `GET /export/status/:jobId` — Check export progress.
- `POST /storage/presign` — Generate Cloudflare R2 presigned upload URL for thumbnails.

---

## 10. Frontend Architecture (Next.js)

### Dynamic Component Strategy
`@excalidraw/excalidraw` accesses `window`, `document`, and HTML5 Canvas primitives. It must be dynamically imported with SSR disabled:

```tsx
// apps/web/src/components/canvas/ExcalidrawWrapper.tsx
'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

export const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full h-full rounded-none" />,
  }
);
```

### Canvas UI Layout Hierarchy
```text
┌────────────────────────────────────────────────────────────────────────┐
│ Header: [Workspace Switcher] [Breadcrumbs]     [Collaborators] [Export]│
├────────────────────────────────────────────────────────────────────────┤
│ Floating Toolbar (Select, Rect, Diamond, Arrow, Text, AI Generator)    │
│                                                                        │
│ ┌──────────────────────────┐  ┌──────────────────────────────────────┐ │
│ │ Collapsible Side-Pane    │  │ Main Infinite Canvas                 │ │
│ │ • Mode A: Mermaid Code   │  │                                      │ │
│ │   (CodeMirror 6)         │  │ • Excalidraw Render Surface          │ │
│ │ • Mode B: AI Assistant   │  │ • Remote Cursors Overlay             │ │
│ │   (Streaming Chat)       │  │ • Active Selection Bounding Boxes   │ │
│ └──────────────────────────┘  └──────────────────────────────────────┘ │
│                                                                        │
│ Floating Status: Zoom Level, Auto-Save Status, Sync Indicator          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Environment Variables Specification

### Backend (`apps/api/.env`)
```bash
PORT=4000
NODE_ENV=production

# Neon PostgreSQL
DATABASE_URL="postgresql://authenticated_backend:password@ep-cool-pooler.neon.tech/diagramz?sslmode=require"
DATABASE_ADMIN_URL="postgresql://neondb_owner:password@ep-cool.neon.tech/diagramz?sslmode=require"

# JWT Config
JWT_ACCESS_SECRET="generate-a-minimum-64-char-secret-string"
JWT_REFRESH_SECRET="generate-a-minimum-64-char-refresh-string"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Redis
REDIS_URL="redis://default:token@cool-redis.upstash.io:6379"

# AI Keys
OPENAI_API_KEY="sk-proj-..."
ANTHROPIC_API_KEY="sk-ant-..."

# Cloudflare R2 Storage
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_ACCESS_KEY_ID="your-access-key-id"
R2_SECRET_ACCESS_KEY="your-secret-access-key"
R2_BUCKET_NAME="diagramz-assets"
R2_PUBLIC_URL="https://assets.diagramz.io"

# CORS
CORS_ORIGIN="https://diagramz.io,https://app.diagramz.io"
```

### Frontend (`apps/web/.env.production`)
```bash
NEXT_PUBLIC_APP_NAME="Diagramz"
NEXT_PUBLIC_API_URL="https://api.diagramz.io"
NEXT_PUBLIC_WS_URL="wss://api.diagramz.io"
NEXT_PUBLIC_R2_PUBLIC_URL="https://assets.diagramz.io"
```

---

## 12. Container Deployment Spec (`apps/api/Dockerfile`)

```dockerfile
FROM node:20-bullseye-slim AS base
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
RUN npm install -g pnpm

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN pnpm --filter @diagramz/shared build
RUN pnpm --filter @diagramz/api build

FROM base AS runner
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
```

---

## 13. Step-by-Step Implementation Roadmap

Execute the following phases sequentially. Ensure zero TypeScript or lint errors before advancing.

### Phase 1: Workspace & Tooling Setup
- [ ] Initialize pnpm monorepo with Turborepo (`apps/web`, `apps/api`, `packages/shared`).
- [ ] Configure root `tsconfig.json`, Prettier, and ESLint configurations.
- [ ] Configure `packages/shared` with standard DTO definitions and Zod schemas.

### Phase 2: Backend Core & Database Persistence
- [ ] Setup NestJS in `apps/api` with validation pipes and Swagger documentation.
- [ ] Configure Drizzle ORM connecting to Neon PostgreSQL.
- [ ] Write schema definitions (`users`, `workspaces`, `projects`, `diagrams`, etc.).
- [ ] Implement database migrations and apply Postgres RLS policies.
- [ ] Implement Auth Module (JWT generation, HTTP-only refresh rotation, Passport strategy).

### Phase 3: Workspaces, Projects, and RBAC
- [ ] Implement `WorkspacesModule` (CRUD, member invitations, role updates).
- [ ] Implement `ProjectsModule` scoped to workspaces.
- [ ] Implement `WorkspaceRolesGuard` to enforce the Permissions Matrix.
- [ ] Set up `AuditModule` using NestJS event emitters to log administrative events.

### Phase 4: Frontend Shell & Authentication
- [ ] Scaffold Next.js 15+ App Router application with Tailwind CSS v4 and shadcn/ui.
- [ ] Build `/login` and `/register` flows using React Hook Form + Zod.
- [ ] Create dashboard layout featuring workspace switcher, project sidebar, and user navigation.
- [ ] Implement workspace members and role management UI.

### Phase 5: Canvas & Diagram-as-Code Engine
- [ ] Mount `@excalidraw/excalidraw` in `apps/web` with SSR explicitly disabled.
- [ ] Embed CodeMirror 6 with Mermaid syntax highlighting in a resizable side-drawer.
- [ ] Implement debounced canvas persistence calling `PATCH /api/v1/diagrams/:id`.
- [ ] Configure Cloudflare R2 upload flow for diagram thumbnails.

### Phase 6: Real-Time Multi-User Collaboration
- [ ] Implement `CollabGateway` in NestJS using Socket.IO.
- [ ] Setup Yjs document management on the server; broadcast binary updates.
- [ ] Connect client-side Excalidraw instances to Yjs documents for real-time multiplayer editing.
- [ ] Render live remote cursor overlays with user badges and color-coding.

### Phase 7: AI Diagram Generation & Streaming
- [ ] Build `AiModule` in NestJS with OpenAI/Anthropic provider implementations.
- [ ] Write strict system prompts enforcing Mermaid.js grammar.
- [ ] Expose an SSE endpoint (`/api/v1/ai/chat`) for streaming interactive refinements.
- [ ] Build frontend AI sidebar permitting prompt submissions and direct diagram imports.

### Phase 8: Async Exports & Hardening
- [ ] Setup Redis and BullMQ queues for handling background render jobs.
- [ ] Implement `@mermaid-js/mermaid-cli` worker converting diagrams to high-res PNG/PDF.
- [ ] Create read-only shared preview page at `/share/[token]`.
- [ ] Run load, concurrency, and security checks across WebSocket and RLS layers.
```