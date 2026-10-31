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
import type {
  ConvenioDetalle,
  ConvenioResumen,
  PaginaConvenios,
} from '@/features/convenios/convenio-api';
import { Convenios } from '@/features/convenios/convenios';

const LISTA = '/api/operaciones-convenios/convenios';
const CANCELAR = '/api/operaciones-convenios/convenio-cancelar/124';

// Datos ficticios, ya calculados como los entrega el back.
function convenio(cambios: Partial<ConvenioResumen> = {}): ConvenioResumen {
  return {
    idConvenio: 124,
    folio: 'CV-000124',
    titular: { idCliente: 1, nombreCompleto: 'María Fernanda López Ruiz', telefono: null },
    idPrestamoConvenio: 46,
    prestamos: 3,
    personas: 3,
    modalidad: { idModalidad: 1, descripcion: 'Semanal' },
    numeroPagos: 12,
    cuotasPagadas: 0,
    cuotasVencidas: 0,
    saldoConvenido: '13795.00',
    totalPagar: '13795.00',
    importeCuota: '1149.58',
    saldoPendiente: '13795.00',
    estado: 'AL_CORRIENTE',
    estatus: 'VIGENTE',
    fechaRegistro: '2026-10-30T18:00:00Z',
    ...cambios,
  };
}

function pagina(contenido: ConvenioResumen[]): PaginaConvenios {
  return {
    contenido,
    pagina: 0,
    tamano: 10,
    totalElementos: contenido.length,
    totalPaginas: 1,
    contadores: { vigentes: 8, conAtraso: 4, liquidados: 2, cancelados: 2, todos: 12 },
  };
}

function detalle(cambios: Partial<ConvenioDetalle> = {}): ConvenioDetalle {
  return {
    convenio: convenio(),
    tasaInteres: '0.00',
    meses: '3',
    interes: '0.00',
    fechaPrimerPago: '2026-11-06',
    motivo: 'Los préstamos de sus familiares los paga ella.',
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
        numeroCuotas: 8,
        cuotasPagadas: 3,
        cuotasVencidas: 0,
        saldo: '5150.00',
      },
    ],
    calendario: [
      {
        idCuota: 461,
        numeroCuota: 1,
        fechaVencimiento: '2026-11-06',
        importe: '1149.58',
        abonado: '0.00',
        saldo: '1149.58',
        fechaPago: null,
        estatus: 'PENDIENTE',
      },
    ],
    pagosRegistrados: 0,
    puedeCancelar: true,
    motivoNoCancelable: null,
    bitacora: {
      registradoPor: 'cobranza1@ejemplo.mx',
      fechaRegistro: '2026-10-30T18:00:00Z',
      ipOrigen: '192.168.1.20',
      actualizadoPor: null,
      fechaActualizacion: null,
      canceladoPor: null,
      fechaCancelacion: null,
      motivoCancelacion: null,
    },
    ...cambios,
  };
}

function sobre<T>(objeto: T) {
  return { objetoResponse: objeto, httpStatus: 'OK', mensaje: 'Listo.' };
}

describe('Convenios', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.open = true;
    };
  });

  let fixture: ComponentFixture<Convenios>;
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

  function lista(): TestRequest {
    return http.expectOne((r) => r.url === LISTA);
  }

  async function abrirDetalle(respuesta: ConvenioDetalle): Promise<void> {
    boton('Ver el detalle del convenio CV-000124').click();
    await esperar();
    http.expectOne(`${LISTA}/124`).flush(sobre(respuesta));
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
    fixture = TestBed.createComponent(Convenios);
    pantalla = fixture.nativeElement as HTMLElement;
    await esperar();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    http.verify();
  });

  it('pide los vigentes del más reciente de 10 en 10 y muestra lo que calcula el back', async () => {
    const peticion = lista();
    expect(peticion.request.params.get('filtro')).toBe('VIGENTES');
    expect(peticion.request.params.get('orden')).toBe('FECHA');
    expect(peticion.request.params.get('direccion')).toBe('DESC');
    expect(peticion.request.params.get('tamano')).toBe('10');
    peticion.flush(sobre(pagina([convenio()])));
    await esperar();

    const tabla = texto('table');
    expect(tabla).toContain('CV-000124');
    expect(tabla).toContain('3 préstamos · 3 personas');
    expect(tabla).toContain('0 de 12');
    expect(tabla).toContain('$13,795.00 MXN');
    expect(tabla).toContain('Al corriente');
    expect(boton('Cancelados').textContent).toContain('2');
  });

  it('filtra y ordena en el back', async () => {
    lista().flush(sobre(pagina([convenio()])));
    await esperar();

    boton('Cancelados').click();
    await esperar();
    let peticion = lista();
    expect(peticion.request.params.get('filtro')).toBe('CANCELADOS');
    peticion.flush(sobre(pagina([])));
    await esperar();
    expect(pantalla.textContent).toContain('Sin coincidencias');

    boton('Titular', pantalla.querySelector('thead') ?? pantalla).click();
    await esperar();
    peticion = lista();
    expect(peticion.request.params.get('orden')).toBe('TITULAR');
    expect(peticion.request.params.get('direccion')).toBe('ASC');
    peticion.flush(sobre(pagina([])));
    await esperar();
  });

  it('el detalle muestra préstamos, motivo y bitácora', async () => {
    lista().flush(sobre(pagina([convenio()])));
    await esperar();
    await abrirDetalle(detalle());

    const dialogo = texto('dialog');
    expect(dialogo).toContain('Convenio CV-000124');
    expect(dialogo).toContain('Sin interés');
    expect(dialogo).toContain('Ana Sofía López Ruiz');
    expect(dialogo).toContain('Vencido');
    expect(dialogo).toContain('cobranza1@ejemplo.mx');
    expect(dialogo).toContain('desde 192.168.1.20');
    expect(boton('Cancelar convenio')).toBeTruthy();
  });

  it('si el back dice que no se puede cancelar, no ofrece el botón y explica por qué', async () => {
    lista().flush(sobre(pagina([convenio()])));
    await esperar();
    await abrirDetalle(
      detalle({
        puedeCancelar: false,
        pagosRegistrados: 2,
        motivoNoCancelable:
          'No se puede cancelar: el préstamo del convenio ya tiene 2 pagos registrados.',
      }),
    );

    expect(texto('dialog')).toContain('ya tiene 2 pagos registrados');
    expect(() => boton('Cancelar convenio')).toThrow();
  });

  it('cancela con el motivo y vuelve a pedir la lista y el detalle', async () => {
    lista().flush(sobre(pagina([convenio()])));
    await esperar();
    await abrirDetalle(detalle());
    boton('Cancelar convenio').click();
    await esperar();

    boton('Sí, cancelar convenio').click();
    await esperar();
    expect(texto('#f-motivo-cancelar-ayuda')).toContain('Escribe el motivo');
    http.expectNone(CANCELAR);

    const motivo = pantalla.querySelector<HTMLTextAreaElement>('#f-motivo-cancelar');
    if (!motivo) throw new Error('No hay motivo');
    motivo.value = 'La clienta no aceptó las condiciones.';
    motivo.dispatchEvent(new Event('input'));
    await esperar();
    boton('Sí, cancelar convenio').click();
    const peticion = http.expectOne(CANCELAR);
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual({ motivo: 'La clienta no aceptó las condiciones.' });
    peticion.flush(
      sobre(detalle({ convenio: convenio({ estado: 'CANCELADO', estatus: 'CANCELADO' }) })),
    );
    await esperar();

    expect(TestBed.inject(AvisosService).aviso()?.mensaje).toContain('CV-000124 cancelado');
    http.expectOne(`${LISTA}/124`).flush(sobre(detalle()));
    lista().flush(sobre(pagina([])));
    await esperar();
  });

  it('imprime el convenio con la misma hoja de la simulación', async () => {
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    lista().flush(sobre(pagina([convenio()])));
    await esperar();
    await abrirDetalle(detalle());

    boton('Imprimir convenio').click();

    expect(imprimir).toHaveBeenCalledOnce();
    const hoja = texto('app-hoja-simulacion');
    expect(hoja).toContain('Convenio de pago');
    expect(hoja).toContain('Préstamos que se convienen');
    expect(hoja).not.toContain('Interés =');
  });
});
