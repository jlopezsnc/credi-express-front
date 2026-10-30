import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatearFecha, formatearMoneda, iniciales, normalizarTexto } from '@/core/format';
import { claseAvatar } from '@/core/ui/avatar';
import { DialogoModal } from '@/core/ui/dialogo-modal';
import { Icono } from '@/core/ui/icono';
import { aPesos } from '@/features/prestamos/calculo-prestamo';
import type { EstadoCuota, EstadoPrestamo, Prestamo } from '@/features/prestamos/prestamo';
import { PrestamosService } from '@/features/prestamos/prestamos.service';

type Filtro = 'activos' | 'atraso' | 'liquidados' | 'todos';

const FILTROS: readonly { id: Filtro; etiqueta: string; aplica: (p: Prestamo) => boolean }[] = [
  { id: 'activos', etiqueta: 'Activos', aplica: (p) => p.estado !== 'liquidado' },
  { id: 'atraso', etiqueta: 'Con atraso', aplica: (p) => p.estado === 'atraso' },
  { id: 'liquidados', etiqueta: 'Liquidados', aplica: (p) => p.estado === 'liquidado' },
  { id: 'todos', etiqueta: 'Todos', aplica: () => true },
];

const ESTADOS_PRESTAMO: Record<EstadoPrestamo, { texto: string; clase: string }> = {
  corriente: { texto: 'Al corriente', clase: 'bg-ok-soft text-ok' },
  atraso: { texto: 'Con atraso', clase: 'bg-atraso-soft text-atraso' },
  liquidado: { texto: 'Liquidado', clase: 'bg-neutro-soft text-neutro' },
};

const ESTADOS_CUOTA: Record<EstadoCuota, { texto: string; clase: string }> = {
  pagada: { texto: 'Pagada', clase: 'bg-ok-soft text-ok' },
  vencida: { texto: 'Vencida', clase: 'bg-atraso-soft text-atraso' },
  pendiente: { texto: 'Pendiente', clase: 'bg-neutro-soft text-neutro' },
};

function pesos(centavos: number): string {
  return formatearMoneda(aPesos(centavos));
}

/** Lo que la tabla y las tarjetas muestran de cada préstamo, ya formateado. */
interface FilaPrestamo {
  prestamo: Prestamo;
  iniciales: string;
  avatar: string;
  estado: { texto: string; clase: string };
  avance: string;
  cuota: string;
  total: string;
  saldo: string;
  proximo: string;
}

/** Lista de préstamos: búsqueda por cliente, filtros por estado y calendario de cada préstamo. */
@Component({
  selector: 'app-prestamos',
  imports: [DialogoModal, Icono, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './prestamos.html',
})
export class Prestamos {
  protected readonly servicio = inject(PrestamosService);

  protected readonly busqueda = signal('');
  protected readonly filtro = signal<Filtro>('activos');
  protected readonly enDetalle = signal<Prestamo | undefined>(undefined);

  protected readonly total = computed(() => this.servicio.prestamos().length);
  protected readonly cargandoInicial = computed(
    () => this.servicio.cargando() && this.total() === 0,
  );

  protected readonly filtros = computed(() =>
    FILTROS.map((f) => ({
      id: f.id,
      etiqueta: f.etiqueta,
      cantidad: this.servicio.prestamos().filter(f.aplica).length,
    })),
  );

  protected readonly filas = computed<FilaPrestamo[]>(() => {
    const filtro = FILTROS.find((f) => f.id === this.filtro());
    const consulta = normalizarTexto(this.busqueda().trim());
    return this.servicio
      .prestamos()
      .filter((p) => filtro?.aplica(p) ?? true)
      .filter((p) => consulta === '' || normalizarTexto(p.cliente).includes(consulta))
      .map((p) => ({
        prestamo: p,
        iniciales: iniciales(p.cliente),
        avatar: claseAvatar(p.idCliente),
        estado: ESTADOS_PRESTAMO[p.estado],
        avance: `${String(p.pagadas)} de ${String(p.cuotas.length)}`,
        cuota: p.cuotas[0] ? pesos(p.cuotas[0].importeCent) : '—',
        total: pesos(p.totalCent),
        saldo: p.saldoCent > 0 ? pesos(p.saldoCent) : '—',
        proximo: p.proxima ? formatearFecha(p.proxima.fechaVencimiento) : '—',
      }));
  });

  protected readonly detalle = computed(() => {
    const p = this.enDetalle();
    if (!p) return undefined;
    return {
      prestamo: p,
      estado: ESTADOS_PRESTAMO[p.estado],
      total: pesos(p.totalCent),
      saldo: pesos(p.saldoCent),
      vencidas: p.vencidas,
      cuotas: p.cuotas.map((c) => ({
        id: c.id,
        numero: c.numero,
        vence: formatearFecha(c.fechaVencimiento),
        importe: pesos(c.importeCent),
        pagada: c.fechaPago ? formatearFecha(c.fechaPago) : '',
        estado: ESTADOS_CUOTA[c.estado],
      })),
    };
  });

  constructor() {
    void this.servicio.cargar();
  }

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }
}
