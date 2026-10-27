import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/client';

const MAX_REINTENTOS = 2;

export function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Los errores 4xx (validación, permisos) no se arreglan reintentando.
        retry: (intentos, error) =>
          !(error instanceof ApiError && error.status < 500) && intentos < MAX_REINTENTOS,
      },
      mutations: {
        // Nunca reintentar en automático algo que mueve dinero (docs §5.2, API6).
        retry: false,
      },
    },
  });
}
