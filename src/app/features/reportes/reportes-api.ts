/*
 * Tipos de `/operaciones-reportes` (docs/API-REPORTES.md). El dinero llega como texto decimal.
 */
import type { ClienteResumen, MetodoPago, OperacionPago } from '@/features/cobranza/cobranza-api';

export interface ReporteCobranza {
  desde: string;
  hasta: string;
  totales: { operaciones: number; importe: string; recargo: string; totalRecibido: string };
  cancelados: { operaciones: number; totalRecibido: string };
  porDia: {
    fecha: string;
    operaciones: number;
    importe: string;
    recargo: string;
    totalRecibido: string;
  }[];
  porMetodo: { metodoPago: MetodoPago; operaciones: number; totalRecibido: string }[];
  operaciones: OperacionReporte[];
}

/** Una operación (folio); el mismo objeto que usa "Cobrado hoy". */
export type OperacionReporte = OperacionPago;

export interface ReporteCartera {
  fecha: string;
  totales: {
    prestamosActivos: number;
    clientesActivos: number;
    clientesConAtraso: number;
    cuotasVencidas: number;
    saldoTotal: string;
    saldoVencido: string;
    saldoPorVencer: string;
    /** Con un decimal: "12.5". */
    porcentajeVencido: string;
  };
  antiguedad: {
    etiqueta: string;
    diasDesde: number;
    diasHasta: number | null;
    cuotas: number;
    saldo: string;
  }[];
  clientesConAtraso: {
    cliente: ClienteResumen;
    prestamos: number;
    cuotasVencidas: number;
    saldoVencido: string;
    saldoTotal: string;
    diasMaximoAtraso: number;
    vencimientoMasAntiguo: string;
  }[];
}
