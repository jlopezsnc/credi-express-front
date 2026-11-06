import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { mensajeDeError } from '@/core/api/api-error';
import { formatearFecha, formatearMoneda } from '@/core/format';
import type { Pagina } from '@/core/tabla/tabla';
import { Paginador } from '@/core/tabla/paginador';
import { AvisosService } from '@/core/ui/avisos.service';
import { DialogoModal } from '@/core/ui/dialogo-modal';
import { Icono } from '@/core/ui/icono';
import { hoyIso } from '@/features/prestamos/calculo-prestamo';
import {
  type MovimientoCaja,
  type PaginaMovimientos,
  type SaldoCaja,
  TIPOS_MOVIMIENTO,
  type TipoMovimientoCaja,
} from '@/features/reportes/caja-api';
import {
  CONCEPTO_MAXIMO,
  type ErroresMovimiento,
  graficaCaja,
  importeValido,
  LIENZO_CAJA,
  MOTIVO_MAXIMO,
  MOTIVO_MINIMO,
  nombreMes,
  validarMovimiento,
} from '@/features/reportes/caja-vista';
import { CajaService } from '@/features/reportes/caja.service';

const TAMANO_MOVIMIENTOS = 10;

interface Consulta<T> {
  cargando: boolean;
  error: string;
  datos: T | undefined;
}

/** "+$1,000.00 MXN" / "−$1,000.00 MXN". */
function conSigno(monto: string): string {
  const valor = Number(monto);
  return `${valor < 0 ? '−' : '+'}${formatearMoneda(Math.abs(valor))}`;
}

/**
 * Pestaña "Saldo de caja" de Reportes: aportado + cobrado − prestado − retirado, mes con mes, y el
 * registro de aportaciones de capital y retiros (docs/API-CAJA.md).
 */
@Component({
  selector: 'app-caja',
  imports: [DialogoModal, Icono, Paginador],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './caja.html',
})
export class Caja {
  private readonly servicio = inject(CajaService);
  private readonly avisos = inject(AvisosService);

  protected readonly hoy = hoyIso();
  protected readonly lienzo = LIENZO_CAJA;
  protected readonly tipos = TIPOS_MOVIMIENTO;
  protected readonly conceptoMaximo = CONCEPTO_MAXIMO;
  protected readonly motivoMaximo = MOTIVO_MAXIMO;

  /** `null` = toda la historia. */
  protected readonly anio = signal<number | null>(null);
  protected readonly saldo = signal<Consulta<SaldoCaja>>({
    cargando: false,
    error: '',
    datos: undefined,
  });
  protected readonly movimientos = signal<Consulta<PaginaMovimientos>>({
    cargando: false,
    error: '',
    datos: undefined,
  });
  /** Mes bajo el cursor en la gráfica. */
  protected readonly mesActivo = signal<number | undefined>(undefined);

  // Registrar movimiento.
  protected readonly registrando = signal<TipoMovimientoCaja | undefined>(undefined);
  protected readonly importe = signal('');
  protected readonly fecha = signal(this.hoy);
  protected readonly concepto = signal('');
  protected readonly intentoRegistrar = signal(false);
  protected readonly errorRegistrar = signal('');

  // Cancelar movimiento.
  protected readonly cancelando = signal<MovimientoCaja | undefined>(undefined);
  protected readonly motivo = signal('');
  protected readonly intentoCancelar = signal(false);
  protected readonly errorCancelar = signal('');

  protected readonly enviando = signal(false);

  protected readonly vista = computed(() => {
    const s = this.saldo().datos;
    if (!s) return undefined;
    const t = s.totales;
    const periodo = s.anio === null ? 'toda la historia' : String(s.anio);
    const ultimo = s.meses[s.meses.length - 1];
    const terminos = [
      ...(s.anio === null
        ? []
        : [
            {
              signo: '',
              etiqueta: `Saldo al iniciar ${String(s.anio)}`,
              valor: formatearMoneda(s.saldoInicial),
              detalle: 'Todo lo de años anteriores',
              clase: 'text-muted-foreground',
            },
          ]),
      {
        signo: '+',
        etiqueta: 'Capital aportado',
        valor: formatearMoneda(t.aportado),
        detalle: 'Incluye el capital inicial',
        clase: 'text-ok',
      },
      {
        signo: '+',
        etiqueta: 'Total cobrado',
        valor: formatearMoneda(t.cobrado),
        detalle: 'Pagos y liquidaciones, con recargos',
        clase: 'text-ok',
      },
      {
        signo: '−',
        etiqueta: 'Total prestado',
        valor: formatearMoneda(t.prestado),
        detalle: 'Monto entregado, sin intereses',
        clase: 'text-aviso',
      },
      {
        signo: '−',
        etiqueta: 'Retiros',
        valor: formatearMoneda(t.retirado),
        detalle: 'Dinero que se sacó de caja',
        clase: 'text-aviso',
      },
    ];
    return {
      periodo,
      saldoActual: formatearMoneda(s.saldoActual),
      saldoFinal: formatearMoneda(s.saldoFinal),
      tituloFinal:
        s.anio === null
          ? 'Saldo neto en caja'
          : `Saldo al cierre de ${ultimo ? nombreMes(ultimo.mes) : String(s.anio)}`,
      negativo: Number(s.saldoActual) < 0,
      terminos,
      anios: s.anios,
      grafica: graficaCaja(
        s.meses,
        (m) =>
          `${nombreMes(m.mes)}: cobrado ${formatearMoneda(m.cobrado)} · prestado ${formatearMoneda(m.prestado)} · saldo ${formatearMoneda(m.acumulado)}`,
      ),
      filas: [...s.meses].reverse().map((m) => ({
        mes: nombreMes(m.mes),
        entradas: formatearMoneda(Number(m.aportado) + Number(m.cobrado)),
        aportado: Number(m.aportado) > 0 ? formatearMoneda(m.aportado) : '',
        cobrado: formatearMoneda(m.cobrado),
        salidas: formatearMoneda(Number(m.prestado) + Number(m.retirado)),
        retirado: Number(m.retirado) > 0 ? formatearMoneda(m.retirado) : '',
        prestado: formatearMoneda(m.prestado),
        neto: conSigno(m.neto),
        positivo: Number(m.neto) >= 0,
        acumulado: formatearMoneda(m.acumulado),
      })),
      neto: conSigno(t.neto),
      sinDatos: s.meses.length === 0,
    };
  });

  /** "Toda la historia" y los años con movimientos. */
  protected readonly opcionesAnio = computed<(number | null)[]>(() => [
    null,
    ...(this.vista()?.anios ?? []),
  ]);

  protected readonly detalleMes = computed(() => {
    const columnas = this.vista()?.grafica.columnas ?? [];
    const activo = this.mesActivo();
    const columna = activo === undefined ? columnas[columnas.length - 1] : columnas[activo];
    return columna?.detalle ?? '';
  });

  protected readonly listaMovimientos = computed(() => {
    const p = this.movimientos().datos;
    if (!p) return undefined;
    const pagina: Pagina<MovimientoCaja> = {
      elementos: p.contenido,
      pagina: p.pagina,
      totalPaginas: p.totalPaginas,
      total: p.totalElementos,
      desde: p.contenido.length > 0 ? p.pagina * p.tamano + 1 : 0,
      hasta: p.pagina * p.tamano + p.contenido.length,
    };
    return {
      pagina,
      filas: p.contenido.map((m) => ({
        m,
        fecha: formatearFecha(m.fecha),
        tipo: TIPOS_MOVIMIENTO[m.tipo],
        importe: `${m.tipo === 'RETIRO' ? '−' : '+'}${formatearMoneda(m.importe)}`,
        cancelado: m.estatus === 'CANCELADO',
      })),
    };
  });

  protected readonly erroresMovimiento = computed<ErroresMovimiento>(() =>
    this.intentoRegistrar()
      ? validarMovimiento(
          { importe: this.importe(), fecha: this.fecha(), concepto: this.concepto() },
          this.hoy,
        )
      : {},
  );

  protected readonly errorMotivo = computed(() =>
    this.intentoCancelar() && this.motivo().trim().length < MOTIVO_MINIMO
      ? `Escribe el motivo (mínimo ${String(MOTIVO_MINIMO)} caracteres).`
      : '',
  );

  constructor() {
    void this.consultarSaldo();
    void this.consultarMovimientos(0);
  }

  protected elegirAnio(anio: number | null): void {
    this.anio.set(anio);
    this.mesActivo.set(undefined);
    void this.consultarSaldo();
  }

  protected async consultarSaldo(): Promise<void> {
    this.saldo.update((c) => ({ ...c, cargando: true, error: '' }));
    try {
      const datos = await this.servicio.saldo(this.anio());
      this.saldo.set({ cargando: false, error: '', datos });
    } catch (error) {
      this.saldo.update((c) => ({
        ...c,
        cargando: false,
        error: mensajeDeError(error, 'No se pudo calcular el saldo de caja.'),
      }));
    }
  }

  protected async consultarMovimientos(pagina: number): Promise<void> {
    this.movimientos.update((c) => ({ ...c, cargando: true, error: '' }));
    try {
      const datos = await this.servicio.movimientos(pagina, TAMANO_MOVIMIENTOS);
      this.movimientos.set({ cargando: false, error: '', datos });
    } catch (error) {
      this.movimientos.update((c) => ({
        ...c,
        cargando: false,
        error: mensajeDeError(error, 'No se pudieron cargar los movimientos.'),
      }));
    }
  }

  protected texto(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected abrirRegistro(tipo: TipoMovimientoCaja): void {
    this.registrando.set(tipo);
    this.importe.set('');
    this.fecha.set(this.hoy);
    const sinMovimientos = (this.movimientos().datos?.totalElementos ?? 0) === 0;
    this.concepto.set(tipo === 'APORTACION' && sinMovimientos ? 'Capital inicial' : '');
    this.intentoRegistrar.set(false);
    this.errorRegistrar.set('');
  }

  protected cerrarRegistro(): void {
    if (!this.enviando()) this.registrando.set(undefined);
  }

  protected async registrar(): Promise<void> {
    const tipo = this.registrando();
    if (!tipo || this.enviando()) return;
    this.intentoRegistrar.set(true);
    const importe = importeValido(this.importe());
    if (Object.keys(this.erroresMovimiento()).length > 0 || !importe) return;
    this.enviando.set(true);
    this.errorRegistrar.set('');
    try {
      await this.servicio.registrar({
        tipo,
        importe,
        fecha: this.fecha(),
        concepto: this.concepto().trim(),
      });
      this.registrando.set(undefined);
      this.avisos.mostrar(tipo === 'APORTACION' ? 'Aportación registrada.' : 'Retiro registrado.');
      void this.consultarSaldo();
      void this.consultarMovimientos(0);
    } catch (error) {
      this.errorRegistrar.set(mensajeDeError(error, 'No se pudo registrar el movimiento.'));
    } finally {
      this.enviando.set(false);
    }
  }

  protected abrirCancelar(movimiento: MovimientoCaja): void {
    this.cancelando.set(movimiento);
    this.motivo.set('');
    this.intentoCancelar.set(false);
    this.errorCancelar.set('');
  }

  protected cerrarCancelar(): void {
    if (!this.enviando()) this.cancelando.set(undefined);
  }

  protected async cancelar(): Promise<void> {
    const movimiento = this.cancelando();
    if (!movimiento || this.enviando()) return;
    this.intentoCancelar.set(true);
    if (this.errorMotivo()) return;
    this.enviando.set(true);
    this.errorCancelar.set('');
    try {
      await this.servicio.cancelar(movimiento.idMovimiento, this.motivo().trim());
      this.cancelando.set(undefined);
      this.avisos.mostrar('Movimiento cancelado. Ya no cuenta en el saldo.');
      void this.consultarSaldo();
      void this.consultarMovimientos(this.movimientos().datos?.pagina ?? 0);
    } catch (error) {
      this.errorCancelar.set(mensajeDeError(error, 'No se pudo cancelar el movimiento.'));
    } finally {
      this.enviando.set(false);
    }
  }

  protected importeCancelar(m: MovimientoCaja): string {
    return formatearMoneda(m.importe);
  }
}
