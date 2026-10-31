import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { errorInterceptor } from '@/core/api/error.interceptor';
import type { DatosCliente } from '@/features/clientes/cliente';
import {
  aCliente,
  type ClienteRespuesta,
  ClientesService,
} from '@/features/clientes/clientes.service';

const LISTA = '/api/operaciones-cliente/cliente-lst';

// Tomado de una respuesta real de cliente-lst.
const RESPUESTA: ClienteRespuesta[] = [
  {
    idCliente: 7,
    nombreCompleto: 'JUAN CORDOVA CORDOVA',
    curp: 'CORJ101020MTCPRR06',
    telefono: '9171007543',
    correoElectronico: null,
    domicilioCalle: null,
    domicilioColonia: null,
    domicilioCiudad: 'HUIMANGUILLO',
  },
];

/** Así envuelve el back sus respuestas. */
function sobre(clientes: ClienteRespuesta[]) {
  return {
    objetoResponse: clientes,
    httpStatus: 'OK',
    mensaje: `${String(clientes.length)} registros encontrados.`,
  };
}

const NUEVO: DatosCliente = {
  nombreCompleto: 'Juan Córdova Córdova',
  curp: 'CORJ101020MTCPRR06',
  telefono: '9171007543',
  correoElectronico: '',
  domicilioCalle: '',
  domicilioColonia: '',
  domicilioCiudad: 'Huimanguillo',
};

describe('aCliente', () => {
  it('rellena los campos nulos y toma al cliente como activo si no llega estatusCliente', () => {
    const cliente = aCliente(RESPUESTA[0] as ClienteRespuesta);
    expect(cliente.id).toBe(7);
    expect(cliente.correoElectronico).toBe('');
    expect(cliente.activo).toBe(true);
    expect(cliente.prestamosActivos).toBeUndefined();
  });

  it('un cliente migrado sin CURP queda con CURP vacía', () => {
    const base = RESPUESTA[0] as ClienteRespuesta;
    expect(aCliente({ ...base, curp: null }).curp).toBe('');
  });

  it('lee estatusCliente cuando el back lo envía', () => {
    const base = RESPUESTA[0] as ClienteRespuesta;
    expect(aCliente({ ...base, estatusCliente: 'INACTIVO' }).activo).toBe(false);
    expect(aCliente({ ...base, estatusCliente: 'ACTIVO' }).activo).toBe(true);
  });
});

describe('ClientesService', () => {
  let servicio: ClientesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    servicio = TestBed.inject(ClientesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('carga la lista desde el back', async () => {
    const carga = servicio.cargar();
    expect(servicio.cargando()).toBe(true);
    http.expectOne(LISTA).flush(sobre(RESPUESTA));
    await carga;
    expect(servicio.cargando()).toBe(false);
    expect(servicio.clientes().map((c) => c.nombreCompleto)).toEqual(['JUAN CORDOVA CORDOVA']);
  });

  it('muestra el mensaje del back si la carga falla', async () => {
    const carga = servicio.cargar();
    http
      .expectOne(LISTA)
      .flush(
        { objetoResponse: null, httpStatus: 'FORBIDDEN', mensaje: 'Sin acceso' },
        { status: 403, statusText: 'Forbidden' },
      );
    await carga;
    expect(servicio.error()).toBe('No tienes permiso para hacer esta operación.');
  });

  it('agrega con POST y vuelve a cargar la lista', async () => {
    const alta = servicio.agregar(NUEVO);
    const post = http.expectOne('/api/operaciones-cliente/cliente-agregar');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(NUEVO);
    post.flush({});
    await Promise.resolve();
    http.expectOne(LISTA).flush(sobre(RESPUESTA));
    await alta;
    expect(servicio.existeCurp('CORJ101020MTCPRR06')).toBe(true);
    expect(servicio.existeCurp('CORJ101020MTCPRR06', 7)).toBe(false);
  });
});
