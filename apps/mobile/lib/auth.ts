import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { AccountType } from '@jobman/shared/src/types';

export async function signUpWithEmail(name: string, email: string, password: string, accountType: AccountType) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await setDoc(doc(db, 'users', cred.user.uid), {
    uid: cred.user.uid, name, email, photoURL: '', accountType, createdAt: serverTimestamp(),
  });
  return cred.user;
}

export async function signInWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signInWithGoogleCredential(idToken: string, accountType: AccountType) {
  const credential = GoogleAuthProvider.credential(idToken);
  const cred = await signInWithCredential(auth, credential);
  const userRef = doc(db, 'users', cred.user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: cred.user.uid, name: cred.user.displayName ?? '', email: cred.user.email ?? '',
      photoURL: cred.user.photoURL ?? '', accountType, createdAt: serverTimestamp(),
    });
  }
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}
