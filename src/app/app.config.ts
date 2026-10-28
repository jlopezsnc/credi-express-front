import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  ErrorHandler,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from '@/app.routes';
import { authInterceptor } from '@/core/api/auth.interceptor';
import { errorInterceptor } from '@/core/api/error.interceptor';
import { ErrorGlobal } from '@/core/error-global';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useExisting: ErrorGlobal },
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    // Solo se precachea el shell estático (ngsw-config.json). Las respuestas de la API (datos
    // personales) no se guardan en caché hasta diseñar el modo sin conexión de cobranza.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
