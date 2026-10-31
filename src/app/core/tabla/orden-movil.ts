import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icono } from '@/core/ui/icono';
import type { Direccion, Orden } from '@/core/tabla/tabla';

export interface ColumnaOrden {
  id: string;
  etiqueta: string;
}

/**
 * En el celular la lista son tarjetas (sin encabezados): un selector de columna y un botón para
 * invertir la dirección.
 */
@Component({
  selector: 'app-orden-movil',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-2' },
  template: `
    <label class="text-muted-foreground shrink-0 text-[13px] font-semibold" [attr.for]="campo()"
      >Ordenar por</label
    >
    <select
      class="entrada min-h-10 min-w-0 flex-1"
      [id]="campo()"
      [value]="orden().columna"
      (change)="elegir($event)"
    >
      @for (c of columnas(); track c.id) {
        <option [value]="c.id" [selected]="c.id === orden().columna">{{ c.etiqueta }}</option>
      }
    </select>
    <button
      type="button"
      class="btn-icono size-10"
      [attr.aria-label]="
        orden().direccion === 'asc'
          ? 'De menor a mayor. Cambiar a de mayor a menor'
          : 'De mayor a menor. Cambiar a de menor a mayor'
      "
      (click)="cambiar.emit({ columna: orden().columna, direccion: invertida() })"
    >
      <app-icono
        [nombre]="orden().direccion === 'asc' ? 'orden-asc' : 'orden-desc'"
        class="size-4"
      />
    </button>
  `,
})
export class OrdenMovil {
  readonly columnas = input.required<readonly ColumnaOrden[]>();
  readonly orden = input.required<Orden<string>>();
  /** Id del `<select>` (único en la página). */
  readonly campo = input('orden-movil');
  readonly cambiar = output<Orden<string>>();

  protected invertida(): Direccion {
    return this.orden().direccion === 'asc' ? 'desc' : 'asc';
  }

  protected elegir(evento: Event): void {
    const columna = (evento.target as HTMLSelectElement).value;
    this.cambiar.emit({ columna, direccion: this.orden().direccion });
  }
}
