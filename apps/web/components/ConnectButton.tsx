'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthProvider';
import {
  getConnectionState, sendConnectionRequest, respondToConnection,
  removeConnection, getOrCreateConversation,
} from '@/lib/firestore';
import type { Connection } from '@jobman/shared/src/types';

type Props = {
  targetUid: string;
  targetName: string;
  targetPhoto?: string;
  /** 'sm' for card grids, 'md' for profile headers. */
  size?: 'sm' | 'md';
  className?: string;
};

// A single button (or button pair) that reflects the mutual-connection state
// between the signed-in user and `targetUid`, and reveals "Message" only once
// the two are connected (DM gating).
export default function ConnectButton({ targetUid, targetName, targetPhoto, size = 'sm', className = '' }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const [conn, setConn] = useState<Connection | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const pad = size === 'md' ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs';

  useEffect(() => {
    if (!user || user.uid === targetUid) { setLoaded(true); return; }
    getConnectionState(user.uid, targetUid)
      .then(setConn)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [user, targetUid]);

  if (!user || user.uid === targetUid || !loaded) return null;

  async function connect() {
    if (!user || busy) return;
    setBusy(true);
    try {
      // A previously declined request must be cleared before a fresh one — the
      // requester can't flip a declined doc back to pending under the rules.
      if (conn?.status === 'declined') await removeConnection(user.uid, targetUid);
      await sendConnectionRequest(user.uid, targetUid);
      setConn(await getConnectionState(user.uid, targetUid));
    } finally { setBusy(false); }
  }

  async function respond(status: 'accepted' | 'declined') {
    if (!conn || busy) return;
    setBusy(true);
    try {
      await respondToConnection(conn.id, status);
      setConn({ ...conn, status });
    } finally { setBusy(false); }
  }

  async function message() {
    if (!user || busy) return;
    setBusy(true);
    try {
      const targetSnap = await getDoc(doc(db, 'users', targetUid));
      const targetData = targetSnap.data();
      const convId = await getOrCreateConversation(
        user.uid, targetUid,
        { [user.uid]: user.displayName ?? 'Me', [targetUid]: targetData?.name ?? targetName },
        { [user.uid]: user.photoURL ?? '', [targetUid]: targetData?.photoURL ?? targetPhoto ?? '' },
      );
      router.push(`/messages/${convId}`);
    } finally { setBusy(false); }
  }

  // Connected → offer to message.
  if (conn?.status === 'accepted') {
    return (
      <button onClick={message} disabled={busy}
        className={`badge font-bold bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-60 ${pad} ${className}`}>
        💬 Message
      </button>
    );
  }

  // Incoming request awaiting this user's decision.
  if (conn?.status === 'pending' && conn.recipientId === user.uid) {
    return (
      <span className={`inline-flex gap-1.5 ${className}`}>
        <button onClick={() => respond('accepted')} disabled={busy}
          className={`badge font-bold bg-acid-300 text-ink hover:brightness-105 disabled:opacity-60 ${pad}`}>
          ✓ Accept
        </button>
        <button onClick={() => respond('declined')} disabled={busy}
          className={`badge font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-60 ${pad}`}>
          Decline
        </button>
      </span>
    );
  }

  // Request sent by this user, still pending.
  if (conn?.status === 'pending' && conn.requesterId === user.uid) {
    return (
      <button disabled
        className={`badge font-bold bg-slate-100 text-slate-400 cursor-default ${pad} ${className}`}>
        ⏳ Requested
      </button>
    );
  }

  // No connection yet (or previously declined) → offer to connect.
  return (
    <button onClick={connect} disabled={busy}
      className={`badge font-bold bg-ink text-white hover:bg-primary-600 disabled:opacity-60 ${pad} ${className}`}>
      ＋ Connect
    </button>
  );
}
