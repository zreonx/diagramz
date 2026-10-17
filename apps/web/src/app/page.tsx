'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Sparkles,
  Layers,
  Users,
  Zap,
  Code2,
  FileText,
  ShieldCheck,
  CheckCircle2,
  MousePointer2,
  Database,
  Cpu,
  Server,
  Cloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuthStore } from '@/stores/auth.store';

export default function HomePage() {
  const { user, isAuthenticated, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary relative overflow-x-hidden">
      {/* Background Gradients & Ambient Lighting */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent blur-3xl rounded-full pointer-events-none -z-10" />

      {/* Sticky Header Navbar */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50 transition-colors">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <Layers className="w-4 h-4" />
              </div>
              <span className="font-semibold text-lg tracking-tight">Diagramz</span>
            </Link>
            <Badge variant="outline" className="hidden sm:inline-flex text-[11px] font-normal text-muted-foreground border-border/60">
              v2.0 Beta
            </Badge>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#canvas" className="hover:text-foreground transition-colors">Canvas Engine</a>
            <a href="#workflow" className="hover:text-foreground transition-colors">Workflow</a>
            <a href="#stencils" className="hover:text-foreground transition-colors">Stencils</a>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isAuthenticated ? (
              <div className="flex items-center gap-2.5">
                <span className="hidden sm:inline-block text-xs text-muted-foreground font-medium">
                  {user?.name || user?.email}
                </span>
                <Link href="/dashboard">
                  <Button size="sm" className="text-xs font-semibold gap-1.5 shadow-sm">
                    Go to Dashboard <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-xs font-medium">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="text-xs font-medium gap-1.5 shadow-sm">
                    Get Started <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-24 max-w-6xl mx-auto w-full z-10">
        {/* Eyebrow Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-secondary/80 border border-border/60 text-secondary-foreground text-xs font-medium mb-8 shadow-sm backdrop-blur-sm">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>The Next-Generation Architecture Workspace</span>
        </div>

        {/* Hero Headline */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-foreground text-center max-w-4xl leading-[1.08] mb-6">
          Where Code, Canvas, and{' '}
          <span className="text-muted-foreground font-semibold">
            Architecture Specs Converge
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="text-base sm:text-lg text-muted-foreground text-center max-w-2xl mb-10 leading-relaxed font-normal">
          Design distributed system topologies on an infinite canvas, generate validated diagrams with Mermaid code and AI, and write technical RFCs side-by-side in real time.
        </p>

        {/* Hero CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 mb-16">
          {isAuthenticated ? (
            <>
              <Link href="/dashboard">
                <Button size="lg" className="h-11 px-7 gap-2 text-sm font-semibold shadow-md">
                  Go to Dashboard <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" size="lg" className="h-11 px-6 text-sm font-medium border-border/80 hover:bg-secondary/60">
                  Open Workspaces
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/register">
                <Button size="lg" className="h-11 px-6 gap-2 text-sm font-medium shadow-md">
                  Start Diagramming Free <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg" className="h-11 px-6 text-sm font-medium border-border/80 hover:bg-secondary/60">
                  Open Demo Workspace
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Metrics Trust Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-10 border-y border-border/40 py-6 w-full max-w-4xl text-center mb-16">
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">Zero-Conflict</div>
            <div className="text-xs text-muted-foreground mt-1">Multiplayer Yjs CRDTs</div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">Bi-Directional</div>
            <div className="text-xs text-muted-foreground mt-1">Mermaid-as-Code Engine</div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">Cloud Stencils</div>
            <div className="text-xs text-muted-foreground mt-1">AWS, Flowcharts &amp; UI</div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">100% Native</div>
            <div className="text-xs text-muted-foreground mt-1">Export SVG, PNG &amp; PDF</div>
          </div>
        </div>

        {/* Interactive Workspace Mockup Preview */}
        <section id="canvas" className="w-full max-w-5xl rounded-xl border border-border/70 bg-card/60 shadow-2xl overflow-hidden backdrop-blur-sm mb-24 transition-all">
          {/* App Window Chrome */}
          <div className="h-10 px-4 bg-muted/60 border-b border-border/60 flex items-center justify-between text-xs text-muted-foreground select-none">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80 border border-red-600/40" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-600/40" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-600/40" />
              <span className="ml-2 font-mono text-[11px] text-foreground/70">global-payment-system.diagramz</span>
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" /> Live Syncing (2 online)
              </span>
            </div>
          </div>

          {/* Split Screen Workspace Preview */}
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[380px] bg-background">
            {/* Left: Code & Technical Markdown Specs */}
            <div className="md:col-span-4 p-5 border-r border-border/50 bg-muted/20 font-mono text-xs text-muted-foreground flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground font-semibold pb-2 border-b border-border/40">
                  <span className="flex items-center gap-1.5"><Code2 className="size-3.5 text-primary" /> Mermaid Spec</span>
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5">v1.4</Badge>
                </div>
                <div className="space-y-1 text-foreground/80 leading-relaxed">
                  <p className="text-primary font-semibold">flowchart LR</p>
                  <p className="pl-3">Client[Web Client] --&gt; Gateway</p>
                  <p className="pl-3">Gateway[API Gateway] --&gt; Auth[Auth Svc]</p>
                  <p className="pl-3">Gateway --&gt; Payment[Checkout Svc]</p>
                  <p className="pl-3">Payment --&gt; Kafka[(Event Bus)]</p>
                  <p className="pl-3">Payment --&gt; DB[(PostgreSQL)]</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border/40 mt-4">
                <div className="text-[11px] font-semibold text-foreground/70 mb-1 flex items-center gap-1.5">
                  <FileText className="size-3 text-primary" /> RFC-104: Payment Flow
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  All transactions require validated JWT tokens and idempotency keys before streaming to Kafka.
                </p>
              </div>
            </div>

            {/* Right: High-fidelity Visual Canvas Nodes */}
            <div className="md:col-span-8 p-8 relative flex items-center justify-center bg-card/30 overflow-hidden">
              {/* Subtle Canvas Dot Grid */}
              <div className="absolute inset-0 bg-[radial-gradient(#80808018_1px,transparent_1px)] [background-size:16px_16px]" />

              {/* Architecture Node Diagram */}
              <div className="relative z-10 w-full flex flex-col md:flex-row items-center justify-between gap-6 max-w-xl">
                {/* Node 1: Client UI */}
                <div className="p-3.5 rounded-lg border border-border bg-card shadow-sm text-center w-32 hover:border-primary/40 transition-colors">
                  <Cloud className="size-5 mx-auto text-blue-500 mb-1.5" />
                  <div className="text-xs font-semibold text-foreground">Web Client</div>
                  <div className="text-[10px] text-muted-foreground">Next.js 15</div>
                </div>

                <div className="h-6 w-0.5 md:h-0.5 md:w-8 bg-border" />

                {/* Node 2: Gateway */}
                <div className="p-3.5 rounded-lg border border-blue-500/40 bg-blue-500/5 shadow-sm text-center w-36 hover:border-blue-500 transition-colors">
                  <Cpu className="size-5 mx-auto text-blue-500 mb-1.5" />
                  <div className="text-xs font-semibold text-foreground">API Gateway</div>
                  <div className="text-[10px] text-muted-foreground">Rate Limiter / Envoy</div>
                </div>

                <div className="h-6 w-0.5 md:h-0.5 md:w-8 bg-border" />

                {/* Node 3: Services & DB */}
                <div className="flex flex-col gap-3">
                  <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 shadow-sm text-center w-36">
                    <Server className="size-4 mx-auto text-emerald-500 mb-1" />
                    <div className="text-xs font-semibold text-foreground">Payment Service</div>
                    <div className="text-[10px] text-muted-foreground">Go / gRPC</div>
                  </div>
                  <div className="p-3 rounded-lg border border-purple-500/40 bg-purple-500/5 shadow-sm text-center w-36">
                    <Database className="size-4 mx-auto text-purple-500 mb-1" />
                    <div className="text-xs font-semibold text-foreground">PostgreSQL</div>
                    <div className="text-[10px] text-muted-foreground">Primary Replica</div>
                  </div>
                </div>
              </div>

              {/* Floating Collaborator Cursors */}
              <div className="absolute top-8 right-16 z-20 flex items-center gap-1.5 animate-bounce">
                <MousePointer2 className="size-4 text-blue-500 fill-blue-500 -rotate-90" />
                <span className="text-[10px] font-medium bg-blue-500 text-white px-2 py-0.5 rounded-full shadow-md">
                  Sarah (Arch Lead)
                </span>
              </div>
              <div className="absolute bottom-8 left-12 z-20 hidden sm:flex items-center gap-1.5">
                <MousePointer2 className="size-4 text-emerald-500 fill-emerald-500 -rotate-90" />
                <span className="text-[10px] font-medium bg-emerald-500 text-white px-2 py-0.5 rounded-full shadow-md">
                  Alex (DevOps)
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Bento Grid */}
        <section id="features" className="w-full mb-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-3">
              Engineered for Modern Architecture Teams
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              Everything you need to conceptualize, iterate, and document distributed software systems with zero friction.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-xl border border-border/70 bg-card hover:border-border transition-all shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <Code2 className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-base text-foreground mb-2">Mermaid-as-Code Engine</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Write diagrams with familiar text syntax or prompt the AI assistant. Insert instantly onto an editable visual canvas with theme-aware styling.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-border/40 text-[11px] text-muted-foreground font-mono">
                Syntax: sequence, flow, ERD, class
              </div>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-xl border border-border/70 bg-card hover:border-border transition-all shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-base text-foreground mb-2">Multiplayer CRDT Collaboration</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Synchronize canvas state, document edits, and cursor presences over WebSockets with zero conflict lockouts. Work together in real time.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-border/40 text-[11px] text-muted-foreground font-mono">
                Powered by Yjs &amp; WebSockets
              </div>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-xl border border-border/70 bg-card hover:border-border transition-all shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-base text-foreground mb-2" id="stencils">Built-in Stencil Libraries</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Drag and drop pre-built components for Cloud Architecture, Flowcharts, Databases, and UI wireframing directly into your workspaces.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-border/40 text-[11px] text-muted-foreground font-mono">
                14+ curated architectural stencils
              </div>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-xl border border-border/70 bg-card hover:border-border transition-all shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-base text-foreground mb-2">Technical Documentation</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Never lose context. Pair visual canvas diagrams with rich markdown documentation for RFCs, design decisions, and architectural roadmaps.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-border/40 text-[11px] text-muted-foreground font-mono">
                Side-by-side Dual Mode
              </div>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-xl border border-border/70 bg-card hover:border-border transition-all shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-base text-foreground mb-2">Instant High-Res Exports</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Export diagrams to crisp SVGs, high-density PNGs, or PDF documentation packages ready for READMEs, PRs, and investor pitch decks.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-border/40 text-[11px] text-muted-foreground font-mono">
                Headless render pipeline
              </div>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-xl border border-border/70 bg-card hover:border-border transition-all shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-base text-foreground mb-2">Workspace &amp; Team Privacy</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Role-based access controls, invite links, and complete data ownership. Your technical diagrams remain private to your team.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-border/40 text-[11px] text-muted-foreground font-mono">
                PostgreSQL &amp; JWT auth
              </div>
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section id="workflow" className="w-full max-w-4xl mb-24 text-center">
          <div className="mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-3">
              How Diagramz Works
            </h2>
            <p className="text-sm text-muted-foreground">
              A streamlined three-step workflow from concept to living documentation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            <div className="p-5 rounded-lg border border-border/60 bg-muted/20">
              <div className="text-xs font-bold text-primary mb-2 font-mono">STEP 01</div>
              <h4 className="font-semibold text-foreground mb-1 text-sm">Code or Prompt</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Describe your architecture in Mermaid syntax or let the built-in AI generate the initial topology in seconds.
              </p>
            </div>
            <div className="p-5 rounded-lg border border-border/60 bg-muted/20">
              <div className="text-xs font-bold text-primary mb-2 font-mono">STEP 02</div>
              <h4 className="font-semibold text-foreground mb-1 text-sm">Refine on Canvas</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Position services, drop cloud stencils, connect queues, and author technical specifications side-by-side.
              </p>
            </div>
            <div className="p-5 rounded-lg border border-border/60 bg-muted/20">
              <div className="text-xs font-bold text-primary mb-2 font-mono">STEP 03</div>
              <h4 className="font-semibold text-foreground mb-1 text-sm">Collaborate &amp; Ship</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Share live links with your engineering team, review with real-time cursors, and export clean assets.
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA Banner */}
        <section className="w-full max-w-4xl p-10 rounded-2xl border border-border/70 bg-gradient-to-b from-card to-muted/30 text-center shadow-lg relative overflow-hidden">
          <div className="relative z-10 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Ready to modernize your system architecture?
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
              Create your free workspace in seconds. No credit card required.
            </p>
            <div className="pt-2">
              <Link href={isAuthenticated ? '/dashboard' : '/register'}>
                <Button size="lg" className="h-11 px-8 text-sm font-semibold gap-2 shadow-sm">
                  {isAuthenticated ? 'Go to Dashboard' : 'Launch Diagramz Free'} <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 bg-background text-xs text-muted-foreground z-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
              D
            </div>
            <span className="font-semibold text-foreground">Diagramz</span>
            <span>&copy; {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            {isAuthenticated ? (
              <Link href="/dashboard" className="hover:text-foreground transition-colors font-semibold text-foreground">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
                <Link href="/register" className="hover:text-foreground transition-colors">Get Started</Link>
              </>
            )}
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
