'use client';

import React from 'react';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={className || 'h-9 w-9 text-muted-foreground hover:text-foreground'}
      title="Toggle theme"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
