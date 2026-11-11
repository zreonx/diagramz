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
}

export function ZCanvasLaserOverlay({
  containerRef,
  color = DEFAULT_LASER_COLOR,
  glowColor,
  width = 'normal',
  trailDuration = 'normal',
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

    // Minimum distance squared (3px threshold) to avoid flooding the buffer with 1000s of micro-points
    const MIN_DIST_SQ = 9;

    const recordPoint = (x: number, y: number, now: number, isDown: boolean) => {
      const pts = pointsRef.current;
      const last = pts[pts.length - 1];
      if (!last) {
        pts.push({ x, y, time: now, isDown });
        return;
      }
      const dx = x - last.x;
      const dy = y - last.y;
      if (dx * dx + dy * dy >= MIN_DIST_SQ || now - last.time > 16) {
        pts.push({ x, y, time: now, isDown });
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const isDown = cursorRef.current.isDown;
      const now = performance.now();
      const x = e.clientX - cachedRect.left;
      const y = e.clientY - cachedRect.top;

      cursorRef.current.x = x;
      cursorRef.current.y = y;
      cursorRef.current.isInside = true;

      // Harvest coalesced events if available for high-DPI curve smoothness
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

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      cursorRef.current.isDown = true;
      const now = performance.now();
      const x = e.clientX - cachedRect.left;
      const y = e.clientY - cachedRect.top;

      cursorRef.current.x = x;
      cursorRef.current.y = y;
      cursorRef.current.isInside = true;

      recordPoint(x, y, now, true);

      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(render);
      }
    };

    const onPointerUp = () => {
      cursorRef.current.isDown = false;
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

    container.addEventListener('pointermove', onPointerMove, { passive: true });
    container.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    container.addEventListener('pointerenter', onPointerEnter, { passive: true });
    container.addEventListener('pointerleave', onPointerLeave, { passive: true });

    const activeFadeMs = durationConfig.activeFadeMs;
    const hoverFadeMs = durationConfig.hoverFadeMs;

    // High-performance 120 FPS render loop
    const render = () => {
      if (!isRunning) return;

      const now = performance.now();
      const canvasW = canvas.width;
      const canvasH = canvas.height;

      // Filter expired trail points
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

      // ─── Draw Radiant Bézier Ribbon Trail ──────────────────────────────────
      if (points.length >= 2) {
        ctx.lineJoin = 'round';

        // Precompute midpoints between consecutive points
        const count = points.length;
        const midX: number[] = new Array(count - 1);
        const midY: number[] = new Array(count - 1);
        for (let i = 0; i < count - 1; i++) {
          midX[i] = (points[i].x + points[i + 1].x) * 0.5;
          midY[i] = (points[i].y + points[i + 1].y) * 0.5;
        }

        // Segment properties cache
        const alphas: number[] = new Array(count - 1);
        const widths: number[] = new Array(count - 1);
        const isDowns: boolean[] = new Array(count - 1);

        for (let i = 0; i < count - 1; i++) {
          const pNext = points[i + 1];
          const maxLife = pNext.isDown ? activeFadeMs : hoverFadeMs;
          const life = Math.max(0, 1 - (now - pNext.time) / maxLife);
          alphas[i] = pNext.isDown ? Math.pow(life, 0.75) : Math.pow(life, 0.75) * 0.45;
          widths[i] =
            (pNext.isDown ? widthConfig.activeWidth : widthConfig.hoverWidth) *
            Math.pow(life, 0.82);
          isDowns[i] = pNext.isDown;
        }

        // Pass 1: Wide Ambient Glow Ribbon (Optical Aura without costly shadowBlur)
        for (let i = 0; i < count - 1; i++) {
          const a = alphas[i];
          if (a <= 0.01) continue;

          const startX = i === 0 ? points[0].x : midX[i - 1];
          const startY = i === 0 ? points[0].y : midY[i - 1];
          const ctrlX = points[i].x;
          const ctrlY = points[i].y;
          const endX = i === count - 2 ? points[count - 1].x : midX[i];
          const endY = i === count - 2 ? points[count - 1].y : midY[i];

          ctx.lineCap = i === 0 || i === count - 2 ? 'round' : 'butt';
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
          ctx.strokeStyle = palette.rgba(a * 0.22);
          ctx.lineWidth = Math.max(1.5, widths[i] * 3.4);
          ctx.stroke();
        }

        // Pass 2: Saturated Plasma Beam Core
        for (let i = 0; i < count - 1; i++) {
          const a = alphas[i];
          if (a <= 0.01) continue;

          const startX = i === 0 ? points[0].x : midX[i - 1];
          const startY = i === 0 ? points[0].y : midY[i - 1];
          const ctrlX = points[i].x;
          const ctrlY = points[i].y;
          const endX = i === count - 2 ? points[count - 1].x : midX[i];
          const endY = i === count - 2 ? points[count - 1].y : midY[i];

          ctx.lineCap = i === 0 || i === count - 2 ? 'round' : 'butt';
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
          ctx.strokeStyle = palette.rgba(a * 0.95);
          ctx.lineWidth = Math.max(1, widths[i]);
          ctx.stroke();
        }

        // Pass 3: White-Hot Center Spine
        for (let i = 0; i < count - 1; i++) {
          const a = alphas[i];
          if (!isDowns[i] || a <= 0.15) continue;

          const startX = i === 0 ? points[0].x : midX[i - 1];
          const startY = i === 0 ? points[0].y : midY[i - 1];
          const ctrlX = points[i].x;
          const ctrlY = points[i].y;
          const endX = i === count - 2 ? points[count - 1].x : midX[i];
          const endY = i === count - 2 ? points[count - 1].y : midY[i];

          ctx.lineCap = i === 0 || i === count - 2 ? 'round' : 'butt';
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
          ctx.strokeStyle = `rgba(255, 255, 255, ${a * 0.92})`;
          ctx.lineWidth = Math.max(1, widths[i] * 0.28);
          ctx.stroke();
        }
      }

      // ─── Draw Instant 0ms Laser Diode Dot ──────────────────────────────────
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
        const haloRadius = isDown ? 18 + pulse * 4 : 12 + pulse * 2;
        const grad = ctx.createRadialGradient(curX, curY, 0.5, curX, curY, haloRadius);
        grad.addColorStop(0, palette.rgba(isDown ? 0.65 : 0.42));
        grad.addColorStop(0.45, palette.rgba(isDown ? 0.25 : 0.12));
        grad.addColorStop(1, palette.rgba(0));

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(curX, curY, haloRadius, 0, Math.PI * 2);
        ctx.fill();

        // Active Press Shockwave Ring
        if (isDown) {
          ctx.beginPath();
          ctx.arc(curX, curY, 9 + pulse * 2, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + pulse * 0.35})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // Saturated Laser Diode Body
        ctx.fillStyle = palette.core;
        ctx.beginPath();
        ctx.arc(curX, curY, isDown ? 6 : 4.5, 0, Math.PI * 2);
        ctx.fill();

        // White-Hot Focal Center
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(curX, curY, isDown ? 2.6 : 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Continue loop if active trail or cursor is inside
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
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointerenter', onPointerEnter);
      container.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [containerRef, palette, widthConfig, durationConfig]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="zcanvas-laser-overlay"
      className="absolute inset-0 w-full h-full pointer-events-none z-50 overflow-hidden"
    />
  );
}
