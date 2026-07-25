'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAuth } from './AuthProvider';
import { createPost } from '@/lib/firestore';
import type { Post } from '@jobman/shared/src/types';

type Props = {
  /** Optional headline stamped onto the post for the author byline. */
  headline?: string;
  /** Called with an optimistic Post so the parent can prepend it immediately. */
  onPosted?: (post: Post) => void;
};

const MAX = 2000;

export default function PostComposer({ headline, onPosted }: Props) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || busy) return;
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const author = { uid: user.uid, name: user.displayName ?? 'Me', photoURL: user.photoURL ?? undefined, headline };
      const id = await createPost(author, body);
      onPosted?.({
        id,
        authorId: author.uid, authorName: author.name, authorPhoto: author.photoURL, authorHeadline: headline,
        text: body, likeCount: 0, commentCount: 0,
        createdAt: { seconds: Date.now() / 1000 } as unknown as Date,
      });
      setText('');
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="card !p-5">
      <div className="flex items-start gap-3">
        {user.photoURL ? (
          <Image src={user.photoURL} alt="You" width={40} height={40} className="rounded-xl object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 font-bold text-primary-700">
            {(user.displayName?.[0] ?? 'U').toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX))}
            rows={3}
            className="input resize-none"
            placeholder="Share an update, a win, or a question…"
            aria-label="Write a post"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">{text.length}/{MAX}</span>
            <button type="submit" disabled={busy || !text.trim()} className="btn-primary text-sm disabled:opacity-60">
              {busy ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
