'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { subscribeToConversations } from '@/lib/firestore';
import { useAuth } from '@/components/AuthProvider';
import { formatDistanceToNow } from 'date-fns';
import type { Conversation } from '@jobman/shared/src/types';

export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToConversations(user.uid, setConversations);
    return unsub;
  }, [user]);

  if (authLoading) return null;
  if (!user) { router.push('/sign-in'); return null; }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Messages</h1>

      {conversations.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl mb-4">💬</div>
          <p className="text-lg font-medium">No conversations yet.</p>
          <p className="text-sm mt-2">Browse profiles and tap "Send Message" to start one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map(conv => {
            const otherId = conv.participants.find(p => p !== user.uid) ?? '';
            const otherName = conv.participantNames?.[otherId] ?? 'Unknown';
            const otherPhoto = conv.participantPhotos?.[otherId];
            const lastReadAt = (conv.lastRead as any)?.[user.uid];
            const isUnread = !!conv.lastMessage
              && conv.lastSenderId !== user.uid
              && (!lastReadAt || ((conv.lastMessageAt as any)?.seconds ?? 0) > (lastReadAt.seconds ?? 0));
            const timeAgo = conv.lastMessageAt
              ? formatDistanceToNow(new Date((conv.lastMessageAt as any).seconds * 1000), { addSuffix: true })
              : '';

            return (
              <Link key={conv.id} href={`/messages/${conv.id}`}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all hover:shadow-sm ${isUnread ? 'bg-primary-50 border-primary-100' : 'bg-white border-slate-100'}`}>
                {otherPhoto ? (
                  <Image src={otherPhoto} alt={otherName} width={48} height={48} className="rounded-full flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold flex-shrink-0">
                    {otherName[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`font-semibold ${isUnread ? 'text-slate-900' : 'text-slate-700'}`}>{otherName}</p>
                    <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo}</span>
                  </div>
                  <p className={`text-sm truncate mt-0.5 ${isUnread ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                    {conv.lastSenderId === user.uid ? 'You: ' : ''}{conv.lastMessage || 'No messages yet'}
                  </p>
                </div>
                {isUnread && conv.lastMessage && <div className="w-2.5 h-2.5 rounded-full bg-primary-500 flex-shrink-0" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
