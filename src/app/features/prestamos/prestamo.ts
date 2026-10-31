/*
 * Tipos de la lista y el calendario de préstamos (`GET /operaciones-prestamos/prestamos` y
 * `/prestamos/{id}`, docs/API-PRESTAMOS.md). Estado, próximo pago, pagos hechos y saldo los calcula
 * el back con los abonos vigentes y "hoy" en hora de México: el front solo los muestra.
 */
import type { ClienteResumen, ModalidadResumen } from '@/features/cobranza/cobranza-api';

export type SituacionPrestamo = 'AL_CORRIENTE' | 'CON_ATRASO' | 'LIQUIDADO';
export type EstatusCuota = 'PAGADA' | 'VENCIDA' | 'ABONO_PARCIAL' | 'PENDIENTE';
export type FiltroPrestamos = 'ACTIVOS' | 'CON_ATRASO' | 'LIQUIDADOS' | 'TODOS';
export type OrdenPrestamos =
  'CLIENTE' | 'PAGOS' | 'CUOTA' | 'TOTAL' | 'SALDO' | 'PROXIMO_PAGO' | 'ESTADO';

export interface PrestamoResumen {
  idPrestamo: number;
  cliente: ClienteResumen;
  modalidad: ModalidadResumen;
  numeroCuotas: number;
  cuotasPagadas: number;
  cuotasVencidas: number;
  importeCuota: string;
  totalPagar: string;
  saldoPendiente: string;
  /** `null` si está liquidado. */
  proximoPago: string | null;
  proximaCuota: number | null;
  estado: SituacionPrestamo;
}

export interface PaginaPrestamos {
  contenido: PrestamoResumen[];
  pagina: number;
  tamano: number;
  totalElementos: number;
  totalPaginas: number;
  /** Cuántos hay en cada filtro (no dependen de la búsqueda). */
  contadores: { activos: number; conAtraso: number; liquidados: number; todos: number };
}

export interface CuotaCalendario {
  idCuota: number;
  numeroCuota: number;
  fechaVencimiento: string;
  importe: string;
  abonado: string;
  saldo: string;
  fechaPago: string | null;
  estatus: EstatusCuota;
}

export interface PrestamoDetalle {
  prestamo: PrestamoResumen;
  cuotas: CuotaCalendario[];
}

/** Petición de una página de la lista. */
export interface ConsultaPrestamos {
  filtro: FiltroPrestamos;
  busqueda: string;
  orden: OrdenPrestamos;
  direccion: 'ASC' | 'DESC';
  pagina: number;
  tamano: number;
}
