# Diagramz System Architecture

## 1. Monorepo Topology (Turborepo + pnpm)

```text
diagramz/
├── apps/
│   ├── web/                  # Next.js 15 App Router frontend (hosted on Vercel)
│   │   └── src/
│   │       ├── app/          # Routes: /, /login, /register, /dashboard, /diagram/[id], /share/[token]
│   │       ├── components/   # UI, Canvas wrappers, DocumentEditor, MermaidEditor, AiAssistant
│   │       ├── hooks/        # useCollab (Yjs + Socket.io), use-theme
│   │       ├── stores/       # Zustand stores (diagram.store.ts, auth.store.ts)
│   │       └── lib/
│   │           └── zcanvaskit/ # Framework-agnostic core canvas & diagramming engine
│   └── api/                  # NestJS 11 REST + WebSocket API (hosted on MonsterASP)
│       └── src/
│           ├── common/       # Guards (JWT, WorkspaceRoles), Pipes (ZodValidationPipe), Decorators
│           ├── database/     # Drizzle ORM schema.ts, client, and PostgreSQL RLS migrations
│           └── modules/      # auth, workspaces, projects, folders, diagrams, collab, ai, export, notifications
├── packages/
│   └── shared/               # @diagramz/shared: Zod contracts, DTOs, and TypeScript interfaces
└── scripts/
    └── package-monsterasp.mjs # Bundles NestJS API into a single file via @vercel/ncc for IIS hosting
```

---

## 2. Core Canvas Engine (`zcanvaskit`)

Located at [`apps/web/src/lib/zcanvaskit`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit), `zcanvaskit` is a modular diagramming engine designed around strict separation of concerns:

- **`core/`**:
  - `schema.ts`: Versioned `ZCanvasDocument` model (`nodes`, `edges`, `strokes`, `viewport`).
  - `layout-beautifier.ts`: `beautifyArchitectureLayout()` — automatic hierarchical graph layout, container bounding-box enclosure, and connector channel routing.
  - `boundaries.ts` & `grouping.ts`: VPC/frame containment (`encloses`, `childIdsOf`) and multi-level node grouping.
  - `history/`: Transaction-based undo/redo stack (`ZCanvasHistory`).
  - `clipboard/`: Internal & system clipboard serialization for nodes, edges, and freehand ink strokes.
- **`geometry/`**:
  - Bezier & orthogonal step path routing, multi-connection port offsets, label collision resolution, alignment guides, and resize handle math.
- **`stencils/`**:
  - `architecture.ts`, `tech-icons.ts`, `standard-shapes.ts`: Vector stencils and unified drag-and-drop payload (`ZCANVAS_ITEM_MIME = 'application/x-diagramz-item'`).
- **`export/`**:
  - `svg.ts`, `png.ts`, `pdf.ts`: High-DPI (up to 4K / 3x) vector and raster exporters + live SVG thumbnail generator.
- **`react/`**:
  - `ZCanvas.tsx`: Interactive infinite canvas component.
  - `ZCanvasToolbar.tsx`: Draggable floating tool dock.
  - `ZCanvasStylePanel.tsx`: Right-hand contextual appearance inspector (`top-20 right-4`).
  - `ZCanvasContextMenu.tsx`: Right-click context menu with alignment, layering, grouping, and auto-layout actions.

---

## 3. Production Networking & Reverse Proxy Architecture

- **Frontend Host**: Vercel (`https://*.vercel.app`)
- **Backend Host**: MonsterASP.NET Free Tier (`http://diagramz.runasp.net`)
- **Database**: MonsterASP PostgreSQL (`db74181.public.databaseasp.net:5432`)
- **Reverse Proxy Pattern**:
  - Because MonsterASP's free tier serves `*.runasp.net` over `http://` only, browser requests from an `https://` Vercel origin directly to `http://diagramz.runasp.net` would be blocked by browser Mixed-Content security.
  - **Solution**: [`apps/web/next.config.ts`](file:///D:/Projects/diagramz/apps/web/next.config.ts) rewrites `/api/v1/:path*` to `http://diagramz.runasp.net/api/v1/:path*` server-to-server.
  - [`apps/web/src/lib/api.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/api.ts) enforces relative `/api/v1` base URLs whenever `window.location.protocol === 'https:'`, eliminating both Mixed-Content errors and CORS preflight (`OPTIONS`) latency.
