// src/firebase.js
import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence,
} from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, serverTimestamp } from 'firebase/firestore';

// ✅ CRA style: direct process.env access
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FB_API_KEY,
  authDomain: process.env.REACT_APP_FB_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FB_PROJECT_ID,
  appId: process.env.REACT_APP_FB_APP_ID,
  storageBucket: process.env.REACT_APP_FB_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FB_MESSAGING_SENDER_ID,
  measurementId: process.env.REACT_APP_FB_MEASUREMENT_ID,
};

// Helpful probe (remove later)
console.log('[FB CRA]', {
  apiKeyPresent: !!firebaseConfig.apiKey,
  apiKeyStart: firebaseConfig.apiKey?.slice(0, 6),
  projectId: firebaseConfig.projectId,
  appIdShapeOk: /^\d+:\d+:web:/.test(firebaseConfig.appId || ''),
});

if (!firebaseConfig.apiKey) {
  throw new Error('Firebase config missing. CRA needs REACT_APP_* in .env.local at project root. Restart dev server.');
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
enableIndexedDbPersistence(db).catch(() => {});
export const ts = serverTimestamp;
