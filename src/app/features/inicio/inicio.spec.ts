import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { errorInterceptor } from '@/core/api/error.interceptor';
import { AuthService } from '@/core/auth/auth.service';
import type { Inicio as DatosInicio, ResumenMes } from '@/features/inicio/inicio-api';
import { Inicio } from '@/features/inicio/inicio';

const RESUMEN = '/api/operaciones-inicio/resumen';

// Datos ficticios, ya calculados como los entrega el back.
function resumen(mes: string, cambios: Partial<ResumenMes> = {}): ResumenMes {
  return {
    mes,
    desde: `${mes}-01`,
    corte: `${mes}-30`,
    cobrado: '109600.00',
    aplicado: '109600.00',
    esperado: '129500.00',
    esperadoALaFecha: '121500.00',
    cumplimiento: '90.2',
    otorgados: 11,
    colocado: '79000.00',
    liquidados: 4,
    convenios: 3,
    convenido: '26350.00',
    semanas: [
      {
        numero: 1,
        desde: `${mes}-01`,
        hasta: `${mes}-07`,
        esperado: '18500.00',
        aplicado: '17900.00',
        cumplimiento: '96.8',
      },
    ],
    ...cambios,
  };
}

function inicio(mes: string, enCurso: boolean): DatosInicio {
  return {
    mes,
    enCurso,
    resumen: resumen(mes),
    anterior: resumen('2026-09', { semanas: [] }),
    variaciones: { cobrado: '-7.8', otorgados: '57.1', convenios: '50.0' },
    hoy: {
      fecha: '2026-10-30',
      cartera: '427800.00',
      vencido: '38700.00',
      porcentajeVencido: '9.0',
      prestamosActivos: 38,
      clientesConAtraso: 8,
      proximos7Dias: { cuotas: 23, importe: '16240.00' },
      requierenAtencion: [
        {
          cliente: { idCliente: 8, nombreCompleto: 'Carmen Beatriz Ortiz Vela', telefono: null },
          prestamos: 1,
          cuotasVencidas: 5,
          saldoVencido: '2975.00',
          saldoTotal: '9520.00',
          diasMaximoAtraso: 34,
          vencimientoMasAntiguo: '2026-09-26',
        },
      ],
    },
  };
}

function sobre<T>(objeto: T) {
  return { objetoResponse: objeto, httpStatus: 'OK', mensaje: 'Listo.' };
}

describe('Inicio', () => {
  let fixture: ComponentFixture<Inicio>;
  let pantalla: HTMLElement;
  let http: HttpTestingController;

  function boton(etiqueta: string): HTMLButtonElement {
    const encontrado = pantalla.querySelector<HTMLButtonElement>(
      `button[aria-label="${etiqueta}"]`,
    );
    if (!encontrado) throw new Error(`No hay botón "${etiqueta}"`);
    return encontrado;
  }

  function texto(): string {
    return pantalla.textContent.replace(/\s+/g, ' ');
  }

  /** Deja correr temporizadores, efectos y detección de cambios (sin `whenStable`, ver Prestamos). */
  async function esperar(): Promise<void> {
    await new Promise((resolver) => setTimeout(resolver));
    TestBed.tick();
    await new Promise((resolver) => setTimeout(resolver));
    TestBed.tick();
  }

  function peticion(): TestRequest {
    return http.expectOne((r) => r.url === RESUMEN);
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { usuario: signal({ displayName: 'Jorge López', email: 'jorge@ejemplo.mx' }) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Inicio);
    pantalla = fixture.nativeElement as HTMLElement;
    await esperar();
  });

  afterEach(() => {
    http.verify();
  });

  it('pide el mes actual y muestra el resumen y la cartera de hoy', async () => {
    const primera = peticion();
    expect(primera.request.params.has('mes')).toBe(false);
    primera.flush(sobre(inicio('2026-10', true)));
    await esperar();

    const t = texto();
    expect(t).toContain(', Jorge');
    expect(t).toContain('Octubre 2026');
    expect(t).toContain('Mes en curso · cifras al 30 de octubre');
    expect(t).toContain('$109,600.00 MXN');
    expect(t).toContain('▼ 7.8% vs septiembre');
    expect(t).toContain('90.2%');
    expect(t).toContain('$79,000.00 MXN prestados · 4 liquidados en el mes');
    expect(t).toContain('$427,800.00 MXN');
    expect(t).toContain('9.0% de la cartera · 8 clientes con atraso');
    expect(t).toContain('Carmen Beatriz Ortiz Vela');
    expect(t).toContain('34 días de atraso');
    // No hay meses futuros.
    expect(boton('Mes siguiente').disabled).toBe(true);
  });

  it('al cambiar de mes lo pide al back y ya permite volver al siguiente', async () => {
    peticion().flush(sobre(inicio('2026-10', true)));
    await esperar();

    boton('Mes anterior').click();
    await esperar();
    const anterior = peticion();
    expect(anterior.request.params.get('mes')).toBe('2026-09');
    anterior.flush(sobre(inicio('2026-09', false)));
    await esperar();

    expect(texto()).toContain('Septiembre 2026');
    expect(texto()).not.toContain('Mes en curso');
    expect(boton('Mes siguiente').disabled).toBe(false);
  });

  it('la gráfica se puede ver como tabla con el cumplimiento de cada semana', async () => {
    peticion().flush(sobre(inicio('2026-10', true)));
    await esperar();

    const alternar = [...pantalla.querySelectorAll('button')].find((b) =>
      b.textContent.includes('Ver como tabla'),
    );
    alternar?.click();
    await esperar();

    expect(texto()).toContain('Del 1 al 7 de octubre');
    expect(texto()).toContain('96.8%');
  });

  it('si falla, lo dice y deja reintentar', async () => {
    peticion().flush(
      { objetoResponse: null, httpStatus: 'FORBIDDEN', mensaje: 'Sin permiso.' },
      { status: 403, statusText: 'Forbidden' },
    );
    await esperar();

    expect(texto()).toContain('No se pudo cargar el resumen');
    expect(texto()).toContain('No tienes permiso');
  });
});
