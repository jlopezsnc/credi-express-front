import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { mensajeDeError } from '@/core/api/api-error';
import { formatearFecha, formatearMoneda } from '@/core/format';
import { conRetraso } from '@/core/senales';
import { EncabezadoOrdenable } from '@/core/tabla/encabezado-ordenable';
import { type ColumnaOrden, OrdenMovil } from '@/core/tabla/orden-movil';
import { Paginador } from '@/core/tabla/paginador';
import type { Orden } from '@/core/tabla/tabla';
import { type PaginaApi, TablaRemota } from '@/core/tabla/tabla-remota';
import { AvisosService } from '@/core/ui/avisos.service';
import { DialogoModal } from '@/core/ui/dialogo-modal';
import { Icono } from '@/core/ui/icono';
import {
  type ConsultaConvenios,
  type ConvenioDetalle,
  type ConvenioResumen,
  type FiltroConvenios,
  MOTIVO_CANCELACION_MINIMO,
  MOTIVO_MAXIMO,
  type OrdenConvenios,
  type PaginaConvenios,
  type SituacionConvenio,
} from '@/features/convenios/convenio-api';
import { ConveniosService } from '@/features/convenios/convenios.service';
import { textoPorcentaje } from '@/features/prestamos/calculo-prestamo';
import { HojaSimulacion, type Simulacion } from '@/features/prestamos/hoja-simulacion';
import type { SituacionPrestamo } from '@/features/prestamos/prestamo';

const POR_PAGINA = 10;

const NOTA_CONVENIO =
  'Los préstamos de arriba quedaron en convenio y su saldo se paga con este calendario. Conserva ' +
  'esta hoja junto con tus recibos de pago.';

const FILTROS: readonly {
  id: FiltroConvenios;
  etiqueta: string;
  cantidad: (c: PaginaConvenios['contadores']) => number;
}[] = [
  { id: 'VIGENTES', etiqueta: 'Vigentes', cantidad: (c) => c.vigentes },
  { id: 'CON_ATRASO', etiqueta: 'Con atraso', cantidad: (c) => c.conAtraso },
  { id: 'LIQUIDADOS', etiqueta: 'Liquidados', cantidad: (c) => c.liquidados },
  { id: 'CANCELADOS', etiqueta: 'Cancelados', cantidad: (c) => c.cancelados },
  { id: 'TODOS', etiqueta: 'Todos', cantidad: (c) => c.todos },
];

type Columna =
  'folio' | 'titular' | 'prestamos' | 'convenido' | 'pagos' | 'saldo' | 'estado' | 'fecha';

const COLUMNAS: readonly (ColumnaOrden & { id: Columna; api: OrdenConvenios })[] = [
  { id: 'folio', etiqueta: 'Folio', api: 'FOLIO' },
  { id: 'titular', etiqueta: 'Titular', api: 'TITULAR' },
  { id: 'prestamos', etiqueta: 'Préstamos', api: 'PRESTAMOS' },
  { id: 'convenido', etiqueta: 'Saldo convenido', api: 'CONVENIDO' },
  { id: 'pagos', etiqueta: 'Pagos', api: 'PAGOS' },
  { id: 'saldo', etiqueta: 'Saldo pendiente', api: 'SALDO' },
  { id: 'estado', etiqueta: 'Estado', api: 'ESTADO' },
  { id: 'fecha', etiqueta: 'Fecha', api: 'FECHA' },
];

function esColumna(id: string): id is Columna {
  return COLUMNAS.some((c) => c.id === id);
}

function columnaApi(columna: Columna): OrdenConvenios {
  return COLUMNAS.find((c) => c.id === columna)?.api ?? 'FECHA';
}

const ESTADOS: Record<SituacionConvenio, { texto: string; clase: string }> = {
  AL_CORRIENTE: { texto: 'Al corriente', clase: 'bg-ok-soft text-ok' },
  CON_ATRASO: { texto: 'Con atraso', clase: 'bg-atraso-soft text-atraso' },
  LIQUIDADO: { texto: 'Liquidado', clase: 'bg-neutro-soft text-neutro' },
  CANCELADO: { texto: 'Cancelado', clase: 'bg-destructive-soft text-destructive' },
};

/** Cómo estaba cada préstamo al convenir. */
const ESTABA: Partial<Record<SituacionPrestamo, { texto: string; clase: string }>> = {
  AL_CORRIENTE: { texto: 'Vigente', clase: 'bg-ok-soft text-ok' },
  CON_ATRASO: { texto: 'Vencido', clase: 'bg-atraso-soft text-atraso' },
};
const ESTABA_OTRO = { texto: '—', clase: 'bg-neutro-soft text-neutro' };

// Las fechas de registro son instantes en UTC: se muestran en hora de México.
const ZONA = 'America/Mexico_City';
const formatoDia = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: ZONA,
});
const formatoLargo = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: ZONA,
});
const formatoHora = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: ZONA,
});

function personasYPrestamos(c: ConvenioResumen): string {
  const prestamos = `${String(c.prestamos)} ${c.prestamos === 1 ? 'préstamo' : 'préstamos'}`;
  return c.personas > 1 ? `${prestamos} · ${String(c.personas)} personas` : prestamos;
}

function pagos(c: ConvenioResumen): string {
  return c.estado === 'CANCELADO' ? '—' : `${String(c.cuotasPagadas)} de ${String(c.numeroPagos)}`;
}

function saldo(c: ConvenioResumen): string {
  return Number(c.saldoPendiente) > 0 ? formatearMoneda(c.saldoPendiente) : '—';
}

/** Lo que muestra la tabla de cada convenio, ya formateado. */
interface FilaConvenio {
  id: number;
  folio: string;
  titular: string;
  prestamoNuevo: number;
  prestamos: string;
  convenido: string;
  pagos: string;
  saldo: string;
  estado: { texto: string; clase: string };
  fecha: string;
}

function fila(c: ConvenioResumen): FilaConvenio {
  return {
    id: c.idConvenio,
    folio: c.folio,
    titular: c.titular.nombreCompleto,
    prestamoNuevo: c.idPrestamoConvenio,
    prestamos: personasYPrestamos(c),
    convenido: formatearMoneda(c.saldoConvenido),
    pagos: pagos(c),
    saldo: saldo(c),
    estado: ESTADOS[c.estado],
    fecha: formatoDia.format(new Date(c.fechaRegistro)),
  };
}

/**
 * Convenios: lista (filtros, búsqueda, orden y páginas en el back), detalle con su bitácora,
 * impresión y cancelación. Si se puede cancelar lo decide el back (`puedeCancelar`).
 */
@Component({
  selector: 'app-convenios',
  imports: [
    DialogoModal,
    EncabezadoOrdenable,
    HojaSimulacion,
    Icono,
    OrdenMovil,
    Paginador,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './convenios.html',
})
export class Convenios {
  private readonly servicio = inject(ConveniosService);
  private readonly avisos = inject(AvisosService);
  private readonly ventana = inject(DOCUMENT).defaultView;

  protected readonly columnas = COLUMNAS;
  protected readonly motivoMaximo = MOTIVO_MAXIMO;
  protected readonly busqueda = signal('');
  protected readonly filtro = signal<FiltroConvenios>('VIGENTES');
  private readonly busquedaConsulta = conRetraso(this.busqueda);

  protected readonly tabla: TablaRemota<Columna, FilaConvenio> = new TablaRemota({
    ordenInicial: { columna: 'fecha', direccion: 'desc' },
    reiniciarCon: () => [this.filtro(), this.busquedaConsulta()],
    respuesta: () => this.paginaFilas(),
  });

  private readonly consulta = computed<ConsultaConvenios>(() => {
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

  private readonly paginaFilas = computed<PaginaApi<FilaConvenio> | undefined>(() => {
    if (!this.lista.hasValue()) return undefined;
    const pagina = this.lista.value();
    return { ...pagina, contenido: pagina.contenido.map(fila) };
  });

  protected readonly cargandoInicial = computed(
    () => this.lista.isLoading() && !this.lista.hasValue(),
  );
  protected readonly error = computed(() => {
    const error = this.lista.error();
    return error ? mensajeDeError(error, 'No se pudo cargar la lista de convenios.') : '';
  });

  protected readonly filtros = computed(() => {
    const contadores = this.lista.hasValue() ? this.lista.value().contadores : undefined;
    return FILTROS.map((f) => ({
      id: f.id,
      etiqueta: f.etiqueta,
      cantidad: contadores ? f.cantidad(contadores) : 0,
    }));
  });

  // Detalle

  protected readonly enDetalle = signal<number | undefined>(undefined);
  private readonly recursoDetalle = this.servicio.detalle(this.enDetalle);

  private readonly datosDetalle = computed<ConvenioDetalle | undefined>(() => {
    const id = this.enDetalle();
    const valor = this.recursoDetalle.hasValue() ? this.recursoDetalle.value() : undefined;
    return valor?.convenio.idConvenio === id ? valor : undefined;
  });

  protected readonly detalle = computed(() => {
    const id = this.enDetalle();
    if (id === undefined) return undefined;
    const d = this.datosDetalle();
    const error = this.recursoDetalle.error();
    return {
      id,
      cargando: !d && !error,
      error: error ? mensajeDeError(error, 'No se pudo cargar el convenio.') : '',
      datos: d && this.vistaDetalle(d),
    };
  });

  /** Hoja "Convenio de pago": el mismo formato que la simulación, sin la fórmula. */
  protected readonly hoja = computed<Simulacion | undefined>(() => {
    const d = this.datosDetalle();
    if (!d) return undefined;
    const c = d.convenio;
    return {
      titulo: 'Convenio de pago',
      cliente: c.titular.nombreCompleto,
      emision: `${c.folio} · ${formatoLargo.format(new Date(c.fechaRegistro))}`,
      cuota: formatearMoneda(c.importeCuota),
      detalle: `× ${String(c.numeroPagos)} pagos ${c.modalidad.descripcion.toLowerCase()}`,
      datos: [
        { etiqueta: 'Saldo convenido', valor: formatearMoneda(c.saldoConvenido) },
        { etiqueta: 'Interés', valor: this.interes(d) },
        { etiqueta: 'Préstamo del convenio', valor: `#${String(c.idPrestamoConvenio)}` },
        { etiqueta: 'Primer pago', valor: formatearFecha(d.fechaPrimerPago) },
      ],
      etiquetaTotal: 'Total del convenio',
      total: formatearMoneda(c.totalPagar),
      prestamos: d.prestamos.map((p) => ({
        id: p.idPrestamo,
        cliente: p.cliente.nombreCompleto,
        saldo: formatearMoneda(p.saldo),
      })),
      filas: d.calendario.map((k) => ({
        numero: k.numeroCuota,
        fecha: formatearFecha(k.fechaVencimiento),
        importe: formatearMoneda(k.importe),
      })),
      notaUltimoPago: '',
      nota: NOTA_CONVENIO,
    };
  });

  // Cancelar

  protected readonly cancelando = signal(false);
  protected readonly motivoCancelar = signal('');
  protected readonly intentoCancelar = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorCancelar = signal('');

  protected readonly errorMotivo = computed(() =>
    this.intentoCancelar() && this.motivoCancelar().trim().length < MOTIVO_CANCELACION_MINIMO
      ? `Escribe el motivo (mínimo ${String(MOTIVO_CANCELACION_MINIMO)} caracteres).`
      : '',
  );

  protected texto(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }

  protected ordenarMovil(orden: Orden<string>): void {
    if (esColumna(orden.columna)) this.tabla.fijarOrden(orden.columna, orden.direccion);
  }

  protected cerrarDetalle(): void {
    if (!this.cancelando()) this.enDetalle.set(undefined);
  }

  protected imprimir(): void {
    if (this.datosDetalle()?.convenio.estatus === 'CANCELADO') {
      this.avisos.error('Un convenio cancelado no se imprime.');
      return;
    }
    this.ventana?.print();
  }

  protected abrirCancelar(): void {
    this.motivoCancelar.set('');
    this.intentoCancelar.set(false);
    this.errorCancelar.set('');
    this.cancelando.set(true);
  }

  protected cerrarCancelar(): void {
    if (!this.enviando()) this.cancelando.set(false);
  }

  protected async cancelar(): Promise<void> {
    const id = this.enDetalle();
    const motivo = this.motivoCancelar().trim();
    if (id === undefined) return;
    if (motivo.length < MOTIVO_CANCELACION_MINIMO) {
      this.intentoCancelar.set(true);
      return;
    }
    this.enviando.set(true);
    this.errorCancelar.set('');
    try {
      const cancelado = await this.servicio.cancelar(id, motivo);
      this.cancelando.set(false);
      this.avisos.mostrar(
        `Convenio ${cancelado.convenio.folio} cancelado. Los préstamos regresaron a Cobranza.`,
      );
    } catch (error) {
      this.errorCancelar.set(mensajeDeError(error, 'No se pudo cancelar el convenio.'));
    } finally {
      this.enviando.set(false);
      // Con éxito o con 409 (entró un pago), se actualiza lo que se ve.
      this.recursoDetalle.reload();
      this.lista.reload();
    }
  }

  private interes(d: ConvenioDetalle): string {
    return Number(d.interes) === 0
      ? 'Sin interés'
      : `${formatearMoneda(d.interes)} (${textoPorcentaje(Number(d.tasaInteres))} mensual)`;
  }

  private vistaDetalle(d: ConvenioDetalle) {
    const c = d.convenio;
    const b = d.bitacora;
    const bitacora = [
      {
        cancelacion: false,
        titulo: 'Generado',
        detalle: [
          formatoHora.format(new Date(b.fechaRegistro)),
          b.registradoPor,
          b.ipOrigen && `desde ${b.ipOrigen}`,
        ]
          .filter(Boolean)
          .join(' · '),
        nota: null as string | null,
      },
    ];
    if (b.canceladoPor && b.fechaCancelacion) {
      bitacora.push({
        cancelacion: true,
        titulo: 'Cancelado',
        detalle: `${formatoHora.format(new Date(b.fechaCancelacion))} · ${b.canceladoPor}`,
        nota: b.motivoCancelacion,
      });
    }
    const n = d.prestamos.length;
    return {
      folio: c.folio,
      titular: c.titular.nombreCompleto,
      prestamoNuevo: c.idPrestamoConvenio,
      plan: `${String(c.numeroPagos)} pagos ${c.modalidad.descripcion.toLowerCase()}`,
      estado: ESTADOS[c.estado],
      cifras: [
        { etiqueta: 'Saldo convenido', valor: formatearMoneda(c.saldoConvenido) },
        { etiqueta: 'Interés', valor: this.interes(d) },
        { etiqueta: 'Total del convenio', valor: formatearMoneda(c.totalPagar) },
        { etiqueta: 'Pago por cuota', valor: formatearMoneda(c.importeCuota) },
        { etiqueta: 'Pagos hechos', valor: pagos(c) },
        { etiqueta: 'Saldo pendiente', valor: saldo(c) },
      ],
      motivo: d.motivo,
      prestamos: d.prestamos.map((p) => ({
        id: p.idPrestamo,
        cliente: p.cliente.nombreCompleto,
        esTitular: p.cliente.idCliente === c.titular.idCliente,
        estaba: ESTABA[p.estado] ?? ESTABA_OTRO,
        cuotas: p.numeroCuotas - p.cuotasPagadas,
        saldo: formatearMoneda(p.saldo),
      })),
      bitacora,
      puedeCancelar: d.puedeCancelar,
      motivoNoCancelable: c.estatus === 'VIGENTE' ? d.motivoNoCancelable : null,
      efecto:
        `${n === 1 ? 'El préstamo regresa' : `Los ${String(n)} préstamos regresan`} a como ` +
        `${n === 1 ? 'estaba' : 'estaban'}, con sus abonos, y ${n === 1 ? 'vuelve' : 'vuelven'} a Cobranza. ` +
        `El préstamo #${String(c.idPrestamoConvenio)} queda cancelado y ya no se cobra.`,
      cancelado: c.estatus === 'CANCELADO',
    };
  }
}
