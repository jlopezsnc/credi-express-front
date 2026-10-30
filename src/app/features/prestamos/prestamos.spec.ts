import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { errorInterceptor } from '@/core/api/error.interceptor';
import type { CuotaRespuesta } from '@/features/prestamos/prestamo';
import { Prestamos } from '@/features/prestamos/prestamos';

const LISTA = '/api/operaciones-prestamos/buscar-ep/todo';

function cuotas(
  idPrestamo: number,
  idCliente: number,
  nombre: string,
  vencimientos: string[],
  pagadas = 0,
): CuotaRespuesta[] {
  return vencimientos.map((fecha, i) => ({
    id: idPrestamo * 100 + i,
    clienteResponse: { idCliente, nombreCompleto: nombre },
    modalidadResponse: { idModalidad: 1, descripcion: 'Semanal' },
    numeroCuota: i + 1,
    fechaVencimiento: fecha,
    importeCuota: 840.0,
    fechaPago: i < pagadas ? fecha : null,
    estadoPago: null,
    diasMoratorios: null,
    alerta: 'VIGENTE',
    idCalculadoraPrestamo: idPrestamo,
  }));
}

// Datos ficticios. Las fechas lejanas evitan depender del día en que corran las pruebas.
const RESPUESTA: CuotaRespuesta[] = [
  ...cuotas(1, 1, 'MARÍA FERNANDA LÓPEZ RUIZ', ['2020-01-07', '2020-01-14']),
  ...cuotas(2, 2, 'JOSÉ ANTONIO HERNÁNDEZ CRUZ', ['2099-01-07', '2099-01-14']),
  ...cuotas(3, 3, 'GUADALUPE MARTÍNEZ TORRES', ['2020-01-07', '2020-01-14'], 2),
];

describe('Prestamos', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.open = true;
    };
  });

  let fixture: ComponentFixture<Prestamos>;
  let pantalla: HTMLElement;
  let http: HttpTestingController;

  function nombresEnTabla(): string[] {
    return [...pantalla.querySelectorAll('tbody tr td:first-child .font-bold')].map((celda) =>
      celda.textContent.trim(),
    );
  }

  function boton(texto: string): HTMLButtonElement {
    const encontrado = [...pantalla.querySelectorAll('button')].find((b) =>
      b.textContent.includes(texto),
    );
    if (!encontrado) throw new Error(`No hay botón "${texto}"`);
    return encontrado;
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
    fixture = TestBed.createComponent(Prestamos);
    pantalla = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  it('agrupa las cuotas y muestra los préstamos activos', async () => {
    expect(pantalla.textContent).toContain('Cargando préstamos');
    http.expectOne(LISTA).flush(RESPUESTA); // hoy el back responde un arreglo suelto
    await esperar();
    expect(nombresEnTabla()).toEqual(['JOSÉ ANTONIO HERNÁNDEZ CRUZ', 'MARÍA FERNANDA LÓPEZ RUIZ']);
    expect(pantalla.textContent).toContain('Con atraso');
    expect(pantalla.textContent).toContain('Al corriente');
  });

  it('acepta la respuesta dentro del sobre y filtra liquidados', async () => {
    http.expectOne(LISTA).flush({ objetoResponse: RESPUESTA, httpStatus: 'OK', mensaje: '6' });
    await esperar();
    boton('Liquidados').click();
    await fixture.whenStable();
    expect(nombresEnTabla()).toEqual(['GUADALUPE MARTÍNEZ TORRES']);
  });

  it('muestra el calendario de un préstamo', async () => {
    http.expectOne(LISTA).flush(RESPUESTA);
    await esperar();
    pantalla
      .querySelector<HTMLButtonElement>(
        '[aria-label="Ver calendario del préstamo 1 de MARÍA FERNANDA LÓPEZ RUIZ"]',
      )
      ?.click();
    await fixture.whenStable();
    const dialogo = pantalla.querySelector('dialog');
    expect(dialogo?.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(dialogo?.textContent).toContain('2 pagos vencidos');
    expect(dialogo?.textContent).toContain('$1,680.00 MXN');
  });

  it('ofrece reintentar si el back falla', async () => {
    http.expectOne(LISTA).flush(null, { status: 403, statusText: 'Forbidden' });
    await esperar();
    expect(pantalla.textContent).toContain('No tienes permiso');
    boton('Reintentar').click();
    http.expectOne(LISTA).flush([]);
    await esperar();
    expect(pantalla.textContent).toContain('Mostrando 0 de 0 préstamos');
  });
});
