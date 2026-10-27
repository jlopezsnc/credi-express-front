import { initializeApp } from '@firebase/app';
import { browserSessionPersistence, initializeAuth, type Auth } from '@firebase/auth';
import { loadEnv } from '@/lib/env';

let auth: Auth | undefined;

/**
 * Inicialización perezosa: solo se crea al usarse, así las pruebas unitarias no necesitan Firebase.
 * La sesión vive en sessionStorage (se cierra con la pestaña) y la administra el SDK, nunca a mano.
 * Sin popupRedirectResolver: el SDK no carga iframes, compatible con `frame-src 'none'` de la CSP.
 */
export function getFirebaseAuth(): Auth {
  if (auth) return auth;

  const env = loadEnv();
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  auth = initializeAuth(app, { persistence: browserSessionPersistence });
  auth.languageCode = 'es';
  return auth;
}
