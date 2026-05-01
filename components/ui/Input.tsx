'use client';

import { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-4 py-2 
          bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg
          text-[var(--color-foreground)] placeholder:text-[var(--color-muted)]
          focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent
          transition-all duration-200
          ${error ? 'border-red-500 focus:ring-red-500' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

