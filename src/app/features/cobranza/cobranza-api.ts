/*
 * Tipos de `/operaciones-cobranza` tal como los envía el back (docs/API-COBRANZA.md §2 y §3).
 * El dinero llega como texto decimal ("710.00"); se pasa a centavos solo para mostrar o comparar.
 */

export type SituacionCuota = 'VENCIDA' | 'HOY' | 'PROXIMA';
export type MetodoPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'DEPOSITO';
export type TipoPago = 'CUOTA_COMPLETA' | 'ABONO_PARCIAL' | 'LIQUIDACION';
export type EstatusPago = 'VIGENTE' | 'CANCELADO';

export interface ClienteResumen {
  idCliente: number;
  nombreCompleto: string;
  telefono: string | null;
}

export interface ModalidadResumen {
  idModalidad: number;
  descripcion: string;
}

export interface Pagina<T> {
  contenido: T[];
  pagina: number;
  tamano: number;
  totalElementos: number;
  totalPaginas: number;
}

/** Página más el importe de todo lo filtrado (no solo de la página), para el pie de la tabla. */
export interface PaginaConTotal<T> extends Pagina<T> {
  importeTotal: string;
}

export type OrdenCuotas = 'CLIENTE' | 'PAGO' | 'VENCE' | 'SITUACION' | 'SALDO';

export interface ResumenCobranza {
  fecha: string;
  porCobrarHoy: { cuotas: number; importe: string };
  vencido: { cuotas: number; importe: string };
  /**
   * De mañana a hoy + 7 días. Opcional: es de la fase 2 y un back anterior no lo envía (front y
   * back se despliegan por separado); sin él, el contador de "Próximos 7 días" muestra 0.
   */
  proximas?: { cuotas: number; importe: string };
  cobrado: { pagos: number; importe: string };
}

export interface CuotaCobranza {
  idCuota: number;
  idPrestamo: number;
  cliente: ClienteResumen;
  modalidad: ModalidadResumen;
  numeroCuota: number;
  totalCuotas: number;
  fechaVencimiento: string;
  importeCuota: string;
  importeAbonado: string;
  saldoCuota: string;
  diasAtraso: number;
  /** Días que faltan para el vencimiento; 0 si vence hoy o ya venció. */
  diasParaVencer: number;
  situacion: SituacionCuota;
}

export interface Pago {
  idPago: number;
  folio: string;
  idCuota: number;
  idPrestamo: number;
  cliente: ClienteResumen;
  numeroCuota: number;
  totalCuotas: number;
  importe: string;
  recargo: string;
  totalRecibido: string;
  fechaPago: string;
  metodoPago: MetodoPago;
  referencia: string | null;
  nota: string | null;
  tipo: TipoPago;
  saldoCuota: string;
  cuotaLiquidada: boolean;
  prestamoLiquidado: boolean;
  registradoPor: string;
  fechaRegistro: string;
  estatus: EstatusPago;
  canceladoPor: string | null;
  fechaCancelacion: string | null;
  motivoCancelacion: string | null;
}

export interface CuotaPorLiquidar {
  idCuota: number;
  numeroCuota: number;
  fechaVencimiento: string;
  importeCuota: string;
  importeAbonado: string;
  saldoCuota: string;
  diasAtraso: number;
  diasParaVencer: number;
  situacion: SituacionCuota;
}

export interface SaldoPrestamo {
  idPrestamo: number;
  cliente: ClienteResumen;
  modalidad: ModalidadResumen;
  totalCuotas: number;
  cuotasPendientes: number;
  saldoTotal: string;
  hayCuotasVencidas: boolean;
  cuotas: CuotaPorLiquidar[];
}

export interface Liquidacion {
  folio: string;
  idPrestamo: number;
  cliente: ClienteResumen;
  cuotasLiquidadas: number;
  importe: string;
  recargo: string;
  totalRecibido: string;
  fechaPago: string;
  metodoPago: MetodoPago;
  referencia: string | null;
  nota: string | null;
  pagos: { idPago: number; idCuota: number; numeroCuota: number; importe: string }[];
  prestamoLiquidado: boolean;
  /** Al momento de cobrar; `null` en una reimpresión (no se guarda y hoy puede ser otra). */
  clienteSinAdeudos: boolean | null;
  registradoPor: string;
  fechaRegistro: string;
}

/** Una operación de cobro: un folio (una liquidación son varias cuotas con el mismo folio). */
export interface OperacionPago {
  folio: string;
  fechaRegistro: string;
  fechaPago: string;
  cliente: ClienteResumen;
  idPrestamo: number;
  cuotaInicial: number;
  cuotaFinal: number;
  totalCuotas: number;
  tipo: TipoPago;
  metodoPago: MetodoPago;
  referencia: string | null;
  importe: string;
  recargo: string;
  totalRecibido: string;
  registradoPor: string;
  estatus: EstatusPago;
}

/** `GET /recibo/{folio}`: lo mismo que se respondió al cobrar, para reimprimir el recibo. */
export type ReciboOperacion =
  | {
      tipo: 'CUOTA_COMPLETA' | 'ABONO_PARCIAL';
      modalidad: ModalidadResumen;
      totalCuotas: number;
      pago: Pago;
      liquidacion: null;
    }
  | {
      tipo: 'LIQUIDACION';
      modalidad: ModalidadResumen;
      totalCuotas: number;
      pago: null;
      liquidacion: Liquidacion;
    };

/** Datos comunes de `pago-registrar` y `prestamo-liquidar`. */
interface PeticionBase {
  importe: string;
  recargo: string;
  fechaPago: string;
  metodoPago: MetodoPago;
  referencia: string | null;
  nota: string | null;
}

export interface PeticionPago extends PeticionBase {
  idCuota: number;
}

export interface PeticionLiquidacion extends PeticionBase {
  idPrestamo: number;
}

export const METODOS_PAGO: readonly { id: MetodoPago; etiqueta: string }[] = [
  { id: 'EFECTIVO', etiqueta: 'Efectivo' },
  { id: 'TRANSFERENCIA', etiqueta: 'Transferencia' },
  { id: 'DEPOSITO', etiqueta: 'Depósito' },
];

export const TIPOS_PAGO: Record<TipoPago, string> = {
  CUOTA_COMPLETA: 'Cuota completa',
  ABONO_PARCIAL: 'Abono parcial',
  LIQUIDACION: 'Liquidación',
};

export function etiquetaMetodo(metodo: MetodoPago): string {
  return METODOS_PAGO.find((m) => m.id === metodo)?.etiqueta ?? metodo;
}
