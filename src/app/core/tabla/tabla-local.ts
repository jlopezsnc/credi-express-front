import { computed, type Signal } from '@angular/core';
import { EstadoTabla } from '@/core/tabla/estado-tabla';
import { type Criterios, type Orden, ordenar, type Pagina, paginar } from '@/core/tabla/tabla';

export interface OpcionesTabla<T, K extends string> {
  /** Filas ya filtradas (búsqueda, filtros). Cuando cambian, se vuelve a la primera página. */
  datos: () => readonly T[];
  criterios: Criterios<T, K>;
  ordenInicial: Orden<K>;
  tamano: number;
}

/**
 * Tabla ordenable y paginada en el navegador, para listas que ya están completas en memoria
 * (Clientes). Para listas que pagina el back, `TablaRemota`.
 *
 * ```ts
 * protected readonly tabla = new TablaLocal({
 *   datos: () => this.filtrados(),
 *   criterios: { nombre: (c) => c.nombreCompleto, saldo: (c) => c.saldo },
 *   ordenInicial: { columna: 'nombre', direccion: 'asc' },
 *   tamano: 10,
 * });
 * ```
 */
export class TablaLocal<T, K extends string> extends EstadoTabla<K> {
  readonly pagina: Signal<Pagina<T>>;

  constructor(opciones: OpcionesTabla<T, K>) {
    super(opciones.ordenInicial, opciones.datos);
    const ordenados = computed(() => ordenar(opciones.datos(), opciones.criterios, this.orden()));
    this.pagina = computed(() => paginar(ordenados(), this.paginaPedida(), opciones.tamano));
  }
}
