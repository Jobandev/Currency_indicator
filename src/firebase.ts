import { initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';
export const auth = import.meta.env.VITE_FIREBASE_API_KEY
  ? getAuth(
      initializeApp({
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      }),
    )
  : null;
if (auth) {
  if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true')
    connectAuthEmulator(auth, 'http://127.0.0.1:9099');
  void setPersistence(auth, browserLocalPersistence);
}
