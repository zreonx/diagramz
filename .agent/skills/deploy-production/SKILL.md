---
name: deploy-production
description: >-
  Use this skill when packaging and deploying the Diagramz NestJS backend to
  MonsterASP.NET (IIS) or deploying the Next.js frontend to Vercel.
---

# Production Deployment Runbook (Vercel + MonsterASP)

## 1. Frontend Deployment (Vercel)
- **Trigger**: Pushing commits to `origin/main` automatically triggers a Vercel production deployment.
- **Proxy Configuration**:
  - `apps/web/next.config.ts` proxies `/api/v1/:path*` to `http://diagramz.runasp.net/api/v1/:path*`.
  - `apps/web/src/lib/api.ts` automatically forces relative `/api/v1` on any `https:` origin to prevent Mixed-Content errors.
- **Pre-Push Verification**:
  ```powershell
  pnpm --filter @diagramz/web test
  pnpm --filter @diagramz/web build
  git push origin main
  ```

## 2. Backend Deployment (MonsterASP.NET IIS)
When changes are made to `apps/api` or `packages/shared`:

1. Run the MonsterASP packager script:
   ```powershell
   node scripts/package-monsterasp.mjs
   ```
   - This script builds `@diagramz/shared`, compiles `@diagramz/api`, bundles everything into a single self-contained `dist-monsterasp/index.js` using `@vercel/ncc`, generates `web.config` with an updated deploy timestamp (to force IIS/iisnode recycle), and produces `monsterasp-deploy.zip`.
2. Upload `monsterasp-deploy.zip` (or the contents of `dist-monsterasp/`) to MonsterASP via File Manager or FTP/WebDeploy.
3. Verify the live backend health and OpenAPI docs at `http://diagramz.runasp.net/docs`.
