/*
 * Ordenamiento y paginación de listas que ya están en memoria. Sin Angular: se prueba sola.
 * El estado con señales para las pantallas está en `tabla-local.ts`.
 */

export type Direccion = 'asc' | 'desc';

export interface Orden<K extends string> {
  columna: K;
  direccion: Direccion;
}

/** Valor por el que se ordena una fila; `null`/`undefined` (sin dato) siempre va al final. */
export type ValorOrden = string | number | null | undefined;

export type Criterios<T, K extends string> = Record<K, (fila: T) => ValorOrden>;

// Español de México, sin distinguir acentos ni mayúsculas, y "Préstamo 10" después de "Préstamo 9".
const colacion = new Intl.Collator('es-MX', { sensitivity: 'base', numeric: true });

function compararValores(a: ValorOrden, b: ValorOrden): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return colacion.compare(String(a), String(b));
}

function vacio(valor: ValorOrden): boolean {
  return valor === null || valor === undefined || valor === '';
}

/** Orden estable: a igual valor se respeta el orden que traía la lista. */
export function ordenar<T, K extends string>(
  lista: readonly T[],
  criterios: Criterios<T, K>,
  orden: Orden<K>,
): T[] {
  const valor = criterios[orden.columna];
  const signo = orden.direccion === 'asc' ? 1 : -1;
  return lista
    .map((fila, indice) => ({ fila, indice, valor: valor(fila) }))
    .sort((a, b) => {
      const sinA = vacio(a.valor);
      const sinB = vacio(b.valor);
      if (sinA || sinB) return sinA === sinB ? a.indice - b.indice : sinA ? 1 : -1;
      return signo * compararValores(a.valor, b.valor) || a.indice - b.indice;
    })
    .map((x) => x.fila);
}

export interface Pagina<T> {
  elementos: T[];
  /** Desde 0. */
  pagina: number;
  totalPaginas: number;
  total: number;
  /** Posición (desde 1) del primer y último elemento mostrados; 0 si no hay elementos. */
  desde: number;
  hasta: number;
}

/** Corta la página pedida; si ya no existe (la lista se achicó), entrega la última. */
export function paginar<T>(lista: readonly T[], pagina: number, tamano: number): Pagina<T> {
  const totalPaginas = Math.max(1, Math.ceil(lista.length / tamano));
  const actual = Math.min(Math.max(0, pagina), totalPaginas - 1);
  const inicio = actual * tamano;
  const elementos = lista.slice(inicio, inicio + tamano);
  return {
    elementos,
    pagina: actual,
    totalPaginas,
    total: lista.length,
    desde: elementos.length > 0 ? inicio + 1 : 0,
    hasta: inicio + elementos.length,
  };
}

/**
 * Números de página a mostrar (desde 0), con `null` donde van puntos suspensivos:
 * siempre la primera, la última y las vecinas de la actual. 10 páginas, actual 5 → 0 … 4 5 6 … 9.
 */
export function paginasVisibles(actual: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const centro = new Set([0, total - 1, actual - 1, actual, actual + 1]);
  if (actual <= 2) [1, 2, 3].forEach((p) => centro.add(p));
  if (actual >= total - 3) [total - 4, total - 3, total - 2].forEach((p) => centro.add(p));
  const paginas = [...centro].filter((p) => p >= 0 && p < total).sort((a, b) => a - b);
  return paginas.flatMap((p, i) => {
    const anterior = paginas[i - 1];
    return anterior !== undefined && p - anterior > 1 ? [null, p] : [p];
  });
}
