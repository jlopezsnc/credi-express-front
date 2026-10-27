import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from '@/lib/api/schema';
import { getFirebaseAuth } from '@/lib/firebase';

/** Formato único de error que devuelve el @RestControllerAdvice del back (docs §2.2). */
export interface ApiErrorBody {
  codigo: string;
  mensaje: string;
  traceId?: string;
  campos?: { campo: string; mensaje: string }[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody | undefined,
  ) {
    super(body?.mensaje ?? `Error HTTP ${String(status)}`);
    this.name = 'ApiError';
  }
}

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    // El SDK renueva el token de vida corta cuando hace falta; nunca se guarda a mano.
    const token = await getFirebaseAuth().currentUser?.getIdToken();
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    return request;
  },
};

const errorMiddleware: Middleware = {
  async onResponse({ response }) {
    if (response.ok) return response;
    const body = (await response
      .clone()
      .json()
      .catch(() => undefined)) as ApiErrorBody | undefined;
    throw new ApiError(response.status, body);
  },
};

export const api = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  credentials: 'omit',
});
api.use(authMiddleware, errorMiddleware);
