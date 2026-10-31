import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icono } from '@/core/ui/icono';
import { type Pagina, paginasVisibles } from '@/core/tabla/tabla';

/**
 * "Mostrando 11–20 de 37 clientes" con anterior, números de página y siguiente.
 * `<app-paginador [pagina]="tabla.pagina()" sustantivo="clientes" (cambiar)="tabla.irA($event)" />`
 */
@Component({
  selector: 'app-paginador',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-wrap items-center justify-between gap-3' },
  template: `
    <span class="text-muted-foreground text-[13px]" aria-live="polite">{{ resumen() }}</span>
    @if (pagina().totalPaginas > 1) {
      <nav [attr.aria-label]="'Páginas de ' + sustantivo()" class="flex items-center gap-1">
        <button
          type="button"
          class="btn-icono size-9 border-transparent bg-transparent disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Página anterior"
          [disabled]="pagina().pagina === 0"
          (click)="cambiar.emit(pagina().pagina - 1)"
        >
          <app-icono nombre="anterior" class="size-4" />
        </button>
        @for (p of numeros(); track $index) {
          @if (p === null) {
            <span class="text-muted-foreground w-6 text-center text-[13px]" aria-hidden="true"
              >…</span
            >
          } @else {
            @let actual = p === pagina().pagina;
            <button
              type="button"
              class="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-[13px] font-bold tabular-nums"
              [class]="
                actual
                  ? 'bg-foreground text-card'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              "
              [attr.aria-current]="actual ? 'page' : null"
              [attr.aria-label]="'Página ' + (p + 1)"
              (click)="cambiar.emit(p)"
            >
              {{ p + 1 }}
            </button>
          }
        }
        <button
          type="button"
          class="btn-icono size-9 border-transparent bg-transparent disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Página siguiente"
          [disabled]="pagina().pagina >= pagina().totalPaginas - 1"
          (click)="cambiar.emit(pagina().pagina + 1)"
        >
          <app-icono nombre="siguiente" class="size-4" />
        </button>
      </nav>
    }
  `,
})
export class Paginador {
  readonly pagina = input.required<Pagina<unknown>>();
  /** En plural: "clientes", "préstamos". */
  readonly sustantivo = input.required<string>();
  readonly cambiar = output<number>();

  protected readonly numeros = computed(() =>
    paginasVisibles(this.pagina().pagina, this.pagina().totalPaginas),
  );

  protected readonly resumen = computed(() => {
    const p = this.pagina();
    if (p.total === 0) return `0 ${this.sustantivo()}`;
    return `Mostrando ${String(p.desde)}–${String(p.hasta)} de ${String(p.total)} ${this.sustantivo()}`;
  });
}
