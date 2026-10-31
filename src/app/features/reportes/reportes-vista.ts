/*
 * Lógica de presentación de los reportes: periodos rápidos, validación del periodo, gráficas y
 * el contenido de los CSV. Sin Angular, para probarla sola.
 */
import { aCsv } from '@/core/csv';
import { diasEntre, restarDias } from '@/features/cobranza/captura-pago';
import { etiquetaMetodo, TIPOS_PAGO } from '@/features/cobranza/cobranza-api';
import { rangoPagos } from '@/features/cobranza/recibo';
import type { ReporteCartera, ReporteCobranza } from '@/features/reportes/reportes-api';

/** Igual que el back (`PeriodoReporte.MAXIMO_DIAS`). */
export const MAXIMO_DIAS = 92;

export type IdPeriodo = 'hoy' | 'semana' | 'mes' | 'mes-anterior';

export interface Periodo {
  desde: string;
  hasta: string;
}

export const PERIODOS: readonly { id: IdPeriodo; etiqueta: string }[] = [
  { id: 'hoy', etiqueta: 'Hoy' },
  { id: 'semana', etiqueta: 'Esta semana' },
  { id: 'mes', etiqueta: 'Este mes' },
  { id: 'mes-anterior', etiqueta: 'Mes anterior' },
];

/** `hoy` en `yyyy-MM-dd`. La semana empieza en lunes. */
export function periodoRapido(id: IdPeriodo, hoy: string): Periodo {
  const fecha = new Date(`${hoy}T00:00:00Z`);
  switch (id) {
    case 'hoy':
      return { desde: hoy, hasta: hoy };
    case 'semana': {
      const desdeLunes = (fecha.getUTCDay() + 6) % 7;
      return { desde: restarDias(hoy, desdeLunes), hasta: hoy };
    }
    case 'mes':
      return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
    case 'mes-anterior': {
      const ultimo = restarDias(`${hoy.slice(0, 8)}01`, 1);
      return { desde: `${ultimo.slice(0, 8)}01`, hasta: ultimo };
    }
  }
}

export function errorPeriodo(p: Periodo): string {
  if (!p.desde || !p.hasta) return 'Elige las dos fechas del periodo.';
  if (p.desde > p.hasta) return 'La fecha inicial no puede ser posterior a la final.';
  if (diasEntre(p.desde, p.hasta) + 1 > MAXIMO_DIAS) {
    return `El periodo no puede pasar de ${String(MAXIMO_DIAS)} días.`;
  }
  return '';
}

/** Alto de cada barra en % del valor mayor; la mayor se marca para etiquetarla. */
export function barras<T>(
  datos: readonly T[],
  valor: (d: T) => number,
): { dato: T; porcentaje: number; mayor: boolean }[] {
  const maximo = Math.max(0, ...datos.map(valor));
  let indiceMayor = -1;
  if (maximo > 0) indiceMayor = datos.findIndex((d) => valor(d) === maximo);
  return datos.map((dato, i) => ({
    dato,
    porcentaje: maximo > 0 ? (valor(dato) / maximo) * 100 : 0,
    mayor: i === indiceMayor,
  }));
}

export function csvCobranza(r: ReporteCobranza): string {
  return aCsv(
    [
      'Folio',
      'Fecha de registro',
      'Fecha del pago',
      'Cliente',
      'Préstamo',
      'Cuotas',
      'Tipo',
      'Método',
      'Referencia',
      'Importe aplicado',
      'Recargo',
      'Total recibido',
      'Registró',
      'Estatus',
    ],
    r.operaciones.map((o) => [
      o.folio,
      o.fechaRegistro,
      o.fechaPago,
      o.cliente.nombreCompleto,
      o.idPrestamo,
      rangoPagos(
        o.cuotaInicial === o.cuotaFinal ? [o.cuotaInicial] : [o.cuotaInicial, o.cuotaFinal],
        o.totalCuotas,
      ),
      TIPOS_PAGO[o.tipo],
      etiquetaMetodo(o.metodoPago),
      o.referencia,
      o.importe,
      o.recargo,
      o.totalRecibido,
      o.registradoPor,
      o.estatus === 'VIGENTE' ? 'Vigente' : 'Cancelado',
    ]),
  );
}

export function csvCartera(r: ReporteCartera): string {
  return aCsv(
    [
      'Cliente',
      'Teléfono',
      'Préstamos con atraso',
      'Cuotas vencidas',
      'Saldo vencido',
      'Saldo total',
      'Días de atraso',
      'Vencimiento más antiguo',
    ],
    r.clientesConAtraso.map((c) => [
      c.cliente.nombreCompleto,
      c.cliente.telefono,
      c.prestamos,
      c.cuotasVencidas,
      c.saldoVencido,
      c.saldoTotal,
      c.diasMaximoAtraso,
      c.vencimientoMasAntiguo,
    ]),
  );
}

/**
 * Trazo SVG de una columna con la base recta en `base` y la punta redondeada (radio 4, sin pasar
 * de la mitad del grueso ni del alto). Vacío si no tiene alto.
 */
export function trazoColumna(x: number, base: number, grueso: number, alto: number): string {
  if (alto <= 0) return '';
  const y = base - alto;
  const r = Math.min(RADIO, grueso / 2, alto);
  return (
    `M${n(x)},${n(base)}V${n(y + r)}Q${n(x)},${n(y)} ${n(x + r)},${n(y)}` +
    `H${n(x + grueso - r)}Q${n(x + grueso)},${n(y)} ${n(x + grueso)},${n(y + r)}V${n(base)}Z`
  );
}

/** Tamaño del lienzo de la gráfica de columnas (unidades del `viewBox`; escala con el ancho). */
export const LIENZO = { ancho: 640, alto: 160 } as const;
/** Barras horizontales: el largo máximo y el grueso (unidades del `viewBox`). */
export const BARRA = { largo: 400, grueso: 20 } as const;

const GROSOR_MAXIMO = 24;
const SEPARACION = 2;
const RADIO = 4;

function n(valor: number): string {
  return String(Math.round(valor * 100) / 100);
}

/**
 * Columnas de alto proporcional (`porcentaje` 0–100), con la punta redondeada (4) y la base recta,
 * a lo más 24 de grueso y 2 de separación entre vecinas.
 */
export function columnas(porcentajes: readonly number[]): { d: string; x: number; slot: number }[] {
  const slot = LIENZO.ancho / Math.max(1, porcentajes.length);
  const grueso = Math.max(1, Math.min(GROSOR_MAXIMO, slot - SEPARACION));
  return porcentajes.map((porcentaje, i) => {
    const x = i * slot + (slot - grueso) / 2;
    const alto = porcentaje > 0 ? Math.max(1, (porcentaje / 100) * LIENZO.alto) : 0;
    if (alto === 0) return { d: '', x: i * slot, slot };
    return { d: trazoColumna(x, LIENZO.alto, grueso, alto), x: i * slot, slot };
  });
}

/** Barra horizontal desde la base (izquierda, recta) con la punta redondeada. */
export function barraHorizontal(porcentaje: number): string {
  if (porcentaje <= 0) return '';
  const largo = Math.max(1, (porcentaje / 100) * BARRA.largo);
  const g = BARRA.grueso;
  const r = Math.min(RADIO, largo, g / 2);
  return `M0,0H${n(largo - r)}Q${n(largo)},0 ${n(largo)},${n(r)}V${n(g - r)}Q${n(largo)},${n(g)} ${n(largo - r)},${n(g)}H0Z`;
}
