import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-no-encontrada',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto max-w-md p-6 text-center">
      <h1 class="text-xl font-semibold">Página no encontrada</h1>
      <a routerLink="/" class="text-primary mt-4 inline-block underline">Volver al inicio</a>
    </main>
  `,
})
export class NoEncontrada {}
