# Deployment & Networking Rules (Vercel + MonsterASP)

1. **HTTPS Reverse Proxy Preservation**:
   - The frontend runs on Vercel (`https://`) while the backend API runs on MonsterASP's free tier (`http://diagramz.runasp.net`).
   - Never remove the `/api/v1/:path*` rewrite in `apps/web/next.config.ts` or the HTTPS mixed-content interceptor in `apps/web/src/lib/api.ts`.
   - In browser client code running over `https:`, always route REST calls through relative `/api/v1` so Vercel proxies them server-to-server.

2. **WebSocket Mixed-Content Guard**:
   - In `apps/web/src/hooks/useCollab.ts`, never initiate an insecure `http://` or `ws://` connection when `window.location.protocol === 'https:'`. Only connect on HTTPS if `NEXT_PUBLIC_WS_URL` is explicitly configured with a `wss://` URL.

3. **MonsterASP Packaging**:
   - Whenever backend code in `apps/api` or `packages/shared` is modified for production deployment to MonsterASP, rebuild the deployment bundle using `node scripts/package-monsterasp.mjs`.
