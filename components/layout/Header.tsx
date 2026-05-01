'use client';

import { ThemeToggle } from '../ThemeToggle';

interface HeaderProps {
  title?: string;
  actions?: React.ReactNode;
}

export function Header({ title, actions }: HeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      {title && <h1 className="text-3xl font-bold text-[var(--color-foreground)]">{title}</h1>}
      <div className="flex items-center gap-4">
        {actions}
        <ThemeToggle />
      </div>
    </div>
  );
}

