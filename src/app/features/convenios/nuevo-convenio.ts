import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { mensajeDeError } from '@/core/api/api-error';
import { formatearFecha, formatearMoneda, iniciales, normalizarTexto } from '@/core/format';
import { conRetraso } from '@/core/senales';
import { EncabezadoOrdenable } from '@/core/tabla/encabezado-ordenable';
import { type ColumnaOrden, OrdenMovil } from '@/core/tabla/orden-movil';
import { Paginador } from '@/core/tabla/paginador';
import type { Orden } from '@/core/tabla/tabla';
import { TablaRemota } from '@/core/tabla/tabla-remota';
import { AvisosService } from '@/core/ui/avisos.service';
import { claseAvatar } from '@/core/ui/avatar';
import { DialogoModal } from '@/core/ui/dialogo-modal';
import { Icono } from '@/core/ui/icono';
import type { Cliente } from '@/features/clientes/cliente';
import { ClientesService } from '@/features/clientes/clientes.service';
import { nuevaLlave } from '@/features/cobranza/captura-pago';
import {
  type Convenio,
  MAXIMO_PRESTAMOS,
  MOTIVO_MAXIMO,
  MOTIVO_MINIMO,
  PAGOS_MAXIMO,
  PAGOS_MINIMO,
  type PeticionConvenio,
  type PeticionSimulacion,
} from '@/features/convenios/convenio-api';
import { ConveniosService } from '@/features/convenios/convenios.service';
import {
  fechaDePago,
  hoyIso,
  type IdPeriodicidad,
  leerDecimal,
  PERIODICIDADES,
  periodicidad,
  TASA_MAXIMA,
  textoPorcentaje,
} from '@/features/prestamos/calculo-prestamo';
import { HojaSimulacion, type Simulacion } from '@/features/prestamos/hoja-simulacion';
import type {
  ConsultaPrestamos,
  OrdenPrestamos,
  PaginaPrestamos,
  PrestamoResumen,
  SituacionPrestamo,
} from '@/features/prestamos/prestamo';
import { PrestamosService } from '@/features/prestamos/prestamos.service';

const POR_PAGINA = 10;
const MAX_RESULTADOS = 5;
const FILAS_VISIBLES = 5;
const PAGOS_INICIAL = '12';

const NOTA_CONVENIO =
  'Esta propuesta es informativa y no es un contrato. Si estás de acuerdo con las condiciones, ' +
  'comunícate con nosotros para formalizar el convenio. Al generarlo, los préstamos de arriba quedan ' +
  'en convenio y su saldo se paga con este calendario.';

/** "Vigentes" = al corriente; "Vencidos" = con atraso. Liquidados y en convenio no se convienen. */
type FiltroConvenio = 'ACTIVOS' | 'CON_ATRASO' | 'AL_CORRIENTE';

const FILTROS: readonly {
  id: FiltroConvenio;
  etiqueta: string;
  cantidad: (c: PaginaPrestamos['contadores']) => number;
}[] = [
  { id: 'ACTIVOS', etiqueta: 'Todos con saldo', cantidad: (c) => c.activos },
  { id: 'CON_ATRASO', etiqueta: 'Vencidos', cantidad: (c) => c.conAtraso },
  { id: 'AL_CORRIENTE', etiqueta: 'Vigentes', cantidad: (c) => c.alCorriente ?? 0 },
];

type Columna = 'cliente' | 'prestamo' | 'pagos' | 'vencidas' | 'saldo' | 'estado';

const COLUMNAS: readonly (ColumnaOrden & { id: Columna; api: OrdenPrestamos })[] = [
  { id: 'cliente', etiqueta: 'Cliente', api: 'CLIENTE' },
  { id: 'prestamo', etiqueta: 'Préstamo', api: 'PRESTAMO' },
  { id: 'pagos', etiqueta: 'Pagos', api: 'PAGOS' },
  { id: 'vencidas', etiqueta: 'Vencidas', api: 'VENCIDAS' },
  { id: 'saldo', etiqueta: 'Saldo', api: 'SALDO' },
  { id: 'estado', etiqueta: 'Estado', api: 'ESTADO' },
];

function esColumna(id: string): id is Columna {
  return COLUMNAS.some((c) => c.id === id);
}

function columnaApi(columna: Columna): OrdenPrestamos {
  return COLUMNAS.find((c) => c.id === columna)?.api ?? 'CLIENTE';
}

const ESTADOS: Partial<Record<SituacionPrestamo, { texto: string; clase: string }>> = {
  AL_CORRIENTE: { texto: 'Vigente', clase: 'bg-ok-soft text-ok' },
  CON_ATRASO: { texto: 'Vencido', clase: 'bg-atraso-soft text-atraso' },
};
const ESTADO_OTRO = { texto: '—', clase: 'bg-neutro-soft text-neutro' };

const formatoFechaLarga = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function fechaLarga(iso: string): string {
  return formatoFechaLarga.format(new Date(`${iso}T00:00:00Z`));
}

/**
 * Nuevo convenio: junta préstamos vigentes o vencidos (de uno o varios clientes, p. ej. a nombre de
 * familiares) en un préstamo nuevo a nombre del titular, sin interés salvo casos excepcionales. La
 * lista, sus filtros, el orden y las páginas, y el plan (saldo, interés, total y calendario) los
 * resuelve el back; la pantalla solo los muestra.
 */
@Component({
  selector: 'app-nuevo-convenio',
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
  templateUrl: './nuevo-convenio.html',
})
export class NuevoConvenio {
  protected readonly clientes = inject(ClientesService);
  private readonly prestamos = inject(PrestamosService);
  private readonly convenios = inject(ConveniosService);
  private readonly avisos = inject(AvisosService);
  private readonly ventana = inject(DOCUMENT).defaultView;

  protected readonly periodicidades = PERIODICIDADES;
  protected readonly columnas = COLUMNAS;
  protected readonly hoy = hoyIso();
  protected readonly motivoMaximo = MOTIVO_MAXIMO;

  // Titular

  protected readonly titularId = signal<number | undefined>(undefined);
  protected readonly busquedaTitular = signal('');

  protected readonly titular = computed(() =>
    this.clientes.clientes().find((c) => c.id === this.titularId()),
  );

  protected readonly avatarTitular = computed(() => {
    const c = this.titular();
    return c ? { iniciales: iniciales(c.nombreCompleto), clase: claseAvatar(c.id) } : undefined;
  });

  protected readonly resultadosTitular = computed(() => {
    const consulta = normalizarTexto(this.busquedaTitular().trim());
    return this.clientes
      .clientes()
      .filter(
        (c) =>
          consulta === '' ||
          normalizarTexto(c.nombreCompleto).includes(consulta) ||
          c.curp.toLowerCase().includes(consulta),
      )
      .slice(0, MAX_RESULTADOS)
      .map((c) => ({
        cliente: c,
        iniciales: iniciales(c.nombreCompleto),
        avatar: claseAvatar(c.id),
      }));
  });

  // Préstamos a convenir

  protected readonly busqueda = signal('');
  protected readonly filtro = signal<FiltroConvenio>('ACTIVOS');
  private readonly busquedaConsulta = conRetraso(this.busqueda);

  protected readonly tabla: TablaRemota<Columna, PrestamoResumen> = new TablaRemota({
    ordenInicial: { columna: 'cliente', direccion: 'asc' },
    reiniciarCon: () => [this.filtro(), this.busquedaConsulta()],
    respuesta: () => (this.lista.hasValue() ? this.lista.value() : undefined),
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

  protected readonly lista = this.prestamos.lista(this.consulta);

  protected readonly errorLista = computed(() => {
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

  /** Los elegidos, con el renglón que trajo el back (se conservan al cambiar de filtro o página). */
  protected readonly seleccion = signal<ReadonlyMap<number, PrestamoResumen>>(new Map());

  protected readonly filas = computed(() =>
    this.tabla.pagina().elementos.map((p) => ({
      prestamo: p,
      seleccionado: this.seleccion().has(p.idPrestamo),
      esTitular: p.cliente.idCliente === this.titularId(),
      pagos: `${String(p.cuotasPagadas)} de ${String(p.numeroCuotas)}`,
      saldo: formatearMoneda(p.saldoPendiente),
      estado: ESTADOS[p.estado] ?? ESTADO_OTRO,
    })),
  );

  protected readonly elegidos = computed(() =>
    [...this.seleccion().values()].map((p) => ({
      id: p.idPrestamo,
      cliente: p.cliente.nombreCompleto,
      detalle: `${(ESTADOS[p.estado] ?? ESTADO_OTRO).texto} · ${String(p.cuotasPagadas)} de ${String(p.numeroCuotas)} pagos`,
      saldo: formatearMoneda(p.saldoPendiente),
    })),
  );

  /** Nombres de las otras personas cuyos préstamos se incluyen (sin el titular). */
  protected readonly otrasPersonas = computed(() => {
    const titular = this.titularId();
    if (titular === undefined) return [];
    const nombres = [...this.seleccion().values()]
      .filter((p) => p.cliente.idCliente !== titular)
      .map((p) => p.cliente.nombreCompleto);
    return [...new Set(nombres)];
  });

  /** Préstamos con saldo del titular, para "Incluir los de …". */
  private readonly delTitular = this.prestamos.lista(
    computed<ConsultaPrestamos | undefined>(() => {
      const idCliente = this.titularId();
      return idCliente === undefined
        ? undefined
        : {
            filtro: 'ACTIVOS',
            busqueda: '',
            idCliente,
            orden: 'PRESTAMO',
            direccion: 'ASC',
            pagina: 0,
            tamano: MAXIMO_PRESTAMOS,
          };
    }),
  );

  protected readonly pendientesDelTitular = computed(() =>
    this.delTitular.hasValue()
      ? this.delTitular.value().contenido.filter((p) => !this.seleccion().has(p.idPrestamo))
      : [],
  );

  protected readonly nombreCortoTitular = computed(
    () => this.titular()?.nombreCompleto.split(/\s+/)[0] ?? '',
  );

  // Plan de pagos

  protected readonly idPeriodicidad = signal<IdPeriodicidad>('semanal');
  protected readonly periodicidadActual = computed(() => periodicidad(this.idPeriodicidad()));
  protected readonly pagos = signal(PAGOS_INICIAL);
  protected readonly tasa = signal('0');
  protected readonly fechaInicio = signal(fechaDePago(this.hoy, periodicidad('semanal'), 1));
  protected readonly motivo = signal('');
  /** Se intentó generar: a partir de aquí se marcan también los campos vacíos. */
  protected readonly intento = signal(false);
  protected readonly verTodo = signal(false);

  private readonly numeroPagos = computed(() =>
    /^\d+$/.test(this.pagos().trim()) ? Number(this.pagos().trim()) : Number.NaN,
  );

  protected readonly errorPagos = computed(() => {
    const n = this.numeroPagos();
    if (Number.isNaN(n)) return 'Captura un número entero de pagos.';
    if (n < PAGOS_MINIMO || n > PAGOS_MAXIMO)
      return `Entre ${String(PAGOS_MINIMO)} y ${String(PAGOS_MAXIMO)} pagos.`;
    return '';
  });

  private readonly tasaNumero = computed(() => leerDecimal(this.tasa().trim() || '0'));

  protected readonly errorTasa = computed(() => {
    const tasa = this.tasaNumero();
    if (Number.isNaN(tasa)) return 'Captura solo números, con hasta dos decimales.';
    if (tasa > TASA_MAXIMA) return `El interés no puede ser mayor a ${String(TASA_MAXIMA)}%.`;
    return '';
  });

  protected readonly conInteres = computed(() => !this.errorTasa() && this.tasaNumero() > 0);

  protected readonly errorFecha = computed(() => {
    const fecha = this.fechaInicio();
    if (!fecha) return this.intento() ? 'Elige la fecha del primer pago.' : '';
    if (fecha < this.hoy) return 'La fecha no puede ser anterior a hoy.';
    return '';
  });

  protected readonly errorTitular = computed(() => this.intento() && !this.titular());
  protected readonly errorSeleccion = computed(() => this.intento() && this.seleccion().size === 0);
  protected readonly errorMotivo = computed(() =>
    this.intento() && this.motivo().trim().length < MOTIVO_MINIMO
      ? `Escribe el motivo (mínimo ${String(MOTIVO_MINIMO)} caracteres).`
      : '',
  );

  // Simulación (la calcula el back)

  private readonly peticionSimulacion = computed<PeticionSimulacion | undefined>(() => {
    const ids = [...this.seleccion().keys()];
    if (ids.length === 0 || this.errorPagos() || this.errorTasa()) return undefined;
    if (!this.fechaInicio() || this.errorFecha()) return undefined;
    return {
      idsPrestamo: ids,
      idModalidad: this.periodicidadActual().idModalidad,
      numeroPagos: this.numeroPagos(),
      tasaInteres: String(this.tasaNumero()),
      fechaPrimerPago: this.fechaInicio(),
    };
  });

  protected readonly simulacion = this.convenios.simulacion(conRetraso(this.peticionSimulacion));

  /** El plan del back, solo si corresponde a lo que hay capturado ahora. */
  protected readonly plan = computed(() => {
    const peticion = this.peticionSimulacion();
    if (!peticion || !this.simulacion.hasValue()) return undefined;
    const plan = this.simulacion.value();
    const mismos =
      plan.numeroPagos === peticion.numeroPagos &&
      plan.prestamos.length === peticion.idsPrestamo.length &&
      plan.prestamos.every((p) => peticion.idsPrestamo.includes(p.idPrestamo));
    return mismos ? plan : undefined;
  });

  protected readonly errorSimulacion = computed(() => {
    const error = this.simulacion.error();
    return error && this.peticionSimulacion()
      ? mensajeDeError(error, 'No se pudo calcular el convenio.')
      : '';
  });

  protected readonly resumen = computed(() => {
    const plan = this.plan();
    const n = this.seleccion().size;
    const incluidos =
      n === 0
        ? '—'
        : `${String(n)} ${n === 1 ? 'préstamo' : 'préstamos'}` +
          (plan && plan.personas > 1 ? ` de ${String(plan.personas)} personas` : '');
    if (!plan) {
      return {
        cuota: '—',
        detalle: 'Elige préstamos y define el plan',
        detalleCorto: '—',
        incluidos,
        saldo: '—',
        interes: '—',
        plazo: '—',
        total: '—',
      };
    }
    const p = this.periodicidadActual();
    const pagos =
      plan.numeroPagos === 1
        ? `1 pago ${p.etiqueta.toLowerCase()}`
        : `${String(plan.numeroPagos)} pagos ${p.adjetivo}`;
    const meses = plan.meses === '1' ? '1 mes' : `${plan.meses} meses`;
    return {
      cuota: formatearMoneda(plan.importeCuota),
      detalle: `× ${pagos}`,
      detalleCorto: `${pagos} de ${formatearMoneda(plan.importeCuota)}`,
      incluidos,
      saldo: formatearMoneda(plan.saldoConvenido),
      interes:
        Number(plan.interes) === 0
          ? 'Sin interés'
          : `${formatearMoneda(plan.interes)} (${textoPorcentaje(Number(plan.tasaInteres))} mensual × ${meses})`,
      plazo: `${meses} (${String(plan.numeroPagos)} ${p.unidad})`,
      total: formatearMoneda(plan.totalPagar),
    };
  });

  private readonly calendarioCompleto = computed(
    () =>
      this.plan()?.calendario.map((c) => ({
        numero: c.numero,
        fecha: formatearFecha(c.fechaVencimiento),
        importe: formatearMoneda(c.importe),
      })) ?? [],
  );

  protected readonly calendario = computed(() =>
    this.verTodo() ? this.calendarioCompleto() : this.calendarioCompleto().slice(0, FILAS_VISIBLES),
  );

  protected readonly totalPagos = computed(() => this.calendarioCompleto().length);
  protected readonly puedeVerTodo = computed(() => this.totalPagos() > FILAS_VISIBLES);

  protected readonly notaUltimoPago = computed(() => {
    const plan = this.plan();
    const ultima = plan?.calendario.at(-1);
    if (!plan || !ultima) return '';
    let nota = `Último pago: ${fechaLarga(ultima.fechaVencimiento)}.`;
    if (plan.importeUltimaCuota !== plan.importeCuota) {
      nota += ` El último pago es de ${formatearMoneda(plan.importeUltimaCuota)} por ajuste de centavos.`;
    }
    return nota;
  });

  protected readonly primerPago = computed(() =>
    this.fechaInicio() && !this.errorFecha() ? fechaLarga(this.fechaInicio()) : '—',
  );

  /** Hoja para el cliente: el mismo formato que "Imprimir simulación", sin la fórmula. */
  protected readonly hoja = computed<Simulacion>(() => {
    const r = this.resumen();
    return {
      titulo: 'Propuesta de convenio',
      cliente: this.titular()?.nombreCompleto,
      emision: fechaLarga(this.hoy),
      cuota: r.cuota,
      detalle: r.detalle,
      datos: [
        { etiqueta: 'Saldo a convenir', valor: r.saldo },
        { etiqueta: 'Interés', valor: r.interes },
        { etiqueta: 'Plazo', valor: r.plazo },
        { etiqueta: 'Primer pago', valor: this.primerPago() },
      ],
      etiquetaTotal: 'Total del convenio',
      total: r.total,
      prestamos:
        this.plan()?.prestamos.map((p) => ({
          id: p.idPrestamo,
          cliente: p.cliente.nombreCompleto,
          saldo: formatearMoneda(p.saldo),
        })) ?? [],
      filas: this.calendarioCompleto(),
      notaUltimoPago: this.notaUltimoPago(),
      nota: NOTA_CONVENIO,
    };
  });

  // Generar

  protected readonly confirmando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorApi = signal('');
  protected readonly resultado = signal<Convenio | undefined>(undefined);
  /** Una llave por intento: se repite en los reintentos del mismo diálogo. */
  private llave = nuevaLlave();

  private readonly valido = computed(
    () =>
      !!this.titular() &&
      this.seleccion().size > 0 &&
      !this.errorPagos() &&
      !this.errorTasa() &&
      !!this.fechaInicio() &&
      !this.errorFecha() &&
      this.motivo().trim().length >= MOTIVO_MINIMO,
  );

  constructor() {
    if (this.clientes.clientes().length === 0) void this.clientes.cargar();
  }

  protected texto(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }

  protected elegirTitular(cliente: Cliente): void {
    if (!cliente.activo) return;
    this.titularId.set(cliente.id);
    this.busquedaTitular.set('');
  }

  protected alternar(prestamo: PrestamoResumen): void {
    const seleccion = new Map(this.seleccion());
    if (seleccion.has(prestamo.idPrestamo)) {
      seleccion.delete(prestamo.idPrestamo);
    } else if (seleccion.size >= MAXIMO_PRESTAMOS) {
      this.avisos.error(`Un convenio admite hasta ${String(MAXIMO_PRESTAMOS)} préstamos.`);
      return;
    } else {
      seleccion.set(prestamo.idPrestamo, prestamo);
    }
    this.seleccion.set(seleccion);
  }

  protected quitar(idPrestamo: number): void {
    const seleccion = new Map(this.seleccion());
    seleccion.delete(idPrestamo);
    this.seleccion.set(seleccion);
  }

  protected incluirDelTitular(): void {
    const seleccion = new Map(this.seleccion());
    for (const p of this.pendientesDelTitular()) {
      if (seleccion.size >= MAXIMO_PRESTAMOS) break;
      seleccion.set(p.idPrestamo, p);
    }
    this.seleccion.set(seleccion);
  }

  protected ordenarMovil(orden: Orden<string>): void {
    if (esColumna(orden.columna)) this.tabla.fijarOrden(orden.columna, orden.direccion);
  }

  protected elegirPeriodicidad(id: IdPeriodicidad): void {
    if (id === this.idPeriodicidad()) return;
    const anterior = this.periodicidadActual();
    const nueva = periodicidad(id);
    // Si la fecha seguía siendo la sugerida, se recorre a la sugerida de la nueva periodicidad.
    if (this.fechaInicio() === fechaDePago(this.hoy, anterior, 1)) {
      this.fechaInicio.set(fechaDePago(this.hoy, nueva, 1));
    }
    this.idPeriodicidad.set(id);
    this.verTodo.set(false);
  }

  protected cambiarPagos(delta: number): void {
    const actual = Number.isNaN(this.numeroPagos()) ? Number(PAGOS_INICIAL) : this.numeroPagos();
    const siguiente = Math.min(PAGOS_MAXIMO, Math.max(PAGOS_MINIMO, actual + delta));
    this.pagos.set(String(siguiente));
    this.verTodo.set(false);
  }

  /** No exige titular: la propuesta se le enseña antes de formalizar el convenio. */
  protected imprimirConvenio(): void {
    if (!this.plan()) {
      this.avisos.error('Elige préstamos y define el plan para imprimir el convenio.');
      return;
    }
    this.ventana?.print();
  }

  protected intentarGenerar(): void {
    if (!this.valido()) {
      this.intento.set(true);
      this.avisos.error('Revisa los datos marcados antes de generar el convenio.');
      return;
    }
    if (!this.plan()) {
      this.avisos.error('Espera a que se actualice el resumen del convenio.');
      return;
    }
    this.llave = nuevaLlave();
    this.errorApi.set('');
    this.confirmando.set(true);
  }

  protected cerrarConfirmacion(): void {
    if (!this.enviando()) this.confirmando.set(false);
  }

  protected async generar(): Promise<void> {
    const peticion = this.peticion();
    if (!peticion) return;
    this.enviando.set(true);
    this.errorApi.set('');
    try {
      this.resultado.set(await this.convenios.generar(peticion, this.llave));
      this.confirmando.set(false);
    } catch (error) {
      this.errorApi.set(mensajeDeError(error, 'No se pudo generar el convenio.'));
      // Si cambió un saldo o un préstamo ya no se puede convenir, se actualiza lo que se ve.
      this.simulacion.reload();
      this.lista.reload();
    } finally {
      this.enviando.set(false);
    }
  }

  protected cerrarResultado(): void {
    this.resultado.set(undefined);
  }

  protected nuevoConvenio(): void {
    const semanal = periodicidad('semanal');
    this.resultado.set(undefined);
    this.titularId.set(undefined);
    this.busquedaTitular.set('');
    this.busqueda.set('');
    this.seleccion.set(new Map());
    this.idPeriodicidad.set(semanal.id);
    this.pagos.set(PAGOS_INICIAL);
    this.tasa.set('0');
    this.fechaInicio.set(fechaDePago(this.hoy, semanal, 1));
    this.motivo.set('');
    this.intento.set(false);
    this.verTodo.set(false);
    this.lista.reload();
  }

  private peticion(): PeticionConvenio | undefined {
    const simulacion = this.peticionSimulacion();
    const titular = this.titular();
    const plan = this.plan();
    if (!simulacion || !titular || !plan) return undefined;
    return {
      ...simulacion,
      idClienteTitular: titular.id,
      motivo: this.motivo().trim(),
      saldoEsperado: plan.saldoConvenido,
    };
  }
}
