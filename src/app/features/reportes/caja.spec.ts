import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { errorInterceptor } from '@/core/api/error.interceptor';
import { hoyIso } from '@/features/prestamos/calculo-prestamo';
import type { MovimientoCaja, PaginaMovimientos, SaldoCaja } from '@/features/reportes/caja-api';
import {
  graficaCaja,
  importeValido,
  montoCorto,
  nombreMes,
  validarMovimiento,
} from '@/features/reportes/caja-vista';
import { Caja } from '@/features/reportes/caja';

const BASE = '/api/operaciones-caja';

// Datos ficticios.
const SALDO: SaldoCaja = {
  anio: null,
  anios: [2026],
  totales: {
    aportado: '50000.00',
    cobrado: '12000.00',
    prestado: '30000.00',
    retirado: '2000.00',
    neto: '30000.00',
  },
  saldoInicial: '0.00',
  saldoFinal: '30000.00',
  saldoActual: '30000.00',
  meses: [
    {
      mes: '2026-09',
      aportado: '50000.00',
      cobrado: '0.00',
      prestado: '30000.00',
      retirado: '0.00',
      neto: '20000.00',
      acumulado: '20000.00',
    },
    {
      mes: '2026-10',
      aportado: '0.00',
      cobrado: '12000.00',
      prestado: '0.00',
      retirado: '2000.00',
      neto: '10000.00',
      acumulado: '30000.00',
    },
  ],
};

const APORTACION: MovimientoCaja = {
  idMovimiento: 1,
  tipo: 'APORTACION',
  importe: '50000.00',
  fecha: '2026-09-01',
  concepto: 'Capital inicial',
  estatus: 'VIGENTE',
  registradoPor: 'user',
  fechaRegistro: '2026-09-01T18:00:00Z',
  canceladoPor: null,
  fechaCancelacion: null,
  motivoCancelacion: null,
};

function pagina(contenido: MovimientoCaja[]): PaginaMovimientos {
  return {
    contenido,
    pagina: 0,
    tamano: 10,
    totalElementos: contenido.length,
    totalPaginas: 1,
  };
}

function sobre<T>(objeto: T) {
  return { objetoResponse: objeto, httpStatus: 'OK', mensaje: 'Listo.' };
}

describe('caja-vista', () => {
  it('nombra los meses y valida el importe', () => {
    expect(nombreMes('2026-10')).toBe('oct 2026');
    expect(importeValido('50,000')).toBe('50000');
    expect(importeValido('1234.567')).toBeUndefined();
    expect(importeValido('0')).toBeUndefined();
    expect(montoCorto(-3400)).toBe('−$3k');
  });

  it('no acepta fechas futuras ni conceptos cortos', () => {
    expect(
      validarMovimiento({ importe: '10', fecha: '2026-11-06', concepto: 'ab' }, '2026-11-05'),
    ).toEqual({
      fecha: 'La fecha no puede ser posterior a hoy.',
      concepto: 'Escribe el concepto (de 3 a 200 caracteres).',
    });
  });

  it('la gráfica pone barras y línea en la misma escala', () => {
    const g = graficaCaja(SALDO.meses, (m) => m.mes);
    expect(g.columnas).toHaveLength(2);
    // Lo prestado en septiembre y el saldo de octubre son $30k: quedan a la misma altura.
    const [septiembre] = g.columnas;
    expect(septiembre?.prestado.y).toBeCloseTo(g.ultimo?.y ?? 0, 5);
    expect(g.ultimo?.etiqueta).toBe('$30k');
  });
});

describe('Caja', () => {
  let fixture: ComponentFixture<Caja>;
  let pantalla: HTMLElement;
  let http: HttpTestingController;

  function boton(texto: string): HTMLButtonElement {
    const encontrado = [...pantalla.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent.replace(/\s+/g, ' ').trim() === texto,
    );
    if (!encontrado) throw new Error(`No hay botón "${texto}"`);
    return encontrado;
  }

  function escribir(id: string, valor: string): void {
    const campo = pantalla.querySelector<HTMLInputElement>(`#${id}`);
    if (!campo) throw new Error(`No hay campo ${id}`);
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  async function esperar(): Promise<void> {
    await new Promise((resolver) => setTimeout(resolver));
    await fixture.whenStable();
  }

  async function abrir(movimientos: MovimientoCaja[]): Promise<void> {
    http.expectOne(`${BASE}/saldo`).flush(sobre(SALDO));
    http.expectOne((r) => r.url === `${BASE}/movimientos`).flush(sobre(pagina(movimientos)));
    await esperar();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Caja);
    pantalla = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
  });

  it('muestra el cálculo del saldo, los meses y los movimientos', async () => {
    await abrir([APORTACION]);

    const texto = pantalla.textContent;
    expect(texto).toContain('Capital aportado');
    expect(texto).toContain('$50,000.00 MXN');
    expect(texto).toContain('Saldo neto en caja');
    expect(texto).toContain('$30,000.00 MXN');
    expect(texto).toContain('oct 2026');
    expect(texto).toContain('Capital inicial');
    expect(pantalla.querySelectorAll('svg rect')).toHaveLength(4);
  });

  it('al elegir un año consulta solo ese año', async () => {
    await abrir([APORTACION]);

    boton('2026').click();
    const peticion = http.expectOne((r) => r.url === `${BASE}/saldo`);
    expect(peticion.request.params.get('anio')).toBe('2026');
    peticion.flush(sobre({ ...SALDO, anio: 2026 }));
    await esperar();

    expect(pantalla.textContent).toContain('Saldo al iniciar 2026');
  });

  it('registra el capital inicial y recarga el saldo', async () => {
    await abrir([]);
    expect(pantalla.textContent).toContain('Todavía no hay aportaciones ni retiros');

    boton('Aportar capital').click();
    await esperar();
    const concepto = pantalla.querySelector<HTMLInputElement>('#f-caja-concepto');
    expect(concepto?.value).toBe('Capital inicial');

    boton('Guardar').click();
    await esperar();
    expect(pantalla.textContent).toContain('Captura un importe mayor a cero');

    escribir('f-caja-importe', '50,000');
    boton('Guardar').click();
    const peticion = http.expectOne(`${BASE}/movimiento-registrar`);
    expect(peticion.request.body).toEqual({
      tipo: 'APORTACION',
      importe: '50000',
      fecha: hoyIso(),
      concepto: 'Capital inicial',
    });
    peticion.flush(sobre(APORTACION), { status: 201, statusText: 'Created' });
    await esperar();

    await abrir([APORTACION]);
    expect(pantalla.querySelector('dialog')).toBeNull();
  });

  it('cancela un movimiento con su motivo', async () => {
    await abrir([APORTACION]);

    const cancelar = pantalla.querySelector<HTMLButtonElement>(
      '[aria-label="Cancelar movimiento Capital inicial"]',
    );
    cancelar?.click();
    await esperar();

    boton('Sí, cancelar').click();
    await esperar();
    expect(pantalla.textContent).toContain('Escribe el motivo (mínimo 5 caracteres).');

    const motivo = pantalla.querySelector<HTMLTextAreaElement>('#f-caja-motivo');
    if (!motivo) throw new Error('No hay motivo');
    motivo.value = 'Se capturó dos veces';
    motivo.dispatchEvent(new Event('input'));
    boton('Sí, cancelar').click();

    const peticion = http.expectOne(`${BASE}/movimiento-cancelar/1`);
    expect(peticion.request.body).toEqual({ motivo: 'Se capturó dos veces' });
    peticion.flush(sobre({ ...APORTACION, estatus: 'CANCELADO' }));
    await esperar();

    await abrir([
      { ...APORTACION, estatus: 'CANCELADO', motivoCancelacion: 'Se capturó dos veces' },
    ]);
    expect(pantalla.textContent).toContain('Cancelado: Se capturó dos veces');
  });
});
