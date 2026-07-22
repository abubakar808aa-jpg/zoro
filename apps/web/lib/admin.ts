import { auth } from './firebase';

// Client helper for /api/admin — server re-verifies the caller is an admin.
export async function adminAction(body: Record<string, string>): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? 'Admin action failed');
  }
}
