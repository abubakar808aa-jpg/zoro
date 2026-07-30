'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  accountType: 'worker' | 'employer' | null;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, accountType: null, isAdmin: false, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accountType, setAccountType] = useState<'worker' | 'employer' | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid));
        const data = snap.data();
        if (data?.banned) {
          // Suspended accounts are signed out immediately.
          await signOut(auth);
          window.alert('Your account has been suspended.' + (data.bannedReason ? `\nReason: ${data.bannedReason}` : ''));
          setUser(null);
          setAccountType(null);
          setIsAdmin(false);
          setLoading(false);
          return;
        }
        setUser(u);
        setAccountType(data?.accountType ?? null);
        setIsAdmin(data?.isAdmin === true);
      } else {
        setUser(null);
        setAccountType(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, accountType, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
