'use client';

import React, { useEffect, useState, Component, ErrorInfo, ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { DiagramDetail } from '@diagramz/shared';
import { Loader2, AlertCircle, FileQuestion, ArrowLeft } from 'lucide-react';
import { DiagramLoaderScreen } from '@/components/canvas/DiagramLoaderScreen';
import { Button } from '@/components/ui/button';
import { DiagramCanvas } from '@/components/canvas/DiagramCanvas';

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
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-background p-6 text-center text-foreground">
          <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
          <h2 className="text-base font-semibold mb-1">Canvas Render Issue</h2>
          <p className="text-xs text-muted-foreground max-w-sm mb-4 font-mono">
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

    const startTime = Date.now();

    checkAuth().then((auth) => {
      if (!auth) {
        router.push('/login');
        return;
      }

      apiClient
        .get<DiagramDetail>(`/diagrams/${diagramId}`)
        .then((res) => {
          const elapsed = Date.now() - startTime;
          const delay = Math.max(0, 600 - elapsed);
          setTimeout(() => {
            setDiagram(res.data);
            setIsLoading(false);
          }, delay);
        })
        .catch((err) => {
          const msg = err.response?.data?.message || err.message || 'Diagram not found';
          setError(msg);
          setIsLoading(false);
        });
    });
  }, [diagramId, checkAuth, router]);

  if (isLoading || !diagramId) {
    return <DiagramLoaderScreen title={diagram?.title} />;
  }

  if (error || !diagram) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background p-6 text-center text-foreground">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <FileQuestion className="w-6 h-6 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight mb-1">Diagram Not Found</h2>
        <p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
          {error === 'Diagram not found'
            ? 'The diagram you requested does not exist or may have been deleted.'
            : error || 'The requested resource could not be found.'}
        </p>
        <Button size="sm" onClick={() => router.push('/dashboard')} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
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
