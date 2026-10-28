import { isDevMode } from '@angular/core';
import { initializeApp } from '@firebase/app';
import {
  type Auth,
  browserLocalPersistence,
  browserSessionPersistence,
  initializeAuth,
} from '@firebase/auth';
import { env } from '@env';

let auth: Auth | undefined;

/**
 * Inicialización perezosa: solo se crea al usarse, así las pruebas unitarias no necesitan Firebase.
 * La sesión la administra el SDK, nunca a mano. En producción vive en sessionStorage (se cierra con
 * la pestaña); en desarrollo es persistente para no iniciar sesión a cada rato.
 * Sin popupRedirectResolver: el SDK no carga iframes, compatible con `frame-src 'none'` de la CSP.
 */
export function getFirebaseAuth(): Auth {
  if (auth) return auth;

  const app = initializeApp(env.firebase);
  const persistence = isDevMode() ? browserLocalPersistence : browserSessionPersistence;
  auth = initializeAuth(app, { persistence });
  auth.languageCode = 'es';
  return auth;
}
