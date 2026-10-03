'use client';

import React, { useEffect, useState, Component, ErrorInfo, ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { DiagramDetail } from '@diagramz/shared';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DiagramCanvas = dynamic(
  () => import('@/components/canvas/DiagramCanvas').then((mod) => mod.DiagramCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-xs font-medium">Opening diagram session...</p>
      </div>
    ),
  },
);

class CanvasErrorBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; onRetry: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('CanvasErrorBoundary caught an error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
          <h2 className="text-base font-semibold text-slate-100 mb-1">Canvas Render Issue</h2>
          <p className="text-xs text-slate-400 max-w-sm mb-4 font-mono">
            {this.state.error?.message || 'An error occurred while loading the diagram canvas.'}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              Reload
            </Button>
            <Button size="sm" onClick={this.props.onRetry}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DiagramEditorPage() {
  const params = useParams();
  const router = useRouter();
  const diagramId = params?.id as string | undefined;
  const { checkAuth } = useAuthStore();

  const [diagram, setDiagram] = useState<DiagramDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!diagramId) return;

    checkAuth().then((auth) => {
      if (!auth) {
        router.push('/login');
        return;
      }

      apiClient
        .get<DiagramDetail>(`/diagrams/${diagramId}`)
        .then((res) => {
          setDiagram(res.data);
          setIsLoading(false);
        })
        .catch((err) => {
          setError(err.response?.data?.message || 'Failed to load diagram');
          setIsLoading(false);
        });
    });
  }, [diagramId, checkAuth, router]);

  if (isLoading || !diagramId) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-xs font-medium">Opening diagram session...</p>
      </div>
    );
  }

  if (error || !diagram) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
        <h2 className="text-base font-semibold text-slate-100 mb-1">Unable to Load Diagram</h2>
        <p className="text-xs text-slate-400 max-w-sm mb-6">{error || 'Diagram not found'}</p>
        <Button size="sm" onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <CanvasErrorBoundary onRetry={() => router.push('/dashboard')}>
      <DiagramCanvas initialDiagram={diagram} />
    </CanvasErrorBoundary>
  );
}
