# Diagramz Agent Harness (`.agents/`)

Welcome to the **Diagramz** AI Agent Harness. This directory provides persistent memory, architectural blueprints, operational runbooks (Skills), contextual guardrails (Rules), changelogs, and session handoffs for AI coding agents working on this repository.

---

## Directory Structure

```text
.agents/
├── README.md                             # This overview & quick-start guide
├── ARCHITECTURE.md                       # Full-stack system map, data flow, and engine boundaries
├── CHANGELOG.md                          # Chronological log of shipped features, fixes, and infra changes
├── HANDOFF.md                            # Live session state, production URLs, and prioritized backlog
├── rules/                                # Automatically discovered workspace rules
│   ├── 01-core-engineering.md            # zcanvaskit purity, schema validation, and testing standards
│   ├── 02-deployment-and-networking.md   # Vercel -> MonsterASP proxy rules & mixed-content guards
│   └── 03-handoff-and-changelog.md       # Protocol for maintaining HANDOFF.md and CHANGELOG.md
└── skills/                               # On-demand progressive-disclosure agent skills
    ├── zcanvaskit-engine/SKILL.md        # Adding stencils, shapes, geometry, exports & running unit tests
    ├── fullstack-feature/SKILL.md        # End-to-end workflow: @diagramz/shared -> apps/api -> apps/web
    ├── deploy-production/SKILL.md        # MonsterASP NCC bundling & Vercel deployment runbook
    └── session-handoff/SKILL.md          # Standardized procedure for recording handoffs & changelogs
```

---

## Quick Commands Reference

| Task | Command |
| :--- | :--- |
| **Build Shared Contracts** | `pnpm --filter @diagramz/shared build` |
| **Run Canvas Engine Tests (565+ tests)** | `pnpm --filter @diagramz/web test` |
| **Verify Web Production Build** | `pnpm --filter @diagramz/web build` |
| **Verify API Build** | `pnpm --filter @diagramz/api build` |
| **Package API for MonsterASP (IIS/NCC)** | `node scripts/package-monsterasp.mjs` |
| **Push Database Schema (Drizzle)** | `pnpm --filter @diagramz/api db:push` |
