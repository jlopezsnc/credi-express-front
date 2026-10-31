import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icono } from '@/core/ui/icono';
import type { Direccion } from '@/core/tabla/tabla';

/**
 * Botón dentro del `<th>` de una columna ordenable. El `<th>` lleva el `aria-sort`
 * (`TablaLocal.ariaSort`); aquí solo se dibuja la flecha y se avisa el clic.
 *
 * ```html
 * <th scope="col" [attr.aria-sort]="tabla.ariaSort('nombre')">
 *   <app-encabezado-ordenable [direccion]="tabla.direccion('nombre')" (ordenar)="tabla.ordenarPor('nombre')">
 *     Cliente
 *   </app-encabezado-ordenable>
 * </th>
 * ```
 */
@Component({
  selector: 'app-encabezado-ordenable',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <button
      type="button"
      class="hover:text-foreground focus-visible:text-foreground -mx-1 inline-flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 tracking-wider uppercase"
      [class.text-foreground]="direccion()"
      [class.flex-row-reverse]="alDerecha()"
      [attr.title]="titulo()"
      (click)="ordenar.emit()"
    >
      <ng-content />
      <app-icono [nombre]="icono()" class="size-3.5" [class.opacity-40]="!direccion()" />
    </button>
  `,
})
export class EncabezadoOrdenable {
  readonly direccion = input<Direccion | undefined>();
  /** Para columnas numéricas alineadas a la derecha: la flecha va antes del texto. */
  readonly alDerecha = input(false);
  readonly ordenar = output();

  protected readonly icono = computed(() => {
    const direccion = this.direccion();
    return direccion === 'asc' ? 'orden-asc' : direccion === 'desc' ? 'orden-desc' : 'ordenar';
  });

  protected readonly titulo = computed(() =>
    this.direccion() === 'asc'
      ? 'Ordenado de menor a mayor'
      : this.direccion() === 'desc'
        ? 'Ordenado de mayor a menor'
        : 'Ordenar por esta columna',
  );
}
