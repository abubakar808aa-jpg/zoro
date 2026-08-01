'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, firebaseConfigurationError } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  accountType: 'worker' | 'employer' | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  accountType: null,
  isAdmin: false,
  loading: true,
  error: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accountType, setAccountType] = useState<'worker' | 'employer' | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (firebaseConfigurationError) {
      setError(firebaseConfigurationError);
      setLoading(false);
      return;
    }

    return onAuthStateChanged(
      auth,
      async (u) => {
        try {
          setError(null);
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
        } catch (err) {
          setUser(null);
          setAccountType(null);
          setIsAdmin(false);
          setError(err instanceof Error ? err.message : 'Unable to verify your account permissions.');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setUser(null);
        setAccountType(null);
        setIsAdmin(false);
        setError(err.message || 'Authentication could not be initialized.');
        setLoading(false);
      }
    );
  }, []);

  return (
    <AuthContext.Provider value={{ user, accountType, isAdmin, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
