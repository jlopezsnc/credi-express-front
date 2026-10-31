/*
 * Recibo de pago: lo que muestran el diálogo "Pago registrado" y el PNG que se descarga
 * (docs/API-COBRANZA.md §7.8). Igual para un pago de cuota y para una liquidación.
 */
import { formatearMoneda, normalizarTexto } from '@/core/format';
import { centavos } from '@/features/cobranza/captura-pago';
import {
  etiquetaMetodo,
  type Liquidacion,
  type MetodoPago,
  type Pago,
  type SaldoPrestamo,
} from '@/features/cobranza/cobranza-api';

export interface Renglon {
  etiqueta: string;
  valor: string;
}

export interface Recibo {
  titulo: string;
  folio: string;
  /** Fecha y hora del registro, ya en texto. */
  registro: string;
  filas: Renglon[];
  importes: (Renglon & { fuerte: boolean })[];
  saldoEtiqueta: string;
  saldo: string;
  liquidada: boolean;
  nota: string;
  archivo: string;
}

const formatoFechaPago = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

// El negocio opera en el centro de México; el registro se muestra en esa hora.
const formatoRegistro = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Mexico_City',
});

const formatoHora = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Mexico_City',
});

/** "2026-10-29T10:15:00-06:00" → "29 de octubre de 2026, 10:15 a.m." */
export function textoRegistro(marca: string): string {
  const fecha = new Date(marca);
  return Number.isNaN(fecha.getTime()) ? '—' : formatoRegistro.format(fecha);
}

/** "2026-10-29T10:15:00-06:00" → "10:15". */
export function horaRegistro(marca: string): string {
  const fecha = new Date(marca);
  return Number.isNaN(fecha.getTime()) ? '—' : formatoHora.format(fecha);
}

export function fechaPagoTexto(iso: string): string {
  return formatoFechaPago.format(new Date(`${iso}T00:00:00Z`));
}

/** "Pago 8 de 8" o "Pagos 3 a 8 de 8". */
export function rangoPagos(numeros: readonly number[], total: number): string {
  const primero = numeros[0];
  const ultimo = numeros[numeros.length - 1];
  if (primero === undefined || ultimo === undefined) return '';
  return primero === ultimo
    ? `Pago ${String(primero)} de ${String(total)}`
    : `Pagos ${String(primero)} a ${String(ultimo)} de ${String(total)}`;
}

/**
 * `PAGO_MARIA_FERNANDA_LOPEZ_RUIZ_RECIBO_2_de_8.png`; en una liquidación las cuotas van como
 * `3_a_8`. Sin acentos, en mayúsculas y con `_`.
 */
export function nombreArchivo(cliente: string, numeros: readonly number[], total: number): string {
  const nombre = normalizarTexto(cliente)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const primero = numeros[0] ?? 0;
  const ultimo = numeros[numeros.length - 1] ?? primero;
  const cuotas = primero === ultimo ? String(primero) : `${String(primero)}_a_${String(ultimo)}`;
  return `PAGO_${nombre}_RECIBO_${cuotas}_de_${String(total)}.png`;
}

function textoMetodo(metodo: MetodoPago, referencia: string | null): string {
  return referencia ? `${etiquetaMetodo(metodo)} · ${referencia}` : etiquetaMetodo(metodo);
}

/** Con recargo se desglosa; sin él basta el importe recibido. */
function importes(
  etiquetaAplicado: string,
  importe: string,
  recargo: string,
  total: string,
): Recibo['importes'] {
  if (centavos(recargo) === 0) {
    return [{ etiqueta: 'Importe recibido', valor: formatearMoneda(importe), fuerte: true }];
  }
  return [
    { etiqueta: etiquetaAplicado, valor: formatearMoneda(importe), fuerte: false },
    { etiqueta: 'Recargo por atraso', valor: formatearMoneda(recargo), fuerte: false },
    { etiqueta: 'Total recibido', valor: formatearMoneda(total), fuerte: true },
  ];
}

export function reciboDePago(p: Pago): Recibo {
  return {
    titulo: 'Pago registrado',
    folio: p.folio,
    registro: textoRegistro(p.fechaRegistro),
    filas: [
      { etiqueta: 'Cliente', valor: p.cliente.nombreCompleto },
      {
        etiqueta: 'Préstamo',
        valor: `Préstamo #${String(p.idPrestamo)} · ${rangoPagos([p.numeroCuota], p.totalCuotas)}`,
      },
      { etiqueta: 'Método', valor: textoMetodo(p.metodoPago, p.referencia) },
      { etiqueta: 'Fecha del pago', valor: fechaPagoTexto(p.fechaPago) },
    ],
    importes: importes('Aplicado a la cuota', p.importe, p.recargo, p.totalRecibido),
    saldoEtiqueta: 'Saldo de la cuota',
    saldo: p.cuotaLiquidada ? 'Cuota liquidada' : `${formatearMoneda(p.saldoCuota)} pendientes`,
    liquidada: p.cuotaLiquidada,
    nota: p.prestamoLiquidado ? 'Con este pago el préstamo queda liquidado.' : '',
    archivo: nombreArchivo(p.cliente.nombreCompleto, [p.numeroCuota], p.totalCuotas),
  };
}

/** `saldo` es lo que se consultó antes de liquidar: de ahí salen la modalidad y el total de cuotas. */
export function reciboDeLiquidacion(l: Liquidacion, saldo: SaldoPrestamo): Recibo {
  const numeros = l.pagos.map((p) => p.numeroCuota).sort((a, b) => a - b);
  return {
    titulo: 'Préstamo liquidado',
    folio: l.folio,
    registro: textoRegistro(l.fechaRegistro),
    filas: [
      { etiqueta: 'Cliente', valor: l.cliente.nombreCompleto },
      {
        etiqueta: 'Préstamo',
        valor: `Préstamo #${String(l.idPrestamo)} · ${saldo.modalidad.descripcion}`,
      },
      { etiqueta: 'Cuotas liquidadas', valor: rangoPagos(numeros, saldo.totalCuotas) },
      { etiqueta: 'Método', valor: textoMetodo(l.metodoPago, l.referencia) },
      { etiqueta: 'Fecha del pago', valor: fechaPagoTexto(l.fechaPago) },
    ],
    importes: importes('Aplicado al préstamo', l.importe, l.recargo, l.totalRecibido),
    saldoEtiqueta: 'Saldo del préstamo',
    saldo: 'Préstamo liquidado',
    liquidada: true,
    nota: l.clienteSinAdeudos
      ? 'El cliente ya no tiene adeudos.'
      : 'El cliente todavía tiene otro préstamo con saldo.',
    archivo: nombreArchivo(l.cliente.nombreCompleto, numeros, saldo.totalCuotas),
  };
}
