'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await apiClient.getCurrentUser();
        if (!cancelled) router.push('/dashboard');
      } catch {
        if (!cancelled) router.push('/login');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-[var(--color-muted)]">Redirecting...</p>
      </div>
    </div>
  );
}
