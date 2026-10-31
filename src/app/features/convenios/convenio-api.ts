/*
 * Tipos de `/operaciones-convenios` tal como los envía el back (docs/API-CONVENIOS.md). Saldo,
 * interés, total y calendario los calcula el back; el dinero llega como texto decimal ("825.83").
 */
import type { ClienteResumen, ModalidadResumen } from '@/features/cobranza/cobranza-api';
import type { CuotaCalendario, SituacionPrestamo } from '@/features/prestamos/prestamo';

/** Cómo va un convenio: la situación de su préstamo nuevo o, si se canceló, `CANCELADO`. */
export type SituacionConvenio = 'AL_CORRIENTE' | 'CON_ATRASO' | 'LIQUIDADO' | 'CANCELADO';
export type EstatusConvenio = 'VIGENTE' | 'CANCELADO';
export type FiltroConvenios = 'VIGENTES' | 'CON_ATRASO' | 'LIQUIDADOS' | 'CANCELADOS' | 'TODOS';
export type OrdenConvenios =
  'FOLIO' | 'TITULAR' | 'PRESTAMOS' | 'CONVENIDO' | 'PAGOS' | 'SALDO' | 'ESTADO' | 'FECHA';

/** Un renglón de la lista, ya calculado por el back. */
export interface ConvenioResumen {
  idConvenio: number;
  folio: string;
  titular: ClienteResumen;
  idPrestamoConvenio: number;
  /** Cuántos préstamos juntó y de cuántas personas. */
  prestamos: number;
  personas: number;
  modalidad: ModalidadResumen;
  numeroPagos: number;
  cuotasPagadas: number;
  cuotasVencidas: number;
  saldoConvenido: string;
  totalPagar: string;
  importeCuota: string;
  /** "0.00" si está cancelado o liquidado. */
  saldoPendiente: string;
  estado: SituacionConvenio;
  estatus: EstatusConvenio;
  fechaRegistro: string;
}

export interface PaginaConvenios {
  contenido: ConvenioResumen[];
  pagina: number;
  tamano: number;
  totalElementos: number;
  totalPaginas: number;
  /** Cuántos hay en cada filtro (no dependen de la búsqueda). */
  contadores: {
    vigentes: number;
    conAtraso: number;
    liquidados: number;
    cancelados: number;
    todos: number;
  };
}

export interface BitacoraConvenio {
  registradoPor: string;
  fechaRegistro: string;
  ipOrigen: string | null;
  actualizadoPor: string | null;
  fechaActualizacion: string | null;
  canceladoPor: string | null;
  fechaCancelacion: string | null;
  motivoCancelacion: string | null;
}

export interface ConvenioDetalle {
  convenio: ConvenioResumen;
  tasaInteres: string;
  meses: string;
  interes: string;
  fechaPrimerPago: string;
  motivo: string;
  /** Cómo estaban al convenir. */
  prestamos: PrestamoConvenido[];
  /** Cuotas del préstamo nuevo. */
  calendario: CuotaCalendario[];
  pagosRegistrados: number;
  /** Lo decide el back: solo se cancela uno vigente y sin pagos. */
  puedeCancelar: boolean;
  motivoNoCancelable: string | null;
  bitacora: BitacoraConvenio;
}

/** Petición de una página de la lista. */
export interface ConsultaConvenios {
  filtro: FiltroConvenios;
  busqueda: string;
  orden: OrdenConvenios;
  direccion: 'ASC' | 'DESC';
  pagina: number;
  tamano: number;
}

/** Un préstamo de origen con cómo está hoy (o cómo estaba al convenir). */
export interface PrestamoConvenido {
  idPrestamo: number;
  cliente: ClienteResumen;
  estado: SituacionPrestamo;
  numeroCuotas: number;
  cuotasPagadas: number;
  cuotasVencidas: number;
  saldo: string;
}

export interface CuotaPlan {
  numero: number;
  fechaVencimiento: string;
  importe: string;
}

export interface SimulacionConvenio {
  prestamos: PrestamoConvenido[];
  /** Cuántas personas distintas tienen los préstamos. */
  personas: number;
  saldoConvenido: string;
  /** Interés mensual en porcentaje ("0.00" = sin interés). */
  tasaInteres: string;
  /** Plazo en meses ("3", "2.5"). */
  meses: string;
  interes: string;
  totalPagar: string;
  numeroPagos: number;
  importeCuota: string;
  importeUltimaCuota: string;
  modalidad: ModalidadResumen;
  calendario: CuotaPlan[];
}

export interface Convenio {
  idConvenio: number;
  folio: string;
  /** Préstamo nuevo con el calendario del convenio: se cobra en Cobranza como cualquier otro. */
  idPrestamoConvenio: number;
  titular: ClienteResumen;
  motivo: string;
  estatus: 'VIGENTE' | 'CANCELADO';
  registradoPor: string;
  fechaRegistro: string;
  plan: SimulacionConvenio;
}

export interface PeticionSimulacion {
  idsPrestamo: number[];
  idModalidad: number;
  numeroPagos: number;
  /** Texto decimal: "0" = sin interés. */
  tasaInteres: string;
  fechaPrimerPago: string;
}

export interface PeticionConvenio extends PeticionSimulacion {
  idClienteTitular: number;
  motivo: string;
  /** El saldo que se vio en la simulación: si cambió (entró un pago), el back responde 409. */
  saldoEsperado: string;
}

export const MOTIVO_CANCELACION_MINIMO = 10;
export const PAGOS_MINIMO = 1;
export const PAGOS_MAXIMO = 52;
export const MOTIVO_MINIMO = 10;
export const MOTIVO_MAXIMO = 250;
export const MAXIMO_PRESTAMOS = 20;
