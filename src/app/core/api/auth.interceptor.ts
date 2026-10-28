import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { esUrlDeApi } from '@/core/api/api';
import { AuthService } from '@/core/auth/auth.service';

/** Adjunta el token de Firebase solo a las llamadas a nuestro back, nunca a terceros. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!esUrlDeApi(req.url)) return next(req);

  return from(inject(AuthService).obtenerToken()).pipe(
    switchMap((token) =>
      next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req),
    ),
  );
};
