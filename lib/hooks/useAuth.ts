'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { removeAccessToken } from '@/lib/cookies';

export function useAuth() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Try to get current user - this will use the HttpOnly cookie automatically
        await apiClient.getCurrentUser();
        setAuthenticated(true);
      } catch (error: any) {
        console.error('Auth check failed:', error);
        removeAccessToken();
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, [router]);

  const logout = async () => {
    await apiClient.logout();
    router.push('/login');
  };

  return { authenticated, loading, logout };
}

