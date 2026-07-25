'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from './AuthProvider';
import {
  toggleLike, addComment, getComments, deletePost, reportContent,
} from '@/lib/firestore';
import type { Post, PostComment } from '@jobman/shared/src/types';

// Firestore Timestamp → relative label. serverTimestamp() is momentarily null
// on the just-written doc, so fall back to "just now".
function when(ts: unknown): string {
  const seconds = (ts as { seconds?: number } | null)?.seconds;
  if (!seconds) return 'just now';
  return formatDistanceToNow(new Date(seconds * 1000), { addSuffix: true });
}

type Props = {
  post: Post;
  /** Whether this card was liked by the current user (loaded by the parent). */
  initialLiked?: boolean;
  onDeleted?: (id: string) => void;
};

function Avatar({ name, photo, size = 40 }: { name: string; photo?: string; size?: number }) {
  return photo ? (
    <Image src={photo} alt={name} width={size} height={size} className="rounded-xl object-cover" />
  ) : (
    <div className="flex items-center justify-center rounded-xl bg-primary-100 font-bold text-primary-700" style={{ width: size, height: size }}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

export default function PostCard({ post, initialLiked = false, onDeleted }: Props) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0);
  const [likeBusy, setLikeBusy] = useState(false);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0);
  const [commentBusy, setCommentBusy] = useState(false);

  const [deleted, setDeleted] = useState(false);

  if (deleted) return null;

  async function like() {
    if (!user || likeBusy) return;
    setLikeBusy(true);
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      await toggleLike(post.id, user.uid);
    } catch {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
    } finally { setLikeBusy(false); }
  }

  async function openComments() {
    const next = !showComments;
    setShowComments(next);
    if (next && !commentsLoaded) {
      try {
        setComments(await getComments(post.id));
      } finally { setCommentsLoaded(true); }
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || commentBusy) return;
    const text = commentText.trim();
    if (!text) return;
    setCommentBusy(true);
    try {
      await addComment(post.id, { uid: user.uid, name: user.displayName ?? 'Me', photoURL: user.photoURL ?? undefined }, text);
      setComments((c) => [...c, {
        id: `local-${Date.now()}`,
        authorId: user.uid, authorName: user.displayName ?? 'Me', authorPhoto: user.photoURL ?? undefined,
        text, createdAt: { seconds: Date.now() / 1000 } as unknown as Date,
      }]);
      setCommentCount((n) => n + 1);
      setCommentText('');
    } finally { setCommentBusy(false); }
  }

  async function remove() {
    if (!user || user.uid !== post.authorId) return;
    if (!window.confirm('Delete this post?')) return;
    try {
      await deletePost(post.id);
      setDeleted(true);
      onDeleted?.(post.id);
    } catch { /* leave the card in place if the delete fails */ }
  }

  async function report() {
    if (!user) return;
    await reportContent({ targetType: 'post', targetId: post.id, reporterId: user.uid, reason: 'Reported from feed' });
    window.alert('Thanks — our team will take a look.');
  }

  return (
    <div className="card !p-5">
      <div className="flex items-start gap-3">
        <Link href={`/profile/${post.authorId}`} className="flex-shrink-0">
          <Avatar name={post.authorName} photo={post.authorPhoto} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/profile/${post.authorId}`} className="font-bold text-ink hover:text-primary-600">
            {post.authorName}
          </Link>
          {post.authorHeadline && <p className="truncate text-xs text-slate-400">{post.authorHeadline}</p>}
          <p className="text-xs text-slate-400">{when(post.createdAt)}</p>
        </div>
        {user && user.uid === post.authorId ? (
          <button onClick={remove} title="Delete post" className="flex-shrink-0 text-slate-300 transition-colors hover:text-red-500">🗑</button>
        ) : user ? (
          <button onClick={report} title="Report this post" className="flex-shrink-0 text-slate-300 transition-colors hover:text-red-500">⚑</button>
        ) : null}
      </div>

      {/* React escapes this, so no injected markup runs */}
      <p className="mt-3 whitespace-pre-wrap break-words text-slate-700">{post.text}</p>
      {post.imageUrl && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.imageUrl} alt="" className="max-h-96 w-full object-cover" />
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
        <button onClick={like} disabled={!user || likeBusy}
          className={`badge px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-60 ${liked ? 'bg-accent-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          {liked ? '♥' : '♡'} {likeCount > 0 ? likeCount : ''} Like
        </button>
        <button onClick={openComments}
          className="badge bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-200">
          💬 {commentCount > 0 ? commentCount : ''} Comment
        </button>
      </div>

      {showComments && (
        <div className="mt-3 space-y-3">
          {commentsLoaded && comments.length === 0 && (
            <p className="text-sm text-slate-400">No comments yet — start the conversation.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <Link href={`/profile/${c.authorId}`} className="flex-shrink-0"><Avatar name={c.authorName} photo={c.authorPhoto} size={32} /></Link>
              <div className="min-w-0 flex-1 rounded-2xl bg-slate-50 px-3 py-2">
                <Link href={`/profile/${c.authorId}`} className="text-sm font-bold text-ink hover:text-primary-600">{c.authorName}</Link>
                <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{c.text}</p>
              </div>
            </div>
          ))}
          {user && (
            <form onSubmit={submitComment} className="flex items-center gap-2">
              <input value={commentText} onChange={(e) => setCommentText(e.target.value)}
                className="input flex-1 !py-2 text-sm" placeholder="Add a comment…" aria-label="Add a comment" />
              <button type="submit" disabled={commentBusy || !commentText.trim()} className="btn-primary text-sm disabled:opacity-60">Post</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
