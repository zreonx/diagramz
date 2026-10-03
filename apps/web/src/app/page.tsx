import Link from 'next/link';
import { ArrowRight, Sparkles, Layers, Users, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-white">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <span>Diagramz</span>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/60 border border-blue-800/50 text-blue-400 text-xs font-medium mb-6">
          <Sparkles className="w-3.5 h-3.5" /> Next-Generation AI Diagramming Workspace
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          Where Code, Canvas, and <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-300">
            Autonomous AI Converge
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mb-10 leading-relaxed">
          Diagramz blends the fluid infinite canvas of modern design tools with strict Mermaid-as-code
          syntax, real-time multiplayer CRDTs, and structured LLM architecture generation.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link href="/register">
            <Button size="lg" className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-xl shadow-blue-600/25 gap-2">
              Launch Workspace Free <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="h-11 px-6 border-slate-700 hover:bg-slate-900 text-slate-200">
              Sign In to Your Team
            </Button>
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-24 text-left w-full">
          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-100 mb-2">Strict AI Generation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              LLMs output strictly validated Mermaid diagrams rather than arbitrary pixel coordinates.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-100 mb-2">Multiplayer CRDTs</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Conflict-free state synchronization via Yjs over WebSockets with ephemeral cursor presence.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-cyan-600/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-100 mb-2">Instant Cloud Exports</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              High-resolution PNG, SVG, and PDF exports rendered headlessly and delivered via R2 storage.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        © 2026 Diagramz. All rights reserved. Built with Next.js 15, NestJS, and Neon PostgreSQL.
      </footer>
    </div>
  );
}
