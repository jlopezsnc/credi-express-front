/** Cuerpo de error del back: el mismo sobre de las respuestas (docs/API-CLIENTES.md). */
export interface ApiErrorBody {
  httpStatus?: string;
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

/** Mensaje para mostrar al usuario a partir de cualquier error de una llamada al back. */
export function mensajeDeError(error: unknown, porDefecto: string): string {
  if (!(error instanceof ApiError)) return porDefecto;
  if (error.status === 0)
    return 'No hay conexión con el servidor. Revisa tu red e intenta de nuevo.';
  if (error.status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  if (error.status === 403) return 'No tienes permiso para hacer esta operación.';
  return error.body?.mensaje ?? porDefecto;
}
