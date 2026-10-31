import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { mensajeDeError } from '@/core/api/api-error';
import { formatearFecha, formatearMoneda, iniciales } from '@/core/format';
import { conRetraso } from '@/core/senales';
import { EncabezadoOrdenable } from '@/core/tabla/encabezado-ordenable';
import { type ColumnaOrden, OrdenMovil } from '@/core/tabla/orden-movil';
import { Paginador } from '@/core/tabla/paginador';
import type { Orden } from '@/core/tabla/tabla';
import { type PaginaApi, TablaRemota } from '@/core/tabla/tabla-remota';
import { AvisosService } from '@/core/ui/avisos.service';
import { claseAvatar } from '@/core/ui/avatar';
import { Icono } from '@/core/ui/icono';
import { hoyIso } from '@/features/prestamos/calculo-prestamo';
import type { CuotaCobranza, OrdenCuotas, SituacionCuota } from '@/features/cobranza/cobranza-api';
import {
  type Etiqueta,
  filaOperacion,
  type FilaOperacion,
  situacionDe,
  textoCuotas,
  textoPagos,
} from '@/features/cobranza/cobranza-vista';
import {
  CobranzaService,
  type ConsultaCuotas,
  type ConsultaOperaciones,
  DIAS_PROXIMOS,
} from '@/features/cobranza/cobranza.service';
import { CobroDialogo } from '@/features/cobranza/cobro-dialogo';
import type { Recibo } from '@/features/cobranza/recibo';
import { ReciboDialogo } from '@/features/cobranza/recibo-dialogo';

const POR_PAGINA = 10;

type Pestana = SituacionCuota | 'COBRADO';

const PESTANAS: readonly { id: Pestana; etiqueta: string }[] = [
  { id: 'HOY', etiqueta: 'Vencen hoy' },
  { id: 'VENCIDA', etiqueta: 'Vencidas' },
  { id: 'PROXIMA', etiqueta: `Próximos ${String(DIAS_PROXIMOS)} días` },
  { id: 'COBRADO', etiqueta: 'Cobrado hoy' },
];

const VACIO: Record<SituacionCuota, { titulo: string; texto: string }> = {
  HOY: { titulo: 'Nada pendiente para hoy', texto: 'No hay cuotas que venzan hoy.' },
  VENCIDA: { titulo: 'Sin atrasos', texto: 'Ningún cliente tiene cuotas vencidas.' },
  PROXIMA: {
    titulo: 'Sin vencimientos próximos',
    texto: `No hay cuotas en los próximos ${String(DIAS_PROXIMOS)} días.`,
  },
};

type Columna = 'cliente' | 'pago' | 'vence' | 'situacion' | 'saldo';

/** Columnas ordenables de la lista de cuotas y la columna del back de cada una. */
const COLUMNAS: readonly (ColumnaOrden & { id: Columna; api: OrdenCuotas })[] = [
  { id: 'cliente', etiqueta: 'Cliente', api: 'CLIENTE' },
  { id: 'pago', etiqueta: 'Pago', api: 'PAGO' },
  { id: 'vence', etiqueta: 'Vence', api: 'VENCE' },
  { id: 'situacion', etiqueta: 'Situación', api: 'SITUACION' },
  { id: 'saldo', etiqueta: 'Saldo de la cuota', api: 'SALDO' },
];

function esColumna(id: string): id is Columna {
  return COLUMNAS.some((c) => c.id === id);
}

const formatoFechaLarga = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Lo que la tabla y las tarjetas muestran de cada cuota, ya formateado. */
interface FilaCuota {
  cuota: CuotaCobranza;
  iniciales: string;
  avatar: string;
  pago: string;
  prestamo: string;
  vence: string;
  situacion: Etiqueta;
  saldo: string;
  abono: string;
  etiquetaCobrar: string;
}

function filaCuota(c: CuotaCobranza): FilaCuota {
  return {
    cuota: c,
    iniciales: iniciales(c.cliente.nombreCompleto),
    avatar: claseAvatar(c.cliente.idCliente),
    pago: `Pago ${String(c.numeroCuota)} de ${String(c.totalCuotas)}`,
    prestamo: `Préstamo #${String(c.idPrestamo)} · ${c.modalidad.descripcion}`,
    vence: formatearFecha(c.fechaVencimiento),
    situacion: situacionDe(c),
    saldo: formatearMoneda(c.saldoCuota),
    abono:
      Number(c.importeAbonado) > 0
        ? `Abonado ${formatearMoneda(c.importeAbonado)} de ${formatearMoneda(c.importeCuota)}`
        : '',
    etiquetaCobrar:
      `Registrar pago de ${c.cliente.nombreCompleto}, ` +
      `pago ${String(c.numeroCuota)} de ${String(c.totalCuotas)}`,
  };
}

/**
 * Cobranza del día: resumen, cuotas por cobrar (filtradas, ordenadas y paginadas en el back),
 * pagos registrados hoy, cobro y liquidación.
 */
@Component({
  selector: 'app-cobranza',
  imports: [CobroDialogo, EncabezadoOrdenable, Icono, OrdenMovil, Paginador, ReciboDialogo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './cobranza.html',
})
export class Cobranza {
  private readonly servicio = inject(CobranzaService);
  private readonly avisos = inject(AvisosService);

  protected readonly columnas = COLUMNAS;
  protected readonly pestana = signal<Pestana>('HOY');
  protected readonly busqueda = signal('');
  protected readonly enCobro = signal<CuotaCobranza | undefined>(undefined);
  protected readonly recibo = signal<Recibo | undefined>(undefined);
  private readonly busquedaConsulta = conRetraso(this.busqueda);

  protected readonly resumen = this.servicio.resumen();

  // Cuotas por cobrar: orden y página en el back.
  protected readonly tabla: TablaRemota<Columna, FilaCuota> = new TablaRemota({
    ordenInicial: { columna: 'vence', direccion: 'asc' },
    reiniciarCon: () => [this.pestana(), this.busquedaConsulta()],
    respuesta: () => this.paginaCuotas(),
  });

  private readonly consultaCuotas = computed<ConsultaCuotas | undefined>(() => {
    const pestana = this.pestana();
    if (pestana === 'COBRADO') return undefined;
    const { orden, pagina } = this.tabla.peticion();
    return {
      situacion: pestana,
      busqueda: this.busquedaConsulta(),
      orden: COLUMNAS.find((c) => c.id === orden.columna)?.api ?? 'VENCE',
      direccion: orden.direccion === 'asc' ? 'ASC' : 'DESC',
      pagina,
      tamano: POR_PAGINA,
    };
  });

  protected readonly cuotas = this.servicio.cuotasPendientes(this.consultaCuotas);

  private readonly paginaCuotas = computed<PaginaApi<FilaCuota> | undefined>(() => {
    const pagina = this.cuotas.hasValue() ? this.cuotas.value() : undefined;
    return pagina ? { ...pagina, contenido: pagina.contenido.map(filaCuota) } : undefined;
  });

  // "Cobrado hoy": el back lo agrupa por folio, del más reciente al más antiguo.
  protected readonly tablaPagos: TablaRemota<'registro', FilaOperacion> = new TablaRemota({
    ordenInicial: { columna: 'registro', direccion: 'desc' },
    reiniciarCon: () => [this.pestana(), this.busquedaConsulta()],
    respuesta: () => this.paginaOperaciones(),
  });

  private readonly consultaOperaciones = computed<ConsultaOperaciones | undefined>(() =>
    this.pestana() === 'COBRADO'
      ? {
          busqueda: this.busquedaConsulta(),
          pagina: this.tablaPagos.peticion().pagina,
          tamano: POR_PAGINA,
        }
      : undefined,
  );

  protected readonly operaciones = this.servicio.operaciones(this.consultaOperaciones);

  private readonly paginaOperaciones = computed<PaginaApi<FilaOperacion> | undefined>(() => {
    const pagina = this.operaciones.hasValue() ? this.operaciones.value() : undefined;
    return pagina ? { ...pagina, contenido: pagina.contenido.map(filaOperacion) } : undefined;
  });

  private readonly datosResumen = computed(() =>
    this.resumen.hasValue() ? this.resumen.value() : undefined,
  );

  protected readonly hoyTexto = computed(() =>
    formatoFechaLarga
      .format(new Date(`${this.datosResumen()?.fecha ?? hoyIso()}T00:00:00Z`))
      .replace(/^./, (letra) => letra.toUpperCase()),
  );

  protected readonly cargandoInicial = computed(
    () => this.resumen.isLoading() && !this.resumen.hasValue(),
  );

  protected readonly cargando = computed(
    () => this.cuotas.isLoading() || this.operaciones.isLoading(),
  );

  protected readonly error = computed(() => {
    const error = this.resumen.error() ?? this.cuotas.error() ?? this.operaciones.error();
    return error ? mensajeDeError(error, 'No se pudo cargar la cobranza.') : '';
  });

  protected readonly tarjetas = computed(() => {
    const r = this.datosResumen();
    if (!r) return [];
    return [
      {
        titulo: 'Por cobrar hoy',
        clase: 'text-muted-foreground',
        monto: formatearMoneda(r.porCobrarHoy.importe),
        detalle: `${textoCuotas(r.porCobrarHoy.cuotas)} por cobrar`,
      },
      {
        titulo: 'Vencido',
        clase: 'text-atraso',
        monto: formatearMoneda(r.vencido.importe),
        detalle: `${textoCuotas(r.vencido.cuotas)} con atraso`,
      },
      {
        titulo: 'Cobrado hoy',
        clase: 'text-ok',
        monto: formatearMoneda(r.cobrado.importe),
        detalle: `${textoPagos(r.cobrado.pagos)} registrados`,
      },
    ];
  });

  /** Los contadores de las pestañas salen del resumen (no dependen de la búsqueda). */
  protected readonly pestanas = computed(() => {
    const r = this.datosResumen();
    const cantidad: Record<Pestana, number> = {
      HOY: r?.porCobrarHoy.cuotas ?? 0,
      VENCIDA: r?.vencido.cuotas ?? 0,
      PROXIMA: r?.proximas?.cuotas ?? 0,
      COBRADO: r?.cobrado.pagos ?? 0,
    };
    return PESTANAS.map((p) => ({ ...p, cantidad: cantidad[p.id] }));
  });

  protected readonly vacio = computed(() => {
    const pestana = this.pestana();
    if (this.busquedaConsulta().trim()) {
      return { titulo: 'Sin coincidencias', texto: 'No hay clientes con ese nombre.' };
    }
    return pestana === 'COBRADO' ? undefined : VACIO[pestana];
  });

  /** "23 cuotas · $18,450.00 MXN por cobrar": cuenta y suma del back, de todo lo filtrado. */
  protected readonly pieCuotas = computed(() => {
    const pagina = this.cuotas.hasValue() ? this.cuotas.value() : undefined;
    if (!pagina || pagina.totalElementos === 0) return '';
    return `${textoCuotas(pagina.totalElementos)} · ${formatearMoneda(pagina.importeTotal)} por cobrar`;
  });

  protected readonly piePagos = computed(() => {
    const pagina = this.operaciones.hasValue() ? this.operaciones.value() : undefined;
    if (!pagina) return '';
    return `${textoPagos(pagina.totalElementos)} · ${formatearMoneda(pagina.importeTotal)} cobrados hoy`;
  });

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected ordenarMovil(orden: Orden<string>): void {
    if (esColumna(orden.columna)) this.tabla.fijarOrden(orden.columna, orden.direccion);
  }

  protected recargar(): void {
    this.resumen.reload();
    if (this.consultaCuotas()) this.cuotas.reload();
    if (this.consultaOperaciones()) this.operaciones.reload();
  }

  protected alRegistrar(recibo: Recibo): void {
    this.enCobro.set(undefined);
    this.recibo.set(recibo);
    this.recargar();
  }

  protected cerrarRecibo(): void {
    this.recibo.set(undefined);
    this.avisos.mostrar('Pago guardado. Aparece en "Cobrado hoy".');
  }
}
