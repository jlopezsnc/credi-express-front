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
