import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { errorInterceptor } from '@/core/api/error.interceptor';
import { hoyIso } from '@/features/prestamos/calculo-prestamo';
import type { ReporteCartera, ReporteCobranza } from '@/features/reportes/reportes-api';
import { Reportes } from '@/features/reportes/reportes';

const BASE = '/api/operaciones-reportes';

// Datos ficticios.
const ANA = { idCliente: 1, nombreCompleto: 'ANA RUIZ', telefono: null };

const COBRANZA: ReporteCobranza = {
  desde: '2026-10-28',
  hasta: '2026-10-30',
  totales: { operaciones: 2, importe: '2930.00', recargo: '50.00', totalRecibido: '2980.00' },
  cancelados: { operaciones: 1, totalRecibido: '300.00' },
  porDia: [
    {
      fecha: '2026-10-28',
      operaciones: 1,
      importe: '710.00',
      recargo: '50.00',
      totalRecibido: '760.00',
    },
    {
      fecha: '2026-10-29',
      operaciones: 0,
      importe: '0.00',
      recargo: '0.00',
      totalRecibido: '0.00',
    },
    {
      fecha: '2026-10-30',
      operaciones: 1,
      importe: '2220.00',
      recargo: '0.00',
      totalRecibido: '2220.00',
    },
  ],
  porMetodo: [
    { metodoPago: 'EFECTIVO', operaciones: 1, totalRecibido: '760.00' },
    { metodoPago: 'TRANSFERENCIA', operaciones: 1, totalRecibido: '2220.00' },
    { metodoPago: 'DEPOSITO', operaciones: 0, totalRecibido: '0.00' },
  ],
  operaciones: [
    {
      folio: 'P-000004',
      fechaRegistro: '2026-10-30T11:00:00-06:00',
      fechaPago: '2026-10-30',
      cliente: ANA,
      idPrestamo: 12,
      cuotaInicial: 5,
      cuotaFinal: 5,
      totalCuotas: 8,
      tipo: 'ABONO_PARCIAL',
      metodoPago: 'EFECTIVO',
      referencia: null,
      importe: '300.00',
      recargo: '0.00',
      totalRecibido: '300.00',
      registradoPor: 'cobrador@ejemplo.com',
      estatus: 'CANCELADO',
    },
  ],
};

const CARTERA: ReporteCartera = {
  fecha: '2026-10-30',
  totales: {
    prestamosActivos: 2,
    clientesActivos: 2,
    clientesConAtraso: 1,
    cuotasVencidas: 2,
    saldoTotal: '4000.00',
    saldoVencido: '1400.00',
    saldoPorVencer: '2600.00',
    porcentajeVencido: '35.0',
  },
  antiguedad: [
    { etiqueta: '1 a 7 días', diasDesde: 1, diasHasta: 7, cuotas: 1, saldo: '400.00' },
    { etiqueta: 'Más de 60 días', diasDesde: 61, diasHasta: null, cuotas: 1, saldo: '1000.00' },
  ],
  clientesConAtraso: [
    {
      cliente: ANA,
      prestamos: 1,
      cuotasVencidas: 2,
      saldoVencido: '1400.00',
      saldoTotal: '2400.00',
      diasMaximoAtraso: 65,
      vencimientoMasAntiguo: '2026-08-26',
    },
  ],
};

function sobre<T>(objeto: T) {
  return { objetoResponse: objeto, httpStatus: 'OK', mensaje: 'Listo.' };
}

describe('Reportes', () => {
  let fixture: ComponentFixture<Reportes>;
  let pantalla: HTMLElement;
  let http: HttpTestingController;
  let descargas: string[];

  function boton(texto: string): HTMLButtonElement {
    const encontrado = [...pantalla.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent.replace(/\s+/g, ' ').trim() === texto,
    );
    if (!encontrado) throw new Error(`No hay botón "${texto}"`);
    return encontrado;
  }

  async function esperar(): Promise<void> {
    await new Promise((resolver) => setTimeout(resolver));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    descargas = [];
    URL.createObjectURL = vi.fn(() => 'blob:csv');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      descargas.push(this.download);
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Reportes);
    pantalla = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('abre con la cobranza del mes y exporta el CSV', async () => {
    const peticion = http.expectOne((r) => r.url === `${BASE}/cobranza`);
    const hoy = hoyIso();
    expect(peticion.request.params.get('desde')).toBe(`${hoy.slice(0, 8)}01`);
    expect(peticion.request.params.get('hasta')).toBe(hoy);
    peticion.flush(sobre(COBRANZA));
    await esperar();

    expect(pantalla.textContent).toContain('$2,980.00 MXN');
    expect(pantalla.textContent).toContain('2 pagos registrados');
    expect(pantalla.textContent).toContain('Día con más cobro: 30 oct: $2,220.00 MXN · 1 pago');
    expect(pantalla.querySelectorAll('svg path.fill-grafica')).toHaveLength(2);
    expect(pantalla.textContent).toContain('Cancelado');

    boton('Exportar CSV').click();
    expect(descargas).toEqual(['COBRANZA_2026-10-28_a_2026-10-30.csv']);
  });

  it('no consulta con un periodo inválido', async () => {
    http.expectOne((r) => r.url === `${BASE}/cobranza`).flush(sobre(COBRANZA));
    await esperar();
    const desde = pantalla.querySelector<HTMLInputElement>('#f-desde');
    if (!desde) throw new Error('Sin campo desde');
    desde.value = '2099-01-01';
    desde.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(pantalla.textContent).toContain('La fecha inicial no puede ser posterior a la final.');
    expect(boton('Consultar').disabled).toBe(true);
    http.expectNone((r) => r.url === `${BASE}/cobranza`);
  });

  it('muestra el error del back y reintenta', async () => {
    http
      .expectOne((r) => r.url === `${BASE}/cobranza`)
      .flush(
        {
          objetoResponse: null,
          httpStatus: 'BAD_REQUEST',
          mensaje: 'Revisa el periodo del reporte.',
        },
        { status: 400, statusText: 'Bad Request' },
      );
    await esperar();
    expect(pantalla.querySelector('[role="alert"]')?.textContent).toContain(
      'Revisa el periodo del reporte.',
    );
    boton('Reintentar').click();
    http.expectOne((r) => r.url === `${BASE}/cobranza`).flush(sobre(COBRANZA));
    await esperar();
    expect(pantalla.querySelector('[role="alert"]')).toBeNull();
  });

  it('la cartera se consulta al abrir su pestaña', async () => {
    http.expectOne((r) => r.url === `${BASE}/cobranza`).flush(sobre(COBRANZA));
    await esperar();
    boton('Cartera').click();
    await fixture.whenStable();
    http.expectOne(`${BASE}/cartera`).flush(sobre(CARTERA));
    await esperar();

    expect(pantalla.textContent).toContain('35.0% de la cartera');
    expect(pantalla.textContent).toContain('ANA RUIZ');
    expect(pantalla.textContent).toContain('65 días');
    expect(pantalla.querySelectorAll('svg path.fill-grafica')).toHaveLength(2);

    boton('Exportar CSV').click();
    expect(descargas).toEqual(['CARTERA_VENCIDA_2026-10-30.csv']);

    // Volver a la pestaña no repite la consulta.
    boton('Cobranza por periodo').click();
    boton('Cartera').click();
    await fixture.whenStable();
    http.expectNone(`${BASE}/cartera`);
  });
});
