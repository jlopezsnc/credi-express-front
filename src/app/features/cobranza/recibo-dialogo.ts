import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { env } from '@env';
import { DialogoModal } from '@/core/ui/dialogo-modal';
import { Icono } from '@/core/ui/icono';
import type { Recibo } from '@/features/cobranza/recibo';
import { ReciboPng } from '@/features/cobranza/recibo-png';

/**
 * Confirmación "Pago registrado" / "Préstamo liquidado". "Crear recibo" descarga un PNG del mismo
 * tamaño que este diálogo (docs/API-COBRANZA.md §7.8).
 */
@Component({
  selector: 'app-recibo-dialogo',
  imports: [DialogoModal, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recibo-dialogo.html',
})
export class ReciboDialogo {
  readonly recibo = input.required<Recibo>();
  readonly cerrar = output();

  private readonly png = inject(ReciboPng);
  private readonly caja = viewChild.required<ElementRef<HTMLDialogElement>>('caja');

  /** Logotipo configurado (`NG_APP_LOGO_URL`); vacío = logotipo temporal. */
  protected readonly logoUrl = env.logoUrl.trim();
  protected readonly logoFallo = signal(false);
  protected readonly pngUrl = signal('');
  protected readonly creando = signal(false);
  protected readonly errorPng = signal('');

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.liberar();
    });
  }

  protected async crearRecibo(): Promise<void> {
    const recibo = this.recibo();
    const medida = this.caja().nativeElement.getBoundingClientRect();
    this.creando.set(true);
    this.errorPng.set('');
    try {
      const imagen = await this.png.crear(recibo, medida.width, medida.height);
      this.liberar();
      const url = URL.createObjectURL(imagen);
      this.pngUrl.set(url);
      this.png.descargar(url, recibo.archivo);
    } catch {
      this.errorPng.set('No se pudo crear el recibo. Intenta de nuevo.');
    } finally {
      this.creando.set(false);
    }
  }

  protected descargarDeNuevo(): void {
    this.png.descargar(this.pngUrl(), this.recibo().archivo);
  }

  private liberar(): void {
    const url = this.pngUrl();
    if (url) URL.revokeObjectURL(url);
    this.pngUrl.set('');
  }
}
