import {
  type CapturaPago,
  errorFecha,
  errorImporte,
  errorRecargo,
  errorReferencia,
  leerImporte,
  nuevaLlave,
  peticionLiquidacion,
  peticionPago,
  textoImporte,
} from '@/features/cobranza/captura-pago';

const CAPTURA: CapturaPago = {
  importe: '1,110.00',
  recargo: '50',
  metodo: 'TRANSFERENCIA',
  referencia: '  0045821933 ',
  fecha: '2026-10-29',
  nota: '   ',
};

describe('leerImporte', () => {
  it('acepta importes con o sin separador de miles', () => {
    expect(leerImporte('1110')).toBe(111000);
    expect(leerImporte('1,110.5')).toBe(111050);
    expect(leerImporte('$ 12,345.67')).toBe(1234567);
    expect(leerImporte('788.57')).toBe(78857);
  });

  it('rechaza comas mal puestas, letras y más de dos decimales', () => {
    expect(leerImporte('1,11')).toBeNaN();
    expect(leerImporte('11,10.00')).toBeNaN();
    expect(leerImporte('abc')).toBeNaN();
    expect(leerImporte('10.123')).toBeNaN();
    expect(leerImporte('-5')).toBeNaN();
  });

  it('formatea con separador de miles al salir del campo', () => {
    expect(textoImporte(111000)).toBe('1,110.00');
    expect(textoImporte(5)).toBe('0.05');
  });
});

describe('validaciones del pago', () => {
  it('el importe es obligatorio, mayor a cero y hasta el saldo', () => {
    expect(errorImporte('', 71000)).toBe('Captura el importe recibido.');
    expect(errorImporte('0', 71000)).toBe('El importe debe ser mayor a cero.');
    expect(errorImporte('710.01', 71000)).toBe('No puede ser mayor al saldo de la cuota.');
    expect(errorImporte('7.1.0', 71000)).toContain('importe válido');
    expect(errorImporte('710', 71000)).toBe('');
  });

  it('el recargo es opcional', () => {
    expect(errorRecargo('')).toBe('');
    expect(errorRecargo('50.00')).toBe('');
    expect(errorRecargo('cincuenta')).toContain('recargo válido');
  });

  it('pide referencia salvo en efectivo', () => {
    expect(errorReferencia('EFECTIVO', '')).toBe('');
    expect(errorReferencia('DEPOSITO', ' ')).toBe('Captura la referencia del pago.');
  });

  it('la fecha va de hace 30 días a hoy', () => {
    expect(errorFecha('2026-10-30', '2026-10-30')).toBe('');
    expect(errorFecha('2026-09-30', '2026-10-30')).toBe('');
    expect(errorFecha('2026-10-31', '2026-10-30')).toBe('La fecha no puede ser posterior a hoy.');
    expect(errorFecha('2026-09-29', '2026-10-30')).toContain('últimos 30 días');
    expect(errorFecha('', '2026-10-30')).toBe('Elige la fecha del pago.');
  });
});

describe('peticiones', () => {
  it('arma el pago con el dinero como texto y los textos recortados', () => {
    expect(peticionPago(101, CAPTURA, true)).toEqual({
      idCuota: 101,
      importe: '1110.00',
      recargo: '50.00',
      fechaPago: '2026-10-29',
      metodoPago: 'TRANSFERENCIA',
      referencia: '0045821933',
      nota: null,
    });
  });

  it('sin atraso no envía recargo; en efectivo no envía referencia', () => {
    const peticion = peticionPago(101, { ...CAPTURA, metodo: 'EFECTIVO' }, false);
    expect(peticion.recargo).toBe('0.00');
    expect(peticion.referencia).toBeNull();
  });

  it('la liquidación usa el saldo total como importe', () => {
    const peticion = peticionLiquidacion(12, '6260.00', { ...CAPTURA, importe: '' }, true);
    expect(peticion).toMatchObject({ idPrestamo: 12, importe: '6260.00', recargo: '50.00' });
  });
});

describe('nuevaLlave', () => {
  it('genera un UUID distinto cada vez', () => {
    const llave = nuevaLlave();
    expect(llave).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(nuevaLlave()).not.toBe(llave);
  });
});
