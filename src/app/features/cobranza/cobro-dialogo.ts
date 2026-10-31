import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  type OnInit,
  output,
  signal,
} from '@angular/core';
import { ApiError, mensajeDeError } from '@/core/api/api-error';
import { formatearFecha, formatearMoneda } from '@/core/format';
import { DialogoModal } from '@/core/ui/dialogo-modal';
import { Icono } from '@/core/ui/icono';
import { aPesos, hoyIso } from '@/features/prestamos/calculo-prestamo';
import {
  type CapturaPago,
  capturaInicial,
  centavos,
  DIAS_ATRAS_MAXIMO,
  errorFecha,
  errorImporte,
  errorRecargo,
  errorReferencia,
  leerImporte,
  NOTA_MAXIMO,
  nuevaLlave,
  peticionLiquidacion,
  peticionPago,
  pideReferencia,
  recargoCent,
  REFERENCIA_MAXIMO,
  restarDias,
  textoImporte,
} from '@/features/cobranza/captura-pago';
import {
  type CuotaCobranza,
  METODOS_PAGO,
  type MetodoPago,
  type SaldoPrestamo,
} from '@/features/cobranza/cobranza-api';
import { situacionDe } from '@/features/cobranza/cobranza-vista';
import { CobranzaService } from '@/features/cobranza/cobranza.service';
import {
  rangoPagos,
  type Recibo,
  reciboDeLiquidacion,
  reciboDePago,
} from '@/features/cobranza/recibo';

type Modo = 'cuota' | 'liquidacion';
type Campo = keyof CapturaPago;

function pesos(centavosValor: number): string {
  return formatearMoneda(aPesos(centavosValor));
}

/**
 * Diálogo "Registrar pago" de una cuota, con el acceso a "Liquidar préstamo" (todo lo que debe el
 * préstamo en una sola operación). Los datos del pago (método, fecha, nota…) se conservan al pasar
 * de una vista a la otra. Al terminar emite el recibo.
 */
@Component({
  selector: 'app-cobro-dialogo',
  imports: [DialogoModal, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cobro-dialogo.html',
})
export class CobroDialogo implements OnInit {
  readonly cuota = input.required<CuotaCobranza>();
  readonly registrado = output<Recibo>();
  readonly cerrar = output();

  private readonly servicio = inject(CobranzaService);

  protected readonly hoy = hoyIso();
  protected readonly fechaMinima = restarDias(this.hoy, DIAS_ATRAS_MAXIMO);
  protected readonly metodos = METODOS_PAGO;
  protected readonly referenciaMaximo = REFERENCIA_MAXIMO;
  protected readonly notaMaximo = NOTA_MAXIMO;
  protected readonly ayudaFecha = `Hoy, o hasta ${String(DIAS_ATRAS_MAXIMO)} días antes.`;

  protected readonly modo = signal<Modo>('cuota');
  protected readonly captura = linkedSignal(() =>
    capturaInicial(centavos(this.cuota().saldoCuota), this.hoy),
  );
  protected readonly intento = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorApi = signal('');
  /** Errores por campo que devolvió el back (400). */
  private readonly camposApi = signal<Partial<Record<string, string>>>({});

  protected readonly saldo = signal<SaldoPrestamo | undefined>(undefined);
  protected readonly errorSaldo = signal('');

  // Una llave por operación: se repite en los reintentos para que el back no duplique el cobro.
  private readonly llavePago = nuevaLlave();
  private readonly llaveLiquidacion = nuevaLlave();

  protected readonly vista = computed(() => {
    const c = this.cuota();
    const importeCent = centavos(c.importeCuota);
    const abonadoCent = centavos(c.importeAbonado);
    return {
      cliente: c.cliente.nombreCompleto,
      prestamo: `Préstamo #${String(c.idPrestamo)} · ${c.modalidad.descripcion}`,
      pago: rangoPagos([c.numeroCuota], c.totalCuotas),
      vence: formatearFecha(c.fechaVencimiento),
      situacion: situacionDe(c),
      importe: pesos(importeCent),
      abonado: abonadoCent > 0 ? pesos(abonadoCent) : '',
      saldo: pesos(centavos(c.saldoCuota)),
    };
  });

  protected readonly liquidacion = computed(() => {
    const s = this.saldo();
    if (!s) return undefined;
    return {
      saldo: s,
      prestamo: `Préstamo #${String(s.idPrestamo)} · ${s.modalidad.descripcion}`,
      rango: rangoPagos(
        s.cuotas.map((q) => q.numeroCuota),
        s.totalCuotas,
      ),
      total: formatearMoneda(s.saldoTotal),
      cuotas: s.cuotas.map((q) => ({
        id: q.idCuota,
        pago: `Pago ${String(q.numeroCuota)}`,
        vence: formatearFecha(q.fechaVencimiento),
        situacion: situacionDe(q),
        saldo: formatearMoneda(q.saldoCuota),
      })),
    };
  });

  private readonly saldoCuotaCent = computed(() => centavos(this.cuota().saldoCuota));

  /** El recargo solo aplica si hay atraso: la cuota vencida o, al liquidar, alguna vencida. */
  protected readonly admiteRecargo = computed(() =>
    this.modo() === 'cuota'
      ? this.cuota().situacion === 'VENCIDA'
      : (this.saldo()?.hayCuotasVencidas ?? false),
  );

  protected readonly pideReferencia = computed(() => pideReferencia(this.captura().metodo));

  private readonly errorImporteLocal = computed(() =>
    errorImporte(this.captura().importe, this.saldoCuotaCent()),
  );
  private readonly errorRecargoLocal = computed(() =>
    this.admiteRecargo() ? errorRecargo(this.captura().recargo) : '',
  );
  private readonly errorReferenciaLocal = computed(() =>
    errorReferencia(this.captura().metodo, this.captura().referencia),
  );
  private readonly errorFechaLocal = computed(() => errorFecha(this.captura().fecha, this.hoy));

  protected readonly errores = computed(() => {
    const api = this.camposApi();
    const importeEscrito = this.captura().importe.trim() !== '';
    return {
      importe:
        (this.intento() || importeEscrito ? this.errorImporteLocal() : '') || api['importe'] || '',
      recargo: this.errorRecargoLocal() || api['recargo'] || '',
      referencia: (this.intento() ? this.errorReferenciaLocal() : '') || api['referencia'] || '',
      fecha: this.errorFechaLocal() || api['fechaPago'] || '',
      nota: api['nota'] || '',
    };
  });

  private readonly recargoValidoCent = computed(() => {
    if (!this.admiteRecargo()) return 0;
    const recargo = recargoCent(this.captura().recargo);
    return Number.isNaN(recargo) ? 0 : recargo;
  });

  /** Lo que entrega el cliente: importe (o saldo total al liquidar) + recargo. */
  private readonly totalCent = computed(() => {
    const base =
      this.modo() === 'liquidacion'
        ? centavos(this.saldo()?.saldoTotal ?? '0')
        : this.errorImporteLocal()
          ? 0
          : leerImporte(this.captura().importe);
    return base + this.recargoValidoCent();
  });

  protected readonly ayudaImporte = computed(() => {
    const error = this.errores().importe;
    if (error) return error;
    if (this.errorImporteLocal()) return `Hasta ${pesos(this.saldoCuotaCent())}.`;
    const restante = this.saldoCuotaCent() - leerImporte(this.captura().importe);
    return restante > 0
      ? `Abono parcial: la cuota quedará con ${pesos(restante)} pendientes.`
      : 'Con este pago la cuota queda liquidada.';
  });

  protected readonly ayudaRecargo = computed(() => {
    const error = this.errores().recargo;
    if (error) return error;
    const valido = this.modo() === 'liquidacion' || !this.errorImporteLocal();
    return this.recargoValidoCent() > 0 && valido
      ? `El cliente entrega ${pesos(this.totalCent())} en total. El recargo no reduce el saldo.`
      : 'A criterio del cobrador. No reduce el saldo.';
  });

  protected readonly botonRegistrar = computed(() => {
    if (this.enviando()) return 'Registrando…';
    if (this.errorImporteLocal() || this.errorRecargoLocal()) return 'Registrar pago';
    return `Registrar pago de ${pesos(this.totalCent())}`;
  });

  protected readonly botonLiquidar = computed(() => {
    if (this.enviando()) return 'Liquidando…';
    if (!this.saldo() || this.errorRecargoLocal()) return 'Liquidar préstamo';
    return `Liquidar por ${pesos(this.totalCent())}`;
  });

  ngOnInit(): void {
    void this.cargarSaldo();
  }

  protected cambiar(campo: Campo, evento: Event): void {
    this.fijar(campo, (evento.target as HTMLInputElement).value);
  }

  protected elegirMetodo(metodo: MetodoPago): void {
    this.fijar('metodo', metodo);
  }

  /** Al salir del campo se muestra con separador de miles: "1110" → "1,110.00". */
  protected formatear(campo: 'importe' | 'recargo'): void {
    const texto = this.captura()[campo];
    const valor = leerImporte(texto);
    if (texto.trim() !== '' && !Number.isNaN(valor)) this.fijar(campo, textoImporte(valor));
  }

  protected usarSaldoCompleto(): void {
    this.fijar('importe', textoImporte(this.saldoCuotaCent()));
  }

  protected abrirLiquidacion(): void {
    this.cambiarModo('liquidacion');
  }

  protected volverACuota(): void {
    if (!this.enviando()) this.cambiarModo('cuota');
  }

  protected alCerrar(): void {
    if (!this.enviando()) this.cerrar.emit();
  }

  protected async registrar(): Promise<void> {
    if (
      this.errorImporteLocal() ||
      this.errorRecargoLocal() ||
      this.errorReferenciaLocal() ||
      this.errorFechaLocal()
    ) {
      this.intento.set(true);
      return;
    }
    const peticion = peticionPago(this.cuota().idCuota, this.captura(), this.admiteRecargo());
    await this.enviar('No se pudo registrar el pago.', async () =>
      reciboDePago(await this.servicio.registrarPago(peticion, this.llavePago)),
    );
  }

  protected async liquidar(): Promise<void> {
    const saldo = this.saldo();
    if (!saldo) return;
    if (this.errorRecargoLocal() || this.errorReferenciaLocal() || this.errorFechaLocal()) {
      this.intento.set(true);
      return;
    }
    const peticion = peticionLiquidacion(
      saldo.idPrestamo,
      saldo.saldoTotal,
      this.captura(),
      this.admiteRecargo(),
    );
    const listo = await this.enviar('No se pudo liquidar el préstamo.', async () =>
      reciboDeLiquidacion(
        await this.servicio.liquidarPrestamo(peticion, this.llaveLiquidacion),
        saldo,
      ),
    );
    // Si el saldo cambió mientras tanto (409), se vuelve a consultar para mostrar el actual.
    if (!listo) void this.cargarSaldo();
  }

  protected async cargarSaldo(): Promise<void> {
    this.errorSaldo.set('');
    try {
      this.saldo.set(await this.servicio.saldoPrestamo(this.cuota().idPrestamo));
    } catch (error) {
      this.errorSaldo.set(mensajeDeError(error, 'No se pudo consultar el saldo del préstamo.'));
    }
  }

  /** Envía la operación y emite el recibo. Devuelve si se registró. */
  private async enviar(porDefecto: string, operacion: () => Promise<Recibo>): Promise<boolean> {
    this.enviando.set(true);
    this.errorApi.set('');
    this.camposApi.set({});
    try {
      this.registrado.emit(await operacion());
      return true;
    } catch (error) {
      this.mostrarError(error, porDefecto);
      return false;
    } finally {
      this.enviando.set(false);
    }
  }

  private mostrarError(error: unknown, porDefecto: string): void {
    let mensaje = mensajeDeError(error, porDefecto);
    if (error instanceof ApiError) {
      if (error.status === 0) mensaje += ' Puedes reintentar: el pago no se registrará dos veces.';
      const campos = error.body?.campos ?? [];
      this.camposApi.set(Object.fromEntries(campos.map((c) => [c.campo, c.mensaje])));
    }
    this.errorApi.set(mensaje);
  }

  private fijar(campo: Campo, valor: string): void {
    this.captura.update((c) => ({ ...c, [campo]: valor }));
    const clave = campo === 'fecha' ? 'fechaPago' : campo === 'metodo' ? 'metodoPago' : campo;
    if (this.camposApi()[clave]) {
      this.camposApi.update((c) => ({ ...c, [clave]: undefined }));
    }
  }

  private cambiarModo(modo: Modo): void {
    this.modo.set(modo);
    this.intento.set(false);
    this.errorApi.set('');
    this.camposApi.set({});
  }
}
