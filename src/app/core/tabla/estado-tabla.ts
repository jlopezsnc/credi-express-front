import { linkedSignal, signal, type Signal, type WritableSignal } from '@angular/core';
import type { Direccion, Orden, Pagina } from '@/core/tabla/tabla';

/**
 * Columna, dirección y página de una tabla. Lo comparten la tabla que ordena en el navegador
 * ({@link TablaLocal}) y la que pide cada página al back (`TablaRemota`); los componentes
 * `EncabezadoOrdenable`, `Paginador` y `OrdenMovil` trabajan con cualquiera de las dos.
 */
export abstract class EstadoTabla<K extends string> {
  readonly orden: WritableSignal<Orden<K>>;
  /** Página pedida (desde 0). Vuelve a 0 cuando cambia el orden o lo que indique `reiniciarCon`. */
  protected readonly paginaPedida: WritableSignal<number>;

  /** La página que se está mostrando. */
  abstract readonly pagina: Signal<Pagina<unknown>>;

  protected constructor(ordenInicial: Orden<K>, reiniciarCon: () => unknown) {
    this.orden = signal<Orden<K>>(ordenInicial);
    this.paginaPedida = linkedSignal({
      source: () => [this.orden(), reiniciarCon()],
      computation: () => 0,
    });
  }

  /** La misma columna invierte la dirección; otra columna empieza ascendente. */
  ordenarPor(columna: K): void {
    this.orden.update((o) =>
      o.columna === columna
        ? { columna, direccion: o.direccion === 'asc' ? 'desc' : 'asc' }
        : { columna, direccion: 'asc' },
    );
  }

  /** Para el selector del celular: columna y dirección explícitas. */
  fijarOrden(columna: K, direccion: Direccion): void {
    this.orden.set({ columna, direccion });
  }

  irA(pagina: number): void {
    this.paginaPedida.set(pagina);
  }

  /** Dirección de la columna, o `undefined` si no es la que ordena. */
  direccion(columna: K): Direccion | undefined {
    const orden = this.orden();
    return orden.columna === columna ? orden.direccion : undefined;
  }

  /** Valor de `aria-sort` para el `<th>` de la columna. */
  ariaSort(columna: K): 'ascending' | 'descending' | 'none' {
    const direccion = this.direccion(columna);
    return direccion === 'asc' ? 'ascending' : direccion === 'desc' ? 'descending' : 'none';
  }
}
