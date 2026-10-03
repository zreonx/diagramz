'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

export const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
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
