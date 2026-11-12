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
 * Renders a continuous, variable-width quad-ribbon mesh with sub-pixel vector anti-aliasing.
 * Eliminates discrete width steps and saw-tooth notches for silky-smooth organic edges.
 */
function renderContinuousLaserRibbon(
  ctx: CanvasRenderingContext2D,
  points: LaserPoint[],
  baseWidth: number,
  alphaScale: number,
  paletteColor: (alpha: number) => string,
  now: number,
  activeFadeMs: number,
  hoverFadeMs: number,
  onlyActive: boolean = false
) {
  const N = points.length;
  if (N < 2) return;

  // 1. Calculate normals, radii, and alphas continuously for every point
  const normals: { x: number; y: number }[] = [];
  const radii: number[] = [];
  const alphas: number[] = [];

  for (let i = 0; i < N; i++) {
    const p = points[i];
    const prev = points[i - 1] ?? points[i];
    const next = points[i + 1] ?? points[i];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy);

    if (len < 1e-5) {
      normals.push(normals[normals.length - 1] ?? { x: 0, y: -1 });
    } else {
      normals.push({ x: -dy / len, y: dx / len });
    }

    const age = now - p.time;
    const maxLife = p.isDown ? activeFadeMs : hoverFadeMs;
    const life = Math.max(0, Math.min(1, 1 - age / maxLife));
    const easeLife = Math.pow(life, 0.72);

    // Continuous non-linear radius tapering down to delicate tip at tail
    const r = Math.max(0.75, (baseWidth * 0.5) * (0.12 + 0.88 * Math.pow(life, 0.85)));
    radii.push(r);
    alphas.push(p.isDown ? easeLife : easeLife * 0.7);
  }

  // 2. Compute left and right boundary vertices along the continuous normal field
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];

  for (let i = 0; i < N; i++) {
    const p = points[i];
    const nx = normals[i].x;
    const ny = normals[i].y;
    const r = radii[i];
    left.push({ x: p.x + nx * r, y: p.y + ny * r });
    right.push({ x: p.x - nx * r, y: p.y - ny * r });
  }

  // 3. Render quads with continuous shared boundaries and round fillets
  for (let i = 0; i < N - 1; i++) {
    const pNext = points[i + 1];
    if (onlyActive && !pNext.isDown) continue;

    const a = alphas[i + 1] * alphaScale;
    if (a <= 0.01) continue;

    ctx.fillStyle = paletteColor(a);

    // Quad body
    ctx.beginPath();
    ctx.moveTo(left[i].x, left[i].y);
    ctx.lineTo(left[i + 1].x, left[i + 1].y);
    ctx.lineTo(right[i + 1].x, right[i + 1].y);
    ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
    ctx.fill();

    // Round fillet at joint to guarantee seamless curvature on sharp turns
    ctx.beginPath();
    ctx.arc(points[i + 1].x, points[i + 1].y, radii[i + 1], 0, Math.PI * 2);
    ctx.fill();
  }

  // Tail cap at start
  const aTail = alphas[0] * alphaScale;
  if ((!onlyActive || points[0].isDown) && aTail > 0.01) {
    ctx.fillStyle = paletteColor(aTail);
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, radii[0], 0, Math.PI * 2);
    ctx.fill();
  }

  // Head cap at end
  const aHead = alphas[N - 1] * alphaScale;
  if ((!onlyActive || points[N - 1].isDown) && aHead > 0.01) {
    ctx.fillStyle = paletteColor(aHead);
    ctx.beginPath();
    ctx.arc(points[N - 1].x, points[N - 1].y, radii[N - 1], 0, Math.PI * 2);
    ctx.fill();
  }
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
    let dpr = Math.max(1, window.devicePixelRatio || 1);

    const updateSize = () => {
      if (!canvas || !container) return;
      cachedRect = container.getBoundingClientRect();
      const currentDpr = Math.max(1, window.devicePixelRatio || 1);
      dpr = currentDpr;

      const pixelW = Math.round(cachedRect.width * currentDpr);
      const pixelH = Math.round(cachedRect.height * currentDpr);

      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW;
        canvas.height = pixelH;
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

      // ─── Draw Radiant Laser Brush Stroke (Continuous Quad Ribbon) ─────────
      if (trail.length >= 2) {
        // Apply Chaikin corner-cutting for silky-smooth organic curves
        const smoothed = trail.length >= 3 ? chaikinSmooth(trail) : trail;

        const baseActiveW = widthConfig.activeWidth;
        const baseHoverW = widthConfig.hoverWidth;
        const isCurrentlyDown = cursor.isDown;
        const baseW = isCurrentlyDown ? baseActiveW : baseHoverW;

        // Pass 1: Luminous Ambient Glow Aura (Subtle & Refined Optical Radiation)
        renderContinuousLaserRibbon(
          ctx,
          smoothed,
          baseW * 1.6,
          0.11,
          (a) => palette.rgba(a),
          now,
          activeFadeMs,
          hoverFadeMs
        );

        // Pass 2: Saturated Neon Brush Core
        renderContinuousLaserRibbon(
          ctx,
          smoothed,
          baseW * 0.95,
          0.92,
          (a) => palette.rgba(a),
          now,
          activeFadeMs,
          hoverFadeMs
        );

        // Pass 3: White-Hot Photonic Center Spine
        renderContinuousLaserRibbon(
          ctx,
          smoothed,
          baseW * 0.24,
          0.92,
          (a) => `rgba(255, 255, 255, ${a})`,
          now,
          activeFadeMs,
          hoverFadeMs,
          true
        );
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

        // Refined Subtle Outer Halo Gradient (Soft, restrained light)
        const haloRadius = isDown ? 11 + pulse * 2 : 7.5 + pulse;
        const grad = ctx.createRadialGradient(curX, curY, 0.5, curX, curY, haloRadius);
        grad.addColorStop(0, palette.rgba(isDown ? 0.4 : 0.25));
        grad.addColorStop(0.6, palette.rgba(isDown ? 0.12 : 0.06));
        grad.addColorStop(1, palette.rgba(0));

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(curX, curY, haloRadius, 0, Math.PI * 2);
        ctx.fill();

        // Active Press Subtle Ring
        if (isDown) {
          ctx.beginPath();
          ctx.arc(curX, curY, 7 + pulse * 1.5, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + pulse * 0.2})`;
          ctx.lineWidth = 0.9;
          ctx.stroke();
        }

        // Saturated Laser Diode Body
        ctx.fillStyle = palette.core;
        ctx.beginPath();
        ctx.arc(curX, curY, isDown ? 4.8 : 3.8, 0, Math.PI * 2);
        ctx.fill();

        // Crisp White-Hot Focal Center
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(curX, curY, isDown ? 1.8 : 1.4, 0, Math.PI * 2);
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
