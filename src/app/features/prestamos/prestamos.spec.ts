import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { errorInterceptor } from '@/core/api/error.interceptor';
import type {
  PaginaPrestamos,
  PrestamoDetalle,
  PrestamoResumen,
} from '@/features/prestamos/prestamo';
import { Prestamos } from '@/features/prestamos/prestamos';

const LISTA = '/api/operaciones-prestamos/prestamos';

// Datos ficticios, ya calculados como los entrega el back.
function prestamo(
  id: number,
  nombre: string,
  cambios: Partial<PrestamoResumen> = {},
): PrestamoResumen {
  return {
    idPrestamo: id,
    cliente: { idCliente: id, nombreCompleto: nombre, telefono: null },
    modalidad: { idModalidad: 1, descripcion: 'Semanal' },
    numeroCuotas: 12,
    cuotasPagadas: 4,
    cuotasVencidas: 0,
    importeCuota: '840.00',
    totalPagar: '10080.00',
    saldoPendiente: '6720.00',
    proximoPago: '2026-11-04',
    proximaCuota: 5,
    estado: 'AL_CORRIENTE',
    ...cambios,
  };
}

const MARIA = prestamo(1, 'MARÍA FERNANDA LÓPEZ RUIZ', {
  estado: 'CON_ATRASO',
  cuotasVencidas: 2,
  proximoPago: '2026-10-14',
});
const JOSE = prestamo(2, 'JOSÉ ANTONIO HERNÁNDEZ CRUZ');

function pagina(
  contenido: PrestamoResumen[],
  cambios: Partial<PaginaPrestamos> = {},
): PaginaPrestamos {
  return {
    contenido,
    pagina: 0,
    tamano: 10,
    totalElementos: contenido.length,
    totalPaginas: 1,
    contadores: { activos: 2, conAtraso: 1, liquidados: 3, todos: 5 },
    ...cambios,
  };
}

function sobre<T>(objeto: T) {
  return { objetoResponse: objeto, httpStatus: 'OK', mensaje: 'Listo.' };
}

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

  function boton(texto: string, selector = 'button'): HTMLButtonElement {
    const encontrado = [...pantalla.querySelectorAll<HTMLButtonElement>(selector)].find((b) =>
      b.textContent.replace(/\s+/g, ' ').trim().startsWith(texto),
    );
    if (!encontrado) throw new Error(`No hay botón "${texto}"`);
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

  /** La petición de la lista que está pendiente. */
  function lista(): TestRequest {
    return http.expectOne((r) => r.url === LISTA);
  }

  async function responder(respuesta: PaginaPrestamos): Promise<void> {
    lista().flush(sobre(respuesta));
    await esperar();
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
    await esperar();
  });

  afterEach(() => {
    http.verify();
  });

  it('pide los activos por próximo pago de 10 en 10 y muestra lo que calcula el back', async () => {
    expect(pantalla.textContent).toContain('Cargando préstamos');
    const peticion = lista();
    expect(peticion.request.params.get('filtro')).toBe('ACTIVOS');
    expect(peticion.request.params.get('orden')).toBe('PROXIMO_PAGO');
    expect(peticion.request.params.get('direccion')).toBe('ASC');
    expect(peticion.request.params.get('pagina')).toBe('0');
    expect(peticion.request.params.get('tamano')).toBe('10');
    expect(peticion.request.params.has('busqueda')).toBe(false);
    peticion.flush(sobre(pagina([MARIA, JOSE])));
    await esperar();

    expect(nombresEnTabla()).toEqual(['MARÍA FERNANDA LÓPEZ RUIZ', 'JOSÉ ANTONIO HERNÁNDEZ CRUZ']);
    expect(pantalla.textContent).toContain('Con atraso');
    expect(pantalla.textContent).toContain('Al corriente');
    expect(pantalla.textContent).toContain('4 de 12');
    expect(pantalla.textContent).toContain('$6,720.00 MXN');
    expect(boton('Liquidados').textContent).toContain('3');
    expect(pantalla.textContent).toContain('Mostrando 1–2 de 2 préstamos');
  });

  it('ordena en el back por la columna elegida y alterna la dirección', async () => {
    await responder(pagina([MARIA, JOSE]));

    boton('Cliente', 'thead button').click();
    await esperar();
    let peticion = lista();
    expect(peticion.request.params.get('orden')).toBe('CLIENTE');
    expect(peticion.request.params.get('direccion')).toBe('ASC');
    peticion.flush(sobre(pagina([JOSE, MARIA])));
    await esperar();
    expect(boton('Cliente', 'thead button').closest('th')?.getAttribute('aria-sort')).toBe(
      'ascending',
    );

    boton('Cliente', 'thead button').click();
    await esperar();
    peticion = lista();
    expect(peticion.request.params.get('direccion')).toBe('DESC');
    peticion.flush(sobre(pagina([MARIA, JOSE])));
    await esperar();
  });

  it('pagina y filtra en el back, y al filtrar vuelve a la primera página', async () => {
    await responder(pagina([MARIA, JOSE], { totalElementos: 12, totalPaginas: 2 }));
    pantalla.querySelector<HTMLButtonElement>('[aria-label="Página siguiente"]')?.click();
    await esperar();
    let peticion = lista();
    expect(peticion.request.params.get('pagina')).toBe('1');
    peticion.flush(sobre(pagina([JOSE], { pagina: 1, totalElementos: 12, totalPaginas: 2 })));
    await esperar();
    expect(pantalla.textContent).toContain('Mostrando 11–11 de 12 préstamos');

    boton('Liquidados').click();
    await esperar();
    peticion = lista();
    expect(peticion.request.params.get('filtro')).toBe('LIQUIDADOS');
    expect(peticion.request.params.get('pagina')).toBe('0');
    peticion.flush(sobre(pagina([])));
    await esperar();
    expect(pantalla.textContent).toContain('Sin coincidencias');
  });

  it('busca en el back cuando se deja de escribir', async () => {
    await responder(pagina([MARIA, JOSE]));
    const entrada = pantalla.querySelector<HTMLInputElement>('input[type="search"]');
    if (!entrada) throw new Error('Sin buscador');
    entrada.value = 'jo';
    entrada.dispatchEvent(new Event('input'));
    entrada.value = 'josé';
    entrada.dispatchEvent(new Event('input'));
    await esperar();
    http.expectNone((r) => r.url === LISTA);

    await esperar(350);
    const peticion = lista();
    expect(peticion.request.params.get('busqueda')).toBe('josé');
    peticion.flush(sobre(pagina([JOSE])));
    await esperar();
    expect(nombresEnTabla()).toEqual(['JOSÉ ANTONIO HERNÁNDEZ CRUZ']);
  });

  it('muestra el calendario con el estatus de cada cuota que calcula el back', async () => {
    await responder(pagina([MARIA, JOSE]));
    pantalla
      .querySelector<HTMLButtonElement>(
        '[aria-label="Ver calendario del préstamo 1 de MARÍA FERNANDA LÓPEZ RUIZ"]',
      )
      ?.click();
    await esperar();
    expect(pantalla.querySelector('dialog')?.textContent).toContain('Cargando calendario');

    const cuota = (numero: number, abonado: string, saldo: string) => ({
      idCuota: 10 + numero,
      numeroCuota: numero,
      fechaVencimiento: '2026-10-14',
      importe: '840.00',
      abonado,
      saldo,
      fechaPago: null,
    });
    const detalle: PrestamoDetalle = {
      prestamo: MARIA,
      cuotas: [
        { ...cuota(1, '840.00', '0.00'), fechaPago: '2026-09-30', estatus: 'PAGADA' },
        { ...cuota(2, '300.00', '540.00'), estatus: 'VENCIDA' },
        { ...cuota(3, '100.00', '740.00'), estatus: 'ABONO_PARCIAL' },
      ],
    };
    http.expectOne('/api/operaciones-prestamos/prestamos/1').flush(sobre(detalle));
    await esperar();

    const dialogo = pantalla.querySelector('dialog');
    expect(dialogo?.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(dialogo?.textContent).toContain('2 pagos vencidos');
    expect(dialogo?.textContent).toContain('Abono parcial');
    expect(dialogo?.textContent).toContain('$540.00 MXN');
  });

  it('ofrece reintentar si el back falla', async () => {
    lista().flush(null, { status: 403, statusText: 'Forbidden' });
    await esperar();
    expect(pantalla.textContent).toContain('No tienes permiso');
    boton('Reintentar').click();
    await esperar();
    await responder(pagina([]));
    expect(pantalla.textContent).toContain('0 préstamos');
  });
});
