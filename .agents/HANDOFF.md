# Diagramz Session Handoff (`HANDOFF.md`)

> **Last Updated**: 2026-10-25
> **Branch**: `main`
> **Test Suite Status**: 589 passing (`0` failing)
> **Build Status**: `@diagramz/shared`, `@diagramz/api`, and `@diagramz/web` passing cleanly

---

## 1. Current Production Environment

| Component | Provider / Host | Endpoint / Details | Status |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | Vercel | `https://*.vercel.app` (Auto-deploys from `main`) | Online |
| **API Reverse Proxy** | Vercel Next.js Rewrites | `/api/v1/:path*` $\rightarrow$ `http://diagramz.runasp.net/api/v1/:path*` | Online |
| **Backend API** | MonsterASP.NET (IIS / iisnode) | `http://diagramz.runasp.net` (Docs: `/docs`) | Online |
| **Database** | MonsterASP PostgreSQL | `db74181.public.databaseasp.net:5432/db74181` | Online |

---

## 2. Recently Completed Work

1. **Comprehensive AWS Architecture Stencils Suite (14 New Official Services)**:
   - Added 14 official AWS service vector icons with exact 24×24 viewBox coordinates, brand hex palettes, and aliases:
     - **AWS Amplify** (`tech-aws-amplify`, `#FF9900`) — Frontend, mobile & web full-stack hosting.
     - **Amazon OpenSearch** (`tech-aws-opensearch`, `#005571`) — Distributed search and log analytics engine.
     - **Amazon Redshift** (`tech-aws-redshift`, `#3B48CC`) — Petabyte-scale cloud data warehouse.
     - **Amazon Kinesis** (`tech-aws-kinesis`, `#8C4FFF`) — Real-time event and data streams ingestion.
     - **Amazon SageMaker** (`tech-aws-sagemaker`, `#01A88D`) — Machine learning model training and inference.
     - **Amazon Bedrock** (`tech-aws-bedrock`, `#01A88D`) — Generative AI foundation models service.
     - **AWS Glue** (`tech-aws-glue`, `#8C4FFF`) — Serverless ETL and unified data catalog.
     - **AWS Secrets Manager** (`tech-aws-secretsmanager`, `#DD344C`) — Credential and API key rotation vault.
     - **Amazon Athena** (`tech-aws-athena`, `#8C4FFF`) — Serverless interactive SQL analytics.
     - **Amazon ECR** (`tech-aws-ecr`, `#ED7100`) — Elastic Container Registry for Docker/OCI images.
     - **AWS App Runner** (`tech-aws-apprunner`, `#ED7100`) — Fully managed container application runtime.
     - **AWS CloudTrail** (`tech-aws-cloudtrail`, `#E7157B`) — Governance, compliance, and API auditing log.
     - **AWS Auto Scaling** (`tech-aws-autoscaling`, `#ED7100`) — Dynamic EC2 and container fleet scaling.
     - **AWS AppSync** (`tech-aws-appsync`, `#E7157B`) — Managed real-time GraphQL API gateway.
   - Automatically indexed and filterable in the **Cloud / K8s** panel tab under the **AWS** chip and in architecture stencil search.
2. **Draw.io Standard Flowchart & BPMN Shapes**:
   - Added four fundamental flowchart node types to `ZCanvasNodeTypeSchema` and `ZCanvasTool`:
     - `document` — Flowchart process output / document with a smooth sinusoidal wavy bottom.
     - `parallelogram` — Data input/output transmission vertex with 20% angular slant.
     - `hexagon` — Preparation / loop initialization vertex with pointed lateral apexes.
     - `subroutine` — Predefined process / procedure with double vertical interior boundary bars.
   - Exportable to clean vector SVG with typography tspans and themed default appearances.
   - Available as 1-click draggable tiles in the Standard Shapes section of the Component Library.
3. **Enhanced Flow Connector Animation ("Marching Ants" Speed & Direction Controls)**:
   - Extended `ZCanvasEdgeSchema` with `animationSpeed?: 'slow' | 'normal' | 'fast'` and `animationDirection?: 'forward' | 'reverse'`.
   - Added inline speed segmented pill selector (`Slow (1.8s)`, `Normal (0.9s)`, `Fast (0.45s)`) and directional toggle (`➔ Forward`, `⬅ Reverse`) in `ZCanvasStylePanel` connector inspector.
4. **Collapsible Architecture Containers (Draw.io Subsystem Fold/Unfold)**:
   - Added `collapsed?: boolean` and `expandedHeight?: number` to `ZCanvasNodeSchema`.
   - Added interactive `[-]` (collapse) and `[+]` (expand) toggle button on container title bars.
   - Collapses complex VPC or namespace container boundaries to a clean 48px header pill, and expands back to original user height with a single click.
5. **Quick-Connect Directional Hover Arrows (Draw.io / Lucidchart Style)**:
   - When any single shape or card is selected, 4 blue directional quick-connect buttons appear outside the North, East, South, and West perimeter.
   - Clicking an arrow spawns a clone of the shape in that direction (spaced by an 80px gap), wires an auto-routed connector between them, selects the new shape, and focuses text editing.
   - Dragging an arrow pulls out an interactive connector wire to connect to another node or canvas space.
2. **Figma "Tidy Up" Grid & Equal-Gap Node Distribution**:
   - Built `distributeNodes` calculating exact variable-size bounds to enforce mathematically equal spacing between items on horizontal and vertical axes.
   - Built `tidyUpNodes` calculating optimal balanced grid layouts (columns = $\lceil\sqrt{N}\rceil$) with consistent 40px gaps.
   - Exposed 1-click **"Tidy Up Grid"** button in `ZCanvasStylePanel` multi-selection inspector.
3. **Miro / FigJam Sticky Notes**:
   - Added `'sticky-note'` node type with authentic pastel post-it appearance, soft drop shadow, custom folded dog-ear corner (`borderRadius: 2px 2px 14px 2px`), and multi-line double-click editing.
   - Added "Sticky Note" tile to Standard Shapes in Component Library with custom preview artwork.
4. **Copy Selection as High-Res PNG to Clipboard (`Ctrl+Shift+C`)**:
   - Added keyboard shortcut `Ctrl+Shift+C` and "Copy as PNG" action in Header More Actions menu.
   - Renders selected nodes/edges/strokes (or full canvas if unselected) as a 2x transparent PNG Blob directly into OS clipboard via `navigator.clipboard.write([new ClipboardItem(...)])`.
5. **Full Real-time Multiplayer Collaboration Stack**:
   - **Header Collaborator Stack & Popover** ([`CanvasHeader.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/CanvasHeader.tsx)): Overlapped peer avatars with colored borders and online status pulse, opening a live presence popover showing active teammate status (`Editing (N items)` vs `Viewing`) and invite shortcut.
   - **Live Multiplayer SVG Cursors & Selection Highlights** ([`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx)): Peer mouse cursors rendered in canvas world coordinates as Figma-style pointers with name badges, scaled with inverse zoom (`1 / viewport.zoom`) for consistent rendering across zoom levels. Real-time dashed bounding boxes around elements currently selected by teammates.
   - **WebSocket Sync Engine** ([`collab.gateway.ts`](file:///D:/Projects/diagramz/apps/api/src/modules/collab/collab.gateway.ts), [`collab.ts`](file:///D:/Projects/diagramz/packages/shared/src/types/collab.ts), [`useCollab.ts`](file:///D:/Projects/diagramz/apps/web/src/hooks/useCollab.ts), [`DiagramCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/DiagramCanvas.tsx)): `room:users` and `diagram:change` events with 40ms cursor throttling and local echo prevention guards.
2. **Figma-Grade Header Hierarchy & More Actions Dropdown**:
   - Reorganized header controls into clean semantic clusters: segmented pill for `[ ⊞ Stencils | ✦ AI Assistant | ⌨ Code ]`, elevated primary brand `Share` button, and consolidated secondary actions (`Auto Layout`, `Version History`, `Duplicate`, `Import JSON`) inside a Figma-style `···` (More) dropdown menu.
2. **Canvas & Page Properties Inspector**:
   - When no elements are selected, `ZCanvasStylePanel` displays active sheet properties (inline sheet name renaming, live node/edge statistics), instant 4-pill grid selector (`Dots`, `Mesh`, `Cross`, `None`), 4 background tone swatches (`Clean`, `Warm`, `Blueprint`, `Charcoal`), snapping and smart guides switches, and 1-click Auto Layout.
3. **Collapsible Inspector & Dynamic Drawer Collision Prevention**:
   - Added `PanelRightClose` minimize button to collapse the inspector into a compact `[ Sliders Inspector ]` tab.
   - Connected `rightOffset` from `DiagramCanvas.tsx` to `ZCanvas`: when the 384px AI Assistant or Mermaid Editor drawer opens, the inspector panel glides smoothly to `right-[400px]`, eliminating panel overlap.
4. **Bottom Status & Context HUD**:
   - Added floating context HUD centered above the bottom bar, showing live selection stats (`1 item selected · 140 × 80px`) or keyboard shortcuts (`Space Pan • / Quick Add • L Laser • F5 Present`).
5. **Quick Connect Picker (Draw.io / Eraser Drop Wire Popover)**:
   - When a user pulls a connector wire from an anchor handle and drops it on empty canvas space, a floating radial popover appears right at the drop point with 1-click presets: Clone Source (`1`), Step / Rectangle (`2`), Decision / Diamond (`3`), Service Card (`4`), Database Table (`5`), State / Circle (`6`), and Text Note (`7`).
   - Automatically connects the edge to the newly spawned node and focuses inline label editing.
2. **Smart Alignment Guidelines & Dynamic Spacing Snapping**:
   - Upgraded `calculateAlignmentGuides` to render finite spans with endpoint tick marks rather than infinite screen lines.
   - Dynamic equal-spacing badges (`↔ 30px`, `↕ 24px`) detected between aligned neighbor nodes.
3. **Line Jumps / Bridges on Crossing Connectors**:
   - Added `lineJumps?: 'none' | 'arc' | 'gap'` to `ZCanvasEdgeSchema`.
   - Built `findSegmentIntersection` and `injectLineJumps` inserting Draw.io semi-circular arc bridges or gaps at line crossings.
   - Configurable in `ZCanvasStylePanel` connector inspector (`None`, `Arc Bridge`, `Gap`).
4. **Multi-Point Connector Labels (`sourceLabel`, `label`, `targetLabel`)**:
   - Full support for source-side (e.g. `1`), center-side (`label`), and target-side (`0..*`) annotations in `schema.ts`, inspector panel, and live SVG canvas.
5. **24 Cloud Architecture Stencils (Kubernetes, GCP, Azure)**:
   - Added 8 Kubernetes stencils, 8 GCP stencils, and 8 Azure stencils to `tech-icons.ts`.
   - Updated `ComponentLibraryPanel.tsx` with a unified **Cloud / K8s** tab and filter pills (`All Cloud`, `AWS`, `K8s`, `GCP`, `Azure`).
6. **Interactive Presentation Mode & Fading Neon Laser Pointer**:
   - Distraction-free full-screen presentation mode (`F5`, `CanvasHeader` button).
   - Floating `<ZCanvasPresentationDock>` with slide navigation, laser toggle (`L`), fullscreen toggle, and exit (`Esc`).
   - Glowing neon laser pointer with smooth 1000ms fading trail and intense hot-center dot.
7. **Multi-Page Canvas Sheets (Draw.io Workbook Model)**:
   - Added `pages?: ZCanvasPage[]` and `activePageId?: string` to `ZCanvasDocumentSchema`.
   - Bottom sheet tab bar (`ZCanvasSheetTabs`) with active tab highlighting, inline rename, duplicate, delete, and `+ Add Page`.
8. **Draw.io Group Selection, Double-Click Drill-Down & Collective Resizing**:
   - Implemented single-click group selection: clicking any member of a group selects the whole group as a unified entity (`enteredGroupId === null`), hiding individual node resize handles to eliminate visual clutter.
   - Double-clicking a component inside a group enters the group (`enteredGroupId`) and selects only that child component (`selectedNodeIds = [node.id]`) without opening text edit on that double-click. The child component displays its own 8 resize handles, rotation handle, and 4 quick-clone arrows. Double-clicking the child again opens inline text editing. Single-clicking sibling members inside the group selects them directly, and pressing `Escape` (or clicking the group header pill) steps back up to whole-group selection.
   - Added a floating Draw.io Group Header Pill (`Group (N) · Double-click item to select` with a 1-click `Ungroup` button; `Inside Group · Click or Esc to select group` when drilled down).
   - Added 8 Collective Resize Handles (`NW, N, NE, E, SE, S, SW, W`) on Group Frames and Multi-Selection Bounding Boxes, with `scaleNodesInBox` proportionally scaling and repositioning all enclosed elements.
   - Batch visual styling in `ZCanvasStylePanel`: stroke color, fill, opacity, stroke width, sloppiness, and typography apply across all selected nodes simultaneously.
   - Added 1-click **Group (`Ctrl+G`)**, **Ungroup (`Ctrl+Shift+G`)**, **Select Whole Group (`Esc`)**, **Match Width**, and **Match Height** buttons to `ZCanvasStylePanel`.
2. **Canvas-First Layout & Right-Hand Inspector**:
   - Diagrams open in 100% full-screen `canvas` mode by default instead of auto-opening the left markdown split view.
   - Added a floating `Notes` button on the top-left of the canvas and a `PanelLeftClose` collapse button inside `DocumentEditor.tsx`.
   - Moved `ZCanvasStylePanel` to the right side (`top-20 right-4`) to keep the left-to-right diagramming surface unobstructed.
2. **Power-User Canvas Controls**:
   - **Auto-Layout (`Wand2`)**: Exposed `beautifyArchitectureLayout` in `CanvasHeader.tsx`, `ZCanvasContextMenu.tsx`, and the Command Palette.
   - **Canvas Command Palette (`Ctrl+K` / `/`)**: Built `CanvasCommandPalette.tsx` for keyboard-driven stencil insertion and view switching.
   - **Inline Title Renaming**: Click the diagram title in `CanvasHeader.tsx` to rename in place.
3. **Version History, JSON Backups, Duplication & Live Thumbnails**:
   - Built `VersionHistoryDialog.tsx` wired to `GET/POST /diagrams/:id/versions` for named checkpoints and 1-click restores.
   - Added `.diagramz.json` export & file import to `CanvasHeader.tsx`.
   - Added 1-click Diagram Duplication in `CanvasHeader.tsx` and `dashboard/page.tsx`.
   - Updated `diagram.store.ts` `saveDiagram()` to auto-generate vector SVG thumbnails (`thumbnailKey`) and rendered live previews on Dashboard cards.
4. **AWS Architecture Stencils & Draw.io-Grade Canvas Interactions**:
   - Added 26 official-style AWS service stencils (`tech-aws-ec2`, `tech-aws-lambda`, `tech-aws-s3`, `tech-aws-rds`, `tech-aws-dynamodb`, `tech-aws-vpc`, `tech-aws-cloudfront`, `tech-aws-route53`, `tech-aws-apigateway`, `tech-aws-elb`, `tech-aws-sqs`, `tech-aws-sns`, `tech-aws-eventbridge`, `tech-aws-stepfunctions`, `tech-aws-iam`, `tech-aws-cognito`, `tech-aws-cloudwatch`, `tech-aws-kms`, `tech-aws-waf`, etc.) in `tech-icons.ts` and exposed a dedicated **AWS** tab in `ComponentLibraryPanel.tsx`.
   - Implemented Draw.io-style 1-click directional Quick-Clone & Connect chevrons (`N`, `E`, `S`, `W`), drop-connector-on-empty-space node spawning, double-click empty canvas node creation, and `1px` (`Alt+Arrow`) / `10px` (`Arrow`) / `20px` (`Shift+Arrow`) precision nudging in `ZCanvas.tsx`.
5. **Draw.io Line & Connector Management**:
   - Added custom multi-waypoint / bend routing (`edge.waypoints`) across `step`, `bezier`, and `straight` lines, with interactive virtual segment midpoint handles (`edge-virtual-midpoint-*`) to insert bends and custom waypoint handles (`edge-waypoint-*`) with orthogonal alignment snapping and double-click deletion.
   - Upgraded `computeOrthogonalStepPath` to route perpendicular port pairs (`right -> top`, `bottom -> left`) via crisp L-bends and same-side ports (`top -> top`, `right -> right`) via a `28px` outer jetty.
   - Added full `Straight` routing support on connected nodes, live magnetic target snapping (`drawio-connect-target-reticle`) when drawing new connections, all arrowheads (`None`, `Arrow`, `Barbs`, `Triangle`, `Circle`, `Diamond`, plus 4 Crow's Foot ER markers), **Flow Animation (marching ants)** (`edge.animated`), and **Reverse Line Direction**.
6. **Entity-Relationship (ERD) Crow's Foot Notation & Column-Level Connections**:
   - Added `er-one` (`||`), `er-zero-one` (`o|`), `er-many` (`|<`), and `er-zero-many` (`o<`) Crow's Foot arrowheads across `schema.ts`, `ZCanvas.tsx`, `export/svg.ts`, and `ZCanvasStylePanel.tsx`.
   - Added 1-click **ER Cardinality Presets** (`1 : 1`, `1 : N`, `0..1 : N`, `N : M`) on selected connectors and a full **Entity Columns (`PK` / `FK`)** editor in `ZCanvasStylePanel.tsx`.
   - Upgraded `table` nodes on the canvas (`ZCanvas.tsx`) with interactive `PK` (amber) and `FK` (sky) badge pills and row-level Left & Right connection anchor ports (`erd-row-anchor-left-*` / `erd-row-anchor-right-*`), plus automatic `1 : N` Crow's Foot defaults when wiring two `table` nodes.
   - Mapped Mermaid `erDiagram` operators (`||--o{`, `||--|{`, etc.) to Crow's Foot markers in `eraser-templates.ts` and added **Entity Table (`PK`/`FK`)**, **Join / Pivot Table (`N:M`)**, and **Relational ERD Schema** templates in `ComponentLibraryPanel.tsx`.

---

## 3. Recommended Next Steps (Backlog)

1. **Drop-Connector-to-Create Quick Picker**:
   - In `ZCanvas.tsx`, when dragging a connector wire from a node handle and releasing over empty canvas space, open a compact popover at the pointer coordinates to create and auto-connect a target node in one gesture.
2. **Soft-Delete & Trash Recovery UI**:
   - Update `DiagramsService.deleteDiagram` in `apps/api/src/modules/diagrams/diagrams.service.ts` to set `deletedAt = new Date()` instead of hard-deleting, and add a "Trash" tab in `apps/web/src/app/dashboard/page.tsx` with Restore / Empty Trash actions.
3. **Presentation / Laser Pointer Mode**:
   - Add a header toggle that hides editing UI chrome and activates a temporary fading red laser pointer stroke on the canvas for live architecture walkthroughs.
4. **Optional SSL WebSocket Proxy for Live Multiplayer**:
   - If real-time multi-user cursor presence is needed over HTTPS without upgrading MonsterASP's free tier, deploy a lightweight Cloudflare Worker (`wss://`) forwarding to `ws://diagramz.runasp.net` and set `NEXT_PUBLIC_WS_URL`.
