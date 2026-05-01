'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  children, 
  ...props 
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-lg border font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)] disabled:opacity-50 disabled:pointer-events-none';
  
  const variants = {
    primary: 'border-transparent bg-[var(--color-primary)] text-white shadow-sm hover:brightness-95 active:translate-y-px',
    secondary: 'border-transparent bg-[var(--color-secondary)] text-white shadow-sm hover:brightness-95 active:translate-y-px',
    accent: 'border-transparent bg-[var(--color-accent)] text-white shadow-sm hover:brightness-95 active:translate-y-px',
    danger: 'border-transparent bg-[var(--color-danger)] text-white shadow-sm hover:brightness-95 active:translate-y-px',
    ghost: 'border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] hover:bg-[color-mix(in_srgb,var(--color-surface)_70%,var(--color-primary)_30%)]',
  };
  
  const sizes = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-11 px-6 text-base',
  };
  
  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

