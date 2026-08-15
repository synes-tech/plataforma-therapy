import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  confirmPasswordReset,
  applyActionCode,
  verifyPasswordResetCode,
  type Auth,
  type User,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
};

export function isFirebaseAuthConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  );
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseAuthConfigured()) {
    throw new Error('Firebase Auth não configurado (VITE_FIREBASE_*).');
  }
  if (!app) {
    app = getApps()[0] ?? initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

export async function signInWithGooglePopup(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  provider.addScope('email');
  provider.addScope('profile');
  try {
    const result = await signInWithPopup(getFirebaseAuth(), provider);
    return result.user;
  } catch (err) {
    const { captureMfaFromError } = await import('./firebase-mfa');
    const mfa = captureMfaFromError(err);
    if (mfa) throw mfa;
    throw err;
  }
}

export function getFirebaseCurrentUser(): User | null {
  if (!isFirebaseAuthConfigured()) return null;
  return getFirebaseAuth().currentUser;
}

export async function getFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  if (!isFirebaseAuthConfigured()) return null;
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export async function signOutFirebase(): Promise<void> {
  if (!isFirebaseAuthConfigured()) return;
  await firebaseSignOut(getFirebaseAuth());
}

export function subscribeFirebaseAuth(callback: (user: User | null) => void): () => void {
  if (!isFirebaseAuthConfigured()) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export async function sendFirebasePasswordReset(email: string, continueUrl: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email.trim().toLowerCase(), {
    url: continueUrl,
    handleCodeInApp: false,
  });
}

export async function confirmFirebasePasswordReset(oobCode: string, newPassword: string): Promise<void> {
  await verifyPasswordResetCode(getFirebaseAuth(), oobCode);
  await confirmPasswordReset(getFirebaseAuth(), oobCode, newPassword);
}

export async function applyFirebaseEmailActionCode(oobCode: string): Promise<void> {
  await applyActionCode(getFirebaseAuth(), oobCode);
}

export type { User as FirebaseUser };
