import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@/core/auth/auth.service';

/** Marcador temporal: aquí irá el dashboard (docs §4.2). */
@Component({
  selector: 'app-inicio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto max-w-3xl p-6">
      <div class="flex items-center justify-between gap-4">
        <h1 class="text-2xl font-semibold">Credi Express</h1>
        <button
          type="button"
          (click)="cerrarSesion()"
          class="border-input hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium"
        >
          Cerrar sesión
        </button>
      </div>
      <p class="text-muted-foreground mt-2">Sesión iniciada como {{ auth.usuario()?.email }}</p>
    </main>
  `,
})
export class Inicio {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected async cerrarSesion(): Promise<void> {
    await this.auth.cerrarSesion();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
