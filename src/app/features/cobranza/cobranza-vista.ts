/*
 * Textos de la pantalla de cobranza. Solo da formato: la situación, los días, los saldos, los
 * totales y la agrupación por folio vienen calculados del back.
 */
import { formatearMoneda } from '@/core/format';
import {
  etiquetaMetodo,
  type OperacionPago,
  type SituacionCuota,
  TIPOS_PAGO,
} from '@/features/cobranza/cobranza-api';
import { horaRegistro, rangoPagos } from '@/features/cobranza/recibo';

export interface Etiqueta {
  texto: string;
  clase: string;
}

const CLASE_SITUACION: Record<SituacionCuota, string> = {
  VENCIDA: 'bg-atraso-soft text-atraso',
  HOY: 'bg-aviso-soft text-aviso',
  PROXIMA: 'bg-neutro-soft text-neutro',
};

function dias(n: number): string {
  return n === 1 ? '1 día' : `${String(n)} días`;
}

/** "12 días de atraso", "Vence hoy", "Mañana", "En 3 días" (los días los calcula el back). */
export function situacionDe(c: {
  situacion: SituacionCuota;
  diasAtraso: number;
  diasParaVencer: number;
}): Etiqueta {
  const clase = CLASE_SITUACION[c.situacion];
  if (c.situacion === 'VENCIDA') return { texto: `${dias(c.diasAtraso)} de atraso`, clase };
  if (c.situacion === 'HOY') return { texto: 'Vence hoy', clase };
  return { texto: c.diasParaVencer === 1 ? 'Mañana' : `En ${dias(c.diasParaVencer)}`, clase };
}

export function textoCuotas(n: number): string {
  return n === 1 ? '1 cuota' : `${String(n)} cuotas`;
}

export function textoPagos(n: number): string {
  return n === 1 ? '1 pago' : `${String(n)} pagos`;
}

/** Lo que muestra un renglón de "Cobrado hoy". */
export interface FilaOperacion {
  folio: string;
  cliente: string;
  pago: string;
  prestamo: string;
  tipo: string;
  metodo: string;
  hora: string;
  importe: string;
}

export function filaOperacion(o: OperacionPago): FilaOperacion {
  const numeros =
    o.cuotaInicial === o.cuotaFinal ? [o.cuotaInicial] : [o.cuotaInicial, o.cuotaFinal];
  return {
    folio: o.folio,
    cliente: o.cliente.nombreCompleto,
    pago: rangoPagos(numeros, o.totalCuotas),
    prestamo: `Préstamo #${String(o.idPrestamo)}`,
    tipo: TIPOS_PAGO[o.tipo],
    metodo: etiquetaMetodo(o.metodoPago),
    hora: horaRegistro(o.fechaRegistro),
    importe: formatearMoneda(o.totalRecibido),
  };
}
