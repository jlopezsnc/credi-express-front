import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { errorInterceptor } from '@/core/api/error.interceptor';
import type { ClienteRespuesta } from '@/features/clientes/clientes.service';
import { NuevoPrestamo } from '@/features/prestamos/nuevo-prestamo';
import type { PeticionPrestamo } from '@/features/prestamos/prestamos.service';

const LISTA = '/api/operaciones-cliente/cliente-lst';
const GENERAR = '/api/operaciones-prestamos/calcular-pagos';

function cliente(
  id: number,
  nombreCompleto: string,
  curp: string,
  extra: Partial<ClienteRespuesta> = {},
): ClienteRespuesta {
  return {
    idCliente: id,
    nombreCompleto,
    curp,
    telefono: '9171007543',
    correoElectronico: null,
    domicilioCalle: null,
    domicilioColonia: null,
    domicilioCiudad: null,
    ...extra,
  };
}

const CLIENTES: ClienteRespuesta[] = [
  cliente(1, 'María Fernanda López Ruiz', 'LORM900312MTCPZR06'),
  cliente(4, 'Luis Alberto Pérez Gómez', 'PEGL920817HTCRMS07', { estatusCliente: 'INACTIVO' }),
];

describe('NuevoPrestamo', () => {
  beforeAll(() => {
    // jsdom no implementa <dialog>.showModal(); los navegadores reales sí.
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.open = true;
    };
  });

  let fixture: ComponentFixture<NuevoPrestamo>;
  let pantalla: HTMLElement;
  let http: HttpTestingController;

  function boton(texto: string, dentro: ParentNode = pantalla): HTMLButtonElement {
    const encontrado = [...dentro.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent.trim() === texto || b.getAttribute('aria-label') === texto,
    );
    if (!encontrado) throw new Error(`No hay botón "${texto}"`);
    return encontrado;
  }

  function escribir(selector: string, valor: string): void {
    const entrada = pantalla.querySelector<HTMLInputElement>(selector);
    if (!entrada) throw new Error(`No hay entrada ${selector}`);
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
  }

  function resumen(): string {
    return pantalla.querySelector('aside')?.textContent.replace(/\s+/g, ' ') ?? '';
  }

  async function esperar(): Promise<void> {
    await new Promise((resolver) => setTimeout(resolver));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NuevoPrestamo);
    pantalla = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    http.expectOne(LISTA).flush({ objetoResponse: CLIENTES, httpStatus: 'OK', mensaje: '2' });
    await esperar();
  });

  it('ofrece 12 y 16 semanas, y 8 a 14 quincenas; no hay mensual', async () => {
    const plazos = () =>
      [...pantalla.querySelectorAll('[aria-labelledby="l-plazos"] button')].map((b) =>
        b.getAttribute('aria-label'),
      );
    expect(plazos()).toEqual(['12 semanas, 3 meses', '16 semanas, 4 meses']);
    expect(pantalla.textContent).not.toContain('Mensual');
    boton('Quincenal').click();
    await fixture.whenStable();
    expect(plazos()).toEqual([
      '8 quincenas, 4 meses',
      '10 quincenas, 5 meses',
      '12 quincenas, 6 meses',
      '14 quincenas, 7 meses',
    ]);
  });

  it('recalcula todo al cambiar el interés mensual', async () => {
    escribir('#f-monto', '6000');
    await fixture.whenStable();
    expect(resumen()).toContain('$8,160.00 MXN'); // 6,000 × 12% × 3 meses + 6,000
    expect(resumen()).toContain('$680.00 MXN');

    escribir('#f-tasa', '10');
    await fixture.whenStable();
    expect(resumen()).toContain('$7,800.00 MXN');
    expect(resumen()).toContain('$650.00 MXN');

    escribir('#f-tasa', '');
    await fixture.whenStable();
    expect(pantalla.querySelector('#f-tasa-ayuda')?.textContent).toContain(
      'Captura el interés mensual',
    );
    expect(resumen()).not.toContain('$650.00');
  });

  it('no deja elegir clientes inactivos', () => {
    const inactivo = pantalla.querySelector<HTMLButtonElement>(
      '[aria-label="Luis Alberto Pérez Gómez, inactivo: no puede recibir préstamos"]',
    );
    expect(inactivo?.disabled).toBe(true);
  });

  it('marca los datos faltantes en lugar de generar', async () => {
    boton('Generar préstamo').click();
    await fixture.whenStable();
    expect(pantalla.querySelector('#f-cliente-ayuda')?.textContent).toContain(
      'Selecciona un cliente',
    );
    expect(pantalla.querySelector('#f-monto-ayuda')?.textContent).toContain('Captura el monto');
    expect(pantalla.querySelector('dialog')).toBeNull();
    http.expectNone(GENERAR);
  });

  it('confirma y envía el préstamo al back', async () => {
    boton('Elegir a María Fernanda López Ruiz').click();
    escribir('#f-monto', '6000');
    await fixture.whenStable();
    boton('Quincenal').click();
    await fixture.whenStable();
    boton('8 quincenas, 4 meses').click();
    await fixture.whenStable();
    boton('Generar préstamo').click();
    await fixture.whenStable();

    const dialogo = pantalla.querySelector('dialog');
    if (!dialogo) throw new Error('No se abrió la confirmación');
    boton('Generar préstamo', dialogo).click();

    const peticion = http.expectOne(GENERAR);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toMatchObject<Partial<PeticionPrestamo>>({
      idCliente: '1',
      idModalidad: '2',
      numeroCuota: '8',
      importeCredito: '6000.00',
      tasaInteres: '12',
      interesGenerado: '2880.00',
      totalPagar: '8880.00',
      importeCuota: '1110.00',
    });
    peticion.flush({
      objetoResponse: { plazosGenerados: 8, resultado: 'Prestamo generado correctamente' },
      httpStatus: 'OK',
      mensaje: 'Prestamo generado correctamente',
    });
    await esperar();
    expect(pantalla.querySelector('#t-generado')?.textContent).toContain(
      'Prestamo generado correctamente',
    );
    expect(pantalla.textContent).toContain('Se generaron 8 plazos de pago');
  });

  it('muestra el error del back sin cerrar la confirmación', async () => {
    boton('Elegir a María Fernanda López Ruiz').click();
    escribir('#f-monto', '6000');
    await fixture.whenStable();
    boton('Generar préstamo').click();
    await fixture.whenStable();
    const dialogo = pantalla.querySelector('dialog');
    if (!dialogo) throw new Error('No se abrió la confirmación');
    boton('Generar préstamo', dialogo).click();
    http
      .expectOne(GENERAR)
      .flush(
        { objetoResponse: null, httpStatus: 'CONFLICT', mensaje: 'El cliente está inactivo.' },
        { status: 409, statusText: 'Conflict' },
      );
    await esperar();
    expect(pantalla.querySelector('dialog [role="alert"]')?.textContent).toContain(
      'El cliente está inactivo.',
    );
  });
});
