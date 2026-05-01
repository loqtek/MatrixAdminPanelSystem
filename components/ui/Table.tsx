'use client';

import { ReactNode } from 'react';

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--color-border)]">{children}</table>
      </div>
    </div>
  );
}

export function TableHeader({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-[var(--color-surface)]">
      <tr>{children}</tr>
    </thead>
  );
}

export function TableHeaderCell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <th className={`px-6 py-3 text-left text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider ${className}`}>
      {children}
    </th>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">{children}</tbody>;
}

export function TableRow({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr
      className={`${onClick ? 'cursor-pointer hover:bg-[var(--color-surface)]/50 transition-colors' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function TableCell({ children, className = '', colSpan, ...props }: { children: ReactNode; className?: string; colSpan?: number } & React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-6 py-4 whitespace-nowrap text-sm text-[var(--color-foreground)] ${className}`} colSpan={colSpan} {...props}>{children}</td>;
}

