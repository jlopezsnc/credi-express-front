import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { errorInterceptor } from '@/core/api/error.interceptor';
import { Clientes } from '@/features/clientes/clientes';
import type { ClienteRespuesta } from '@/features/clientes/clientes.service';

const LISTA = '/api/operaciones-cliente/cliente-lst';

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

/** Así envuelve el back sus respuestas. */
function sobre(clientes: ClienteRespuesta[]) {
  return {
    objetoResponse: clientes,
    httpStatus: 'OK',
    mensaje: `${String(clientes.length)} registros encontrados.`,
  };
}

const RESPUESTA: ClienteRespuesta[] = [
  cliente(1, 'María Fernanda López Ruiz', 'LORM900312MTCPZR06'),
  cliente(2, 'José Antonio Hernández Cruz', 'HECJ850214HTCRRS07', {
    prestamosActivos: 1,
    saldoPendiente: '9200.00',
    conAtraso: true,
  }),
  cliente(3, 'Guadalupe Martínez Torres', 'MATG780530MTCRRD08'),
  cliente(4, 'Luis Alberto Pérez Gómez', 'PEGL920817HTCRMS07', { estatusCliente: 'INACTIVO' }),
];

describe('Clientes', () => {
  beforeAll(() => {
    // jsdom no implementa <dialog>.showModal(); los navegadores reales sí.
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.open = true;
    };
  });

  let fixture: ComponentFixture<Clientes>;
  let pantalla: HTMLElement;
  let http: HttpTestingController;

  /** Nombres de la tabla de escritorio (las tarjetas repiten los mismos datos). */
  function nombresEnTabla(): string[] {
    return [...pantalla.querySelectorAll('tbody tr td:first-child .font-bold')].map((celda) =>
      celda.textContent.trim(),
    );
  }

  function encabezado(texto: string): HTMLButtonElement {
    const encontrado = [...pantalla.querySelectorAll<HTMLButtonElement>('thead button')].find(
      (b) => b.textContent.trim() === texto,
    );
    if (!encontrado) throw new Error(`No hay encabezado "${texto}"`);
    return encontrado;
  }

  function boton(texto: string): HTMLButtonElement {
    const encontrado = [...pantalla.querySelectorAll('button')].find((b) =>
      b.textContent.includes(texto),
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

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Clientes);
    pantalla = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  /** Deja que terminen las promesas del servicio y se pinte la pantalla. */
  async function esperar(): Promise<void> {
    await new Promise((resolver) => setTimeout(resolver));
    await fixture.whenStable();
  }

  async function cargarLista(respuesta: ClienteRespuesta[] = RESPUESTA): Promise<void> {
    http.expectOne(LISTA).flush(sobre(respuesta));
    await esperar();
  }

  it('muestra "Cargando" y luego solo los clientes activos', async () => {
    expect(pantalla.textContent).toContain('Cargando clientes');
    await cargarLista();
    // Por defecto, por nombre.
    expect(nombresEnTabla()).toEqual([
      'Guadalupe Martínez Torres',
      'José Antonio Hernández Cruz',
      'María Fernanda López Ruiz',
    ]);
  });

  it('ordena por la columna elegida y alterna la dirección', async () => {
    await cargarLista();
    const curp = encabezado('CURP');
    curp.click();
    await fixture.whenStable();
    expect(nombresEnTabla()).toEqual([
      'José Antonio Hernández Cruz',
      'María Fernanda López Ruiz',
      'Guadalupe Martínez Torres',
    ]);
    expect(curp.closest('th')?.getAttribute('aria-sort')).toBe('ascending');

    curp.click();
    await fixture.whenStable();
    expect(nombresEnTabla()[0]).toBe('Guadalupe Martínez Torres');
    expect(curp.closest('th')?.getAttribute('aria-sort')).toBe('descending');

    // El saldo vacío queda al final en ambas direcciones.
    encabezado('Saldo pendiente').click();
    await fixture.whenStable();
    expect(nombresEnTabla()[0]).toBe('José Antonio Hernández Cruz');
  });

  it('pagina de 10 en 10 y vuelve a la primera página al buscar', async () => {
    const muchos = Array.from({ length: 23 }, (_, i) =>
      cliente(
        i + 1,
        `Cliente ${String(i + 1).padStart(2, '0')}`,
        `CURP${String(i).padStart(14, '0')}`,
      ),
    );
    await cargarLista(muchos);
    expect(nombresEnTabla()).toHaveLength(10);
    expect(pantalla.textContent).toContain('Mostrando 1–10 de 23 clientes');

    pantalla.querySelector<HTMLButtonElement>('[aria-label="Página 3"]')?.click();
    await fixture.whenStable();
    expect(nombresEnTabla()).toEqual(['Cliente 21', 'Cliente 22', 'Cliente 23']);
    expect(pantalla.textContent).toContain('Mostrando 21–23 de 23 clientes');

    escribir('input[type="search"]', 'cliente 1');
    await fixture.whenStable();
    expect(pantalla.textContent).toContain('Mostrando 1–10 de 10 clientes');
  });

  it('ofrece reintentar si el back no responde', async () => {
    http.expectOne(LISTA).flush(null, { status: 401, statusText: 'Unauthorized' });
    await esperar();
    expect(pantalla.textContent).toContain('Tu sesión expiró');
    boton('Reintentar').click();
    await cargarLista();
    expect(nombresEnTabla()).toHaveLength(3);
  });

  it('busca sin importar acentos', async () => {
    await cargarLista();
    escribir('input[type="search"]', 'martinez');
    await fixture.whenStable();
    expect(nombresEnTabla()).toEqual(['Guadalupe Martínez Torres']);
  });

  it('los inactivos tienen su filtro y se pueden reactivar', async () => {
    await cargarLista();
    boton('Inactivos').click();
    await fixture.whenStable();
    expect(nombresEnTabla()).toEqual(['Luis Alberto Pérez Gómez']);
    expect(
      pantalla.querySelector('[aria-label="Reactivar a Luis Alberto Pérez Gómez"]'),
    ).not.toBeNull();
  });

  it('avisa si la CURP ya está registrada', async () => {
    await cargarLista();
    boton('Nuevo cliente').click();
    await fixture.whenStable();
    escribir('#f-curp', 'lorm900312mtcpzr06');
    await fixture.whenStable();
    expect(pantalla.querySelector('#f-curp-ayuda')?.textContent).toContain('Ya existe un cliente');
  });

  it('muestra fecha de nacimiento y sexo de una CURP válida', async () => {
    await cargarLista();
    boton('Nuevo cliente').click();
    await fixture.whenStable();
    escribir('#f-curp', 'CORJ101020MTCPRR06');
    await fixture.whenStable();
    const ayuda = pantalla.querySelector('#f-curp-ayuda')?.textContent ?? '';
    expect(ayuda).toContain('CURP válida');
    expect(ayuda).toContain('Mujer');
  });

  it('no deja dar de baja a un cliente con préstamos activos', async () => {
    await cargarLista();
    pantalla
      .querySelector<HTMLButtonElement>('[aria-label="Dar de baja a José Antonio Hernández Cruz"]')
      ?.click();
    await fixture.whenStable();
    expect(pantalla.querySelector('#titulo-baja')?.textContent).toContain(
      'No se puede dar de baja',
    );
  });

  it('da de baja con confirmación', async () => {
    await cargarLista();
    pantalla
      .querySelector<HTMLButtonElement>('[aria-label="Dar de baja a María Fernanda López Ruiz"]')
      ?.click();
    await fixture.whenStable();
    [...pantalla.querySelectorAll<HTMLButtonElement>('dialog button')]
      .find((b) => b.textContent.trim() === 'Dar de baja')
      ?.click();
    const baja = http.expectOne('/api/operaciones-cliente/cliente-baja/1');
    expect(baja.request.method).toBe('PUT');
    baja.flush(null);
    await esperar();
    await cargarLista(
      RESPUESTA.map((c) => (c.idCliente === 1 ? { ...c, estatusCliente: 'INACTIVO' as const } : c)),
    );
    expect(nombresEnTabla()).not.toContain('María Fernanda López Ruiz');
  });
});
