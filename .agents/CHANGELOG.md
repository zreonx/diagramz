# Diagramz Changelog

All notable architectural changes, features, bug fixes, and deployment milestones for **Diagramz** are documented in this file.

---

## [2026-10-24] — AWS Architecture Stencils, Draw.io Line Management, Entity-Relationship (ERD) & Draw.io Grouping

### Added
- **Draw.io Group Selection, Double-Click Drill-Down & Collective Resizing** ([`grouping.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/core/grouping.ts), [`grouping.test.mjs`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/core/grouping.test.mjs), [`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx), [`ZCanvasStylePanel.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvasStylePanel.tsx)):
  - **Draw.io Single-Click Group Selection vs Double-Click Drill-Down**: Single-clicking any grouped component selects the entire group as a unified unit; member nodes hide individual resize/rotate handles to prevent visual clutter. Double-clicking any child component inside the group enters the group (`enteredGroupId`) and selects only that individual child without triggering text editing, displaying its own 8 resize handles, rotation handle, and 4 quick-clone arrows. A subsequent double-click on the selected child opens inline text editing. Single-clicking sibling nodes inside the entered group selects them directly, and pressing `Escape` (or clicking the group header pill) steps out back to selecting the whole group.
  - **Group Frame Header Pill & Collective 8-Point Resizing**: Group frames display a floating header pill (`Group (N) · Double-click item to select` + 1-click `Ungroup` button when outer group is selected; `Inside Group · Click or Esc to select group` when drilled down). When 2+ nodes are selected (in a group or multi-selection), 8 collective resize handles (`NW, N, NE, E, SE, S, SW, W`) scale all members proportionally via `scaleNodesInBox`.
  - **Batch Styling, Match Width & Match Height in Style Panel**: Adjusting colors, strokes, sloppiness, or typography in `ZCanvasStylePanel` when multiple elements or groups are selected applies to all items simultaneously. Added 1-click **Group (`Ctrl+G`)**, **Ungroup (`Ctrl+Shift+G`)**, **Match Width**, and **Match Height** buttons to the inspector panel.
- **Entity-Relationship (ERD) Crow's Foot Notation & Column-Level Relationships** ([`schema.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/core/schema.ts), [`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx), [`ZCanvasStylePanel.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvasStylePanel.tsx), [`export/svg.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/export/svg.ts), [`eraser-templates.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/eraser-templates.ts), [`ComponentLibraryPanel.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/ComponentLibraryPanel.tsx)):
  - **Crow's Foot ER Cardinality Markers**: Added `er-one` (`||` Exactly One), `er-zero-one` (`o|` Zero or One), `er-many` (`|<` One or Many), and `er-zero-many` (`o<` Zero or Many) arrowheads across `schema.ts`, live canvas SVG `<marker>` defs, `exportDocumentToSvg`, and `ZCanvasStylePanel`.
  - **1-Click ER Cardinality Presets & Table Columns Inspector**: Added 1-click relationship presets (`1 : 1`, `1 : N`, `0..1 : N`, `N : M`) in `ZCanvasStylePanel` when a connector is selected, plus a dedicated **Entity columns (`PK` / `FK`)** editor when a `table` node is selected.
  - **Row-Level Field Connection Ports & Interactive `PK` / `FK` Badges on `table` Nodes**: Every column row of a `table` node displays clickable `PK` (amber) and `FK` (sky) badge pills and row-level Left & Right connection ports (`erd-row-anchor-left-*` / `erd-row-anchor-right-*`) so users can drag Crow's Foot foreign-key relationships directly from a specific column row to another column row. Connecting two `table` nodes automatically defaults to `1 : N` (`er-one` $\rightarrow$ `er-many`, `step` routing).
  - **Mermaid `erDiagram` Cardinality Mapping & ERD Stencil Presets**: `parseMermaidToEraser` now maps Mermaid `erDiagram` relationship operators (`||--o{`, `||--|{`, `}o--o{`, `||--||`) into Crow's Foot `startArrowhead` / `endArrowhead`, and `ComponentLibraryPanel.tsx` includes ready-to-drop **Entity Table (`PK`/`FK`)**, **Join / Pivot Table (`N:M`)**, and **Relational ERD Schema (Crow's Foot)** templates.
- **Draw.io Line & Connector Management** ([`geometry/index.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/geometry/index.ts), [`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx), [`ZCanvasStylePanel.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvasStylePanel.tsx), [`ZCanvasContextMenu.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvasContextMenu.tsx)):
  - **Interactive Multi-Waypoints & Virtual Segment Midpoints (`edge.waypoints`)**: Every segment of a selected line displays a blue Draw.io virtual midpoint handle (`edge-virtual-midpoint-*`); dragging any segment midpoint inserts a new custom bend/waypoint. Existing custom waypoints (`edge-waypoint-*`) snap orthogonally (`x`/`y` alignment guides within `8px` of adjacent vertices) when dragged and can be deleted by double-clicking.
  - **Smart Orthogonal L-Bends & U-Turn Jetties**: `computeOrthogonalStepPath` now routes perpendicular port pairs (e.g., `right -> top`, `bottom -> left`) via crisp 2-segment L-bends and same-side port pairs (`top -> top`, `right -> right`, etc.) via a `28px` outer jetty.
  - **Full `Straight` Routing Support on Connected Nodes**: Added `Straight` alongside `Step` and `Curve` in `ZCanvasStylePanel` and context menu routing cycle (`Step -> Curve -> Straight`), and updated `computeEdgeGeometry` so connected nodes support direct straight/polyline routing.
  - **Live Magnetic Target Snapping on New Connections**: Dragging a new connection wire from a shape anchor highlights hovered target shapes with a magnetic outline, pulsing target reticle (`drawio-connect-target-reticle`), and live `step` / `bezier` / `straight` path preview.
  - **6 Arrowheads, Flow Animation & Reverse Direction**: Exposed all 6 arrowheads (`None`, `Arrow`, `Barbs`, `Triangle`, `Circle`, `Diamond`), **Flow Animation (marching ants)** toggle (`edge.animated`), **Reverse Line Direction**, and **Clear Waypoints** in `ZCanvasStylePanel` and `ZCanvasContextMenu`.
- **26 AWS Architecture Service Stencils** ([`tech-icons.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/stencils/tech-icons.ts), [`registry.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/stencils/registry.ts), [`ComponentLibraryPanel.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/ComponentLibraryPanel.tsx)):
  - Added 26 vector AWS service icons across Compute (`EC2`, `Lambda`, `ECS`, `EKS`, `Fargate`), Storage (`S3`, `EBS`, `EFS`), Databases (`RDS`, `DynamoDB`, `Aurora`, `ElastiCache`), Networking (`VPC`, `CloudFront`, `Route 53`, `API Gateway`, `ELB`), Integration (`SQS`, `SNS`, `EventBridge`, `Step Functions`), and Security/Observability (`IAM`, `Cognito`, `CloudWatch`, `KMS`, `WAF & Shield`) with authentic AWS brand colors.
  - Added a dedicated **AWS** tab in [`ComponentLibraryPanel.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/ComponentLibraryPanel.tsx) and exposed `AWS (Amazon Web Services)` inside the main Architecture tab and Command Palette (`Ctrl+K`).
- **Draw.io Directional Quick-Clone & Connect Chevrons (`N`, `E`, `S`, `W`)** ([`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx)):
  - Selecting a single node displays 4 directional arrows (`↑`, `→`, `↓`, `←`) outside its bounding box; clicking any arrow clones the node in that direction with a 120px gap and connects an edge in one click.
- **Draw.io Drop-Connector-on-Empty-Space Node Spawn** ([`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx)):
  - Dragging a connector wire from an anchor handle and releasing over empty canvas space (`>= 60px` away) automatically spawns and connects a target node at the drop point.
- **Double-Click Empty Canvas Quick-Create & Precision Keyboard Nudging** ([`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx)):
  - Double-clicking empty canvas background spawns a shape at the cursor and immediately opens inline label editing.
  - Added `Alt + Arrow` (`1px` pixel-perfect micro-nudge), `Arrow` (`10px` grid step), and `Shift + Arrow` (`20px` fast step).

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
- **AI Agent Harness (`.agents/`)**:
  - Established `.agents/ARCHITECTURE.md`, `.agents/CHANGELOG.md`, `.agents/HANDOFF.md`, `.agents/rules/`, and `.agents/skills/` for seamless multi-session AI engineering.

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
