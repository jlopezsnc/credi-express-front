import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type NombreIcono =
  | 'marca'
  | 'inicio'
  | 'clientes'
  | 'prestamos'
  | 'cobranza'
  | 'reportes'
  | 'sol'
  | 'luna'
  | 'colapsar'
  | 'salir'
  | 'menu'
  | 'cerrar'
  | 'buscar'
  | 'mas'
  | 'editar'
  | 'telefono'
  | 'ubicacion'
  | 'palomita'
  | 'alerta'
  | 'baja'
  | 'reactivar'
  | 'descargar'
  | 'imprimir'
  | 'convenio'
  | 'info'
  | 'listo'
  | 'ordenar'
  | 'orden-asc'
  | 'orden-desc'
  | 'anterior'
  | 'siguiente';

/**
 * Íconos de trazo en SVG en línea (sin fuentes ni archivos externos). El tamaño lo da el host:
 * `<app-icono nombre="clientes" class="size-5" />`. Son decorativos: el texto accesible va en el botón.
 */
@Component({
  selector: 'app-icono',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex size-5 shrink-0', 'aria-hidden': 'true' },
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="nombre() === 'marca' ? 2.4 : 1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="size-full"
    >
      @switch (nombre()) {
        @case ('marca') {
          <path d="M17 7.5A6.5 6.5 0 1 0 17 16.5" />
          <path d="M12 9.5v5M10 12h4" />
        }
        @case ('inicio') {
          <path d="M3.5 10.5 12 3.5l8.5 7" />
          <path d="M5.5 9v11.5h13V9" />
          <path d="M10 20.5v-6h4v6" />
        }
        @case ('clientes') {
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
          <path d="M15.5 4.7a3.5 3.5 0 0 1 0 6.6" />
          <path d="M17.8 13.9c2.2.9 3.7 3.1 3.7 6.1" />
        }
        @case ('prestamos') {
          <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M6 10v4M18 10v4" />
        }
        @case ('cobranza') {
          <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
          <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
          <path d="m9 15 2 2 4-4" />
        }
        @case ('reportes') {
          <path d="M3.5 20.5h17" />
          <path d="M7 16.5v-5M12 16.5v-10M17 16.5v-7" />
        }
        @case ('sol') {
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"
          />
        }
        @case ('luna') {
          <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7z" />
        }
        @case ('colapsar') {
          <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />
        }
        @case ('salir') {
          <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
          <path d="m10 17 5-5-5-5M15 12H3.5" />
        }
        @case ('menu') {
          <path d="M4 6.5h16M4 12h16M4 17.5h16" />
        }
        @case ('cerrar') {
          <path d="M6 6l12 12M18 6 6 18" />
        }
        @case ('buscar') {
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4.2-4.2" />
        }
        @case ('mas') {
          <path d="M12 5v14M5 12h14" />
        }
        @case ('editar') {
          <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
          <path d="m13.5 6.5 4 4" />
        }
        @case ('telefono') {
          <path
            d="M5.5 3.5h3l2 5-2.5 1.5a11 11 0 0 0 6 6l1.5-2.5 5 2v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3.5 5.5a2 2 0 0 1 2-2z"
          />
        }
        @case ('ubicacion') {
          <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
          <circle cx="12" cy="9.5" r="2.5" />
        }
        @case ('alerta') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5.5M12 16.5v.01" />
        }
        @case ('baja') {
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
          <path d="M16 11h6" />
        }
        @case ('reactivar') {
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
          <path d="m16 11 2 2 4-4" />
        }
        @case ('descargar') {
          <path d="M12 3.5v11M7.5 10 12 14.5 16.5 10" />
          <path d="M4.5 16.5v3h15v-3" />
        }
        @case ('imprimir') {
          <path d="M7 8.5V3.5h10v5" />
          <rect x="3.5" y="8.5" width="17" height="8" rx="2" />
          <path d="M7 14h10v6.5H7z" />
        }
        @case ('convenio') {
          <path d="M7 3.5h7l4 4v13H7z" />
          <path d="M14 3.5v4h4" />
          <path d="m9.5 14 2 2 3.5-3.5" />
        }
        @case ('info') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5.5M12 7.5v.01" />
        }
        @case ('listo') {
          <path d="M5 12.5 10 17.5 19 7" />
        }
        @case ('ordenar') {
          <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />
        }
        @case ('orden-asc') {
          <path d="M12 19V5M6 11l6-6 6 6" />
        }
        @case ('orden-desc') {
          <path d="M12 5v14M6 13l6 6 6-6" />
        }
        @case ('anterior') {
          <path d="m15 6-6 6 6 6" />
        }
        @case ('siguiente') {
          <path d="m9 6 6 6-6 6" />
        }
        @case ('palomita') {
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12.5 2.5 2.5L16 9.5" />
        }
      }
    </svg>
  `,
})
export class Icono {
  readonly nombre = input.required<NombreIcono>();
}
