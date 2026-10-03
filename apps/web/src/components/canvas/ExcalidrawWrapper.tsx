'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

export const Excalidraw = dynamic(
  async () => {
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.process = window.process || { env: {} };
      // @ts-ignore
      window.process.env = window.process.env || {};
      // @ts-ignore
      window.process.env.IS_PREACT = 'false';
      // @ts-ignore
      window.process.env.NODE_ENV = process.env.NODE_ENV || 'production';
    }
    const mod = await import('@excalidraw/excalidraw');
    return mod.Excalidraw;
  },
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 gap-3">
        <Skeleton className="w-16 h-16 rounded-full" />
        <p className="text-sm font-medium">Loading Diagramz Canvas Engine...</p>
      </div>
    ),
  },
);
