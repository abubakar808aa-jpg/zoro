'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { subscribeToMessages, sendMessage, markConversationRead } from '@/lib/firestore';
import { suggestReplies } from '@/lib/ai';
import { useAuth } from '@/components/AuthProvider';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDistanceToNow } from 'date-fns';
import type { Message, Conversation } from '@jobman/shared/src/types';

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'conversations', id)).then(snap => {
      if (snap.exists()) setConv({ id: snap.id, ...snap.data() } as Conversation);
    });
    markConversationRead(id, user.uid).catch(() => {});
    return subscribeToMessages(id, msgs => {
      setMessages(msgs);
      // Keep the conversation marked read while it's open
      const latest = msgs[msgs.length - 1];
      if (latest && latest.senderId !== user.uid) {
        markConversationRead(id, user.uid).catch(() => {});
      }
    });
  }, [id, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!user || (!text.trim() && !file)) return;
    setSending(true);
    try {
      await sendMessage(id, user.uid, text.trim(), file ?? undefined);
      setText(''); setFile(null); setSuggestions([]);
    } finally { setSending(false); }
  }

  async function handleSuggest() {
    if (!user || messages.length === 0) return;
    setSuggesting(true);
    try {
      const recent = messages.slice(-10)
        .filter(m => m.text)
        .map(m => ({ sender: (m.senderId === user.uid ? 'me' : 'them') as 'me' | 'them', text: m.text }));
      const { suggestions: s } = await suggestReplies(recent);
      setSuggestions(s ?? []);
    } catch {
      setSuggestions([]);
    } finally { setSuggesting(false); }
  }

  if (authLoading) return null;
  if (!user) { router.push('/sign-in'); return null; }

  const otherId = conv?.participants.find(p => p !== user.uid) ?? '';
  const otherName = conv?.participantNames?.[otherId] ?? 'User';
  const otherPhoto = conv?.participantPhotos?.[otherId];

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-100">
        <button onClick={() => router.push('/messages')} className="text-slate-400 hover:text-slate-600 mr-1">←</button>
        {otherPhoto ? (
          <Image src={otherPhoto} alt={otherName} width={40} height={40} className="rounded-full" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
            {otherName[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-semibold text-slate-900 text-sm">{otherName}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
        {messages.map(msg => {
          const isMine = msg.senderId === user.uid;
          const time = msg.createdAt ? formatDistanceToNow(new Date((msg.createdAt as any).seconds * 1000), { addSuffix: true }) : '';
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md rounded-2xl px-4 py-2.5 ${isMine ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-white text-slate-900 shadow-sm border border-slate-100 rounded-bl-sm'}`}>
                {msg.fileUrl && msg.fileType === 'image' && (
                  <a href={msg.fileUrl} target="_blank" rel="noreferrer">
                    <img src={msg.fileUrl} alt={msg.fileName} className="rounded-xl mb-2 max-w-full max-h-48 object-cover" />
                  </a>
                )}
                {msg.fileUrl && msg.fileType === 'document' && (
                  <a href={msg.fileUrl} target="_blank" rel="noreferrer"
                    className={`flex items-center gap-2 text-sm mb-1 ${isMine ? 'text-primary-100' : 'text-primary-600'}`}>
                    📄 {msg.fileName}
                  </a>
                )}
                {msg.text && <p className="text-sm leading-relaxed">{msg.text}</p>}
                <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-200' : 'text-slate-400'}`}>{time}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* AI reply suggestions */}
      {suggestions.length > 0 && (
        <div className="px-4 py-2 bg-white border-t border-slate-100 flex flex-wrap gap-2">
          {suggestions.map(s => (
            <button key={s} onClick={() => { setText(s); setSuggestions([]); }}
              className="text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200 rounded-full px-3 py-1.5 hover:bg-violet-100 transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* File preview */}
      {file && (
        <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center gap-2">
          <span className="text-sm text-slate-600 flex-1 truncate">📎 {file.name}</span>
          <button onClick={() => setFile(null)} className="text-slate-400 hover:text-slate-600 text-xs">✕ Remove</button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-2 px-4 py-3 bg-white border-t border-slate-100">
        <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" className="hidden"
          onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => fileRef.current?.click()}
          className="p-2 text-slate-400 hover:text-primary-600 transition-colors rounded-lg hover:bg-primary-50">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        <button type="button" onClick={handleSuggest} disabled={suggesting || messages.length === 0}
          title="Suggest replies with AI"
          className="p-2 text-violet-500 hover:text-violet-700 transition-colors rounded-lg hover:bg-violet-50 disabled:opacity-40">
          {suggesting ? <span className="text-sm animate-pulse">✨</span> : <span className="text-sm">✨</span>}
        </button>
        <input value={text} onChange={e => setText(e.target.value)} className="input flex-1"
          placeholder="Type a message…" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }} />
        <button type="submit" disabled={sending || (!text.trim() && !file)}
          className="btn-primary px-4 py-2.5 disabled:opacity-40">
          {sending ? '…' : '→'}
        </button>
      </form>
    </div>
  );
}
