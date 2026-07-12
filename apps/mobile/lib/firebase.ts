import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth } from 'firebase/auth';
// @ts-ignore — exported by Firebase's react-native bundle but missing from its public types
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig } from '@jobman/shared/src/firebase/config';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);
export const storage = getStorage(app);
