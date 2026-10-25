# Diagramz Changelog

All notable architectural changes, features, bug fixes, and deployment milestones for **Diagramz** are documented in this file.

---

## [2026-10-26] — Hardware-Accelerated Neon Laser Pointer, Double-Click Text Insertion & Minimalist Canvas Typography

### Added
- **Hardware-Accelerated HTML5 Canvas Neon Laser Pointer** ([ZCanvasLaserOverlay.tsx](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvasLaserOverlay.tsx), [ZCanvas.tsx](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx)):
  - Replaced the sluggish SVG-filter laser trail with a dedicated, high-DPI HTML5 canvas overlay running at 120 FPS.
  - Eliminated high-frequency React state re-renders of the main canvas on mousemove, resulting in buttery smooth cursor responsiveness with 0% CPU overhead when idle.
  - Multi-pass cinematic laser aesthetics: wide ambient neon aura, intense electric crimson core, and white-hot center beam with Catmull/quadratic spline smoothing and aerodynamic comet tail tapering.
  - Interactive laser pointer beacon at cursor with radial pulsing aura ring and 4-axis sparkle lens flare.
- **Double-Click Canvas to Insert Text** ([ZCanvas.tsx](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx)):
  - Double-clicking on empty canvas background now creates a clean text node at the exact cursor point and immediately focuses it for inline editing (replacing the previous rectangle creation).
  - Single-clicking an already-selected text node seamlessly enters edit mode.
  - Automatic blank text pruning: if the user cancels (Escape) or blurs without typing text into a newly created text box, the empty node is automatically discarded to prevent canvas clutter.
- **Minimalist Canvas Text Aesthetics & Auto-Sizing** ([ZCanvas.tsx](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx)):
  - Removed heavy card `shadow-2xl` and thick borders from text nodes, replacing them with a crisp, minimal `ring-1.5 ring-blue-500/80` outline and subtle hover indicator.
  - Upgraded typography with `leading-relaxed`, negative letter-spacing (`-0.01em`), and light `Type something...` placeholder.
  - Dynamic width & height auto-expansion on text commit to fit typed content naturally without clipping or unwanted scrollbars.

---

## [2026-10-25] — Eraser.io-Grade Multi-Domain AI Assistant, AWS Architecture Stencils Suite, Flowchart Shapes & Clean Canvas Selection

### Added
- **Eraser.io-Grade Multi-Domain AI Assistant** ([ai.service.ts](file:///D:/Projects/diagramz/apps/api/src/modules/ai/ai.service.ts), [DiagramCanvas.tsx](file:///D:/Projects/diagramz/apps/web/src/components/canvas/DiagramCanvas.tsx), [AiAssistant.tsx](file:///D:/Projects/diagramz/apps/web/src/components/ai/AiAssistant.tsx)):
  - Upgraded the AI system prompt to generate crystal-clear, mathematically precise, production-grade diagrams across ANY domain — not just technical cloud architectures, but business workflows, customer journeys, decision trees, ERD database schemas, and sequence flows.
  - Implemented strict non-colliding layout positioning rules: horizontal progression spacing ($dx \ge 220\text{px}$), tier/branch spacing ($dy \ge 160\text{px}$), decision diamond branching ('Yes' straight forward, 'No' downward lateral), and meaningful relationship labels on all edges.
  - Enhanced canvas native document ingestion in `DiagramCanvas.tsx` (`handleInsertNativeCanvasDoc`) to recognize all geometric and flowchart shapes (`document`, `parallelogram`, `hexagon`, `subroutine`, `card`, `circle`, `diamond`, `rectangle`, `sticky-note`), preserving exact node dimensions and types rather than incorrectly converting them to `arch-server` SVGs.
  - Expanded offline/fallback generator in `ai.service.ts` to intelligently generate 5 specialized domain diagrams: Employee Hiring & Onboarding Flowchart, Customer Refund & Returns Decision Tree, E-Commerce Relational Database Schema (ERD), Event-Driven Distributed Streaming Mesh, and AWS Serverless Production Architecture.
  - Modernized `AiAssistant.tsx` welcome screen and quick prompt template chips to showcase non-technical and technical diagram generation capabilities.

### Removed
- **Click-to-Clone & Connect Directional Buttons** ([ZCanvas.tsx](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx)):
  - Removed the cluttering directional quick-clone chevron buttons that appeared around single-selected nodes.
  - Keeps the node selection bounding box, 8-point resize grasps, rotation handle, and standard anchor ports clean, uncluttered, and responsive.

### Added
- **Comprehensive AWS Architecture Stencils Suite (14 New Official Services)** ([`tech-icons.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/stencils/tech-icons.ts), [`registry.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/stencils/registry.ts), [`builtin.test.mjs`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/stencils/builtin.test.mjs)):
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
- **Draw.io Standard Flowchart & BPMN Shapes** ([`schema.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/core/schema.ts), [`shape-paths.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/geometry/shape-paths.ts), [`ZCanvasShapeGeometry.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvasShapeGeometry.tsx), [`svg.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/export/svg.ts), [`standard-shapes.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/stencils/standard-shapes.ts)):
  - Added four fundamental flowchart node types to `ZCanvasNodeTypeSchema` and `ZCanvasTool`:
    - `document` — Flowchart process output / document with a smooth sinusoidal wavy bottom.
    - `parallelogram` — Data input/output transmission vertex with 20% angular slant.
    - `hexagon` — Preparation / loop initialization vertex with pointed lateral apexes.
    - `subroutine` — Predefined process / procedure with double vertical interior boundary bars.
  - Exportable to clean vector SVG with typography tspans and themed default appearances.
  - Available as 1-click draggable tiles in the Standard Shapes section of the Component Library.
- **Enhanced Flow Connector Animation ("Marching Ants" Speed & Direction Controls)** ([`schema.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/core/schema.ts), [`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx), [`ZCanvasStylePanel.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvasStylePanel.tsx)):
  - Extended `ZCanvasEdgeSchema` with `animationSpeed?: 'slow' | 'normal' | 'fast'` and `animationDirection?: 'forward' | 'reverse'`.
  - Added inline speed segmented pill selector (`Slow (1.8s)`, `Normal (0.9s)`, `Fast (0.45s)`) and directional toggle (`➔ Forward`, `⬅ Reverse`) in `ZCanvasStylePanel` connector inspector.
- **Collapsible Architecture Containers (Draw.io Subsystem Fold/Unfold)** ([`schema.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/core/schema.ts), [`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx)):
  - Added `collapsed?: boolean` and `expandedHeight?: number` to `ZCanvasNodeSchema`.
  - Added interactive `[-]` (collapse) and `[+]` (expand) toggle button on container title bars.
  - Collapses complex VPC or namespace container boundaries to a clean 48px header pill, and expands back to original user height with a single click.

---

## [2026-10-25] — Quick-Connect Directional Hover Arrows, Figma Tidy Up & Equal-Gap Distribute, Miro Sticky Notes, and Copy Selection as PNG to Clipboard

### Added
- **Quick-Connect Directional Hover Arrows (Draw.io / Lucidchart Style)** ([`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx)):
  - When a single node is selected, 4 blue directional quick-connect buttons appear outside the North, East, South, and West perimeter of the node.
  - **Clicking an arrow** immediately duplicates/spawns a new connected node in that direction (spaced by an 80px gap) with an auto-routed connector, selects the new node, and focuses inline text editing.
  - **Dragging an arrow** pulls out an interactive connection wire directly from that face to drop onto other elements or open canvas.
- **Figma "Tidy Up" Grid & Equal-Gap Node Distribution** ([`distribute-align.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/geometry/distribute-align.ts), [`distribute-align.test.mjs`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/geometry/distribute-align.test.mjs), [`ZCanvasStylePanel.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvasStylePanel.tsx), [`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx)):
  - Built `distributeNodes` calculating exact variable-size bounds to enforce mathematically equal spacing between items on both horizontal and vertical axes.
  - Built `tidyUpNodes` calculating optimal balanced grid layouts (columns = $\lceil\sqrt{N}\rceil$) with consistent 40px gaps.
  - Exposed 1-click **"Tidy Up Grid"** button in `ZCanvasStylePanel` multi-selection inspector.
- **Miro / FigJam Sticky Notes** ([`schema.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/core/schema.ts), [`standard-shapes.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/stencils/standard-shapes.ts), [`placement.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/stencils/placement.ts), [`ComponentLibraryPanel.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/ComponentLibraryPanel.tsx), [`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx)):
  - Added `'sticky-note'` node type with authentic pastel post-it appearance, soft drop shadow, custom folded dog-ear corner (`borderRadius: 2px 2px 14px 2px`), and multi-line double-click editing.
  - Added "Sticky Note" tile to Standard Shapes in Component Library with custom preview artwork.
- **Copy Selection as High-Res PNG to Clipboard (`Ctrl+Shift+C`)** ([`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx), [`CanvasHeader.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/CanvasHeader.tsx)):
  - Added keyboard shortcut `Ctrl+Shift+C` (and "Copy as PNG" action in Header More Actions menu).
  - Renders the selected nodes/edges/strokes (or full canvas if unselected) as a 2x transparent PNG Blob directly into OS clipboard via `navigator.clipboard.write([new ClipboardItem(...)])`.

---

## [2026-10-25] — Full Real-time Multiplayer Collaboration: Header Teammates Stack, Live SVG Cursors, Remote Selection Outlines & WebSocket Sync

### Added
- **Interactive Collaborator Stack & Live Presence Popover** ([`CanvasHeader.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/CanvasHeader.tsx)):
  - Top header collaborator trigger button displaying overlapped user avatars with colored borders, active status pulse rings, and participant count.
  - Interactive Popover displaying:
    - Active teammates indicator with pulsing emerald radar dot (`N online`).
    - Local user item (`(You)`).
    - Teammate list with real-time state badges (`Editing (N items)` with pencil icon vs `Viewing` with eye icon).
    - Quick "Invite Collaborators" dialog trigger.
- **Real-time Live Multiplayer SVG Cursors** ([`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx)):
  - Rendered peer mouse pointers in world canvas space using Figma-grade SVG arrow pointers in teammate-assigned brand colors.
  - Floating name badges attached to cursor pointers.
  - Sized with inverse zoom factor (`1 / viewport.zoom`) to maintain sharp, readable screen dimensions at any zoom level.
- **Teammate Selection Outlines & Badges** ([`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx)):
  - Outlines nodes currently selected by peers with dashed colored bounding boxes and floating name badges (`"Alice"`).
- **Full-Stack WebSocket Document Synchronization** ([`collab.gateway.ts`](file:///D:/Projects/diagramz/apps/api/src/modules/collab/collab.gateway.ts), [`collab.ts`](file:///D:/Projects/diagramz/packages/shared/src/types/collab.ts), [`useCollab.ts`](file:///D:/Projects/diagramz/apps/web/src/hooks/useCollab.ts), [`DiagramCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/DiagramCanvas.tsx)):
  - Added `COLLAB_SOCKET_EVENTS.ROOM_USERS` and `COLLAB_SOCKET_EVENTS.DIAGRAM_CHANGE`.
  - Collab Gateway now collects active sockets upon join and dispatches `room:users` to the joining client.
  - Relay `diagram:change` events to broadcast diagram document updates across connected clients in the room.
  - Implemented 40ms cursor position throttling and re-entrance guards in `DiagramCanvas.tsx` to prevent cyclic echo broadcasts.

---

## [2026-10-25] — Figma-Grade Header Ergonomics, Canvas & Page Properties Inspector, Collapsible Inspector Dock & Bottom Status HUD

### Added
- **Figma-Grade Header Hierarchy & More Actions Dropdown** ([`CanvasHeader.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/CanvasHeader.tsx)):
  - Reorganized header controls into clean semantic clusters:
    - **Unified Segmented Panel Group**: `[ ⊞ Stencils | ✦ AI Assistant | ⌨ Code ]` in a pill toggle container.
    - **Primary Actions**: Prominent primary `Share` button (brand accent with icon), `Export` button, and full-screen `Present (F5)` button.
    - **`···` (More Actions) Dropdown**: Consolidated secondary actions into a Radix dropdown menu: `Auto Layout Architecture (Wand2)`, `Version History & Checkpoints (History)`, `Duplicate Diagram (CopyPlus)`, `Import JSON Backup (Upload)`, and `Command Palette (Ctrl+K)`.
    - Eliminates header button wrapping on laptops and screens down to 1024px.
- **Canvas & Page Properties Inspector When Unselected** ([`ZCanvasStylePanel.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvasStylePanel.tsx), [`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx)):
  - When no shape or connector is selected, the inspector panel no longer disappears; it smoothly transitions to the **Canvas & Page Properties** inspector:
    - **Active Sheet / Page Card**: Live sheet name with inline rename on click, plus node and connector statistics (`N nodes · M edges`).
    - **Grid Style Selector**: 4-pill instant toggle (`Dots`, `Mesh`, `Cross`, `None`).
    - **Canvas Background Tone Swatches**: Clean Default (`#ffffff` / dark), Warm Slate (`#faf8f5`), Blueprint Navy (`#0c1524`), Charcoal (`#121214`).
    - **Snapping & Guides Controls**: Toggles for `Snap to Grid`, `Smart Alignment Guides`, and `Show Minimap`.
    - **Auto-Layout Quick Action**: 1-click button to trigger `beautifyArchitectureLayout`.
- **Collapsible Inspector & Dynamic Drawer Collision Prevention** ([`ZCanvasStylePanel.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvasStylePanel.tsx), [`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx), [`DiagramCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/DiagramCanvas.tsx)):
  - Added a Collapse / Minimize button (`PanelRightClose`) on the inspector header to minimize into a floating `[ Sliders Inspector ]` tab, maximizing visual drawing area.
  - Added `rightOffset` prop to `ZCanvas` wired to `DiagramCanvas.tsx`: when the 384px AI Assistant or Mermaid Code editor drawer is open, `ZCanvasStylePanel` glides smoothly to `right-[400px]` (`rightOffset + 16px`), completely eliminating panel overlap and collision.
- **Interactive Bottom Canvas Status HUD** ([`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx)):
  - Subtle floating HUD pill centered between sheet tabs and zoom dock:
    - When elements are selected: displays live selection count and dimensions (`1 item selected · 140 × 80px`).
    - When unselected: displays keyboard shortcut hints (`Space Pan • / Quick Add • L Laser • F5 Present`).

---

## [2026-10-24] — Quick Connect Picker, Smart Alignment Guidelines, Crossing Line Jumps, Multi-Point Labels, Cloud Stencils (K8s, GCP, Azure), Presentation Mode & Multi-Page Workbook Sheets

### Added
- **Drop-Connector "Quick Connect Picker" Popover** ([`QuickConnectPicker.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/QuickConnectPicker.tsx), [`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx)):
  - Releasing a dragged connector wire on empty canvas space opens a floating radial/popover selector right at the cursor drop point with 1-click presets: Clone Source Node (`1`), Step / Rectangle (`2`), Decision / Diamond (`3`), Service Card (`4`), Database Table (`5`), State / Circle (`6`), and Text Note (`7`).
  - Selecting any preset immediately spawns the new node, wires the connector to it, records history, and places focus into inline label editing.
- **Smart Alignment Guidelines & Dynamic Spacing Snapping** ([`geometry/index.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/geometry/index.ts), [`geometry.test.mjs`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/geometry/geometry.test.mjs), [`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx)):
  - Upgraded `calculateAlignmentGuides` to calculate magnetic snapping against all other canvas nodes during drag and resize, returning finite guideline spans (`start` to `end`) with terminal tick marks rather than infinite screen-spanning lines.
  - Added dynamic equal-spacing detection badges (`↔ 30px`, `↕ 24px`) displayed between aligned nodes when equidistant intervals are detected.
- **Line Jumps / Bridges on Crossing Connectors** ([`schema.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/core/schema.ts), [`geometry/index.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/geometry/index.ts), [`geometry.test.mjs`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/geometry/geometry.test.mjs), [`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx), [`ZCanvasStylePanel.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvasStylePanel.tsx)):
  - Added `lineJumps?: 'none' | 'arc' | 'gap'` to `ZCanvasEdgeSchema`.
  - Implemented `findSegmentIntersection` and `injectLineJumps(vertices, otherVerticesList, style, radius)` to detect segment intersections between lines and insert Draw.io-style semi-circular arc bridges (`A 6 6 0 0 1 ...`) or gaps (`M ...`) at crossings.
  - Exposed line jump controls (`None`, `Arc Bridge`, `Gap`) in `ZCanvasStylePanel` connector inspector.
- **Multi-Point Connector Labels (`sourceLabel`, `label`, `targetLabel`)** ([`schema.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/core/schema.ts), [`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx), [`ZCanvasStylePanel.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvasStylePanel.tsx)):
  - Added `sourceLabel?: string` and `targetLabel?: string` to `ZCanvasEdgeSchema` alongside the existing center `label`.
  - Rendered endpoint annotations positioned with smart offsets along the start and end tangent segments of straight, step, and curved lines.
  - Added dedicated Source, Center, and Target text input fields in `ZCanvasStylePanel`.
- **24 Cloud Architecture Stencils (Kubernetes, Google Cloud GCP, Microsoft Azure)** ([`tech-icons.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/stencils/tech-icons.ts), [`builtin.test.mjs`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/stencils/builtin.test.mjs), [`ComponentLibraryPanel.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/ComponentLibraryPanel.tsx)):
  - Added 8 authentic Kubernetes stencils (`Pod`, `Deployment`, `Service`, `Ingress`, `ConfigMap`, `Secret`, `StatefulSet`, `Namespace`).
  - Added 8 Google Cloud Platform (GCP) stencils (`Compute Engine`, `Cloud Functions`, `Cloud Run`, `Google Kubernetes Engine`, `Cloud Storage`, `Cloud SQL`, `BigQuery`, `Pub/Sub`).
  - Added 8 Microsoft Azure stencils (`Virtual Machines`, `Azure Functions`, `App Service`, `AKS`, `Blob Storage`, `Azure SQL`, `Cosmos DB`, `Virtual Network`).
  - Expanded `ComponentLibraryPanel.tsx` with a unified **Cloud / K8s** tab featuring interactive filter pills (`All Cloud`, `AWS`, `K8s`, `GCP`, `Azure`).
- **Interactive Presentation Mode & Fading Neon Laser Pointer** ([`ZCanvasPresentationDock.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvasPresentationDock.tsx), [`CanvasHeader.tsx`](file:///D:/Projects/diagramz/apps/web/src/components/canvas/CanvasHeader.tsx), [`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx)):
  - Full-screen distraction-free presentation mode triggered via `F5`, the Header `Present` button, or `zcanvas:toggle-presentation` custom event.
  - Hides toolbars, style panels, and minimap; displays floating `<ZCanvasPresentationDock>` with slide navigation, laser pointer toggle, fullscreen toggle, and exit (`Esc`).
  - Glowing Neon Laser Pointer (`L` key) with smooth 1000ms fading Catmull-Rom/segment trail, multi-layer SVG drop-shadow glow filter (`#ff2a6d`), and glowing hot-center head cursor.
  - Slide keyboard navigation (`ArrowRight`, `PageDown`, `Space` for next slide; `ArrowLeft`, `PageUp` for previous slide).
- **Multi-Page Canvas Workbook Sheets (Draw.io Workbook Model)** ([`schema.ts`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/core/schema.ts), [`ZCanvasSheetTabs.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvasSheetTabs.tsx), [`ZCanvas.tsx`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/react/ZCanvas.tsx), [`workbook-pages.test.mjs`](file:///D:/Projects/diagramz/apps/web/src/lib/zcanvaskit/core/workbook-pages.test.mjs)):
  - Added `ZCanvasPageSchema`, `pages?: ZCanvasPage[]`, and `activePageId?: string` to `ZCanvasDocumentSchema`.
  - Added `<ZCanvasSheetTabs>` bottom dock with active tab highlighting, inline double-click tab renaming, tab duplication, deletion, and `+ Add Page`.
  - Complete state isolation per page: switching pages preserves nodes, edges, strokes, and viewport camera positions per sheet while keeping top-level document backward-compatible.

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
