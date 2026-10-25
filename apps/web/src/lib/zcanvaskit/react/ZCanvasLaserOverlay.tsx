'use client';

import React, { useRef, useEffect } from 'react';

interface LaserPoint {
  x: number;
  y: number;
  time: number;
  isDown: boolean;
}

interface ZCanvasLaserOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  color?: string;
  glowColor?: string;
}

export function ZCanvasLaserOverlay({
  containerRef,
  color = '#ff1744',
  glowColor = '#ff2a6d',
}: ZCanvasLaserOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointsRef = useRef<LaserPoint[]>([]);
  const cursorRef = useRef<{ x: number; y: number; isInside: boolean; isDown: boolean }>({
    x: -100,
    y: -100,
    isInside: false,
    isDown: false,
  });
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    // Handle high-DPI sizing
    const updateSize = () => {
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.scale(dpr, dpr);
      }
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    // Pointer events
    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const now = performance.now();

      cursorRef.current.x = x;
      cursorRef.current.y = y;
      cursorRef.current.isInside = true;

      // Add point to trail
      const last = pointsRef.current[pointsRef.current.length - 1];
      if (!last || Math.hypot(x - last.x, y - last.y) >= 2 || now - last.time > 16) {
        pointsRef.current.push({
          x,
          y,
          time: now,
          isDown: cursorRef.current.isDown,
        });
      }

      // Ensure RAF is active
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(render);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // Only main left click
      cursorRef.current.isDown = true;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      pointsRef.current.push({
        x,
        y,
        time: performance.now(),
        isDown: true,
      });
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(render);
      }
    };

    const onPointerUp = () => {
      cursorRef.current.isDown = false;
    };

    const onPointerEnter = () => {
      cursorRef.current.isInside = true;
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

    // Render loop
    const FADE_TIME_MS = 600;

    const render = () => {
      if (!isRunning) return;

      const now = performance.now();
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Filter expired points
      const points = pointsRef.current;
      while (points.length > 0 && now - points[0].time > FADE_TIME_MS) {
        points.shift();
      }

      ctx.clearRect(0, 0, width, height);

      // 1. Draw glowing neon laser trail
      if (points.length >= 2) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Segment-by-segment spline rendering with dynamic tapering and fading
        for (let i = 1; i < points.length; i++) {
          const p0 = points[i - 1];
          const p1 = points[i];
          const age = now - p1.time;
          const life = Math.max(0, 1 - age / FADE_TIME_MS);
          if (life <= 0) continue;

          // Eased opacity and width for smooth comet tapering
          const easeLife = Math.pow(life, 0.85);
          const baseWidth = (cursorRef.current.isDown ? 7 : 5) * easeLife;
          const alpha = easeLife;

          // Pass 1: Wide Ambient Halo Glow
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.strokeStyle = `rgba(255, 30, 90, ${alpha * 0.35})`;
          ctx.lineWidth = baseWidth * 2.5;
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 14;
          ctx.stroke();

          // Pass 2: Vivid Neon Core
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.strokeStyle = `rgba(255, 23, 68, ${alpha * 0.95})`;
          ctx.lineWidth = baseWidth;
          ctx.shadowColor = color;
          ctx.shadowBlur = 6;
          ctx.stroke();

          // Pass 3: White-Hot Center Flare
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.lineWidth = Math.max(1.2, baseWidth * 0.35);
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 2;
          ctx.stroke();
        }

        ctx.restore();
      }

      // 2. Draw High-Tech Glowing Laser Dot at Cursor Position
      const cursor = cursorRef.current;
      if (cursor.isInside && cursor.x >= 0 && cursor.y >= 0 && cursor.x <= width && cursor.y <= height) {
        ctx.save();
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.008);

        // Soft Outer Pulse Halo
        const haloRadius = 14 + pulse * 4;
        const grad = ctx.createRadialGradient(cursor.x, cursor.y, 2, cursor.x, cursor.y, haloRadius);
        grad.addColorStop(0, 'rgba(255, 23, 68, 0.45)');
        grad.addColorStop(0.5, 'rgba(255, 42, 109, 0.18)');
        grad.addColorStop(1, 'rgba(255, 23, 68, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, haloRadius, 0, Math.PI * 2);
        ctx.fill();

        // Vivid Neon Dot with Glow
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 12;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, cursor.isDown ? 6.5 : 5, 0, Math.PI * 2);
        ctx.fill();

        // White-Hot Intense Core
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, cursor.isDown ? 3 : 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Subtle Cinematic Lens Flare Crosshairs
        const flareLen = cursor.isDown ? 12 : 8;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 2;
        ctx.beginPath();
        ctx.moveTo(cursor.x - flareLen, cursor.y);
        ctx.lineTo(cursor.x + flareLen, cursor.y);
        ctx.moveTo(cursor.x, cursor.y - flareLen);
        ctx.lineTo(cursor.x, cursor.y + flareLen);
        ctx.stroke();

        ctx.restore();
      }

      // Continue animation if points are still fading or cursor is inside
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
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointerenter', onPointerEnter);
      container.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [containerRef, color, glowColor]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="zcanvas-laser-overlay"
      className="absolute inset-0 w-full h-full pointer-events-none z-50 overflow-hidden"
    />
  );
}
