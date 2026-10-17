'use client';

import React, { useEffect, useState } from 'react';
import { Layers, Sparkles, Command } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiagramLoaderScreenProps {
  title?: string;
  subtitle?: string;
  fullscreen?: boolean;
  className?: string;
}

const LOADING_STAGES = [
  'Initializing vector canvas engine...',
  'Parsing diagram nodes & stencils...',
  'Routing orthogonal connector paths...',
  'Syncing collaborative document state...',
  'Finalizing high-precision render pipeline...',
];

const PRO_TIPS = [
  { key: 'Space + Drag', text: 'Pan around the infinite canvas' },
  { key: 'Double Click', text: 'Instantly add a note or node' },
  { key: 'Cmd / Ctrl + K', text: 'Search icons & architecture templates' },
  { key: 'Alt + Drag', text: 'Duplicate selected elements' },
  { key: 'D', text: 'Toggle Document & Canvas side-by-side' },
];

export function DiagramLoaderScreen({
  title,
  subtitle,
  fullscreen = true,
  className,
}: DiagramLoaderScreenProps) {
  const [stageIndex, setStageIndex] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [dots, setDots] = useState('');

  // Cycle loading status text
  useEffect(() => {
    const stageInterval = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % LOADING_STAGES.length);
    }, 1800);

    const tipInterval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % PRO_TIPS.length);
    }, 3600);

    const dotsInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 450);

    return () => {
      clearInterval(stageInterval);
      clearInterval(tipInterval);
      clearInterval(dotsInterval);
    };
  }, []);

  const activeTip = PRO_TIPS[tipIndex];

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center select-none overflow-hidden bg-background text-foreground transition-colors duration-300',
        fullscreen ? 'fixed inset-0 z-50 h-screen w-screen' : 'w-full h-full min-h-[400px]',
        className
      )}
    >
      {/* ─── Canvas Dot Grid Ambient Background ─── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60 dark:opacity-40"
        style={{
          backgroundImage: `radial-gradient(currentColor 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          color: 'var(--canvas-dot, #D8D8D0)',
        }}
      />

      {/* ─── Ambient Glow Center Bloom ─── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] h-[320px] bg-gradient-to-tr from-primary/20 via-primary/5 to-cyan-500/10 blur-[90px] rounded-full pointer-events-none animate-pulse duration-[3500ms]" />

      {/* ─── Main Content Wrapper ─── */}
      <div className="relative z-10 flex flex-col items-center max-w-md px-6 text-center animate-in fade-in zoom-in-95 duration-500">
        
        {/* ─── Animated Eraser Diagram Blueprint Scene ─── */}
        <div className="relative w-[360px] sm:w-[420px] h-[190px] mb-6 flex items-center justify-center">
          <svg
            className="w-full h-full overflow-visible drop-shadow-sm"
            viewBox="0 0 420 190"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Connector gradient */}
              <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#635BFF" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#8B85FF" stopOpacity="1" />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.8" />
              </linearGradient>

              {/* Node glow shadow filter */}
              <filter id="nodeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#635BFF" floodOpacity="0.15" />
              </filter>
            </defs>

            {/* Connecting Paths with flowing dashes */}
            {/* Path 1: Client -> Engine */}
            <path
              id="path-client-engine"
              d="M 120 95 C 145 95, 145 95, 170 95"
              stroke="url(#edgeGradient)"
              strokeWidth="2"
              strokeDasharray="5 5"
              className="animate-eraser-flow"
            />

            {/* Path 2: Engine -> Vector Canvas (Upper branch) */}
            <path
              id="path-engine-canvas"
              d="M 280 80 C 300 80, 300 45, 320 45"
              stroke="url(#edgeGradient)"
              strokeWidth="2"
              strokeDasharray="5 5"
              className="animate-eraser-flow"
            />

            {/* Path 3: Engine -> Live Docs (Lower branch) */}
            <path
              id="path-engine-docs"
              d="M 280 110 C 300 110, 300 145, 320 145"
              stroke="url(#edgeGradient)"
              strokeWidth="2"
              strokeDasharray="5 5"
              className="animate-eraser-flow"
            />

            {/* Energy Particle Streams traveling along paths */}
            <circle r="3" fill="#8B85FF" filter="drop-shadow(0 0 4px #635BFF)">
              <animateMotion dur="1.8s" repeatCount="indefinite" path="M 120 95 C 145 95, 145 95, 170 95" />
            </circle>

            <circle r="3" fill="#06B6D4" filter="drop-shadow(0 0 4px #06B6D4)">
              <animateMotion dur="2.1s" repeatCount="indefinite" path="M 280 80 C 300 80, 300 45, 320 45" />
            </circle>

            <circle r="3" fill="#8B85FF" filter="drop-shadow(0 0 4px #635BFF)">
              <animateMotion dur="2.1s" repeatCount="indefinite" path="M 280 110 C 300 110, 300 145, 320 145" />
            </circle>

            {/* Junction Ports & Ping Rings */}
            <circle cx="120" cy="95" r="3" fill="#635BFF" />
            <circle cx="170" cy="95" r="3" fill="#635BFF" />
            <circle cx="280" cy="80" r="3" fill="#8B85FF" />
            <circle cx="280" cy="110" r="3" fill="#8B85FF" />
            <circle cx="320" cy="45" r="3" fill="#06B6D4" />
            <circle cx="320" cy="145" r="3" fill="#8B85FF" />

            {/* Pulsing ring on Engine port */}
            <circle cx="280" cy="80" r="6" stroke="#8B85FF" strokeWidth="1" opacity="0.6" className="animate-ping" />

            {/* ─── Node 1: Client Node (Left) ─── */}
            <g className="animate-eraser-float" style={{ animationDelay: '0s' }}>
              <rect
                x="25"
                y="68"
                width="95"
                height="54"
                rx="10"
                className="fill-card stroke-border"
                strokeWidth="1.2"
                filter="url(#nodeGlow)"
              />
              {/* Header bar */}
              <rect x="25" y="68" width="95" height="18" rx="10" className="fill-muted/40" />
              {/* Window dots */}
              <circle cx="35" cy="77" r="2.5" fill="#EF4444" opacity="0.8" />
              <circle cx="43" cy="77" r="2.5" fill="#F59E0B" opacity="0.8" />
              <circle cx="51" cy="77" r="2.5" fill="#10B981" opacity="0.8" />
              {/* Label */}
              <text x="35" y="103" className="fill-foreground font-sans text-[11px] font-semibold">
                Client
              </text>
              <rect x="35" y="109" width="45" height="4" rx="2" className="fill-muted-foreground/30" />
            </g>

            {/* ─── Node 2: Diagramz Engine (Center, Hero) ─── */}
            <g className="animate-eraser-float" style={{ animationDelay: '0.4s' }}>
              <rect
                x="170"
                y="60"
                width="110"
                height="70"
                rx="12"
                className="fill-card stroke-primary/50"
                strokeWidth="1.5"
                filter="url(#nodeGlow)"
              />
              {/* Top Accent Stripe */}
              <path
                d="M 170 70 A 10 10 0 0 1 180 60 L 270 60 A 10 10 0 0 1 280 70 L 280 72 L 170 72 Z"
                fill="url(#edgeGradient)"
                opacity="0.85"
              />
              {/* Inner content */}
              <text x="180" y="88" className="fill-foreground font-sans text-[11px] font-bold tracking-tight">
                Diagramz Core
              </text>
              {/* Mock code lines */}
              <rect x="180" y="97" width="55" height="4" rx="2" className="fill-primary/40" />
              <rect x="180" y="105" width="75" height="4" rx="2" className="fill-muted-foreground/30" />
              <rect x="180" y="113" width="40" height="4" rx="2" className="fill-muted-foreground/20" />
              {/* Active Pulse Pill */}
              <circle cx="264" cy="86" r="3" fill="#10B981" />
              <circle cx="264" cy="86" r="6" stroke="#10B981" strokeWidth="1" opacity="0.5" className="animate-ping" />
            </g>

            {/* ─── Node 3: Vector Canvas (Top Right) ─── */}
            <g className="animate-eraser-float" style={{ animationDelay: '0.8s' }}>
              <rect
                x="320"
                y="20"
                width="88"
                height="50"
                rx="10"
                className="fill-card stroke-border"
                strokeWidth="1.2"
                filter="url(#nodeGlow)"
              />
              <text x="330" y="42" className="fill-foreground font-sans text-[11px] font-semibold">
                Canvas
              </text>
              <rect x="330" y="49" width="50" height="4" rx="2" className="fill-cyan-500/40" />
              <rect x="330" y="56" width="35" height="4" rx="2" className="fill-muted-foreground/30" />
              {/* Diamond stencil shape preview */}
              <rect x="382" y="32" width="12" height="12" rx="2" className="stroke-cyan-500/60 fill-none" strokeWidth="1.2" transform="rotate(45 388 38)" />
            </g>

            {/* ─── Node 4: Document Engine (Bottom Right) ─── */}
            <g className="animate-eraser-float" style={{ animationDelay: '1.2s' }}>
              <rect
                x="320"
                y="120"
                width="88"
                height="50"
                rx="10"
                className="fill-card stroke-border"
                strokeWidth="1.2"
                filter="url(#nodeGlow)"
              />
              <text x="330" y="142" className="fill-foreground font-sans text-[11px] font-semibold">
                Doc Sync
              </text>
              <rect x="330" y="149" width="55" height="4" rx="2" className="fill-primary/40" />
              <rect x="330" y="156" width="40" height="4" rx="2" className="fill-muted-foreground/30" />
            </g>

            {/* ─── Live Collaborative Multiplayer Cursor ─── */}
            <g className="animate-eraser-cursor pointer-events-none drop-shadow-md">
              <path
                d="M 0 0 L 11 11 L 6.5 11.5 L 9 17 L 7 18 L 4.5 12.5 L 0 15 Z"
                fill="#635BFF"
                stroke="#FFFFFF"
                strokeWidth="1"
              />
              {/* User badge */}
              <g transform="translate(14, 12)">
                <rect x="0" y="0" width="58" height="16" rx="4" fill="#635BFF" />
                <text x="6" y="11" fill="#FFFFFF" fontSize="9" fontWeight="600" fontFamily="sans-serif">
                  Diagramz
                </text>
              </g>
            </g>
          </svg>
        </div>

        {/* ─── Diagram Title / Branded Identity Header ─── */}
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-5 h-5 rounded-md bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
            <Layers className="w-3 h-3" />
          </div>
          <h2 className="text-base font-semibold tracking-tight text-foreground line-clamp-1">
            {title ? title : 'Diagramz Workspace'}
          </h2>
        </div>

        {/* ─── Animated Stage Status ─── */}
        <div className="h-5 flex items-center justify-center gap-2 mb-4">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <p className="text-xs text-muted-foreground font-mono transition-all duration-300">
            {subtitle || LOADING_STAGES[stageIndex]}
            <span className="inline-block w-4 text-left font-bold">{dots}</span>
          </p>
        </div>

        {/* ─── Eraser Sleek Shimmer Progress Bar ─── */}
        <div className="w-48 h-1 bg-muted rounded-full overflow-hidden mb-6 relative">
          <div className="absolute inset-0 w-24 bg-gradient-to-r from-transparent via-primary to-transparent animate-eraser-progress rounded-full" />
        </div>

        {/* ─── Eraser Pro-Tip Footer Pill ─── */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 border border-border/70 backdrop-blur-sm text-xs text-muted-foreground shadow-xs transition-opacity duration-300">
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono font-medium text-foreground border border-border/80">
            {activeTip.key}
          </kbd>
          <span className="text-[11px] truncate">{activeTip.text}</span>
        </div>
      </div>
    </div>
  );
}
