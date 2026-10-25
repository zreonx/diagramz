'use client';

import React, { useRef, useEffect } from 'react';

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
  const sparklesRef = useRef<Sparkle[]>([]);
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
      const isDown = cursorRef.current.isDown;

      cursorRef.current.x = x;
      cursorRef.current.y = y;
      cursorRef.current.isInside = true;

      // Always track recent positions for smooth trail
      const last = pointsRef.current[pointsRef.current.length - 1];
      const dist = last ? Math.hypot(x - last.x, y - last.y) : 999;
      if (!last || dist >= 2.5 || now - last.time > 16) {
        pointsRef.current.push({
          x,
          y,
          time: now,
          isDown,
        });

        // Spawn delicate micro-sparkles while actively drawing
        if (isDown && Math.random() > 0.45) {
          sparklesRef.current.push({
            x: x + (Math.random() - 0.5) * 4,
            y: y + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 0.8,
            vy: (Math.random() - 0.5) * 0.8 - 0.2,
            size: 1 + Math.random() * 1.8,
            alpha: 0.9,
            color: Math.random() > 0.3 ? '#ffffff' : glowColor,
          });
        }
      }

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
      const now = performance.now();

      pointsRef.current.push({
        x,
        y,
        time: now,
        isDown: true,
      });

      // Energy burst sparkles on click
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5 + Math.random() * 0.5;
        const speed = 0.8 + Math.random() * 1.2;
        sparklesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 1.5 + Math.random() * 1.5,
          alpha: 1,
          color: i % 2 === 0 ? '#ffffff' : glowColor,
        });
      }

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
    const DRAG_FADE_MS = 750; // Active drawn trail lifespan
    const HOVER_FADE_MS = 220; // Subtle hover tracer lifespan

    const render = () => {
      if (!isRunning) return;

      const now = performance.now();
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Filter expired points
      const points = pointsRef.current;
      while (
        points.length > 0 &&
        now - points[0].time > (points[0].isDown ? DRAG_FADE_MS : HOVER_FADE_MS)
      ) {
        points.shift();
      }

      // Update sparkles
      const sparkles = sparklesRef.current;
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i];
        s.x += s.vx;
        s.y += s.vy;
        s.alpha -= 0.035;
        s.size *= 0.96;
        if (s.alpha <= 0 || s.size <= 0.2) {
          sparkles.splice(i, 1);
        }
      }

      ctx.clearRect(0, 0, width, height);

      // 1. Draw Silky Smooth Tapered Laser Ribbon
      if (points.length >= 2) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Split into connected segments to allow natural width and opacity tapering
        for (let i = 1; i < points.length; i++) {
          const p0 = points[i - 1];
          const p1 = points[i];
          const maxLife = p1.isDown ? DRAG_FADE_MS : HOVER_FADE_MS;
          const age = now - p1.time;
          const life = Math.max(0, 1 - age / maxLife);
          if (life <= 0) continue;

          // Non-linear easing for natural comet tail physics
          const lifeEase = Math.pow(life, 0.7);
          const widthScale = Math.pow(life, 0.85);
          const baseWidth = (p1.isDown ? 7.5 : 3.5) * widthScale;
          const alpha = p1.isDown ? lifeEase : lifeEase * 0.45;

          // Midpoint smoothing
          const midX = (p0.x + p1.x) / 2;
          const midY = (p0.y + p1.y) / 2;

          // Pass 1: Wide Deep Ambient Glow (Soft Neon Ribbon)
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
          ctx.lineTo(p1.x, p1.y);
          ctx.strokeStyle = `rgba(255, 30, 90, ${alpha * 0.35})`;
          ctx.lineWidth = baseWidth * 2.8;
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = p1.isDown ? 14 : 8;
          ctx.stroke();

          // Pass 2: Vivid Hot Core (Saturated Neon Crimson)
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
          ctx.lineTo(p1.x, p1.y);
          ctx.strokeStyle = `rgba(255, 20, 68, ${alpha * 0.95})`;
          ctx.lineWidth = Math.max(1.5, baseWidth);
          ctx.shadowColor = color;
          ctx.shadowBlur = p1.isDown ? 6 : 3;
          ctx.stroke();

          // Pass 3: White-Hot Energy Spine (Pure white core center)
          if (p1.isDown && life > 0.25) {
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
            ctx.lineTo(p1.x, p1.y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
            ctx.lineWidth = Math.max(1.2, baseWidth * 0.32);
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 2;
            ctx.stroke();
          }
        }

        ctx.restore();
      }

      // 2. Draw Ambient Micro-Sparkles
      if (sparkles.length > 0) {
        ctx.save();
        for (const s of sparkles) {
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

      // 3. Draw Radiant Presentation Laser Diode Dot at Cursor
      const cursor = cursorRef.current;
      if (cursor.isInside && cursor.x >= 0 && cursor.y >= 0 && cursor.x <= width && cursor.y <= height) {
        ctx.save();
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.007);
        const isDown = cursor.isDown;

        // Radiant Outer Aura Halo
        const haloRadius = isDown ? 18 + pulse * 4 : 12 + pulse * 2.5;
        const grad = ctx.createRadialGradient(cursor.x, cursor.y, 1, cursor.x, cursor.y, haloRadius);
        grad.addColorStop(0, isDown ? 'rgba(255, 23, 68, 0.55)' : 'rgba(255, 23, 68, 0.35)');
        grad.addColorStop(0.4, isDown ? 'rgba(255, 42, 109, 0.22)' : 'rgba(255, 42, 109, 0.12)');
        grad.addColorStop(1, 'rgba(255, 23, 68, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, haloRadius, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing Energy Ring when actively drawing
        if (isDown) {
          ctx.beginPath();
          ctx.arc(cursor.x, cursor.y, 9 + pulse * 2, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + pulse * 0.3})`;
          ctx.lineWidth = 1.2;
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 6;
          ctx.stroke();
        }

        // Intense Ruby Neon Ring
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = isDown ? 12 : 8;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, isDown ? 6 : 4.5, 0, Math.PI * 2);
        ctx.fill();

        // White-Hot Diode Core
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = isDown ? 5 : 3;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, isDown ? 2.8 : 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // Continue loop if trail is still visible, sparkles exist, or cursor is inside
      if (points.length > 0 || sparkles.length > 0 || cursor.isInside) {
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
