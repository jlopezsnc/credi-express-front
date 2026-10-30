import { afterNextRender, Directive, ElementRef, inject, output } from '@angular/core';

/**
 * Abre un `<dialog>` nativo como modal al mostrarse: el navegador atrapa el foco, lo devuelve al
 * cerrar y bloquea el fondo. Úsalo dentro de un `@if`; `cerrar` avisa cuando se pulsa Esc.
 *
 * `<dialog appDialogoModal (cerrar)="abierto.set(false)">…</dialog>`
 */
@Directive({
  selector: 'dialog[appDialogoModal]',
  host: { '(cancel)': 'alCancelar($event)' },
})
export class DialogoModal {
  readonly cerrar = output();
  private readonly dialogo = inject<ElementRef<HTMLDialogElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      this.dialogo.nativeElement.showModal();
    });
  }

  protected alCancelar(evento: Event): void {
    // El cierre lo decide el componente (quita el @if), no el navegador.
    evento.preventDefault();
    this.cerrar.emit();
  }
}
