import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@/core/auth/auth.service';

/** Marcador temporal: aquí irá el dashboard (docs §4.2). */
@Component({
  selector: 'app-inicio',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6' },
  template: `
    <header>
      <p class="text-muted-foreground mb-1.5 text-[13px] font-semibold">Operación / Inicio</p>
      <h1 class="text-[26px] font-extrabold tracking-tight lg:text-[32px]">Inicio</h1>
      <p class="text-muted-foreground mt-1.5 text-sm">
        Sesión iniciada como {{ auth.usuario()?.email }}
      </p>
    </header>
    <div class="tarjeta px-6 py-12 text-center">
      <p class="text-base font-bold">Aquí irá el resumen del día</p>
      <p class="text-muted-foreground mt-1.5 text-sm">
        Mientras tanto, puedes revisar el
        <a routerLink="/clientes" class="text-primary-ink font-semibold underline"
          >catálogo de clientes</a
        >.
      </p>
    </div>
  `,
})
export class Inicio {
  protected readonly auth = inject(AuthService);
}
