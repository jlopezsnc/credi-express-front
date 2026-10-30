import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Marcador para las secciones del menú que todavía no se diseñan. El título llega por la ruta. */
@Component({
  selector: 'app-proximamente',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6' },
  template: `
    <header>
      <p class="text-muted-foreground mb-1.5 text-[13px] font-semibold">
        Operación / {{ titulo() }}
      </p>
      <h1 class="text-[26px] font-extrabold tracking-tight lg:text-[32px]">{{ titulo() }}</h1>
    </header>
    <div class="tarjeta px-6 py-12 text-center">
      <p class="text-base font-bold">Próximamente</p>
      <p class="text-muted-foreground mt-1.5 text-sm">Esta sección se está diseñando.</p>
    </div>
  `,
})
export class Proximamente {
  readonly titulo = input.required<string>();
}
