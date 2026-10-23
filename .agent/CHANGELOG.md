# Diagramz Changelog

All notable architectural changes, features, bug fixes, and deployment milestones for **Diagramz** are documented in this file.

---

## [2026-10-24] — Version History, JSON Backups, Duplication, Live Previews & Agent Harness

### Added
- **Version History & Named Checkpoints UI** ([`VersionHistoryDialog.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/VersionHistoryDialog.tsx)):
  - Connected to `GET /diagrams/:id/versions` and `POST /diagrams/:id/versions`.
  - Users can save named checkpoints (with node/edge statistics) and restore any historical snapshot in one click.
- **Editable `.diagramz.json` Export & Import** ([`CanvasHeader.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/CanvasHeader.tsx)):
  - Added `JSON` format option to the Export dialog to download full `.diagramz.json` bundles (`canvasData`, `mermaidCode`, `documentContent`, `viewMode`).
  - Added one-click `.json` / `.diagramz.json` file import to restore backups directly onto the canvas.
- **1-Click Diagram Duplication** ([`CanvasHeader.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/CanvasHeader.tsx), [`dashboard/page.tsx`](file:///D:/Projects/diagramz/apps/web/src/app/dashboard/page.tsx)):
  - Added Duplicate button in the Canvas Header and Dashboard card dropdown menus (Grid & List views).
- **Live SVG Thumbnail Previews on Dashboard Cards** ([`diagram.store.ts`](file:///D:/Projects/diagramz/apps/web/src/stores/diagram.store.ts), [`dashboard/page.tsx`](file:///D:/Projects/diagramz/apps/web/src/app/dashboard/page.tsx)):
  - Auto-generates a lightweight vector SVG data URL via `exportDocumentToSvg` during `saveDiagram()` and persists it to `thumbnailKey`.
  - Dashboard cards now render live miniature visual previews of each diagram.
- **AI Agent Harness (`.agent/`)**:
  - Established `.agent/ARCHITECTURE.md`, `.agent/CHANGELOG.md`, `.agent/HANDOFF.md`, `.agent/rules/`, and `.agent/skills/` for seamless multi-session AI engineering.

---

## [2026-10-23] — Power-User Canvas Features & Ergonomics

### Added
- **1-Click Auto-Layout / Beautify Architecture** ([`CanvasHeader.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/CanvasHeader.tsx), [`DiagramCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/DiagramCanvas.tsx), [`ZCanvasContextMenu.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvasContextMenu.tsx)):
  - Exposed `beautifyArchitectureLayout` in the top header bar and canvas right-click context menu.
- **Canvas Quick Command Palette (`Ctrl+K` / `/`)** ([`CanvasCommandPalette.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/CanvasCommandPalette.tsx)):
  - Keyboard-first spotlight dialog to search and drop architecture stencils, basic shapes, or trigger layout and view actions.
- **Inline Diagram Title Renaming** ([`CanvasHeader.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/CanvasHeader.tsx)):
  - Click-to-edit title directly in the canvas header with `Enter` to commit and `Escape` to cancel.

### Fixed
- **WebSocket HTTPS Mixed-Content Guard** ([`useCollab.ts`](file:///D:/Projects/diagramz/apps/web/src/hooks/useCollab.ts)):
  - Prevented browser `blocked:mixed-content` console errors on HTTPS origins when `NEXT_PUBLIC_WS_URL` is not an explicit `wss://` endpoint.
- **Backend Default `viewMode` Sync** ([`diagrams.service.ts`](file:///D:/Projects/diagramz/apps/api/src/modules/diagrams/diagrams.service.ts)):
  - Updated backend fallback from `'both'` to `'canvas'`.

---

## [2026-10-22] — Canvas-First Workspace Layout & Right-Hand Inspector

### Changed
- **Canvas-First Default View**:
  - Defaulted `viewMode` to `'canvas'` across [`diagram.store.ts`](file:///D:/Projects/diagramz/apps/web/src/stores/diagram.store.ts), [`CreateDiagramDialog.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/CreateDiagramDialog.tsx), [`dashboard/page.tsx`](file:///D:/Projects/diagramz/apps/web/src/app/dashboard/page.tsx), and [`WorkspaceFileTree.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/workspace/WorkspaceFileTree.tsx), with user preference persisted in `localStorage`.
  - Added floating **`Notes`** quick-open pill on the left canvas edge and a `PanelLeftClose` collapse button in [`DocumentEditor.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/editor/DocumentEditor.tsx).
- **Right-Hand Style Inspector**:
  - Repositioned [`ZCanvasStylePanel.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvasStylePanel.tsx) from `left-4` to `right-4` (`top-20 right-4`) so it never obstructs left-to-right diagramming flows.

---

## [2026-10-18] — Production Deployment (Vercel + MonsterASP + PostgreSQL)

### Added
- **MonsterASP Packaging Pipeline** ([`scripts/package-monsterasp.mjs`](file:///D:/Projects/diagramz/scripts/package-monsterasp.mjs)):
  - Single-file `@vercel/ncc` bundle of NestJS API with automated `web.config` IIS handler generation and Scalar API reference at `/docs`.
- **Vercel Reverse Proxy & Mixed-Content Protection** ([`apps/web/next.config.ts`](file:///D:/Projects/diagramz/apps/web/next.config.ts), [`apps/web/src/lib/api.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/api.ts)):
  - Configured Next.js rewrites to proxy `/api/v1/:path*` to `http://diagramz.runasp.net/api/v1/:path*`, providing zero-cost HTTPS termination and eliminating CORS preflight overhead.
