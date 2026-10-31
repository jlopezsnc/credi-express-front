import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { env } from '@env';
import { Icono } from '@/core/ui/icono';

/** Datos ya formateados de la simulación: la hoja no calcula nada. */
export interface Simulacion {
  /** Sin cliente se deja una línea para escribirlo a mano: es una cotización previa a la solicitud. */
  cliente: string | undefined;
  emision: string;
  cuota: string;
  detalle: string;
  monto: string;
  tasa: string;
  meses: string;
  interes: string;
  total: string;
  primerPago: string;
  filas: readonly { numero: number; fecha: string; importe: string }[];
  notaUltimoPago: string;
}

/**
 * Hoja de simulación para el cliente. Solo existe al imprimir (`hidden print:block`) y va en
 * `.papel`, con los colores claros aunque la pantalla esté en tema oscuro. No lleva la fórmula del
 * interés: al cliente le basta con los importes.
 */
@Component({
  selector: 'app-hoja-simulacion',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'papel text-foreground hidden text-[13px] leading-normal print:block' },
  templateUrl: './hoja-simulacion.html',
})
export class HojaSimulacion {
  readonly simulacion = input.required<Simulacion>();

  protected readonly logoUrl = env.logoUrl.trim();
}
