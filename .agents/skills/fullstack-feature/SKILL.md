---
name: fullstack-feature
description: >-
  Use this skill when building or extending an end-to-end full-stack feature
  across @diagramz/shared (Zod contracts & types), apps/api (NestJS controllers,
  services, and Drizzle ORM schema), and apps/web (Next.js UI & Zustand stores).
---

# Full-Stack Feature Development Runbook

Follow this 4-step sequence whenever adding or modifying API endpoints, database columns, or full-stack features in Diagramz.

## Step 1: Shared Contracts (`packages/shared`)
1. Define or update the Zod validation schema in `packages/shared/src/contracts/*.contract.ts`.
2. Define or update TypeScript response interfaces in `packages/shared/src/types/models.ts`.
3. Rebuild `@diagramz/shared` so both `apps/api` and `apps/web` see the updated types:
   ```powershell
   pnpm --filter @diagramz/shared build
   ```

## Step 2: Database & NestJS API (`apps/api`)
1. If schema changes are needed, update `apps/api/src/database/schema.ts` and push via Drizzle:
   ```powershell
   pnpm --filter @diagramz/api db:push
   ```
2. Implement business logic in `apps/api/src/modules/<module>/<module>.service.ts`.
3. Expose the endpoint in `apps/api/src/modules/<module>/<module>.controller.ts` using `@UsePipes(new ZodValidationPipe(...))` and `@UseGuards(WorkspaceRolesGuard)`.

## Step 3: Frontend Store & UI (`apps/web`)
1. Consume the endpoint via `apiClient` (`apps/web/src/lib/api.ts`).
2. Update state in `apps/web/src/stores/diagram.store.ts` or `auth.store.ts`.
3. Wire the UI component and provide immediate user feedback via `toast` (`sonner`).

## Step 4: End-to-End Verification
1. Run unit tests: `pnpm --filter @diagramz/web test`
2. Run production build check: `pnpm --filter @diagramz/web build`
