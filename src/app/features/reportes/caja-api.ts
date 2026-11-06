/*
 * Tipos de `/operaciones-caja` (docs/API-CAJA.md). El dinero llega como texto decimal.
 */

export type TipoMovimientoCaja = 'APORTACION' | 'RETIRO';
export type EstatusMovimientoCaja = 'VIGENTE' | 'CANCELADO';

export interface MesCaja {
  /** `yyyy-MM`. */
  mes: string;
  aportado: string;
  cobrado: string;
  prestado: string;
  retirado: string;
  /** aportado + cobrado − prestado − retirado del mes. */
  neto: string;
  /** Saldo al cierre del mes, con todo lo anterior. */
  acumulado: string;
}

export interface SaldoCaja {
  /** `null` = toda la historia. */
  anio: number | null;
  anios: number[];
  totales: { aportado: string; cobrado: string; prestado: string; retirado: string; neto: string };
  saldoInicial: string;
  saldoFinal: string;
  saldoActual: string;
  /** Del más antiguo al más reciente. */
  meses: MesCaja[];
}

export interface MovimientoCaja {
  idMovimiento: number;
  tipo: TipoMovimientoCaja;
  importe: string;
  /** `yyyy-MM-dd`. */
  fecha: string;
  concepto: string;
  estatus: EstatusMovimientoCaja;
  registradoPor: string;
  fechaRegistro: string;
  canceladoPor: string | null;
  fechaCancelacion: string | null;
  motivoCancelacion: string | null;
}

export interface PaginaMovimientos {
  contenido: MovimientoCaja[];
  /** Desde 0. */
  pagina: number;
  tamano: number;
  totalElementos: number;
  totalPaginas: number;
}

export interface NuevoMovimientoCaja {
  tipo: TipoMovimientoCaja;
  /** Decimal con punto y hasta dos decimales, sin comas. */
  importe: string;
  fecha: string;
  concepto: string;
}

export const TIPOS_MOVIMIENTO: Record<TipoMovimientoCaja, string> = {
  APORTACION: 'Aportación de capital',
  RETIRO: 'Retiro',
};
