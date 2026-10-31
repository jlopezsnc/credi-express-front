import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { mensajeDeError } from '@/core/api/api-error';
import { descargarCsv } from '@/core/csv';
import { formatearFecha, formatearMoneda, iniciales } from '@/core/format';
import { claseAvatar } from '@/core/ui/avatar';
import { Icono } from '@/core/ui/icono';
import { hoyIso } from '@/features/prestamos/calculo-prestamo';
import { centavos } from '@/features/cobranza/captura-pago';
import { etiquetaMetodo, TIPOS_PAGO } from '@/features/cobranza/cobranza-api';
import { textoCuotas, textoPagos } from '@/features/cobranza/cobranza-vista';
import { horaRegistro, rangoPagos } from '@/features/cobranza/recibo';
import type { ReporteCartera, ReporteCobranza } from '@/features/reportes/reportes-api';
import {
  BARRA,
  barraHorizontal,
  barras,
  columnas,
  csvCartera,
  csvCobranza,
  errorPeriodo,
  LIENZO,
  type IdPeriodo,
  type Periodo,
  PERIODOS,
  periodoRapido,
} from '@/features/reportes/reportes-vista';
import { ReportesService } from '@/features/reportes/reportes.service';

type Pestana = 'cobranza' | 'cartera';

const PESTANAS: readonly { id: Pestana; etiqueta: string }[] = [
  { id: 'cobranza', etiqueta: 'Cobranza por periodo' },
  { id: 'cartera', etiqueta: 'Cartera' },
];

interface Consulta<T> {
  cargando: boolean;
  error: string;
  datos: T | undefined;
}

const formatoDiaCorto = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

function diaCorto(fechaIso: string): string {
  return formatoDiaCorto.format(new Date(`${fechaIso}T00:00:00Z`));
}

/** Reportes: cobranza por periodo y cartera (vencida y por vencer), con exportación a CSV. */
@Component({
  selector: 'app-reportes',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './reportes.html',
})
export class Reportes {
  private readonly servicio = inject(ReportesService);
  private readonly documento = inject(DOCUMENT);

  protected readonly hoy = hoyIso();
  protected readonly periodos = PERIODOS;
  protected readonly pestanas = PESTANAS;
  protected readonly lienzo = LIENZO;
  protected readonly barra = BARRA;
  /** Día bajo el cursor en la gráfica; sin cursor se describe el día con más cobro. */
  protected readonly diaActivo = signal<number | undefined>(undefined);
  protected readonly pestana = signal<Pestana>('cobranza');

  protected readonly periodo = signal<Periodo>(periodoRapido('mes', this.hoy));
  protected readonly periodoElegido = signal<IdPeriodo | undefined>('mes');
  protected readonly errorFechas = computed(() => errorPeriodo(this.periodo()));

  protected readonly cobranza = signal<Consulta<ReporteCobranza>>({
    cargando: false,
    error: '',
    datos: undefined,
  });
  protected readonly cartera = signal<Consulta<ReporteCartera>>({
    cargando: false,
    error: '',
    datos: undefined,
  });

  protected readonly vistaCobranza = computed(() => {
    const r = this.cobranza().datos;
    if (!r) return undefined;
    const vigentes = r.operaciones.filter((o) => o.estatus === 'VIGENTE').length;
    const dias = barras(r.porDia, (d) => centavos(d.totalRecibido));
    const geometria = columnas(dias.map((d) => d.porcentaje));
    return {
      titulo:
        r.desde === r.hasta
          ? formatearFecha(r.desde)
          : `Del ${formatearFecha(r.desde)} al ${formatearFecha(r.hasta)}`,
      tarjetas: [
        {
          titulo: 'Total cobrado',
          valor: formatearMoneda(r.totales.totalRecibido),
          detalle: `${textoPagos(r.totales.operaciones)} registrados`,
        },
        {
          titulo: 'Aplicado a cuotas',
          valor: formatearMoneda(r.totales.importe),
          detalle: 'Reduce el saldo de los préstamos',
        },
        {
          titulo: 'Recargos',
          valor: formatearMoneda(r.totales.recargo),
          detalle: 'Por atraso, a criterio del cobrador',
        },
        {
          titulo: 'Cancelados',
          valor: formatearMoneda(r.cancelados.totalRecibido),
          detalle: `${textoPagos(r.cancelados.operaciones)} · no suman`,
        },
      ],
      dias: dias.map((b, i) => ({
        ...b,
        columna: geometria[i] ?? { d: '', x: 0, slot: 0 },
        fecha: diaCorto(b.dato.fecha),
        total: formatearMoneda(b.dato.totalRecibido),
        detalle: `${diaCorto(b.dato.fecha)}: ${formatearMoneda(b.dato.totalRecibido)} · ${textoPagos(b.dato.operaciones)}`,
      })),
      metodos: r.porMetodo.map((m) => ({
        metodo: etiquetaMetodo(m.metodoPago),
        operaciones: textoPagos(m.operaciones),
        total: formatearMoneda(m.totalRecibido),
      })),
      operaciones: r.operaciones.map((o) => ({
        folio: o.folio,
        fecha: `${diaCorto(o.fechaRegistro.slice(0, 10))} · ${horaRegistro(o.fechaRegistro)}`,
        cliente: o.cliente.nombreCompleto,
        pago: `${rangoPagos(o.cuotaInicial === o.cuotaFinal ? [o.cuotaInicial] : [o.cuotaInicial, o.cuotaFinal], o.totalCuotas)} · Préstamo #${String(o.idPrestamo)}`,
        tipo: TIPOS_PAGO[o.tipo],
        metodo: etiquetaMetodo(o.metodoPago),
        total: formatearMoneda(o.totalRecibido),
        cancelado: o.estatus === 'CANCELADO',
      })),
      pie: `${textoPagos(vigentes)} vigentes${r.cancelados.operaciones > 0 ? ` · ${textoPagos(r.cancelados.operaciones)} cancelados` : ''}`,
    };
  });

  protected readonly vistaCartera = computed(() => {
    const r = this.cartera().datos;
    if (!r) return undefined;
    const t = r.totales;
    return {
      fecha: formatearFecha(r.fecha),
      tarjetas: [
        {
          titulo: 'Saldo por cobrar',
          clase: 'text-muted-foreground',
          valor: formatearMoneda(t.saldoTotal),
          detalle: `${String(t.prestamosActivos)} préstamos · ${String(t.clientesActivos)} clientes`,
        },
        {
          titulo: 'Vencido',
          clase: 'text-atraso',
          valor: formatearMoneda(t.saldoVencido),
          detalle: `${t.porcentajeVencido}% de la cartera · ${textoCuotas(t.cuotasVencidas)}`,
        },
        {
          titulo: 'Por vencer',
          clase: 'text-ok',
          valor: formatearMoneda(t.saldoPorVencer),
          detalle: 'Cuotas al corriente',
        },
        {
          titulo: 'Clientes con atraso',
          clase: 'text-muted-foreground',
          valor: String(t.clientesConAtraso),
          detalle: `de ${String(t.clientesActivos)} con saldo`,
        },
      ],
      antiguedad: barras(r.antiguedad, (a) => centavos(a.saldo)).map((b) => ({
        ...b,
        d: barraHorizontal(b.porcentaje),
        saldo: formatearMoneda(b.dato.saldo),
        cuotas: textoCuotas(b.dato.cuotas),
      })),
      clientes: r.clientesConAtraso.map((c) => ({
        id: c.cliente.idCliente,
        nombre: c.cliente.nombreCompleto,
        telefono: c.cliente.telefono ?? 'Sin teléfono',
        iniciales: iniciales(c.cliente.nombreCompleto),
        avatar: claseAvatar(c.cliente.idCliente),
        atraso: c.diasMaximoAtraso === 1 ? '1 día' : `${String(c.diasMaximoAtraso)} días`,
        desde: formatearFecha(c.vencimientoMasAntiguo),
        cuotas: textoCuotas(c.cuotasVencidas),
        vencido: formatearMoneda(c.saldoVencido),
        total: formatearMoneda(c.saldoTotal),
      })),
    };
  });

  protected readonly detalleDia = computed(() => {
    const dias = this.vistaCobranza()?.dias ?? [];
    const activo = this.diaActivo();
    if (activo !== undefined && dias[activo]) return dias[activo].detalle;
    const mayor = dias.find((d) => d.mayor);
    return mayor ? `Día con más cobro: ${mayor.detalle}` : 'Sin cobros en el periodo.';
  });

  constructor() {
    void this.consultarCobranza();
  }

  protected elegirPestana(pestana: Pestana): void {
    this.pestana.set(pestana);
    if (pestana === 'cartera' && !this.cartera().datos && !this.cartera().cargando) {
      void this.consultarCartera();
    }
  }

  protected elegirPeriodo(id: IdPeriodo): void {
    this.periodoElegido.set(id);
    this.periodo.set(periodoRapido(id, this.hoy));
    void this.consultarCobranza();
  }

  protected cambiarFecha(campo: keyof Periodo, evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.periodoElegido.set(undefined);
    this.periodo.update((p) => ({ ...p, [campo]: valor }));
  }

  protected async consultarCobranza(): Promise<void> {
    if (this.errorFechas()) return;
    const { desde, hasta } = this.periodo();
    this.cobranza.update((c) => ({ ...c, cargando: true, error: '' }));
    try {
      const datos = await this.servicio.cobranza(desde, hasta);
      this.cobranza.set({ cargando: false, error: '', datos });
    } catch (error) {
      this.cobranza.update((c) => ({
        ...c,
        cargando: false,
        error: mensajeDeError(error, 'No se pudo generar el reporte de cobranza.'),
      }));
    }
  }

  protected async consultarCartera(): Promise<void> {
    this.cartera.update((c) => ({ ...c, cargando: true, error: '' }));
    try {
      const datos = await this.servicio.cartera();
      this.cartera.set({ cargando: false, error: '', datos });
    } catch (error) {
      this.cartera.update((c) => ({
        ...c,
        cargando: false,
        error: mensajeDeError(error, 'No se pudo generar el reporte de cartera.'),
      }));
    }
  }

  protected exportarCobranza(): void {
    const r = this.cobranza().datos;
    if (!r) return;
    descargarCsv(this.documento, `COBRANZA_${r.desde}_a_${r.hasta}.csv`, csvCobranza(r));
  }

  protected exportarCartera(): void {
    const r = this.cartera().datos;
    if (!r) return;
    descargarCsv(this.documento, `CARTERA_VENCIDA_${r.fecha}.csv`, csvCartera(r));
  }
}
