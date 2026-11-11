'use client';

import React, { useRef, useEffect } from 'react';
import {
  LaserWidthMode,
  LaserDurationMode,
  LASER_WIDTH_CONFIGS,
  LASER_DURATION_CONFIGS,
  DEFAULT_LASER_COLOR,
  resolveLaserPalette,
} from '../laser/laser-theme';

interface LaserPoint {
  x: number;
  y: number;
  time: number;
  isDown: boolean;
}

export interface ZCanvasLaserOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  color?: string;
  glowColor?: string;
  width?: LaserWidthMode;
  trailDuration?: LaserDurationMode;
  onPanStart?: (clientX: number, clientY: number) => void;
  onPanMove?: (clientX: number, clientY: number) => void;
  onPanEnd?: () => void;
}

/**
 * High-performance Chaikin algorithm for organic curve smoothing.
 * Eliminates angular kinks and mouse-sampling staircase artifacts in O(N) time.
 */
function chaikinSmooth(pts: LaserPoint[]): LaserPoint[] {
  const n = pts.length;
  if (n < 3) return pts;
  const out: LaserPoint[] = [pts[0]];
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    out.push({
      x: 0.75 * p0.x + 0.25 * p1.x,
      y: 0.75 * p0.y + 0.25 * p1.y,
      time: 0.75 * p0.time + 0.25 * p1.time,
      isDown: p1.isDown,
    });
    out.push({
      x: 0.25 * p0.x + 0.75 * p1.x,
      y: 0.25 * p0.y + 0.75 * p1.y,
      time: 0.25 * p0.time + 0.75 * p1.time,
      isDown: p1.isDown,
    });
  }
  out.push(pts[n - 1]);
  return out;
}

/**
 * Draws a continuous curved path between indices startIdx and endIdx
 * using quadratic midpoint Bézier interpolation.
 */
function strokeCurveSection(
  ctx: CanvasRenderingContext2D,
  pts: LaserPoint[],
  startIdx: number,
  endIdx: number
) {
  const span = endIdx - startIdx + 1;
  if (span < 2) return;

  ctx.beginPath();
  ctx.moveTo(pts[startIdx].x, pts[startIdx].y);

  if (span === 2) {
    ctx.lineTo(pts[endIdx].x, pts[endIdx].y);
  } else {
    for (let i = startIdx; i < endIdx - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) * 0.5;
      const midY = (pts[i].y + pts[i + 1].y) * 0.5;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    ctx.quadraticCurveTo(
      pts[endIdx - 1].x,
      pts[endIdx - 1].y,
      pts[endIdx].x,
      pts[endIdx].y
    );
  }
  ctx.stroke();
}

export function ZCanvasLaserOverlay({
  containerRef,
  color = DEFAULT_LASER_COLOR,
  glowColor,
  width = 'normal',
  trailDuration = 'normal',
  onPanStart,
  onPanMove,
  onPanEnd,
}: ZCanvasLaserOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointsRef = useRef<LaserPoint[]>([]);

  // Instant hardware-tracked cursor position
  const cursorRef = useRef<{ x: number; y: number; isInside: boolean; isDown: boolean }>({
    x: -100,
    y: -100,
    isInside: false,
    isDown: false,
  });

  const isPanningRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  // Dynamic configuration based on user selection
  const widthConfig = LASER_WIDTH_CONFIGS[width] || LASER_WIDTH_CONFIGS.normal;
  const durationConfig = LASER_DURATION_CONFIGS[trailDuration] || LASER_DURATION_CONFIGS.normal;
  const palette = resolveLaserPalette(color, glowColor);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let isRunning = true;

    // Cache container rect to prevent layout reflow during pointermove & animation frames
    let cachedRect = container.getBoundingClientRect();
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const updateSize = () => {
      if (!canvas || !container) return;
      cachedRect = container.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(cachedRect.width);
      const h = Math.floor(cachedRect.height);

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    window.addEventListener('resize', updateSize, { passive: true });
    window.addEventListener('scroll', updateSize, { passive: true });

    // Filter out only identical zero-distance sub-pixel jitter (< 0.25px squared)
    const MIN_DIST_SQ = 0.25;

    const recordPoint = (x: number, y: number, now: number, isDown: boolean) => {
      const pts = pointsRef.current;
      const last = pts[pts.length - 1];
      if (!last) {
        pts.push({ x, y, time: now, isDown });
        return;
      }
      const dx = x - last.x;
      const dy = y - last.y;
      if (dx * dx + dy * dy >= MIN_DIST_SQ) {
        pts.push({ x, y, time: now, isDown });
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 1) {
        // Middle click pan
        isPanningRef.current = true;
        onPanStart?.(e.clientX, e.clientY);
        return;
      }
      if (e.button !== 0) return;

      cursorRef.current.isDown = true;
      cursorRef.current.isInside = true;
      const now = performance.now();
      const x = e.clientX - cachedRect.left;
      const y = e.clientY - cachedRect.top;

      cursorRef.current.x = x;
      cursorRef.current.y = y;
      recordPoint(x, y, now, true);

      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(render);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (isPanningRef.current || e.buttons === 4) {
        onPanMove?.(e.clientX, e.clientY);
        return;
      }

      const now = performance.now();
      const x = e.clientX - cachedRect.left;
      const y = e.clientY - cachedRect.top;
      const isDown = cursorRef.current.isDown;

      cursorRef.current.x = x;
      cursorRef.current.y = y;
      cursorRef.current.isInside = true;

      // Harvest high-DPI coalesced events for silky-smooth curves
      if (typeof e.getCoalescedEvents === 'function') {
        const coalesced = e.getCoalescedEvents();
        if (coalesced && coalesced.length > 0) {
          for (let i = 0; i < coalesced.length; i++) {
            const ev = coalesced[i];
            recordPoint(ev.clientX - cachedRect.left, ev.clientY - cachedRect.top, now, isDown);
          }
        } else {
          recordPoint(x, y, now, isDown);
        }
      } else {
        recordPoint(x, y, now, isDown);
      }

      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(render);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 1 || isPanningRef.current) {
        isPanningRef.current = false;
        onPanEnd?.();
        return;
      }
      cursorRef.current.isDown = false;
      try {
        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    };

    const onPointerEnter = (e: PointerEvent) => {
      cursorRef.current.isInside = true;
      cursorRef.current.x = e.clientX - cachedRect.left;
      cursorRef.current.y = e.clientY - cachedRect.top;
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(render);
      }
    };

    const onPointerLeave = () => {
      cursorRef.current.isInside = false;
      cursorRef.current.isDown = false;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerenter', onPointerEnter);
    canvas.addEventListener('pointerleave', onPointerLeave);

    const activeFadeMs = durationConfig.activeFadeMs;
    const hoverFadeMs = durationConfig.hoverFadeMs;

    // High-performance hardware-accelerated 120 FPS render loop
    const render = () => {
      if (!isRunning) return;

      const now = performance.now();

      // Expire old trail points beyond their respective lifespan
      const points = pointsRef.current;
      while (
        points.length > 0 &&
        now - points[0].time > (points[0].isDown ? activeFadeMs : hoverFadeMs)
      ) {
        points.shift();
      }

      // Fast clear using scaled coordinate space
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cachedRect.width, cachedRect.height);

      const cursor = cursorRef.current;

      // ─── Build Live Trail with 0ms Cursor Anchor ───────────────────────────
      const trail: LaserPoint[] = points.slice();
      if (cursor.isInside && trail.length > 0) {
        const last = trail[trail.length - 1];
        const dx = cursor.x - last.x;
        const dy = cursor.y - last.y;
        // Seamlessly connect the instantaneous cursor tip with 0ms lag
        if (dx * dx + dy * dy > 0.25) {
          trail.push({
            x: cursor.x,
            y: cursor.y,
            time: now,
            isDown: cursor.isDown,
          });
        }
      }

      // ─── Draw Radiant Laser Brush Stroke ──────────────────────────────────
      if (trail.length >= 2) {
        // Apply Chaikin corner-cutting for silky-smooth organic curves
        const smoothed = trail.length >= 3 ? chaikinSmooth(trail) : trail;
        const count = smoothed.length;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Divide into progressive continuous sections for smooth width & alpha tapering
        const numSections = Math.min(18, Math.max(1, Math.floor(count / 3)));

        // Precompute section properties
        const sectionProps = [];
        for (let s = 0; s < numSections; s++) {
          const startIdx = Math.floor((s * (count - 1)) / numSections);
          const endIdx = Math.floor(((s + 1) * (count - 1)) / numSections);
          const pEnd = smoothed[endIdx];
          const age = now - pEnd.time;
          const maxLife = pEnd.isDown ? activeFadeMs : hoverFadeMs;
          const life = Math.max(0, Math.min(1, 1 - age / maxLife));
          const easeLife = Math.pow(life, 0.72);
          const baseW = pEnd.isDown ? widthConfig.activeWidth : widthConfig.hoverWidth;
          const width = Math.max(1.8, baseW * (0.18 + 0.82 * Math.pow(life, 0.8)));
          const alpha = pEnd.isDown ? easeLife : easeLife * 0.7;

          sectionProps.push({
            startIdx,
            endIdx,
            width,
            alpha,
            isDown: pEnd.isDown,
          });
        }

        // Pass 1: Luminous Ambient Glow Aura (Optical Radiation)
        for (let s = 0; s < numSections; s++) {
          const sp = sectionProps[s];
          if (sp.alpha <= 0.02) continue;
          ctx.lineWidth = Math.max(3, sp.width * 2.6);
          ctx.strokeStyle = palette.rgba(sp.alpha * 0.24);
          strokeCurveSection(ctx, smoothed, sp.startIdx, sp.endIdx);
        }

        // Pass 2: Saturated Neon Brush Core
        for (let s = 0; s < numSections; s++) {
          const sp = sectionProps[s];
          if (sp.alpha <= 0.02) continue;
          ctx.lineWidth = Math.max(1.5, sp.width);
          ctx.strokeStyle = palette.rgba(sp.alpha * 0.96);
          strokeCurveSection(ctx, smoothed, sp.startIdx, sp.endIdx);
        }

        // Pass 3: White-Hot Photonic Center Spine
        for (let s = 0; s < numSections; s++) {
          const sp = sectionProps[s];
          if (!sp.isDown || sp.alpha <= 0.12) continue;
          ctx.lineWidth = Math.max(1, sp.width * 0.32);
          ctx.strokeStyle = `rgba(255, 255, 255, ${sp.alpha * 0.95})`;
          strokeCurveSection(ctx, smoothed, sp.startIdx, sp.endIdx);
        }
      }

      // ─── Draw Radiant Laser Diode Dot ─────────────────────────────────────
      if (
        cursor.isInside &&
        cursor.x >= 0 &&
        cursor.y >= 0 &&
        cursor.x <= cachedRect.width &&
        cursor.y <= cachedRect.height
      ) {
        const curX = cursor.x;
        const curY = cursor.y;
        const isDown = cursor.isDown;
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.008);

        // Radiant Outer Halo Gradient (Fast GPU radial shader simulation)
        const haloRadius = isDown ? 22 + pulse * 4 : 14 + pulse * 2;
        const grad = ctx.createRadialGradient(curX, curY, 0.5, curX, curY, haloRadius);
        grad.addColorStop(0, palette.rgba(isDown ? 0.75 : 0.48));
        grad.addColorStop(0.5, palette.rgba(isDown ? 0.28 : 0.15));
        grad.addColorStop(1, palette.rgba(0));

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(curX, curY, haloRadius, 0, Math.PI * 2);
        ctx.fill();

        // Active Press Shockwave Ring
        if (isDown) {
          ctx.beginPath();
          ctx.arc(curX, curY, 10 + pulse * 3, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 + pulse * 0.35})`;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }

        // Saturated Laser Diode Body
        ctx.fillStyle = palette.core;
        ctx.beginPath();
        ctx.arc(curX, curY, isDown ? 6.5 : 5, 0, Math.PI * 2);
        ctx.fill();

        // White-Hot Focal Center
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(curX, curY, isDown ? 2.8 : 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Continue render loop if active trail remains or cursor is inside
      if (points.length > 0 || cursor.isInside) {
        rafIdRef.current = requestAnimationFrame(render);
      } else {
        rafIdRef.current = null;
      }
    };

    rafIdRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('scroll', updateSize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerenter', onPointerEnter);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [containerRef, palette, widthConfig, durationConfig, onPanStart, onPanMove, onPanEnd]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="zcanvas-laser-overlay"
      className="absolute inset-0 w-full h-full pointer-events-auto cursor-none z-40 overflow-hidden select-none touch-none"
    />
  );
}
