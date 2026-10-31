import { httpResource, type HttpResourceRef, type HttpResourceRequest } from '@angular/common/http';
import type { RespuestaApi } from '@/core/api/api';

/**
 * `httpResource` para el back: entrega solo el `objetoResponse` del sobre. Se vuelve a pedir solo
 * cuando cambian los signals que lee `peticion` (y cancela la petición anterior); `undefined` = no
 * pedir nada. Crear en un contexto de inyección (campo de un componente).
 *
 * El tipo `T` lo garantiza el contrato del back (docs/API-*.md); no se valida en ejecución.
 */
export function recursoApi<T>(
  peticion: () => HttpResourceRequest | string | undefined,
): HttpResourceRef<T | undefined> {
  return httpResource(
    () => {
      const p = peticion();
      return typeof p === 'string' ? { url: p } : p;
    },
    { parse: (respuesta) => (respuesta as RespuestaApi<T>).objetoResponse },
  );
}
