import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { errorInterceptor } from '@/core/api/error.interceptor';
import { AvisosService } from '@/core/ui/avisos.service';
import type { ClienteRespuesta } from '@/features/clientes/clientes.service';
import type {
  Convenio,
  PeticionConvenio,
  SimulacionConvenio,
} from '@/features/convenios/convenio-api';
import { NuevoConvenio } from '@/features/convenios/nuevo-convenio';
import type { PaginaPrestamos, PrestamoResumen } from '@/features/prestamos/prestamo';

const CLIENTES_URL = '/api/operaciones-cliente/cliente-lst';
const PRESTAMOS_URL = '/api/operaciones-prestamos/prestamos';
const SIMULAR_URL = '/api/operaciones-convenios/simular';
const GENERAR_URL = '/api/operaciones-convenios/convenio-generar';

// Datos ficticios, ya calculados como los entrega el back.
const CLIENTES: ClienteRespuesta[] = [
  {
    idCliente: 1,
    nombreCompleto: 'María Fernanda López Ruiz',
    curp: 'LORM900312MTCPZR06',
    telefono: '9932145567',
    correoElectronico: null,
    domicilioCalle: null,
    domicilioColonia: null,
    domicilioCiudad: null,
  },
];

function prestamo(
  id: number,
  idCliente: number,
  nombre: string,
  cambios: Partial<PrestamoResumen> = {},
): PrestamoResumen {
  return {
    idPrestamo: id,
    cliente: { idCliente, nombreCompleto: nombre, telefono: null },
    modalidad: { idModalidad: 1, descripcion: 'Semanal' },
    numeroCuotas: 12,
    cuotasPagadas: 5,
    cuotasVencidas: 3,
    importeCuota: '840.00',
    totalPagar: '10080.00',
    saldoPendiente: '4760.00',
    proximoPago: '2026-10-14',
    proximaCuota: 6,
    estado: 'CON_ATRASO',
    ...cambios,
  };
}

const DE_MARIA = prestamo(12, 1, 'María Fernanda López Ruiz');
const DE_ANA = prestamo(18, 2, 'Ana Sofía López Ruiz', {
  cuotasVencidas: 0,
  saldoPendiente: '5150.00',
  estado: 'AL_CORRIENTE',
});

function pagina(contenido: PrestamoResumen[]): PaginaPrestamos {
  return {
    contenido,
    pagina: 0,
    tamano: 10,
    totalElementos: contenido.length,
    totalPaginas: 1,
    contadores: {
      activos: 2,
      alCorriente: 1,
      conAtraso: 1,
      liquidados: 0,
      enConvenio: 0,
      todos: 2,
    },
  };
}

const PLAN: SimulacionConvenio = {
  prestamos: [
    {
      idPrestamo: 12,
      cliente: { idCliente: 1, nombreCompleto: 'María Fernanda López Ruiz', telefono: null },
      estado: 'CON_ATRASO',
      numeroCuotas: 12,
      cuotasPagadas: 5,
      cuotasVencidas: 3,
      saldo: '4760.00',
    },
    {
      idPrestamo: 18,
      cliente: { idCliente: 2, nombreCompleto: 'Ana Sofía López Ruiz', telefono: null },
      estado: 'AL_CORRIENTE',
      numeroCuotas: 12,
      cuotasPagadas: 5,
      cuotasVencidas: 0,
      saldo: '5150.00',
    },
  ],
  personas: 2,
  saldoConvenido: '9910.00',
  tasaInteres: '0.00',
  meses: '3',
  interes: '0.00',
  totalPagar: '9910.00',
  numeroPagos: 12,
  importeCuota: '825.83',
  importeUltimaCuota: '825.87',
  modalidad: { idModalidad: 1, descripcion: 'Semanal' },
  calendario: Array.from({ length: 12 }, (_, i) => ({
    numero: i + 1,
    fechaVencimiento: `2026-11-${String(6 + i).padStart(2, '0')}`,
    importe: i === 11 ? '825.87' : '825.83',
  })),
};

function sobre<T>(objeto: T) {
  return { objetoResponse: objeto, httpStatus: 'OK', mensaje: 'Listo.' };
}

describe('NuevoConvenio', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.open = true;
    };
  });

  let fixture: ComponentFixture<NuevoConvenio>;
  let pantalla: HTMLElement;
  let http: HttpTestingController;

  function boton(texto: string, dentro: ParentNode = pantalla): HTMLButtonElement {
    const encontrado = [...dentro.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) =>
        b.textContent.replace(/\s+/g, ' ').trim().startsWith(texto) ||
        b.getAttribute('aria-label') === texto,
    );
    if (!encontrado) throw new Error(`No hay botón "${texto}"`);
    return encontrado;
  }

  function texto(selector: string): string {
    return pantalla.querySelector(selector)?.textContent.replace(/\s+/g, ' ') ?? '';
  }

  /** Deja correr temporizadores, efectos y detección de cambios (sin `whenStable`, ver Prestamos). */
  async function esperar(ms = 0): Promise<void> {
    await new Promise((resolver) => setTimeout(resolver, ms));
    TestBed.tick();
    await new Promise((resolver) => setTimeout(resolver));
    TestBed.tick();
  }

  function listaPrestamos(): TestRequest {
    return http.expectOne((r) => r.url === PRESTAMOS_URL && !r.params.has('idCliente'));
  }

  async function marcar(idPrestamo: number): Promise<void> {
    const casilla = pantalla.querySelector<HTMLInputElement>(
      `input[type="checkbox"][aria-label*="#${String(idPrestamo)} "]`,
    );
    if (!casilla) throw new Error(`No hay casilla del préstamo ${String(idPrestamo)}`);
    casilla.click();
    await esperar();
  }

  /** Elige a María, marca sus dos préstamos y responde la simulación. */
  async function conPlan(): Promise<TestRequest> {
    boton('Elegir a María Fernanda López Ruiz como titular').click();
    await esperar();
    http
      .expectOne((r) => r.url === PRESTAMOS_URL && r.params.get('idCliente') === '1')
      .flush(sobre(pagina([DE_MARIA])));
    await marcar(12);
    await marcar(18);
    await esperar(350);
    const simulacion = http.expectOne(SIMULAR_URL);
    simulacion.flush(sobre(PLAN));
    await esperar();
    return simulacion;
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
    fixture = TestBed.createComponent(NuevoConvenio);
    pantalla = fixture.nativeElement as HTMLElement;
    await esperar();
    http.expectOne(CLIENTES_URL).flush(sobre(CLIENTES));
    listaPrestamos().flush(sobre(pagina([DE_MARIA, DE_ANA])));
    await esperar();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    http.verify();
  });

  it('lista los préstamos con saldo por cliente y filtra en el back', async () => {
    expect(pantalla.textContent).toContain('Ana Sofía López Ruiz');
    expect(pantalla.textContent).toContain('Vencido');
    expect(pantalla.textContent).toContain('Vigente');
    expect(boton('Vigentes').textContent).toContain('1');

    boton('Vencidos').click();
    await esperar();
    const peticion = listaPrestamos();
    expect(peticion.request.params.get('filtro')).toBe('CON_ATRASO');
    expect(peticion.request.params.get('orden')).toBe('CLIENTE');
    expect(peticion.request.params.get('tamano')).toBe('10');
    peticion.flush(sobre(pagina([DE_MARIA])));
    await esperar();
  });

  it('pide el plan al back sin interés y lo muestra', async () => {
    const simulacion = await conPlan();

    expect(simulacion.request.method).toBe('POST');
    expect(simulacion.request.body).toEqual({
      idsPrestamo: [12, 18],
      idModalidad: 1,
      numeroPagos: 12,
      tasaInteres: '0',
      fechaPrimerPago: expect.any(String) as string,
    });
    const resumen = texto('aside');
    expect(resumen).toContain('$825.83 MXN');
    expect(resumen).toContain('Sin interés');
    expect(resumen).toContain('$9,910.00 MXN');
    expect(resumen).toContain('2 préstamos de 2 personas');
    expect(resumen).toContain('Ver los 12 pagos');
    expect(pantalla.textContent).toContain('Incluye préstamos a nombre de otras personas');
  });

  it('marca el motivo y no genera sin él', async () => {
    await conPlan();
    boton('Generar convenio').click();
    await esperar();

    expect(texto('#f-motivo-ayuda')).toContain('Escribe el motivo');
    expect(pantalla.querySelector('dialog')).toBeNull();
  });

  it('genera el convenio con su llave y el saldo que se vio', async () => {
    await conPlan();
    const motivo = pantalla.querySelector<HTMLTextAreaElement>('#f-motivo');
    if (!motivo) throw new Error('No hay motivo');
    motivo.value = 'Los préstamos de su hermana los paga ella.';
    motivo.dispatchEvent(new Event('input'));
    await esperar();
    boton('Generar convenio').click();
    await esperar();

    const dialogo = pantalla.querySelector('dialog');
    if (!dialogo) throw new Error('No se abrió la confirmación');
    boton('Generar convenio', dialogo).click();
    const peticion = http.expectOne(GENERAR_URL);
    expect(peticion.request.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(peticion.request.body).toMatchObject<Partial<PeticionConvenio>>({
      idClienteTitular: 1,
      idsPrestamo: [12, 18],
      motivo: 'Los préstamos de su hermana los paga ella.',
      saldoEsperado: '9910.00',
    });
    const convenio: Convenio = {
      idConvenio: 124,
      folio: 'CV-000124',
      idPrestamoConvenio: 46,
      titular: { idCliente: 1, nombreCompleto: 'María Fernanda López Ruiz', telefono: null },
      motivo: 'Los préstamos de su hermana los paga ella.',
      estatus: 'VIGENTE',
      registradoPor: 'cobrador@ejemplo.mx',
      fechaRegistro: '2026-10-30T18:00:00Z',
      plan: PLAN,
    };
    peticion.flush(sobre(convenio));
    await esperar();

    expect(texto('#t-generado')).toContain('Convenio CV-000124 generado');
    expect(pantalla.textContent).toContain('Se generó el préstamo #46 con 12 pagos');
  });

  describe('Imprimir convenio', () => {
    it('pide el plan antes de imprimir', async () => {
      const imprimir = vi.spyOn(window, 'print').mockImplementation(() => undefined);
      boton('Imprimir convenio').click();
      await esperar();

      expect(imprimir).not.toHaveBeenCalled();
      expect(TestBed.inject(AvisosService).aviso()?.mensaje).toContain('para imprimir el convenio');
    });

    it('imprime con el mismo formato de la simulación, los préstamos y sin la fórmula', async () => {
      const imprimir = vi.spyOn(window, 'print').mockImplementation(() => undefined);
      await conPlan();
      boton('Imprimir convenio').click();

      expect(imprimir).toHaveBeenCalledOnce();
      const hoja = texto('app-hoja-simulacion');
      expect(hoja).toContain('Propuesta de convenio');
      expect(hoja).toContain('Cliente: María Fernanda López Ruiz');
      expect(hoja).toContain('Préstamos que se convienen');
      expect(hoja).toContain('Ana Sofía López Ruiz');
      expect(hoja).toContain('Total del convenio');
      expect(hoja).not.toContain('Interés =');
      expect(
        pantalla.querySelectorAll('app-hoja-simulacion table')[1]?.querySelectorAll('tbody tr'),
      ).toHaveLength(12);
    });
  });
});
