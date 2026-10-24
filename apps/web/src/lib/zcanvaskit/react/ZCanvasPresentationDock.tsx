'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  X,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ZCanvasPage } from '../core/schema';

export interface ZCanvasPresentationDockProps {
  pages: ZCanvasPage[];
  activePageId: string;
  onSelectPage: (pageId: string) => void;
  isLaserActive: boolean;
  onToggleLaser: () => void;
  onExitPresentation: () => void;
}

export function ZCanvasPresentationDock({
  pages,
  activePageId,
  onSelectPage,
  isLaserActive,
  onToggleLaser,
  onExitPresentation,
}: ZCanvasPresentationDockProps) {
  const currentIndex = pages.findIndex((p) => p.id === activePageId);
  const hasPages = pages.length > 1;

  const handlePrev = () => {
    if (currentIndex > 0) onSelectPage(pages[currentIndex - 1].id);
  };

  const handleNext = () => {
    if (currentIndex < pages.length - 1) onSelectPage(pages[currentIndex + 1].id);
  };

  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      data-testid="zcanvas-presentation-dock"
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 p-1.5 rounded-2xl bg-card/95 backdrop-blur-2xl border border-border/80 shadow-2xl select-none animate-in fade-in-50 slide-in-from-bottom-3 duration-200"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {hasPages && (
        <>
          <button
            type="button"
            disabled={currentIndex <= 0}
            onClick={handlePrev}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Previous Page (Left Arrow)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-2 text-xs font-mono font-medium text-foreground">
            {currentIndex + 1} / {pages.length}
          </span>

          <button
            type="button"
            disabled={currentIndex >= pages.length - 1}
            onClick={handleNext}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Next Page (Right Arrow)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-border/60 mx-0.5" />
        </>
      )}

      {/* Laser Pointer Toggle */}
      <button
        type="button"
        onClick={onToggleLaser}
        className={cn(
          'flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer',
          isLaserActive
            ? 'bg-rose-500/15 text-rose-500 border border-rose-500/40 shadow-xs'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
        title="Toggle Neon Laser Pointer (L)"
      >
        <Sparkles className={cn('w-3.5 h-3.5', isLaserActive && 'text-rose-500 animate-pulse')} />
        <span>Laser (L)</span>
      </button>

      {/* Fullscreen Toggle */}
      <button
        type="button"
        onClick={toggleFullscreen}
        className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        title="Toggle Fullscreen"
      >
        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>

      <div className="w-[1px] h-4 bg-border/60 mx-0.5" />

      {/* Exit Presentation */}
      <button
        type="button"
        onClick={onExitPresentation}
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
        title="Exit Presentation Mode (Esc)"
      >
        <X className="w-3.5 h-3.5" />
        <span>Exit (Esc)</span>
      </button>
    </div>
  );
}
