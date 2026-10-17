'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sliders,
  Magnet,
  Spline,
  GitCommit,
  MapPin,
  Check,
  Sparkles,
  CircleDot,
  Grid3X3,
  Plus,
  Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ZCanvasSettings,
  ZCanvasGridStyle,
  ZCanvasGridSize,
  ZCanvasBackgroundTone,
  ZCanvasFontFamily,
  ZCanvasStylePreset,
  ZCanvasSloppiness,
} from '../core/settings';

export interface ZCanvasSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ZCanvasSettings;
  onUpdateSettings: (newSettings: Partial<ZCanvasSettings>) => void;
  onResetViewport?: () => void;
  onZoomToFit?: () => void;
  onClearCanvas?: () => void;
  onAlignNodes?: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onDistributeNodes?: (direction: 'horizontal' | 'vertical') => void;
  hasSelection?: boolean;
  onExportSvg?: () => void;
  onExportPng?: () => void;
}

export function ZCanvasSettingsDialog({
  open,
  onOpenChange,
  settings,
  onUpdateSettings,
}: ZCanvasSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<'grid' | 'routing'>('grid');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-border/80 bg-card/95 backdrop-blur-3xl text-foreground shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/50 bg-surface-secondary/20">
          <div className="flex items-center gap-3.5 pr-8">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
              <Sliders className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-semibold tracking-tight text-foreground">
                  Canvas Settings
                </DialogTitle>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50">
                  ,
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                Adjust grid, snapping behavior, colors, and typography
              </DialogDescription>
            </div>
          </div>

          {/* Minimalist Segmented Tab Navigation */}
          <div className="mt-4 p-1 bg-surface-secondary/60 border border-border/60 rounded-xl grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('grid')}
              className={cn(
                'py-1.5 px-3 text-xs font-medium rounded-lg transition-all text-center',
                activeTab === 'grid'
                  ? 'bg-card text-foreground font-semibold shadow-xs border border-border/40'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Grid &amp; Snap
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('routing')}
              className={cn(
                'py-1.5 px-3 text-xs font-medium rounded-lg transition-all text-center',
                activeTab === 'routing'
                  ? 'bg-card text-foreground font-semibold shadow-xs border border-border/40'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Style &amp; Fonts
            </button>
          </div>
        </div>

        {/* Scrollable Content Body with Custom Sleek Scrollbar */}
        <div
          className={cn(
            'px-6 py-5 space-y-6 overflow-y-auto flex-1 overscroll-contain',
            '[&::-webkit-scrollbar]:w-1.5',
            '[&::-webkit-scrollbar-track]:bg-transparent',
            '[&::-webkit-scrollbar-thumb]:rounded-full',
            '[&::-webkit-scrollbar-thumb]:bg-border/60',
            'hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30'
          )}
        >
          {/* TAB 1: Grid & Snapping */}
          {activeTab === 'grid' && (
            <div className="space-y-5">
              {/* Grid Pattern Selection */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2.5">
                  Grid Pattern
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'dots', label: 'Dots', icon: CircleDot, desc: 'Subtle dots' },
                      { id: 'mesh', label: 'Mesh', icon: Grid3X3, desc: 'Graph lines' },
                      { id: 'cross', label: 'Crosses', icon: Plus, desc: 'Plus marks' },
                      { id: 'none', label: 'Blank', icon: Square, desc: 'Clean canvas' },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    const isSelected = settings.gridStyle === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onUpdateSettings({ gridStyle: item.id as ZCanvasGridStyle })}
                        className={cn(
                          'p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-2.5',
                          isSelected
                            ? 'border-primary/80 bg-primary/8 ring-1 ring-primary/40 shadow-xs'
                            : 'border-border/60 bg-card/60 hover:bg-muted/40 hover:border-border'
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <Icon className={cn('w-4 h-4', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                          {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                        </div>
                        <div>
                          <div className={cn('text-xs font-semibold leading-none', isSelected ? 'text-primary' : 'text-foreground')}>
                            {item.label}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1 truncate">{item.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grid Resolution / Spacing */}
              {settings.gridStyle !== 'none' && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2.5">
                    Grid Density
                  </label>
                  <div className="grid grid-cols-4 gap-2 p-1 bg-surface-secondary/40 border border-border/60 rounded-xl">
                    {(
                      [
                        { size: 16, label: '16px', tag: 'Compact' },
                        { size: 24, label: '24px', tag: 'Default' },
                        { size: 32, label: '32px', tag: 'Medium' },
                        { size: 48, label: '48px', tag: 'Spacious' },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.size}
                        type="button"
                        onClick={() => onUpdateSettings({ gridSize: item.size as ZCanvasGridSize })}
                        className={cn(
                          'py-2 px-1 rounded-lg text-center transition-all',
                          settings.gridSize === item.size
                            ? 'bg-card text-foreground font-semibold shadow-xs border border-border/40'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <div className="text-xs font-mono font-medium">{item.label}</div>
                        <div className="text-[9px] text-muted-foreground">{item.tag}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Snapping Controls with Clean Toggle Switches */}
              <div className="pt-2 border-t border-border/50 space-y-2.5">
                <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card/40">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Magnet className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-foreground">Snap to Grid</div>
                      <div className="text-[11px] text-muted-foreground">
                        Snap nodes and resizing anchors to grid points
                      </div>
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={settings.snapToGrid}
                    onChange={() => onUpdateSettings({ snapToGrid: !settings.snapToGrid })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card/40">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-500 shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-foreground">Smart Alignment Guides</div>
                      <div className="text-[11px] text-muted-foreground">
                        Display magnetic dynamic guidelines when aligning nodes
                      </div>
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={settings.showGuides}
                    onChange={() => onUpdateSettings({ showGuides: !settings.showGuides })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Routing & Display */}
          {activeTab === 'routing' && (
            <div className="space-y-5">
              {/* Connector Routing */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2.5">
                  Default Connector Routing
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ edgeRouting: 'bezier' })}
                    className={cn(
                      'p-3.5 rounded-xl border text-left transition-all flex items-start gap-3',
                      settings.edgeRouting === 'bezier'
                        ? 'border-primary/80 bg-primary/8 ring-1 ring-primary/40 shadow-xs'
                        : 'border-border/60 bg-card/60 hover:bg-muted/40'
                    )}
                  >
                    <Spline className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <div className={cn('text-xs font-semibold', settings.edgeRouting === 'bezier' ? 'text-primary' : 'text-foreground')}>
                        Curved Bezier
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Fluid architectural connections with smooth paths
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ edgeRouting: 'step' })}
                    className={cn(
                      'p-3.5 rounded-xl border text-left transition-all flex items-start gap-3',
                      settings.edgeRouting === 'step'
                        ? 'border-primary/80 bg-primary/8 ring-1 ring-primary/40 shadow-xs'
                        : 'border-border/60 bg-card/60 hover:bg-muted/40'
                    )}
                  >
                    <GitCommit className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                    <div>
                      <div className={cn('text-xs font-semibold', settings.edgeRouting === 'step' ? 'text-primary' : 'text-foreground')}>
                        Orthogonal Step
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Clean 90° right angles optimal for flowcharts
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Minimap Display Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card/40">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-foreground">Interactive Minimap</div>
                    <div className="text-[11px] text-muted-foreground">
                      Floating thumbnail viewport in bottom right corner
                    </div>
                  </div>
                </div>
                <ToggleSwitch
                  checked={settings.showMinimap}
                  onChange={() => onUpdateSettings({ showMinimap: !settings.showMinimap })}
                />
              </div>

              {/* Canvas Background Tone */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2.5">
                  Canvas Background Tone
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'default', label: 'Default', desc: 'Design Token' },
                      { id: 'warm', label: 'Warm', desc: 'Calm Tint' },
                      { id: 'cool', label: 'Slate', desc: 'Cool Gray' },
                      { id: 'contrast', label: 'Solid', desc: 'High Contrast' },
                    ] as const
                  ).map((tone) => (
                    <button
                      key={tone.id}
                      type="button"
                      onClick={() => onUpdateSettings({ backgroundTone: tone.id as ZCanvasBackgroundTone })}
                      className={cn(
                        'p-2.5 rounded-xl border text-center transition-all',
                        settings.backgroundTone === tone.id
                          ? 'border-primary/80 bg-primary/8 font-semibold text-primary ring-1 ring-primary/40'
                          : 'border-border/60 bg-card/60 hover:bg-muted/40 text-foreground'
                      )}
                    >
                      <div className="text-xs font-medium">{tone.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{tone.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Canvas Font Family */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2.5">
                  Diagram Typography / Font
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'sans', label: 'Inter Sans', desc: 'Modern & Clean', fontClass: 'font-sans' },
                      { id: 'mono', label: 'Monospace', desc: 'Code & Technical', fontClass: 'font-mono' },
                      { id: 'serif', label: 'Editorial', desc: 'Elegant Serif', fontClass: 'font-serif' },
                      { id: 'handwriting', label: 'Handwritten', desc: 'Excali Sketch', fontClass: 'font-sans tracking-wide' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => onUpdateSettings({ fontFamily: f.id as ZCanvasFontFamily })}
                      className={cn(
                        'p-2.5 rounded-xl border text-center transition-all',
                        settings.fontFamily === f.id
                          ? 'border-primary/80 bg-primary/8 font-semibold text-primary ring-1 ring-primary/40'
                          : 'border-border/60 bg-card/60 hover:bg-muted/40 text-foreground'
                      )}
                    >
                      <div className={cn('text-xs font-medium', f.fontClass)}>{f.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{f.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Default Font Size */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2.5">
                  Default Font Size
                </label>
                <div className="space-y-2 p-3 rounded-xl border border-border/60 bg-card/60">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ fontSize: Math.max(8, (settings.fontSize ?? 16) - 2) })}
                      title="Decrease font size (-2px)"
                      className="h-7 w-7 flex items-center justify-center rounded-lg border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted text-sm font-semibold cursor-pointer transition-colors"
                    >
                      -
                    </button>
                    <div className="relative flex-1 flex items-center">
                      <input
                        type="number"
                        min={8}
                        max={120}
                        value={settings.fontSize ?? 16}
                        onChange={(e) => {
                          const num = parseInt(e.target.value, 10);
                          if (!isNaN(num) && num >= 8 && num <= 120) {
                            onUpdateSettings({ fontSize: num });
                          }
                        }}
                        className="w-full h-7 px-2 pr-6 text-center text-xs font-medium rounded-lg border border-border/70 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                      />
                      <span className="absolute right-2 text-[10px] text-muted-foreground pointer-events-none">px</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ fontSize: Math.min(120, (settings.fontSize ?? 16) + 2) })}
                      title="Increase font size (+2px)"
                      className="h-7 w-7 flex items-center justify-center rounded-lg border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted text-sm font-semibold cursor-pointer transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[12, 14, 16, 20, 24, 32].map((sz) => {
                      const isAct = (settings.fontSize ?? 16) === sz;
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => onUpdateSettings({ fontSize: sz })}
                          className={cn(
                            'h-6 rounded-md text-[11px] font-medium border transition-colors cursor-pointer',
                            isAct
                              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                              : 'border-border/60 hover:bg-muted text-muted-foreground'
                          )}
                        >
                          {sz}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Diagram Sloppiness with Clean SVG Icons */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2.5">
                  Diagram Sloppiness (Hand-drawn vs Precision)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        id: 'architectural',
                        label: 'Architectural',
                        desc: 'Crisp ruler-straight lines',
                        icon: (
                          <svg viewBox="0 0 24 24" className="w-5 h-3.5 mx-auto" fill="none" stroke="currentColor">
                            <line x1="2" y1="12" x2="22" y2="12" strokeWidth="2.2" strokeLinecap="round" />
                          </svg>
                        ),
                      },
                      {
                        id: 'artist',
                        label: 'Artist',
                        desc: 'Subtle organic sketch',
                        icon: (
                          <svg viewBox="0 0 24 24" className="w-5 h-3.5 mx-auto" fill="none" stroke="currentColor">
                            <path d="M2 13 Q 7 8, 12 12 T 22 11" strokeWidth="2.2" strokeLinecap="round" />
                          </svg>
                        ),
                      },
                      {
                        id: 'cartoonist',
                        label: 'Cartoonist',
                        desc: 'Playful expressive sketch',
                        icon: (
                          <svg viewBox="0 0 24 24" className="w-5 h-3.5 mx-auto" fill="none" stroke="currentColor">
                            <path d="M2 14 C 5 7, 7 17, 10 11 C 13 5, 15 18, 18 10 C 20 6, 21 15, 22 12" strokeWidth="2.2" strokeLinecap="round" />
                          </svg>
                        ),
                      },
                    ] as const
                  ).map((slop) => (
                    <button
                      key={slop.id}
                      type="button"
                      onClick={() => onUpdateSettings({ sloppiness: slop.id as ZCanvasSloppiness })}
                      className={cn(
                        'p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5',
                        settings.sloppiness === slop.id
                          ? 'border-primary/80 bg-primary/8 font-semibold text-primary ring-1 ring-primary/40 shadow-xs'
                          : 'border-border/60 bg-card/60 hover:bg-muted/40 text-foreground'
                      )}
                    >
                      <div className="w-full flex justify-center py-0.5 text-current opacity-90">
                        {slop.icon}
                      </div>
                      <div className="text-xs font-medium">{slop.label}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight truncate w-full">
                        {slop.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Stroke Style with Visual Icons */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2.5">
                  Default Stroke Style
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        id: 'solid',
                        label: 'Solid',
                        icon: (
                          <svg viewBox="0 0 24 24" className="w-6 h-3 mx-auto" fill="none" stroke="currentColor">
                            <line x1="2" y1="12" x2="22" y2="12" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                        ),
                      },
                      {
                        id: 'dashed',
                        label: 'Dashed',
                        icon: (
                          <svg viewBox="0 0 24 24" className="w-6 h-3 mx-auto" fill="none" stroke="currentColor">
                            <line x1="2" y1="12" x2="22" y2="12" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 3.5" />
                          </svg>
                        ),
                      },
                      {
                        id: 'dotted',
                        label: 'Dotted',
                        icon: (
                          <svg viewBox="0 0 24 24" className="w-6 h-3 mx-auto" fill="none" stroke="currentColor">
                            <line x1="2" y1="12" x2="22" y2="12" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1.5 3.5" />
                          </svg>
                        ),
                      },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => onUpdateSettings({ strokeStyle: st.id, penStrokeStyle: st.id })}
                      className={cn(
                        'p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5',
                        (settings.strokeStyle ?? 'solid') === st.id
                          ? 'border-primary/80 bg-primary/8 font-semibold text-primary ring-1 ring-primary/40 shadow-xs'
                          : 'border-border/60 bg-card/60 hover:bg-muted/40 text-foreground'
                      )}
                    >
                      <div className="w-full flex justify-center py-0.5 text-current opacity-90">
                        {st.icon}
                      </div>
                      <div className="text-xs font-medium">{st.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Stroke Width with Visual Proportional Weight Lines */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2.5">
                  Default Stroke Width
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 6].map((w) => {
                    const isAct = (settings.strokeWidth ?? 2) === w;
                    return (
                      <button
                        key={w}
                        type="button"
                        onClick={() => onUpdateSettings({ strokeWidth: w })}
                        className={cn(
                          'p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5',
                          isAct
                            ? 'border-primary/80 bg-primary/8 font-semibold text-primary ring-1 ring-primary/40 shadow-xs'
                            : 'border-border/60 bg-card/60 hover:bg-muted/40 text-foreground'
                        )}
                      >
                        <div className="w-full flex justify-center py-1 text-current">
                          <svg viewBox="0 0 24 24" className="w-5 h-3" fill="none" stroke="currentColor">
                            <line x1="3" y1="12" x2="21" y2="12" strokeWidth={Math.min(5.5, Math.max(1.2, w * 1.1))} strokeLinecap="round" />
                          </svg>
                        </div>
                        <div className="text-[11px] font-medium">{w}px</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Diagram Style Preset */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2.5">
                  Diagram Aesthetic Preset
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'clean', label: 'Clean', desc: 'Crisp borders & modern layout' },
                      { id: 'sketch', label: 'Sketch', desc: 'Hand-drawn rough outlines' },
                      { id: 'soft', label: 'Soft', desc: 'Gentle rounded aesthetics' },
                      { id: 'technical', label: 'Technical', desc: 'High contrast & structured' },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onUpdateSettings({ stylePreset: p.id as ZCanvasStylePreset })}
                      className={cn(
                        'p-2.5 rounded-xl border text-center transition-all',
                        settings.stylePreset === p.id
                          ? 'border-primary/80 bg-primary/8 font-semibold text-primary ring-1 ring-primary/40'
                          : 'border-border/60 bg-card/60 hover:bg-muted/40 text-foreground'
                      )}
                    >
                      <div className="text-xs font-medium">{p.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pencil & Freehand Stroke Preset */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2.5">
                  Freehand Pencil Preset
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'precise', label: 'Precise', desc: 'Fine nib, high smoothing' },
                      { id: 'natural', label: 'Natural', desc: 'Balanced everyday nib' },
                      { id: 'sketch', label: 'Sketchy', desc: 'Thin nib, follows closely' },
                      { id: 'marker', label: 'Marker', desc: 'Bold round nib, blunt ends' },
                    ] as const
                  ).map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => onUpdateSettings({ strokePreset: sp.id })}
                      className={cn(
                        'p-2.5 rounded-xl border text-center transition-all',
                        settings.strokePreset === sp.id
                          ? 'border-primary/80 bg-primary/8 font-semibold text-primary ring-1 ring-primary/40'
                          : 'border-border/60 bg-card/60 hover:bg-muted/40 text-foreground'
                      )}
                    >
                      <div className="text-xs font-medium">{sp.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{sp.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border/50 bg-surface-secondary/30 flex items-center justify-between text-xs text-muted-foreground">
          <span className="text-[11px]">Settings persist automatically in local storage</span>
          <Button
            size="sm"
            className="h-8 px-4 rounded-xl text-xs font-medium"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        checked ? 'bg-primary' : 'bg-muted-foreground/30'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
          checked ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  );
}
