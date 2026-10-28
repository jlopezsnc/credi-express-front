import { Pipe, type PipeTransform } from '@angular/core';
import { formatearFecha, formatearMoneda } from '@/core/format';

/** Uso en plantillas: `{{ prestamo.monto | moneda }}` → `$12,345.67 MXN`. */
@Pipe({ name: 'moneda' })
export class MonedaPipe implements PipeTransform {
  transform(monto: string | number): string {
    return formatearMoneda(monto);
  }
}

/** Uso en plantillas: `{{ cuota.fechaVencimiento | fecha }}` → `31 ene 2026`. */
@Pipe({ name: 'fecha' })
export class FechaPipe implements PipeTransform {
  transform(fechaIso: string): string {
    return formatearFecha(fechaIso);
  }
}
