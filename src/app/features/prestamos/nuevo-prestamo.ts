import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { mensajeDeError } from '@/core/api/api-error';
import { formatearFecha, formatearMoneda, iniciales, normalizarTexto } from '@/core/format';
import { AvisosService } from '@/core/ui/avisos.service';
import { claseAvatar } from '@/core/ui/avatar';
import { DialogoModal } from '@/core/ui/dialogo-modal';
import { Icono } from '@/core/ui/icono';
import type { Cliente } from '@/features/clientes/cliente';
import { ClientesService } from '@/features/clientes/clientes.service';
import {
  aDecimal,
  aPesos,
  calcularPrestamo,
  fechaDePago,
  hoyIso,
  type IdPeriodicidad,
  leerDecimal,
  MONTO_MAXIMO,
  MONTO_MINIMO,
  PERIODICIDADES,
  periodicidad,
  TASA_INICIAL,
  TASA_MAXIMA,
  textoMeses,
  textoPorcentaje,
} from '@/features/prestamos/calculo-prestamo';
import { HojaSimulacion, type Simulacion } from '@/features/prestamos/hoja-simulacion';
import { type PeticionPrestamo, PrestamosService } from '@/features/prestamos/prestamos.service';

const MAX_RESULTADOS = 5;
const FILAS_VISIBLES = 5;

const formatoFechaLarga = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function fechaLarga(iso: string): string {
  return formatoFechaLarga.format(new Date(`${iso}T00:00:00Z`));
}

function pesos(centavos: number): string {
  return formatearMoneda(aPesos(centavos));
}

interface Resultado {
  mensaje: string;
  plazosGenerados: number;
  cliente: string;
}

/** Alta de un préstamo: cliente, monto, interés mensual, plazo, calendario y generación. */
@Component({
  selector: 'app-nuevo-prestamo',
  imports: [DialogoModal, HojaSimulacion, Icono, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './nuevo-prestamo.html',
})
export class NuevoPrestamo {
  protected readonly clientes = inject(ClientesService);
  private readonly prestamos = inject(PrestamosService);
  private readonly avisos = inject(AvisosService);
  private readonly ventana = inject(DOCUMENT).defaultView;

  protected readonly periodicidades = PERIODICIDADES;
  protected readonly hoy = hoyIso();
  protected readonly hoyTexto = fechaLarga(this.hoy);

  protected readonly clienteId = signal<number | undefined>(undefined);
  protected readonly busqueda = signal('');
  protected readonly monto = signal('');
  protected readonly tasa = signal(TASA_INICIAL);
  protected readonly idPeriodicidad = signal<IdPeriodicidad>('semanal');
  protected readonly plazos = signal(periodicidad('semanal').plazos[0] ?? 12);
  protected readonly fechaInicio = signal(fechaDePago(this.hoy, periodicidad('semanal'), 1));
  /** Se intentó generar: a partir de aquí se marcan también los campos vacíos. */
  protected readonly intento = signal(false);
  protected readonly verTodo = signal(false);
  protected readonly confirmando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorApi = signal('');
  protected readonly resultado = signal<Resultado | undefined>(undefined);

  protected readonly periodicidadActual = computed(() => periodicidad(this.idPeriodicidad()));

  // Cliente

  protected readonly elegido = computed(() =>
    this.clientes.clientes().find((c) => c.id === this.clienteId()),
  );

  protected readonly resultados = computed(() => {
    const consulta = normalizarTexto(this.busqueda().trim());
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

  protected readonly avatarElegido = computed(() => {
    const c = this.elegido();
    return c ? { iniciales: iniciales(c.nombreCompleto), clase: claseAvatar(c.id) } : undefined;
  });

  protected readonly errorCliente = computed(() => this.intento() && !this.elegido());

  // Monto e interés

  private readonly montoNumero = computed(() => leerDecimal(this.monto()));

  protected readonly errorMonto = computed(() => {
    const texto = this.monto().trim();
    const monto = this.montoNumero();
    if (texto === '') return this.intento() ? 'Captura el monto solicitado.' : '';
    if (Number.isNaN(monto)) return 'Captura solo números, con hasta dos decimales.';
    if (monto < MONTO_MINIMO) return `El monto mínimo es ${formatearMoneda(MONTO_MINIMO)}.`;
    if (monto > MONTO_MAXIMO) return `El monto máximo es ${formatearMoneda(MONTO_MAXIMO)}.`;
    return '';
  });

  protected readonly ayudaMonto = `Entre ${formatearMoneda(MONTO_MINIMO)} y ${formatearMoneda(MONTO_MAXIMO)}.`;

  private readonly montoValido = computed(() => this.monto().trim() !== '' && !this.errorMonto());

  private readonly tasaNumero = computed(() => leerDecimal(this.tasa()));

  protected readonly errorTasa = computed(() => {
    const tasa = this.tasaNumero();
    if (this.tasa().trim() === '') return 'Captura el interés mensual.';
    if (Number.isNaN(tasa)) return 'Captura solo números, con hasta dos decimales.';
    if (tasa <= 0) return 'El interés debe ser mayor a 0%.';
    if (tasa > TASA_MAXIMA) return `El interés no puede ser mayor a ${String(TASA_MAXIMA)}%.`;
    return '';
  });

  // Plazo

  protected readonly opcionesPlazo = computed(() => {
    const p = this.periodicidadActual();
    return p.plazos.map((n) => ({
      numero: n,
      unidad: p.unidad,
      meses: textoMeses(n / p.porMes),
    }));
  });

  protected readonly errorFecha = computed(() => {
    const fecha = this.fechaInicio();
    if (!fecha) return this.intento() ? 'Elige la fecha del primer pago.' : '';
    if (fecha < this.hoy) return 'La fecha no puede ser anterior a hoy.';
    return '';
  });

  // Cálculo y calendario

  protected readonly calculo = computed(() => {
    if (!this.montoValido() || this.errorTasa()) return undefined;
    return calcularPrestamo({
      periodicidad: this.periodicidadActual(),
      plazos: this.plazos(),
      monto: this.montoNumero(),
      tasaMensual: this.tasaNumero(),
    });
  });

  protected readonly resumen = computed(() => {
    const calculo = this.calculo();
    const p = this.periodicidadActual();
    const plazos = this.plazos();
    const detalle = `${String(plazos)} pagos ${p.adjetivo}`;
    const tasa = this.errorTasa() ? '—' : `${textoPorcentaje(this.tasaNumero())} mensual`;
    if (!calculo) {
      return {
        cuota: '—',
        detalle: 'Captura el monto y el interés para calcular',
        detalleCorto: '—',
        monto: this.montoValido() ? formatearMoneda(this.montoNumero()) : '—',
        tasa,
        meses: '—',
        interes: '—',
        total: '—',
        formula:
          'Interés = monto × interés mensual × plazo en meses. Cada pago = total ÷ número de pagos.',
      };
    }
    const meses = textoMeses(calculo.meses);
    const tasaNumero = this.tasaNumero();
    return {
      cuota: pesos(calculo.cuotaCent),
      detalle: `× ${detalle}`,
      detalleCorto: `${detalle} de ${pesos(calculo.cuotaCent)}`,
      monto: pesos(calculo.montoCent),
      tasa,
      meses: `${meses} (${String(plazos)} ${p.unidad})`,
      interes: pesos(calculo.interesCent),
      total: pesos(calculo.totalCent),
      formula:
        `Interés = ${pesos(calculo.montoCent)} × ${textoPorcentaje(tasaNumero)} × ${meses} ` +
        `(${textoPorcentaje(tasaNumero * calculo.meses)} en total). ` +
        `Cada pago = total ÷ ${String(plazos)} pagos.`,
    };
  });

  protected readonly filas = computed(() => {
    const calculo = this.calculo();
    const inicio = this.fechaInicio();
    if (!calculo || !inicio || this.errorFecha()) return [];
    const p = this.periodicidadActual();
    const plazos = this.plazos();
    return Array.from({ length: plazos }, (_, i) => ({
      numero: i + 1,
      fecha: formatearFecha(fechaDePago(inicio, p, i)),
      importe: pesos(i === plazos - 1 ? calculo.ultimaCent : calculo.cuotaCent),
    }));
  });

  protected readonly calendario = computed(() =>
    this.verTodo() ? this.filas() : this.filas().slice(0, FILAS_VISIBLES),
  );

  protected readonly puedeVerTodo = computed(() => this.filas().length > FILAS_VISIBLES);

  protected readonly notaUltimoPago = computed(() => {
    const calculo = this.calculo();
    const inicio = this.fechaInicio();
    if (!calculo || this.filas().length === 0) return '';
    const ultimo = fechaDePago(inicio, this.periodicidadActual(), this.plazos() - 1);
    let nota = `Último pago: ${fechaLarga(ultimo)}.`;
    if (calculo.ultimaCent !== calculo.cuotaCent) {
      nota += ` El último pago es de ${pesos(calculo.ultimaCent)} por ajuste de centavos.`;
    }
    return nota;
  });

  protected readonly primerPago = computed(() =>
    this.fechaInicio() && !this.errorFecha() ? fechaLarga(this.fechaInicio()) : '—',
  );

  /** Lo que se imprime para el cliente: el resumen y el calendario completo, sin la fórmula. */
  protected readonly simulacion = computed<Simulacion>(() => {
    const { cuota, detalle, monto, tasa, meses, interes, total } = this.resumen();
    return {
      cliente: this.elegido()?.nombreCompleto,
      emision: this.hoyTexto,
      cuota,
      detalle,
      monto,
      tasa,
      meses,
      interes,
      total,
      primerPago: this.primerPago(),
      filas: this.filas(),
      notaUltimoPago: this.notaUltimoPago(),
    };
  });

  private readonly valido = computed(
    () =>
      !!this.elegido() &&
      this.montoValido() &&
      !this.errorTasa() &&
      !!this.fechaInicio() &&
      !this.errorFecha(),
  );

  constructor() {
    if (this.clientes.clientes().length === 0) void this.clientes.cargar();
  }

  protected texto(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }

  protected elegirCliente(cliente: Cliente): void {
    if (!cliente.activo) return;
    this.clienteId.set(cliente.id);
    this.busqueda.set('');
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
    this.plazos.set(nueva.plazos[0] ?? this.plazos());
    this.verTodo.set(false);
  }

  protected intentarGenerar(): void {
    if (!this.valido()) {
      this.intento.set(true);
      this.avisos.error('Revisa los datos marcados antes de generar el préstamo.');
      return;
    }
    this.errorApi.set('');
    this.confirmando.set(true);
  }

  /** No exige cliente: la simulación se le enseña antes de que haga la solicitud. */
  protected imprimirSimulacion(): void {
    if (this.filas().length === 0) {
      this.avisos.error(
        'Captura el monto, el interés y la fecha del primer pago para imprimir la simulación.',
      );
      return;
    }
    this.ventana?.print();
  }

  protected cerrarConfirmacion(): void {
    if (!this.enviando()) this.confirmando.set(false);
  }

  protected async generar(): Promise<void> {
    const peticion = this.peticion();
    const cliente = this.elegido();
    if (!peticion || !cliente) return;
    this.enviando.set(true);
    this.errorApi.set('');
    try {
      const respuesta = await this.prestamos.generar(peticion);
      this.confirmando.set(false);
      this.resultado.set({
        mensaje: respuesta.objetoResponse.resultado || respuesta.mensaje,
        plazosGenerados: respuesta.objetoResponse.plazosGenerados,
        cliente: cliente.nombreCompleto,
      });
    } catch (error) {
      this.errorApi.set(mensajeDeError(error, 'No se pudo generar el préstamo.'));
    } finally {
      this.enviando.set(false);
    }
  }

  protected cerrarResultado(): void {
    this.resultado.set(undefined);
  }

  protected nuevoPrestamo(): void {
    const semanal = periodicidad('semanal');
    this.resultado.set(undefined);
    this.clienteId.set(undefined);
    this.busqueda.set('');
    this.monto.set('');
    this.tasa.set(TASA_INICIAL);
    this.idPeriodicidad.set(semanal.id);
    this.plazos.set(semanal.plazos[0] ?? 12);
    this.fechaInicio.set(fechaDePago(this.hoy, semanal, 1));
    this.intento.set(false);
    this.verTodo.set(false);
  }

  private peticion(): PeticionPrestamo | undefined {
    const cliente = this.elegido();
    const calculo = this.calculo();
    if (!cliente || !calculo) return undefined;
    return {
      idCliente: String(cliente.id),
      idModalidad: String(this.periodicidadActual().idModalidad),
      numeroCuota: String(this.plazos()),
      importeCuota: aDecimal(calculo.cuotaCent),
      fechaGeneracionOperacion: this.hoy,
      fechaInicioCredito: this.fechaInicio(),
      importeCredito: aDecimal(calculo.montoCent),
      tasaInteres: String(this.tasaNumero()),
      totalPagar: aDecimal(calculo.totalCent),
      interesGenerado: aDecimal(calculo.interesCent),
      estadoPago: '1',
      diasMoratorios: '0',
      alerta: 'VIGENTE',
      idCalculadoraPrestamo: '1',
    };
  }
}
