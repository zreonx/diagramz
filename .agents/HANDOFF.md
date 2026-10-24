# Diagramz Session Handoff (`HANDOFF.md`)

> **Last Updated**: 2026-10-24
> **Branch**: `main`
> **Test Suite Status**: 566 passing (`0` failing)
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

1. **Canvas-First Layout & Right-Hand Inspector**:
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
