import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, retry, throwError, timer } from 'rxjs';
import { esUrlDeApi } from '@/core/api/api';
import { ApiError, type ApiErrorBody } from '@/core/api/api-error';

const MAX_REINTENTOS = 2;

/**
 * Convierte los errores del back en `ApiError`.
 * Solo se reintentan las consultas (GET) ante fallas de red o 5xx: los 4xx (validación, permisos)
 * no se arreglan reintentando, y nunca se reintenta algo que mueve dinero (docs §5.2, API6).
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  if (!esUrlDeApi(req.url)) return next(req);

  const peticion = next(req);
  const conReintentos =
    req.method === 'GET'
      ? peticion.pipe(
          retry({
            count: MAX_REINTENTOS,
            delay: (error: unknown, intento) =>
              error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500)
                ? timer(500 * intento)
                : throwError(() => error),
          }),
        )
      : peticion;

  return conReintentos.pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
      const body = (typeof error.error === 'object' ? error.error : undefined) as
        ApiErrorBody | undefined;
      return throwError(() => new ApiError(error.status, body ?? undefined));
    }),
  );
};
