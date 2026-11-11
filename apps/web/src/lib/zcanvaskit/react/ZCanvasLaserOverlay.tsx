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

interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
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
  const sparklesRef = useRef<Sparkle[]>([]);

  // Raw pointer target and smoothed diode position
  const targetCursorRef = useRef<{ x: number; y: number; isInside: boolean; isDown: boolean }>({
    x: -100,
    y: -100,
    isInside: false,
    isDown: false,
  });
  const smoothedCursorRef = useRef<{ x: number; y: number }>({ x: -100, y: -100 });
  const rafIdRef = useRef<number | null>(null);

  // Dynamic configuration based on user selection
  const widthConfig = LASER_WIDTH_CONFIGS[width] || LASER_WIDTH_CONFIGS.normal;
  const durationConfig = LASER_DURATION_CONFIGS[trailDuration] || LASER_DURATION_CONFIGS.normal;
  const palette = resolveLaserPalette(color, glowColor);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    // Handle high-DPI sizing and Retina crispness
    const updateSize = () => {
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.scale(dpr, dpr);
      }
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    const recordPoint = (x: number, y: number, now: number, isDown: boolean) => {
      const pts = pointsRef.current;
      const last = pts[pts.length - 1];
      const dist = last ? Math.hypot(x - last.x, y - last.y) : 999;

      // Filter sub-pixel jitter while capturing fine high-frequency strokes
      if (!last || dist >= 1.5 || now - last.time > 12) {
        pts.push({ x, y, time: now, isDown });

        // Spawn delicate micro-sparkles while actively drawing
        if (isDown && Math.random() > 0.42) {
          const sparkColor =
            Math.random() > 0.4
              ? '#ffffff'
              : Math.random() > 0.5
              ? palette.glow
              : palette.core;

          sparklesRef.current.push({
            x: x + (Math.random() - 0.5) * 3,
            y: y + (Math.random() - 0.5) * 3,
            vx: (Math.random() - 0.5) * 0.9,
            vy: (Math.random() - 0.5) * 0.9 - 0.25,
            size: 1 + Math.random() * 1.8,
            alpha: 0.95,
            color: sparkColor,
          });
        }
      }
    };

    // Sub-frame pointer event harvesting (PointerEvent.getCoalescedEvents())
    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const isDown = targetCursorRef.current.isDown;
      const now = performance.now();

      // Harvest intermediate hardware samples between render frames if available
      if (typeof e.getCoalescedEvents === 'function') {
        const coalesced = e.getCoalescedEvents();
        if (coalesced && coalesced.length > 0) {
          for (let i = 0; i < coalesced.length; i++) {
            const ev = coalesced[i];
            const cx = ev.clientX - rect.left;
            const cy = ev.clientY - rect.top;
            recordPoint(cx, cy, now, isDown);
          }
        } else {
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          recordPoint(x, y, now, isDown);
        }
      } else {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        recordPoint(x, y, now, isDown);
      }

      const latestX = e.clientX - rect.left;
      const latestY = e.clientY - rect.top;
      targetCursorRef.current.x = latestX;
      targetCursorRef.current.y = latestY;
      targetCursorRef.current.isInside = true;

      // If smoothed cursor has not been initialized, snap directly
      if (smoothedCursorRef.current.x < 0) {
        smoothedCursorRef.current.x = latestX;
        smoothedCursorRef.current.y = latestY;
      }

      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(render);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // Only primary left-click
      targetCursorRef.current.isDown = true;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const now = performance.now();

      targetCursorRef.current.x = x;
      targetCursorRef.current.y = y;
      smoothedCursorRef.current.x = x;
      smoothedCursorRef.current.y = y;

      recordPoint(x, y, now, true);

      // Energy burst sparkles on click
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.4;
        const speed = 0.9 + Math.random() * 1.3;
        sparklesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 1.5 + Math.random() * 1.6,
          alpha: 1,
          color: i % 2 === 0 ? '#ffffff' : palette.glow,
        });
      }

      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(render);
      }
    };

    const onPointerUp = () => {
      targetCursorRef.current.isDown = false;
    };

    const onPointerEnter = () => {
      targetCursorRef.current.isInside = true;
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(render);
      }
    };

    const onPointerLeave = () => {
      targetCursorRef.current.isInside = false;
      targetCursorRef.current.isDown = false;
      smoothedCursorRef.current.x = -100;
      smoothedCursorRef.current.y = -100;
    };

    container.addEventListener('pointermove', onPointerMove, { passive: true });
    container.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    container.addEventListener('pointerenter', onPointerEnter, { passive: true });
    container.addEventListener('pointerleave', onPointerLeave, { passive: true });

    // Render loop
    const activeFadeMs = durationConfig.activeFadeMs;
    const hoverFadeMs = durationConfig.hoverFadeMs;

    const render = () => {
      if (!isRunning) return;

      const now = performance.now();
      const rect = container.getBoundingClientRect();
      const widthPx = rect.width;
      const heightPx = rect.height;

      // Filter expired trail points
      const points = pointsRef.current;
      while (
        points.length > 0 &&
        now - points[0].time > (points[0].isDown ? activeFadeMs : hoverFadeMs)
      ) {
        points.shift();
      }

      // Update ambient micro-sparkles
      const sparkles = sparklesRef.current;
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i];
        s.x += s.vx;
        s.y += s.vy;
        s.alpha -= 0.032;
        s.size *= 0.96;
        if (s.alpha <= 0 || s.size <= 0.2) {
          sparkles.splice(i, 1);
        }
      }

      // Cursor spring dampening for butter-smooth diode motion
      const target = targetCursorRef.current;
      const smoothed = smoothedCursorRef.current;
      if (target.isInside && smoothed.x >= 0) {
        const ease = target.isDown ? 0.85 : 0.65;
        smoothed.x += (target.x - smoothed.x) * ease;
        smoothed.y += (target.y - smoothed.y) * ease;
      }

      ctx.clearRect(0, 0, widthPx, heightPx);

      // 1. Draw Continuous Midpoint Bézier Radiant Ribbon
      if (points.length >= 2) {
        ctx.save();
        ctx.lineJoin = 'round';

        // Calculate smooth midpoints between consecutive points
        const midpoints: Array<{ x: number; y: number }> = [];
        for (let i = 0; i < points.length - 1; i++) {
          midpoints.push({
            x: (points[i].x + points[i + 1].x) / 2,
            y: (points[i].y + points[i + 1].y) / 2,
          });
        }

        // Draw connected ribbon segments without overlapping "bead" artifacts
        for (let i = 0; i < points.length - 1; i++) {
          const pCurrent = points[i];
          const pNext = points[i + 1];
          const maxLife = pNext.isDown ? activeFadeMs : hoverFadeMs;
          const age = now - pNext.time;
          const life = Math.max(0, 1 - age / maxLife);
          if (life <= 0) continue;

          // Natural non-linear optical tapering
          const lifeEase = Math.pow(life, 0.72);
          const widthScale = Math.pow(life, 0.82);
          const baseWidth =
            (pNext.isDown ? widthConfig.activeWidth : widthConfig.hoverWidth) * widthScale;
          const alpha = pNext.isDown ? lifeEase : lifeEase * 0.45;

          // Midpoint B-spline start and end
          const startX = i === 0 ? pCurrent.x : midpoints[i - 1].x;
          const startY = i === 0 ? pCurrent.y : midpoints[i - 1].y;
          const ctrlX = pCurrent.x;
          const ctrlY = pCurrent.y;
          const endX = i === points.length - 2 ? pNext.x : midpoints[i].x;
          const endY = i === points.length - 2 ? pNext.y : midpoints[i].y;

          // Cap only the very first and last segment to prevent circular bead stacking
          const isEndpoint = i === 0 || i === points.length - 2;
          ctx.lineCap = isEndpoint ? 'round' : 'butt';

          // Pass 1: Wide Radiant Glow Aura (Ambient Neon Ribbon)
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
          ctx.strokeStyle = palette.rgba(alpha * 0.32);
          ctx.lineWidth = Math.max(1, baseWidth * 2.7);
          ctx.shadowColor = palette.glow;
          ctx.shadowBlur = pNext.isDown ? 14 : 7;
          ctx.stroke();

          // Pass 2: Saturated Hot Plasma Core
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
          ctx.strokeStyle = palette.rgba(alpha * 0.95);
          ctx.lineWidth = Math.max(1.2, baseWidth);
          ctx.shadowColor = palette.core;
          ctx.shadowBlur = pNext.isDown ? 6 : 3;
          ctx.stroke();

          // Pass 3: White-Hot Laser Spine
          if (pNext.isDown && life > 0.2) {
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
            ctx.lineWidth = Math.max(1.1, baseWidth * 0.28);
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 2;
            ctx.stroke();
          }
        }

        ctx.restore();
      }

      // 2. Draw Radiant Micro-Sparkles
      if (sparkles.length > 0) {
        ctx.save();
        for (let i = 0; i < sparkles.length; i++) {
          const s = sparkles[i];
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fillStyle = s.color;
          ctx.globalAlpha = Math.max(0, s.alpha);
          ctx.shadowColor = s.color;
          ctx.shadowBlur = 4;
          ctx.fill();
        }
        ctx.restore();
      }

      // 3. Draw Radiant Diode Dot & Dynamic Aura at Cursor
      if (
        target.isInside &&
        smoothed.x >= 0 &&
        smoothed.y >= 0 &&
        smoothed.x <= widthPx &&
        smoothed.y <= heightPx
      ) {
        ctx.save();
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.007);
        const isDown = target.isDown;
        const curX = smoothed.x;
        const curY = smoothed.y;

        // Radiant Outer Aura Halo with custom palette colors
        const haloRadius = isDown ? 19 + pulse * 4 : 13 + pulse * 2.5;
        const grad = ctx.createRadialGradient(curX, curY, 1, curX, curY, haloRadius);
        grad.addColorStop(0, palette.rgba(isDown ? 0.6 : 0.38));
        grad.addColorStop(0.45, palette.rgba(isDown ? 0.25 : 0.14));
        grad.addColorStop(1, palette.rgba(0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(curX, curY, haloRadius, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing Luminous Shockwave Ring when actively drawing
        if (isDown) {
          ctx.beginPath();
          ctx.arc(curX, curY, 9.5 + pulse * 2.2, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 + pulse * 0.35})`;
          ctx.lineWidth = 1.3;
          ctx.shadowColor = palette.glow;
          ctx.shadowBlur = 7;
          ctx.stroke();
        }

        // Brilliant Saturated Diode Ring
        ctx.shadowColor = palette.glow;
        ctx.shadowBlur = isDown ? 13 : 8;
        ctx.fillStyle = palette.core;
        ctx.beginPath();
        ctx.arc(curX, curY, isDown ? 6.2 : 4.6, 0, Math.PI * 2);
        ctx.fill();

        // White-Hot Photonic Diode Center
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = isDown ? 5 : 3;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(curX, curY, isDown ? 2.8 : 2.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // Keep loop running while trail points, sparkles, or active cursor are present
      if (points.length > 0 || sparkles.length > 0 || target.isInside) {
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
