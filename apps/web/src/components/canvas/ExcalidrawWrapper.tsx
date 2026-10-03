'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { applyReact19Shim } from '@/lib/react-19-shim';

applyReact19Shim();

export const Excalidraw = dynamic(
  async () => {
    applyReact19Shim();
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
