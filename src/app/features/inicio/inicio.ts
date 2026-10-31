import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { mensajeDeError } from '@/core/api/api-error';
import { formatearMoneda, iniciales } from '@/core/format';
import { AuthService } from '@/core/auth/auth.service';
import { claseAvatar } from '@/core/ui/avatar';
import { Icono } from '@/core/ui/icono';
import type { Inicio as DatosInicio } from '@/features/inicio/inicio-api';
import { InicioService } from '@/features/inicio/inicio.service';
import {
  detalleSemana,
  etiquetaMes,
  graficaSemanas,
  LIENZO_SEMANAS,
  moverMes,
  nombreMes,
  type Variacion,
  variacion,
} from '@/features/inicio/inicio-vista';

const TONOS: Record<Variacion['tono'], string> = {
  bien: 'bg-ok-soft text-ok',
  mal: 'bg-atraso-soft text-atraso',
  neutra: 'bg-neutro-soft text-neutro',
};

// Nombres completos para que Tailwind los genere (no se arman clases con texto).
const COLUMNAS_GRID: Record<number, string> = { 4: 'grid-cols-4', 5: 'grid-cols-5' };
const COLUMNA_GRID = ['col-start-1', 'col-start-2', 'col-start-3', 'col-start-4', 'col-start-5'];

const formatoHoy = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const formatoCorte = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

function fecha(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function saludo(hora: number): string {
  if (hora < 12) return 'Buenos días';
  return hora < 19 ? 'Buenas tardes' : 'Buenas noches';
}

/**
 * Inicio: el resumen del mes elegido comparado con el anterior (cifras exactas por mes) y la
 * cartera al día de hoy. Todo lo calcula el back (`GET /operaciones-inicio/resumen`).
 */
@Component({
  selector: 'app-inicio',
  imports: [Icono, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './inicio.html',
})
export class Inicio {
  private readonly auth = inject(AuthService);
  private readonly servicio = inject(InicioService);

  protected readonly lienzo = LIENZO_SEMANAS;
  protected readonly saludo = saludo(new Date().getHours());

  protected readonly nombre = computed(() => {
    const usuario = this.auth.usuario();
    const nombre = usuario?.displayName?.trim() || usuario?.email?.split('@')[0] || '';
    return nombre.split(/\s+/)[0] ?? '';
  });

  /** `AAAA-MM`; sin él, el back responde con el mes actual. */
  protected readonly mesElegido = signal<string | undefined>(undefined);
  protected readonly recurso = this.servicio.resumen(this.mesElegido);
  protected readonly semanaActiva = signal<number | undefined>(undefined);
  protected readonly verTabla = signal(false);

  protected readonly cargandoInicial = computed(
    () => this.recurso.isLoading() && !this.recurso.hasValue(),
  );
  protected readonly error = computed(() => {
    const error = this.recurso.error();
    return error ? mensajeDeError(error, 'No se pudo cargar el resumen.') : '';
  });

  protected readonly vista = computed(() => {
    if (!this.recurso.hasValue()) return undefined;
    return this.armar(this.recurso.value());
  });

  /** No hay resumen de un mes que no ha empezado (el día de hoy lo decide el back, en hora de México). */
  protected readonly puedeAvanzar = computed(() => {
    const v = this.vista();
    return !!v && v.mes < v.mesActual;
  });

  protected readonly globo = computed(() => {
    const v = this.vista();
    const i = this.semanaActiva();
    if (!v || i === undefined) return undefined;
    const semana = v.semanas[i];
    const grupo = v.grafica.grupos[i];
    if (!semana || !grupo) return undefined;
    return {
      ...semana,
      columnas: COLUMNAS_GRID[v.grafica.grupos.length] ?? 'grid-cols-5',
      columna: COLUMNA_GRID[i] ?? 'col-start-1',
    };
  });

  protected cambiarMes(meses: number): void {
    const actual = this.vista()?.mes;
    if (!actual) return;
    this.semanaActiva.set(undefined);
    this.mesElegido.set(moverMes(actual, meses));
  }

  private armar(d: DatosInicio) {
    const r = d.resumen;
    const anterior = nombreMes(d.anterior.mes);
    const tono = (v: Variacion) => ({ texto: v.texto, clase: TONOS[v.tono] });
    const esperadoBase = d.enCurso ? r.esperadoALaFecha : r.esperado;
    const atrasados = d.hoy.clientesConAtraso;
    return {
      mes: d.mes,
      mesActual: d.hoy.fecha.slice(0, 7),
      etiqueta: etiquetaMes(d.mes),
      nombreMes: nombreMes(d.mes),
      enCurso: d.enCurso,
      hoy: formatoHoy.format(fecha(d.hoy.fecha)).replace(/^./, (c) => c.toUpperCase()),
      corte: formatoCorte.format(fecha(r.corte)),
      cobrado: formatearMoneda(r.cobrado),
      cobradoVariacion: tono(variacion(d.variaciones.cobrado, anterior, 'subir')),
      cobradoDetalle: d.enCurso
        ? `Del 1 al ${formatoCorte.format(fecha(r.corte))}, lo que entró en caja.`
        : 'Lo que entró en caja en el mes.',
      cumplimiento: r.cumplimiento === null ? '—' : `${r.cumplimiento}%`,
      cumplimientoAncho: Math.min(100, Number(r.cumplimiento ?? 0)),
      cumplimientoDetalle:
        `Aplicado ${formatearMoneda(r.aplicado)} de ${formatearMoneda(esperadoBase)} esperados` +
        (d.enCurso ? ` a la fecha (el mes completo espera ${formatearMoneda(r.esperado)}).` : '.'),
      otorgados: String(r.otorgados),
      otorgadosVariacion: tono(variacion(d.variaciones.otorgados, anterior, 'subir')),
      otorgadosDetalle: `${formatearMoneda(r.colocado)} prestados · ${String(r.liquidados)} ${r.liquidados === 1 ? 'liquidado' : 'liquidados'} en el mes`,
      convenios: String(r.convenios),
      // Más convenios no es buena ni mala noticia por sí sola.
      conveniosVariacion: tono(variacion(d.variaciones.convenios, anterior, 'nada')),
      conveniosDetalle:
        r.convenios === 0
          ? 'Ningún convenio en el mes'
          : `${formatearMoneda(r.convenido)} convenidos`,
      grafica: graficaSemanas(r.semanas),
      semanas: r.semanas.map((s) => detalleSemana(s, d.mes)),
      cartera: formatearMoneda(d.hoy.cartera),
      prestamosActivos: `${String(d.hoy.prestamosActivos)} ${d.hoy.prestamosActivos === 1 ? 'préstamo activo' : 'préstamos activos'}`,
      vencido: formatearMoneda(d.hoy.vencido),
      vencidoDetalle: `${d.hoy.porcentajeVencido}% de la cartera · ${String(atrasados)} ${atrasados === 1 ? 'cliente' : 'clientes'} con atraso`,
      proximos: formatearMoneda(d.hoy.proximos7Dias.importe),
      proximosDetalle: `${String(d.hoy.proximos7Dias.cuotas)} cuotas por cobrar`,
      atencion: d.hoy.requierenAtencion.map((c) => ({
        id: c.cliente.idCliente,
        nombre: c.cliente.nombreCompleto,
        iniciales: iniciales(c.cliente.nombreCompleto),
        avatar: claseAvatar(c.cliente.idCliente),
        detalle:
          `${String(c.cuotasVencidas)} ${c.cuotasVencidas === 1 ? 'cuota vencida' : 'cuotas vencidas'} · ` +
          `${String(c.diasMaximoAtraso)} ${c.diasMaximoAtraso === 1 ? 'día' : 'días'} de atraso`,
        vencido: formatearMoneda(c.saldoVencido),
      })),
      graficaAria:
        `Aplicado contra esperado por semana de ${nombreMes(d.mes)}: ` +
        r.semanas
          .map((s) => {
            const w = detalleSemana(s, d.mes);
            return `${w.titulo}, esperado ${w.esperado}, aplicado ${w.aplicado}`;
          })
          .join('; '),
    };
  }
}
