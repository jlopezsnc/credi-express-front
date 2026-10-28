import { ChangeDetectionStrategy, Component, computed, inject, isDevMode } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ErrorGlobal } from '@/core/error-global';

/** Raíz: muestra las rutas o, ante un error no controlado, una pantalla en lugar de quedar en blanco. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mensajeError(); as mensaje) {
      <main role="alert" class="mx-auto max-w-md p-6 text-center">
        <h1 class="text-xl font-semibold">Algo salió mal</h1>
        <p class="text-muted-foreground mt-2">{{ mensaje }}</p>
        <button
          type="button"
          (click)="recargar()"
          class="bg-primary text-primary-foreground mt-4 rounded-md px-4 py-2 font-medium"
        >
          Recargar
        </button>
      </main>
    } @else {
      <router-outlet />
    }
  `,
})
export class App {
  private readonly errorGlobal = inject(ErrorGlobal);

  /** El detalle del error solo se muestra en desarrollo. */
  protected readonly mensajeError = computed(() => {
    const error = this.errorGlobal.error();
    if (error === undefined) return undefined;
    if (isDevMode()) return error instanceof Error ? error.message : String(error);
    return 'Ocurrió un error inesperado. Recarga la página o intenta más tarde.';
  });

  protected recargar(): void {
    window.location.reload();
  }
}
