'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DiagramCanvas } from '@/components/canvas/DiagramCanvas';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { DiagramDetail } from '@diagramz/shared';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DiagramEditorPage() {
  const params = useParams();
  const router = useRouter();
  const diagramId = params.id as string;
  const { checkAuth } = useAuthStore();

  const [diagram, setDiagram] = useState<DiagramDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

  if (isLoading) {
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

  return <DiagramCanvas initialDiagram={diagram} />;
}
