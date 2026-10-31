import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { mensajeDeError } from '@/core/api/api-error';
import { formatearFecha, formatearMoneda, iniciales } from '@/core/format';
import { conRetraso } from '@/core/senales';
import { EncabezadoOrdenable } from '@/core/tabla/encabezado-ordenable';
import { type ColumnaOrden, OrdenMovil } from '@/core/tabla/orden-movil';
import { Paginador } from '@/core/tabla/paginador';
import type { Orden } from '@/core/tabla/tabla';
import { type PaginaApi, TablaRemota } from '@/core/tabla/tabla-remota';
import { claseAvatar } from '@/core/ui/avatar';
import { DialogoModal } from '@/core/ui/dialogo-modal';
import { Icono } from '@/core/ui/icono';
import type {
  ConsultaPrestamos,
  EstatusCuota,
  FiltroPrestamos,
  OrdenPrestamos,
  PaginaPrestamos,
  PrestamoResumen,
  SituacionPrestamo,
} from '@/features/prestamos/prestamo';
import { PrestamosService } from '@/features/prestamos/prestamos.service';

const POR_PAGINA = 10;

const FILTROS: readonly {
  id: FiltroPrestamos;
  etiqueta: string;
  cantidad: (c: PaginaPrestamos['contadores']) => number;
}[] = [
  { id: 'ACTIVOS', etiqueta: 'Activos', cantidad: (c) => c.activos },
  { id: 'CON_ATRASO', etiqueta: 'Con atraso', cantidad: (c) => c.conAtraso },
  { id: 'LIQUIDADOS', etiqueta: 'Liquidados', cantidad: (c) => c.liquidados },
  { id: 'EN_CONVENIO', etiqueta: 'En convenio', cantidad: (c) => c.enConvenio ?? 0 },
  { id: 'CANCELADOS', etiqueta: 'Cancelados', cantidad: (c) => c.cancelados ?? 0 },
  { id: 'TODOS', etiqueta: 'Todos', cantidad: (c) => c.todos },
];

type Columna = 'cliente' | 'pagos' | 'cuota' | 'total' | 'saldo' | 'proximo' | 'estado';

/** Columnas ordenables y la columna del back que corresponde a cada una. */
const COLUMNAS: readonly (ColumnaOrden & { id: Columna; api: OrdenPrestamos })[] = [
  { id: 'cliente', etiqueta: 'Cliente', api: 'CLIENTE' },
  { id: 'pagos', etiqueta: 'Pagos hechos', api: 'PAGOS' },
  { id: 'cuota', etiqueta: 'Cuota', api: 'CUOTA' },
  { id: 'total', etiqueta: 'Total', api: 'TOTAL' },
  { id: 'saldo', etiqueta: 'Saldo pendiente', api: 'SALDO' },
  { id: 'proximo', etiqueta: 'Próximo pago', api: 'PROXIMO_PAGO' },
  { id: 'estado', etiqueta: 'Estado', api: 'ESTADO' },
];

function esColumna(id: string): id is Columna {
  return COLUMNAS.some((c) => c.id === id);
}

function columnaApi(columna: Columna): OrdenPrestamos {
  return COLUMNAS.find((c) => c.id === columna)?.api ?? 'PROXIMO_PAGO';
}

const ESTADOS_PRESTAMO: Record<SituacionPrestamo, { texto: string; clase: string }> = {
  AL_CORRIENTE: { texto: 'Al corriente', clase: 'bg-ok-soft text-ok' },
  CON_ATRASO: { texto: 'Con atraso', clase: 'bg-atraso-soft text-atraso' },
  LIQUIDADO: { texto: 'Liquidado', clase: 'bg-neutro-soft text-neutro' },
  EN_CONVENIO: { texto: 'En convenio', clase: 'bg-primary-soft text-primary-ink' },
  CANCELADO: { texto: 'Cancelado', clase: 'bg-destructive-soft text-destructive' },
};

const ESTATUS_CUOTA: Record<EstatusCuota, { texto: string; clase: string }> = {
  PAGADA: { texto: 'Pagada', clase: 'bg-ok-soft text-ok' },
  VENCIDA: { texto: 'Vencida', clase: 'bg-atraso-soft text-atraso' },
  ABONO_PARCIAL: { texto: 'Abono parcial', clase: 'bg-aviso-soft text-aviso' },
  PENDIENTE: { texto: 'Pendiente', clase: 'bg-neutro-soft text-neutro' },
  EN_CONVENIO: { texto: 'En convenio', clase: 'bg-primary-soft text-primary-ink' },
  CANCELADA: { texto: 'Cancelada', clase: 'bg-destructive-soft text-destructive' },
};

/** Lo que la tabla y las tarjetas muestran de cada préstamo, ya formateado. */
interface FilaPrestamo {
  id: number;
  cliente: string;
  modalidad: string;
  iniciales: string;
  avatar: string;
  estado: { texto: string; clase: string };
  avance: string;
  cuota: string;
  total: string;
  saldo: string;
  proximo: string;
}

/** En convenio se muestra el folio: es lo que hay que buscar para cobrar. */
function estadoDe(p: PrestamoResumen): { texto: string; clase: string } {
  const estado = ESTADOS_PRESTAMO[p.estado];
  return p.estado === 'EN_CONVENIO' && p.folioConvenio
    ? { ...estado, texto: `${estado.texto} ${p.folioConvenio}` }
    : estado;
}

function fila(p: PrestamoResumen): FilaPrestamo {
  return {
    id: p.idPrestamo,
    cliente: p.cliente.nombreCompleto,
    modalidad: p.folioConvenioOrigen
      ? `${p.modalidad.descripcion} · Convenio ${p.folioConvenioOrigen}`
      : p.modalidad.descripcion,
    iniciales: iniciales(p.cliente.nombreCompleto),
    avatar: claseAvatar(p.cliente.idCliente),
    estado: estadoDe(p),
    avance: `${String(p.cuotasPagadas)} de ${String(p.numeroCuotas)}`,
    cuota: formatearMoneda(p.importeCuota),
    total: formatearMoneda(p.totalPagar),
    saldo: Number(p.saldoPendiente) > 0 ? formatearMoneda(p.saldoPendiente) : '—',
    proximo: p.proximoPago ? formatearFecha(p.proximoPago) : '—',
  };
}

/**
 * Lista de préstamos: filtros, búsqueda, orden y páginas los resuelve el back; el estado, el
 * próximo pago, los pagos hechos y el saldo vienen calculados. Calendario de cada préstamo.
 */
@Component({
  selector: 'app-prestamos',
  imports: [DialogoModal, EncabezadoOrdenable, Icono, OrdenMovil, Paginador, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './prestamos.html',
})
export class Prestamos {
  private readonly servicio = inject(PrestamosService);

  protected readonly columnas = COLUMNAS;
  protected readonly busqueda = signal('');
  protected readonly filtro = signal<FiltroPrestamos>('ACTIVOS');
  private readonly busquedaConsulta = conRetraso(this.busqueda);

  protected readonly tabla: TablaRemota<Columna, FilaPrestamo> = new TablaRemota({
    ordenInicial: { columna: 'proximo', direccion: 'asc' },
    reiniciarCon: () => [this.filtro(), this.busquedaConsulta()],
    respuesta: () => this.paginaFilas(),
  });

  private readonly consulta = computed<ConsultaPrestamos>(() => {
    const { orden, pagina } = this.tabla.peticion();
    return {
      filtro: this.filtro(),
      busqueda: this.busquedaConsulta(),
      orden: columnaApi(orden.columna),
      direccion: orden.direccion === 'asc' ? 'ASC' : 'DESC',
      pagina,
      tamano: POR_PAGINA,
    };
  });

  protected readonly lista = this.servicio.lista(this.consulta);

  private readonly paginaFilas = computed<PaginaApi<FilaPrestamo> | undefined>(() => {
    if (!this.lista.hasValue()) return undefined;
    const pagina = this.lista.value();
    return { ...pagina, contenido: pagina.contenido.map(fila) };
  });

  protected readonly cargandoInicial = computed(
    () => this.lista.isLoading() && !this.lista.hasValue(),
  );
  protected readonly error = computed(() => {
    const error = this.lista.error();
    return error ? mensajeDeError(error, 'No se pudo cargar la lista de préstamos.') : '';
  });

  protected readonly filtros = computed(() => {
    const contadores = this.lista.hasValue() ? this.lista.value().contadores : undefined;
    return FILTROS.map((f) => ({
      id: f.id,
      etiqueta: f.etiqueta,
      cantidad: contadores ? f.cantidad(contadores) : 0,
    }));
  });

  /** Préstamo cuyo calendario está abierto. */
  protected readonly enDetalle = signal<number | undefined>(undefined);
  protected readonly calendario = this.servicio.detalle(this.enDetalle);

  protected readonly detalle = computed(() => {
    const id = this.enDetalle();
    if (id === undefined) return undefined;
    const valor = this.calendario.hasValue() ? this.calendario.value() : undefined;
    const d = valor?.prestamo.idPrestamo === id ? valor : undefined;
    const error = this.calendario.error();
    return {
      id,
      cargando: !d && !error,
      error: error ? mensajeDeError(error, 'No se pudo cargar el calendario.') : '',
      datos: d && {
        cliente: d.prestamo.cliente.nombreCompleto,
        subtitulo: `Préstamo #${String(id)} · ${String(d.prestamo.numeroCuotas)} pagos · ${d.prestamo.modalidad.descripcion}`,
        estado: estadoDe(d.prestamo),
        total: formatearMoneda(d.prestamo.totalPagar),
        saldo: formatearMoneda(d.prestamo.saldoPendiente),
        vencidas: d.prestamo.cuotasVencidas,
        cuotas: d.cuotas.map((c) => ({
          id: c.idCuota,
          numero: c.numeroCuota,
          vence: formatearFecha(c.fechaVencimiento),
          importe: formatearMoneda(c.importe),
          saldo: Number(c.saldo) > 0 ? formatearMoneda(c.saldo) : '—',
          estatus: ESTATUS_CUOTA[c.estatus],
          detalle: c.fechaPago
            ? `Pagada el ${formatearFecha(c.fechaPago)}`
            : Number(c.abonado) > 0
              ? `Abonado ${formatearMoneda(c.abonado)}`
              : null,
        })),
      },
    };
  });

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected ordenarMovil(orden: Orden<string>): void {
    if (esColumna(orden.columna)) this.tabla.fijarOrden(orden.columna, orden.direccion);
  }
}
