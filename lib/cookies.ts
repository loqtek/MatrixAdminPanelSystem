/**
 * Clear any legacy client-side access_token cookie (session is HttpOnly-only now).
 */

const COOKIE_NAME = 'access_token';

export function removeAccessToken(): void {
  if (typeof document === 'undefined') return;

  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}
