import { computed, type Signal } from '@angular/core';
import { EstadoTabla } from '@/core/tabla/estado-tabla';
import type { Orden, Pagina } from '@/core/tabla/tabla';

/** Página como la entrega el back (`PaginaResponse` y sus variantes). */
export interface PaginaApi<T> {
  contenido: T[];
  /** Desde 0. */
  pagina: number;
  tamano: number;
  totalElementos: number;
  totalPaginas: number;
}

/** Lo que se le pide al back: columna, dirección y página. */
export interface PeticionTabla<K extends string> {
  orden: Orden<K>;
  pagina: number;
}

/** Convierte la página del back a la forma que dibuja el `Paginador`. */
export function paginaDeApi<T>(api: PaginaApi<T> | undefined): Pagina<T> {
  if (!api) return { elementos: [], pagina: 0, totalPaginas: 1, total: 0, desde: 0, hasta: 0 };
  const inicio = api.pagina * api.tamano;
  return {
    elementos: api.contenido,
    pagina: api.pagina,
    totalPaginas: Math.max(1, api.totalPaginas),
    total: api.totalElementos,
    desde: api.contenido.length > 0 ? inicio + 1 : 0,
    hasta: inicio + api.contenido.length,
  };
}

/**
 * Tabla que ordena y pagina en el back: guarda columna, dirección y página, y `peticion` dice qué
 * pedir. La pantalla arma la consulta HTTP (normalmente un `httpResource`) con `peticion()` y le
 * pasa la respuesta en `respuesta`.
 *
 * ```ts
 * protected readonly tabla = new TablaRemota<Columna>({
 *   ordenInicial: { columna: 'proximo', direccion: 'asc' },
 *   reiniciarCon: () => [this.filtro(), this.busqueda()],
 *   respuesta: () => this.lista.value(),
 * });
 * ```
 */
export class TablaRemota<K extends string, T = unknown> extends EstadoTabla<K> {
  readonly peticion: Signal<PeticionTabla<K>>;
  readonly pagina: Signal<Pagina<T>>;

  constructor(opciones: {
    ordenInicial: Orden<K>;
    /** Filtros y búsqueda: cuando cambian, se vuelve a la primera página. */
    reiniciarCon: () => unknown;
    /** La última página que respondió el back. */
    respuesta: () => PaginaApi<T> | undefined;
  }) {
    super(opciones.ordenInicial, opciones.reiniciarCon);
    this.peticion = computed(() => ({ orden: this.orden(), pagina: this.paginaPedida() }));
    this.pagina = computed(() => paginaDeApi(opciones.respuesta()));
  }
}
