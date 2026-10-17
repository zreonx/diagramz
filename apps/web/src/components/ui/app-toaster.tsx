'use client';

import React, { useEffect } from 'react';
import { Toaster as SonnerToaster, toast } from 'sonner';

export function AppToaster() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).toast = toast;
    }

    // Allows user to click anywhere on a toast notification to dismiss it immediately
    const handleGlobalToastClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const toastEl = target.closest('[data-sonner-toast]');
      if (!toastEl) return;

      // If clicking directly on a button or action link inside the toast, let that element handle it
      if (target.closest('button') || target.closest('a')) return;

      // Find the specific toast ID if available, otherwise dismiss all
      const toastId = toastEl.getAttribute('data-testid') || toastEl.getAttribute('data-id');
      if (toastId) {
        toast.dismiss(toastId);
      } else {
        toast.dismiss();
      }
    };

    document.addEventListener('click', handleGlobalToastClick, true);
    return () => {
      document.removeEventListener('click', handleGlobalToastClick, true);
    };
  }, []);

  return (
    <SonnerToaster
      richColors
      position="bottom-right"
      closeButton
      duration={3500}
      visibleToasts={3}
      toastOptions={{
        duration: 3500,
        className:
          'cursor-pointer select-none transition-transform hover:scale-[1.01] active:scale-[0.99] shadow-xl border border-border/80 backdrop-blur-md',
        style: {
          pointerEvents: 'auto',
        },
      }}
    />
  );
}
