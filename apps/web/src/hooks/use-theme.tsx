'use client';

import React, { useEffect, useState } from 'react';
import { create } from 'zustand';

export type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const applyThemeToDOM = (t: Theme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (t === 'light') {
    root.classList.remove('dark');
  } else {
    root.classList.add('dark');
  }
};

const getSavedTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem('diagramz_theme') as Theme | null;
    if (saved === 'dark' || saved === 'light') return saved;
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
};

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'dark',
  setTheme: (theme: Theme) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('diagramz_theme', theme);
      } catch {}
    }
    applyThemeToDOM(theme);
    set({ theme });
  },
  toggleTheme: () => {
    set((state) => {
      const next: Theme = state.theme === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('diagramz_theme', next);
        } catch {}
      }
      applyThemeToDOM(next);
      return { theme: next };
    });
  },
}));

export function useTheme() {
  const { theme, setTheme, toggleTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const initial = getSavedTheme();
    if (useThemeStore.getState().theme !== initial) {
      useThemeStore.getState().setTheme(initial);
    } else {
      applyThemeToDOM(initial);
    }
  }, []);

  const activeTheme = mounted ? theme : 'dark';

  return {
    theme: activeTheme,
    toggleTheme,
    setTheme,
    isDark: activeTheme === 'dark',
  };
}
