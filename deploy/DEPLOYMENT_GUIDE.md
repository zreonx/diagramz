# Diagramz Deployment Guide: Cloudflare R2, MonsterASP & Vercel

This guide provides step-by-step instructions to configure and deploy the Diagramz full-stack application with:
- **Cloudflare R2** for object storage (diagram exports, assets, stencils)
- **MonsterASP** for the NestJS API & WebSockets backend
- **Vercel** for the Next.js 15 frontend
- **GitHub Actions** for automated continuous deployment (CI/CD)

---

## Architecture Overview

```
┌───────────────────────────────────────┐         ┌───────────────────────────────────────┐
│           Vercel Frontend             │         │          MonsterASP Backend           │
│        (Next.js 15 App Router)        │ ──────> │           (NestJS REST & WS)          │
│    https://diagramz.vercel.app        │  HTTPS  │    https://api.yourdomain.com         │
│                                       │   WSS   │                                       │
└───────────────────────────────────────┘         └───────────────────────────────────────┘
                     │                                           │              │
                     │ (Direct Client Uploads & CDN Reads)       ▼              ▼
                     │                                  ┌────────────────┐ ┌────────────────┐
                     └────────────────────────────────> │ Hosted Postgres│ │ Cloudflare R2  │
                                                        │ (DatabaseASP / │ │ (diagramz      │
                                                        │  Neon)         │ │  bucket)       │
                                                        └────────────────┘ └────────────────┘
```

---

## Part 1: Cloudflare R2 Setup

Your R2 Endpoint:
`https://0d9c81d5c9f99cdde6bb6b26ee11c04c.r2.cloudflarestorage.com/diagramz`

### 1. Extracted Identifiers
- **Account ID (`R2_ACCOUNT_ID`)**: `0d9c81d5c9f99cdde6bb6b26ee11c04c`
- **Bucket Name (`R2_BUCKET_NAME`)**: `diagramz`
- **S3 Endpoint**: `https://0d9c81d5c9f99cdde6bb6b26ee11c04c.r2.cloudflarestorage.com`

### 2. Generate R2 Access Keys (Required)
1. Go to **Cloudflare Dashboard** > **R2** > **Manage R2 API Tokens**.
2. Click **Create API Token**.
3. Choose:
   - **Permissions**: **Object Read & Write**
   - **Bucket**: Apply to specific bucket `diagramz` (or All buckets)
   - **TTL**: Forever (or as per your security policy)
4. Click **Create API Token**.
5. Save the generated credentials:
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`

### 3. Configure Public Access for the Bucket
By default, R2 buckets are private. To allow users and the canvas to render exported assets and stencils:
1. In Cloudflare Dashboard > **R2** > Click `diagramz` bucket > **Settings**.
2. Under **Public Access**:
   - **Option A (Quickest)**: Click **Allow Access** under **R2.dev Subdomain**. You will get an address like `https://pub-xxxxxx.r2.dev`.
   - **Option B (Custom Domain)**: Click **Connect Domain** and bind a domain like `assets.yourdomain.com`.
3. Set this public URL as `R2_PUBLIC_URL` (in backend `.env`) and `NEXT_PUBLIC_R2_PUBLIC_URL` (in Vercel).

### 4. Configure R2 CORS Policy (Crucial for Canvas Direct Uploads)
Because the browser uploads files directly to R2 via presigned URLs:
1. In **R2** > `diagramz` bucket > **Settings** > **CORS Policy**.
2. Click **Add CORS policy** and enter the following JSON:
```json
[
  {
    "AllowedOrigins": [
      "https://*.vercel.app",
      "https://yourdomain.com",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## Part 2: PostgreSQL Database (DatabaseASP / MonsterASP)

1. Ensure the PostgreSQL database is reachable:
   ```env
   DATABASE_URL="postgresql://<user>:<password>@db74181.public.databaseasp.net:5432/db74181?sslmode=disable"
   ```
2. Push the schema to create all tables:
   ```bash
   pnpm db:push
   ```

---

## Part 3: Backend Deployment on MonsterASP

### 1. Build & Package Artifacts
Run the monorepo packaging script:
```bash
pnpm package:monsterasp
```
This produces a fully self-contained bundle at `deploy/monsterasp/bundle/`:
- `dist/` (Compiled NestJS application)
- `web.config` (Pre-configured IIS / iisnode routing with WebSocket support)
- `package.json`
- `node_modules/` (Production dependencies with `@diagramz/shared` dereferenced and pre-bundled)

### 2. Environment Variables (.env) on MonsterASP
Configure these in your MonsterASP control panel or in `.env` placed at the site root:

```bash
NODE_ENV=production
PORT=4000

# PostgreSQL Connection
DATABASE_URL="postgresql://db74181:<password>@db74181.public.databaseasp.net:5432/db74181?sslmode=disable"

# JWT Authentication Secrets (Generate secure 64-char strings)
JWT_ACCESS_SECRET="generate-a-minimum-64-char-secret-string-access"
JWT_REFRESH_SECRET="generate-a-minimum-64-char-secret-string-refresh"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Cookie Cross-Origin Configuration
COOKIE_SAME_SITE="none"

# CORS Whitelist (Include your Vercel URL and any custom domains)
CORS_ORIGIN="https://diagramz.vercel.app,https://yourdomain.com"

# Cloudflare R2 Storage
R2_ACCOUNT_ID="0d9c81d5c9f99cdde6bb6b26ee11c04c"
R2_ACCESS_KEY_ID="642dd03b7d46668b8fb83d6a99008931"
R2_SECRET_ACCESS_KEY="5c312c322d423e1ec9fa431e5a3be460cb2ffdcd028c730ca7bd1f09c887449d"
R2_BUCKET_NAME="diagramz"
R2_PUBLIC_URL="https://pub-fb93e4f415284ff7a43c17deef744f61.r2.dev"

# AI Keys
GEMINI_API_KEY=""
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""

# Email Configuration (Resend)
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="Diagramz <noreply@yourdomain.com>"
APP_URL="https://diagramz.vercel.app"
```

---

## Part 4: Frontend Deployment on Vercel

### 1. Import Repository into Vercel
1. Log in to [Vercel](https://vercel.com) and click **Add New... > Project**.
2. Select your `diagramz` GitHub repository.
3. In **Project Configuration**:
   - **Framework Preset**: Next.js
   - **Root Directory**: Click edit and select `apps/web`
   - **Build Command**: Leave default or `cd ../.. && pnpm build --filter=@diagramz/web...`
   - **Output Directory**: Automatically `.next`

### 2. Environment Variables in Vercel
Add these under **Project Settings > Environment Variables**:

| Variable Name | Example Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_NAME` | `Diagramz` | Brand title |
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com/api/v1` | MonsterASP HTTPS API endpoint |
| `NEXT_PUBLIC_WS_URL` | `wss://api.yourdomain.com` | MonsterASP WebSocket endpoint |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | `https://pub-fb93e4f415284ff7a43c17deef744f61.r2.dev` | Public URL to R2 bucket |

---

## Part 5: GitHub Auto Deploy (CI/CD)

### 1. Frontend Auto Deploy (Vercel)
When your GitHub repository is connected to Vercel:
- Pushes to `main` or `master` automatically trigger production deployments.
- Pull Requests automatically create preview deployments.
- Zero manual GitHub Actions workflow required for Vercel.

### 2. Backend Auto Deploy (MonsterASP via GitHub Actions)
A pre-configured GitHub Actions workflow is set up at `.github/workflows/deploy-monsterasp.yml`.

To enable automated deployment:
1. Go to your GitHub repository > **Settings** > **Secrets and variables** > **Actions**.
2. Click **New repository secret** and add:
   - `MONSTERASP_FTP_SERVER`: Your MonsterASP FTP hostname (e.g., `ftp.monsterasp.net` or site hostname)
   - `MONSTERASP_FTP_USERNAME`: Your MonsterASP FTP username
   - `MONSTERASP_FTP_PASSWORD`: Your MonsterASP FTP password
   - `MONSTERASP_SERVER_DIR`: Optional (defaults to `/site/wwwroot/`)
3. Every `git push` to `main` touching `apps/api/**` or `packages/shared/**` will automatically:
   - Run type checks and build the project
   - Bundle the application with dereferenced dependencies
   - Synchronize changed files to MonsterASP via FTPS
   - Auto-restart the iisnode process
