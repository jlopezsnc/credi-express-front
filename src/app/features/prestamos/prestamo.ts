/*
 * Tipos de la lista y el calendario de préstamos (`GET /operaciones-prestamos/prestamos` y
 * `/prestamos/{id}`, docs/API-PRESTAMOS.md). Estado, próximo pago, pagos hechos y saldo los calcula
 * el back con los abonos vigentes y "hoy" en hora de México: el front solo los muestra.
 */
import type { ClienteResumen, ModalidadResumen } from '@/features/cobranza/cobranza-api';

/**
 * `EN_CONVENIO`: su saldo pasó a un convenio; `CANCELADO`: préstamo de un convenio cancelado
 * (docs/API-CONVENIOS.md). En los dos su saldo es 0.
 */
export type SituacionPrestamo =
  'AL_CORRIENTE' | 'CON_ATRASO' | 'LIQUIDADO' | 'EN_CONVENIO' | 'CANCELADO';
export type EstatusCuota =
  'PAGADA' | 'VENCIDA' | 'ABONO_PARCIAL' | 'PENDIENTE' | 'EN_CONVENIO' | 'CANCELADA';
export type FiltroPrestamos =
  'ACTIVOS' | 'AL_CORRIENTE' | 'CON_ATRASO' | 'LIQUIDADOS' | 'EN_CONVENIO' | 'CANCELADOS' | 'TODOS';
export type OrdenPrestamos =
  | 'CLIENTE'
  | 'PRESTAMO'
  | 'PAGOS'
  | 'VENCIDAS'
  | 'CUOTA'
  | 'TOTAL'
  | 'SALDO'
  | 'PROXIMO_PAGO'
  | 'ESTADO';

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
  /**
   * Convenio al que pasó su saldo y convenio que generó este préstamo. Opcionales: un back anterior
   * a los convenios no los envía.
   */
  folioConvenio?: string | null;
  folioConvenioOrigen?: string | null;
}

export interface PaginaPrestamos {
  contenido: PrestamoResumen[];
  pagina: number;
  tamano: number;
  totalElementos: number;
  totalPaginas: number;
  /** Cuántos hay en cada filtro (no dependen de la búsqueda). */
  contadores: {
    activos: number;
    conAtraso: number;
    liquidados: number;
    todos: number;
    /** De los convenios; un back anterior no los envía. */
    alCorriente?: number;
    enConvenio?: number;
    cancelados?: number;
  };
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
  /** Solo los de este cliente. */
  idCliente?: number;
  orden: OrdenPrestamos;
  direccion: 'ASC' | 'DESC';
  pagina: number;
  tamano: number;
}
