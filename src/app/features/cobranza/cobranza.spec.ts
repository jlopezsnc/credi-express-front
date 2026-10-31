import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { errorInterceptor } from '@/core/api/error.interceptor';
import { AvisosService } from '@/core/ui/avisos.service';
import { Cobranza } from '@/features/cobranza/cobranza';
import type {
  CuotaCobranza,
  Liquidacion,
  OperacionPago,
  Pago,
  PaginaConTotal,
  ReciboOperacion,
  ResumenCobranza,
  SaldoPrestamo,
  SituacionCuota,
} from '@/features/cobranza/cobranza-api';
import type { Recibo } from '@/features/cobranza/recibo';
import { ReciboPng } from '@/features/cobranza/recibo-png';

const BASE = '/api/operaciones-cobranza';

// Datos ficticios, ya calculados como los entrega el back.
const MARIA = { idCliente: 1, nombreCompleto: 'MARÍA FERNANDA LÓPEZ RUIZ', telefono: '9932145567' };
const JOSE = { idCliente: 2, nombreCompleto: 'JOSÉ ANTONIO HERNÁNDEZ CRUZ', telefono: null };
const QUINCENAL = { idModalidad: 2, descripcion: 'Quincenal' };

function cuota(cambios: Partial<CuotaCobranza>): CuotaCobranza {
  return {
    idCuota: 104,
    idPrestamo: 13,
    cliente: JOSE,
    modalidad: QUINCENAL,
    numeroCuota: 4,
    totalCuotas: 8,
    fechaVencimiento: '2026-10-29',
    importeCuota: '1110.00',
    importeAbonado: '0.00',
    saldoCuota: '1110.00',
    diasAtraso: 0,
    diasParaVencer: 0,
    situacion: 'HOY',
    ...cambios,
  };
}

const DE_HOY = cuota({});
const VENCIDA = cuota({
  idCuota: 101,
  idPrestamo: 12,
  cliente: MARIA,
  numeroCuota: 7,
  fechaVencimiento: '2026-10-17',
  importeAbonado: '400.00',
  saldoCuota: '710.00',
  diasAtraso: 12,
  situacion: 'VENCIDA',
});
const PROXIMA = cuota({
  idCuota: 109,
  fechaVencimiento: '2026-11-01',
  diasParaVencer: 3,
  situacion: 'PROXIMA',
});

const RESUMEN: ResumenCobranza = {
  fecha: '2026-10-29',
  porCobrarHoy: { cuotas: 1, importe: '1110.00' },
  vencido: { cuotas: 1, importe: '710.00' },
  proximas: { cuotas: 1, importe: '1110.00' },
  cobrado: { pagos: 0, importe: '0.00' },
};

const SALDO_12: SaldoPrestamo = {
  idPrestamo: 12,
  cliente: MARIA,
  modalidad: QUINCENAL,
  totalCuotas: 8,
  cuotasPendientes: 2,
  saldoTotal: '1820.00',
  hayCuotasVencidas: true,
  cuotas: [
    { ...VENCIDA, idCuota: 101 },
    {
      idCuota: 102,
      numeroCuota: 8,
      fechaVencimiento: '2026-11-01',
      importeCuota: '1110.00',
      importeAbonado: '0.00',
      saldoCuota: '1110.00',
      diasAtraso: 0,
      diasParaVencer: 3,
      situacion: 'PROXIMA',
    },
  ],
};

function pagina<T>(
  contenido: T[],
  importeTotal: string,
  cambios: Partial<PaginaConTotal<T>> = {},
): PaginaConTotal<T> {
  return {
    contenido,
    pagina: 0,
    tamano: 10,
    totalElementos: contenido.length,
    totalPaginas: 1,
    importeTotal,
    ...cambios,
  };
}

function sobre<T>(objeto: T, httpStatus = 'OK') {
  return { objetoResponse: objeto, httpStatus, mensaje: 'Listo.' };
}

function pagoDe(c: CuotaCobranza, importe: string, recargo = '0.00'): Pago {
  return {
    idPago: 233,
    folio: 'P-000233',
    idCuota: c.idCuota,
    idPrestamo: c.idPrestamo,
    cliente: c.cliente,
    numeroCuota: c.numeroCuota,
    totalCuotas: c.totalCuotas,
    importe,
    recargo,
    totalRecibido: (Number(importe) + Number(recargo)).toFixed(2),
    fechaPago: '2026-10-29',
    metodoPago: 'EFECTIVO',
    referencia: null,
    nota: null,
    tipo: 'ABONO_PARCIAL',
    saldoCuota: '710.00',
    cuotaLiquidada: false,
    prestamoLiquidado: false,
    registradoPor: 'cobrador@ejemplo.com',
    fechaRegistro: '2026-10-29T10:15:00-06:00',
    estatus: 'VIGENTE',
    canceladoPor: null,
    fechaCancelacion: null,
    motivoCancelacion: null,
  };
}

describe('Cobranza', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.open = true;
    };
  });

  let fixture: ComponentFixture<Cobranza>;
  let pantalla: HTMLElement;
  let http: HttpTestingController;
  const png = {
    crear: vi.fn<(r: Recibo, ancho: number, alto: number) => Promise<Blob>>(),
    descargar: vi.fn<(url: string, archivo: string) => void>(),
  };

  function boton(texto: string, dentro: ParentNode = pantalla): HTMLButtonElement {
    const encontrado = [...dentro.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) =>
        b.textContent.replace(/\s+/g, ' ').trim() === texto ||
        b.getAttribute('aria-label') === texto,
    );
    if (!encontrado) throw new Error(`No hay botón "${texto}"`);
    return encontrado;
  }

  function escribir(selector: string, valor: string): void {
    const entrada = pantalla.querySelector<HTMLInputElement>(selector);
    if (!entrada) throw new Error(`No hay entrada ${selector}`);
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
    entrada.dispatchEvent(new Event('blur'));
  }

  function dialogo(): HTMLDialogElement {
    const encontrado = pantalla.querySelector('dialog');
    if (!encontrado) throw new Error('No hay diálogo abierto');
    return encontrado;
  }

  /**
   * Deja correr temporizadores, efectos y detección de cambios. No usa `whenStable()`: espera a
   * que terminen las peticiones de `httpResource`, y aquí las responde la prueba.
   */
  async function esperar(ms = 0): Promise<void> {
    await new Promise((resolver) => setTimeout(resolver, ms));
    TestBed.tick();
    await new Promise((resolver) => setTimeout(resolver));
    TestBed.tick();
  }

  function cuotasDe(situacion: SituacionCuota): TestRequest {
    return http.expectOne(
      (r) => r.url === `${BASE}/cuotas-pendientes` && r.params.get('situacion') === situacion,
    );
  }

  /** La pantalla pide el resumen y solo la pestaña activa. */
  async function responderCarga(
    situacion: SituacionCuota = 'HOY',
    cuotas: CuotaCobranza[] = [DE_HOY],
    resumen = RESUMEN,
  ): Promise<void> {
    http.expectOne((r) => r.url === `${BASE}/resumen`).flush(sobre(resumen));
    cuotasDe(situacion).flush(sobre(pagina(cuotas, cuotas[0]?.saldoCuota ?? '0.00')));
    await esperar();
  }

  async function verVencidas(): Promise<void> {
    boton('Vencidas 1').click();
    await esperar();
    cuotasDe('VENCIDA').flush(sobre(pagina([VENCIDA], '710.00')));
    await esperar();
  }

  async function abrirCobro(etiqueta: string, saldo: SaldoPrestamo): Promise<void> {
    boton(etiqueta).click();
    await esperar();
    http.expectOne(`${BASE}/prestamo-saldo/${String(saldo.idPrestamo)}`).flush(sobre(saldo));
    await esperar();
  }

  beforeEach(async () => {
    png.crear.mockReset().mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    png.descargar.mockReset();
    URL.createObjectURL = vi.fn(() => 'blob:recibo');
    URL.revokeObjectURL = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: ReciboPng, useValue: png },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Cobranza);
    pantalla = fixture.nativeElement as HTMLElement;
    await esperar();
  });

  afterEach(() => {
    http.verify();
  });

  it('pide el resumen y la pestaña activa, de 10 en 10 por vencimiento', async () => {
    expect(pantalla.textContent).toContain('Cargando cobranza');
    const resumen = http.expectOne((r) => r.url === `${BASE}/resumen`);
    expect(resumen.request.params.get('dias')).toBe('7');
    resumen.flush(sobre(RESUMEN));
    const cuotas = cuotasDe('HOY');
    expect(cuotas.request.params.get('orden')).toBe('VENCE');
    expect(cuotas.request.params.get('direccion')).toBe('ASC');
    expect(cuotas.request.params.get('pagina')).toBe('0');
    expect(cuotas.request.params.get('tamano')).toBe('10');
    cuotas.flush(sobre(pagina([DE_HOY], '1110.00')));
    await esperar();

    expect(pantalla.textContent).toContain('1 cuota con atraso');
    expect(pantalla.textContent).toContain('JOSÉ ANTONIO HERNÁNDEZ CRUZ');
    expect(pantalla.textContent).toContain('Vence hoy');
    expect(pantalla.textContent).toContain('1 cuota · $1,110.00 MXN por cobrar');
    // Los contadores de las pestañas salen del resumen.
    expect(boton('Próximos 7 días 1')).toBeTruthy();
  });

  it('no truena con un back anterior que no envía las próximas', async () => {
    const anterior: ResumenCobranza = { ...RESUMEN, proximas: undefined };
    await responderCarga('HOY', [DE_HOY], anterior);
    expect(pantalla.textContent).toContain('JOSÉ ANTONIO HERNÁNDEZ CRUZ');
    expect(boton('Próximos 7 días 0')).toBeTruthy();
  });

  it('muestra la situación que calcula el back', async () => {
    await responderCarga();
    await verVencidas();
    expect(pantalla.textContent).toContain('12 días de atraso');
    expect(pantalla.textContent).toContain('Abonado $400.00 MXN de $1,110.00 MXN');

    boton('Próximos 7 días 1').click();
    await esperar();
    cuotasDe('PROXIMA').flush(sobre(pagina([PROXIMA], '1110.00')));
    await esperar();
    expect(pantalla.textContent).toContain('En 3 días');
  });

  it('ordena y pagina en el back', async () => {
    await responderCarga('HOY', [DE_HOY]);
    const saldo = [...pantalla.querySelectorAll<HTMLButtonElement>('thead button')].find((b) =>
      b.textContent.includes('Saldo de la cuota'),
    );
    saldo?.click();
    await esperar();
    let peticion = cuotasDe('HOY');
    expect(peticion.request.params.get('orden')).toBe('SALDO');
    expect(peticion.request.params.get('direccion')).toBe('ASC');
    peticion.flush(sobre(pagina([DE_HOY], '23310.00', { totalElementos: 21, totalPaginas: 3 })));
    await esperar();
    expect(pantalla.textContent).toContain('Mostrando 1–1 de 21 cuotas');
    expect(pantalla.textContent).toContain('21 cuotas · $23,310.00 MXN por cobrar');

    pantalla.querySelector<HTMLButtonElement>('[aria-label="Página 3"]')?.click();
    await esperar();
    peticion = cuotasDe('HOY');
    expect(peticion.request.params.get('pagina')).toBe('2');
    expect(peticion.request.params.get('orden')).toBe('SALDO');
    peticion.flush(
      sobre(pagina([DE_HOY], '23310.00', { pagina: 2, totalElementos: 21, totalPaginas: 3 })),
    );
    await esperar();
  });

  it('registra un abono con su llave de idempotencia y descarga el recibo en PNG', async () => {
    await responderCarga();
    await verVencidas();
    await abrirCobro('Registrar pago de MARÍA FERNANDA LÓPEZ RUIZ, pago 7 de 8', SALDO_12);

    expect(dialogo().textContent).toContain('Saldo del préstamo: $1,820.00 MXN (Pagos 7 a 8 de 8)');
    escribir('#f-importe', '400');
    escribir('#f-recargo', '1000');
    await esperar();
    expect(pantalla.querySelector<HTMLInputElement>('#f-recargo')?.value).toBe('1,000.00');
    expect(dialogo().textContent).toContain('la cuota quedará con $310.00 MXN pendientes');
    boton('Registrar pago de $1,400.00 MXN').click();

    const peticion = http.expectOne(`${BASE}/pago-registrar`);
    expect(peticion.request.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(peticion.request.body).toMatchObject({
      idCuota: 101,
      importe: '400.00',
      recargo: '1000.00',
      metodoPago: 'EFECTIVO',
      referencia: null,
    });
    const pago = { ...pagoDe(VENCIDA, '400.00', '1000.00'), saldoCuota: '310.00' };
    peticion.flush(sobre(pago, 'CREATED'), { status: 201, statusText: 'Created' });
    await esperar();
    // Después de registrar se vuelven a pedir el resumen y la pestaña activa.
    await responderCarga('VENCIDA', [VENCIDA]);

    expect(dialogo().textContent).toContain('Pago registrado');
    expect(dialogo().textContent).toContain('P-000233');
    expect(dialogo().textContent).toContain('$310.00 MXN pendientes');
    boton('Crear recibo').click();
    await esperar();
    expect(png.crear).toHaveBeenCalledOnce();
    expect(png.descargar).toHaveBeenCalledWith(
      'blob:recibo',
      'PAGO_MARIA_FERNANDA_LOPEZ_RUIZ_RECIBO_7_de_8.png',
    );
    expect(dialogo().textContent).toContain('Recibo creado');

    boton('Listo').click();
    await esperar();
    expect(pantalla.querySelector('dialog')).toBeNull();
  });

  it('no envía si el importe supera el saldo de la cuota', async () => {
    await responderCarga();
    await abrirCobro('Registrar pago de JOSÉ ANTONIO HERNÁNDEZ CRUZ, pago 4 de 8', {
      ...SALDO_12,
      idPrestamo: 13,
      hayCuotasVencidas: false,
    });
    expect(pantalla.querySelector('#f-recargo')).toBeNull();
    escribir('#f-importe', '1,110.01');
    await esperar();
    boton('Registrar pago').click();
    await esperar();
    expect(dialogo().textContent).toContain('No puede ser mayor al saldo de la cuota.');
    http.expectNone(`${BASE}/pago-registrar`);
  });

  it('muestra el error del back y reintenta con la misma llave', async () => {
    await responderCarga();
    await abrirCobro('Registrar pago de JOSÉ ANTONIO HERNÁNDEZ CRUZ, pago 4 de 8', {
      ...SALDO_12,
      idPrestamo: 13,
    });
    boton('Registrar pago de $1,110.00 MXN').click();
    const primera = http.expectOne(`${BASE}/pago-registrar`);
    const llave = primera.request.headers.get('Idempotency-Key');
    primera.flush(
      {
        objetoResponse: null,
        httpStatus: 'CONFLICT',
        mensaje: 'Primero hay que cobrar la cuota 3 de este préstamo.',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await esperar();
    expect(dialogo().querySelector('[role="alert"]')?.textContent).toContain(
      'Primero hay que cobrar la cuota 3',
    );

    boton('Registrar pago de $1,110.00 MXN').click();
    const segunda = http.expectOne(`${BASE}/pago-registrar`);
    expect(segunda.request.headers.get('Idempotency-Key')).toBe(llave);
    segunda.error(new ProgressEvent('error'));
    await esperar();
    expect(dialogo().textContent).toContain('no se registrará dos veces');
  });

  it('liquida el préstamo completo con un solo importe y entrega el recibo', async () => {
    await responderCarga();
    await verVencidas();
    await abrirCobro('Registrar pago de MARÍA FERNANDA LÓPEZ RUIZ, pago 7 de 8', SALDO_12);

    boton('Liquidar préstamo').click();
    await esperar();
    expect(dialogo().textContent).toContain('Liquidar préstamo');
    expect(dialogo().querySelectorAll('tbody tr')).toHaveLength(2);
    expect(dialogo().textContent).toContain('sin descuento');
    expect(dialogo().textContent).toContain('En 3 días');
    escribir('#f-recargo', '150');
    boton('Transferencia').click();
    await esperar();
    boton('Liquidar por $1,970.00 MXN').click();
    await esperar();
    expect(dialogo().textContent).toContain('Captura la referencia del pago.');
    http.expectNone(`${BASE}/prestamo-liquidar`);

    escribir('#f-referencia', ' 998877 ');
    await esperar();
    boton('Liquidar por $1,970.00 MXN').click();
    const peticion = http.expectOne(`${BASE}/prestamo-liquidar`);
    expect(peticion.request.headers.has('Idempotency-Key')).toBe(true);
    expect(peticion.request.body).toMatchObject({
      idPrestamo: 12,
      importe: '1820.00',
      recargo: '150.00',
      metodoPago: 'TRANSFERENCIA',
      referencia: '998877',
    });
    const liquidacion: Liquidacion = {
      folio: 'P-000240',
      idPrestamo: 12,
      cliente: MARIA,
      cuotasLiquidadas: 2,
      importe: '1820.00',
      recargo: '150.00',
      totalRecibido: '1970.00',
      fechaPago: '2026-10-29',
      metodoPago: 'TRANSFERENCIA',
      referencia: '998877',
      nota: null,
      pagos: [
        { idPago: 240, idCuota: 101, numeroCuota: 7, importe: '710.00' },
        { idPago: 241, idCuota: 102, numeroCuota: 8, importe: '1110.00' },
      ],
      prestamoLiquidado: true,
      clienteSinAdeudos: true,
      registradoPor: 'cobrador@ejemplo.com',
      fechaRegistro: '2026-10-29T11:02:00-06:00',
    };
    peticion.flush(sobre(liquidacion, 'CREATED'), { status: 201, statusText: 'Created' });
    await esperar();
    await responderCarga('VENCIDA', []);

    expect(dialogo().textContent).toContain('Préstamo liquidado');
    expect(dialogo().textContent).toContain('El cliente ya no tiene adeudos.');
    boton('Crear recibo').click();
    await esperar();
    expect(png.descargar).toHaveBeenCalledWith(
      'blob:recibo',
      'PAGO_MARIA_FERNANDA_LOPEZ_RUIZ_RECIBO_7_a_8_de_8.png',
    );
  });

  it('muestra "Cobrado hoy" ya agrupado por el back', async () => {
    await responderCarga('HOY', [DE_HOY], {
      ...RESUMEN,
      cobrado: { pagos: 1, importe: '1970.00' },
    });
    boton('Cobrado hoy 1').click();
    await esperar();

    const operacion: OperacionPago = {
      folio: 'P-000240',
      fechaRegistro: '2026-10-29T11:02:00-06:00',
      fechaPago: '2026-10-29',
      cliente: MARIA,
      idPrestamo: 12,
      cuotaInicial: 7,
      cuotaFinal: 8,
      totalCuotas: 8,
      tipo: 'LIQUIDACION',
      metodoPago: 'TRANSFERENCIA',
      referencia: '998877',
      importe: '1820.00',
      recargo: '150.00',
      totalRecibido: '1970.00',
      registradoPor: 'cobrador@ejemplo.com',
      estatus: 'VIGENTE',
    };
    const peticion = http.expectOne((r) => r.url === `${BASE}/operaciones`);
    expect(peticion.request.params.get('tamano')).toBe('10');
    peticion.flush(sobre(pagina([operacion], '1970.00')));
    await esperar();

    const filas = pantalla.querySelectorAll('section[aria-label="Pagos registrados hoy"] tbody tr');
    expect(filas).toHaveLength(1);
    expect(filas[0]?.textContent).toContain('Pagos 7 a 8 de 8');
    expect(filas[0]?.textContent).toContain('Liquidación');
    expect(filas[0]?.textContent).toContain('$1,970.00 MXN');
    expect(pantalla.textContent).toContain('1 pago · $1,970.00 MXN cobrados hoy');

    // Reimprimir: el mismo diálogo del cobro, con los datos que guarda el back.
    const avisos = TestBed.inject(AvisosService);
    const mostrar = vi.spyOn(avisos, 'mostrar');
    boton('Reimprimir recibo P-000240').click();
    await esperar();
    const recibo: ReciboOperacion = {
      tipo: 'LIQUIDACION',
      modalidad: QUINCENAL,
      totalCuotas: 8,
      pago: null,
      liquidacion: {
        folio: 'P-000240',
        idPrestamo: 12,
        cliente: MARIA,
        cuotasLiquidadas: 2,
        importe: '1820.00',
        recargo: '150.00',
        totalRecibido: '1970.00',
        fechaPago: '2026-10-29',
        metodoPago: 'TRANSFERENCIA',
        referencia: '998877',
        nota: null,
        pagos: [
          { idPago: 240, idCuota: 101, numeroCuota: 7, importe: '710.00' },
          { idPago: 241, idCuota: 102, numeroCuota: 8, importe: '1110.00' },
        ],
        prestamoLiquidado: true,
        clienteSinAdeudos: null,
        registradoPor: 'cobrador@ejemplo.com',
        fechaRegistro: '2026-10-29T11:02:00-06:00',
      },
    };
    http.expectOne(`${BASE}/recibo/P-000240`).flush(sobre(recibo));
    await esperar();

    expect(dialogo().textContent).toContain('Préstamo liquidado');
    expect(dialogo().textContent).toContain('P-000240');
    expect(dialogo().textContent).not.toContain('adeudos');
    boton('Crear recibo').click();
    await esperar();
    expect(png.descargar).toHaveBeenCalledWith(
      'blob:recibo',
      'PAGO_MARIA_FERNANDA_LOPEZ_RUIZ_RECIBO_7_a_8_de_8.png',
    );
    boton('Listo').click();
    await esperar();
    expect(pantalla.querySelector('dialog')).toBeNull();
    expect(mostrar).not.toHaveBeenCalled();
  });

  it('si no se puede cargar el recibo avisa el error y no abre el diálogo', async () => {
    await responderCarga('HOY', [DE_HOY], {
      ...RESUMEN,
      cobrado: { pagos: 1, importe: '710.00' },
    });
    boton('Cobrado hoy 1').click();
    await esperar();
    const operacion: OperacionPago = {
      folio: 'P-000233',
      fechaRegistro: '2026-10-29T10:15:00-06:00',
      fechaPago: '2026-10-29',
      cliente: MARIA,
      idPrestamo: 12,
      cuotaInicial: 7,
      cuotaFinal: 7,
      totalCuotas: 8,
      tipo: 'CUOTA_COMPLETA',
      metodoPago: 'EFECTIVO',
      referencia: null,
      importe: '710.00',
      recargo: '0.00',
      totalRecibido: '710.00',
      registradoPor: 'cobrador@ejemplo.com',
      estatus: 'VIGENTE',
    };
    http
      .expectOne((r) => r.url === `${BASE}/operaciones`)
      .flush(sobre(pagina([operacion], '710.00')));
    await esperar();
    const error = vi.spyOn(TestBed.inject(AvisosService), 'error');

    boton('Reimprimir recibo P-000233').click();
    await esperar();
    http.expectOne(`${BASE}/recibo/P-000233`).flush(
      {
        objetoResponse: null,
        httpStatus: 'NOT_FOUND',
        mensaje: 'No hay un pago vigente con ese folio.',
      },
      { status: 404, statusText: 'Not Found' },
    );
    await esperar();

    expect(error).toHaveBeenCalledWith('No hay un pago vigente con ese folio.');
    expect(pantalla.querySelector('dialog')).toBeNull();
  });
});
