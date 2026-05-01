export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Color utility classes using CSS variables
export const colors = {
  primary: 'bg-[var(--color-primary)] text-white',
  secondary: 'bg-[var(--color-secondary)] text-white',
  accent: 'bg-[var(--color-accent)] text-white',
  background: 'bg-[var(--color-background)]',
  surface: 'bg-[var(--color-surface)]',
  foreground: 'text-[var(--color-foreground)]',
  muted: 'text-[var(--color-muted)]',
  border: 'border-[var(--color-border)]',
};

