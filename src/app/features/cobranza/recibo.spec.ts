import type { Liquidacion, Pago, SaldoPrestamo } from '@/features/cobranza/cobranza-api';
import {
  nombreArchivo,
  rangoPagos,
  reciboDeLiquidacion,
  reciboDeOperacion,
  reciboDePago,
} from '@/features/cobranza/recibo';

// Datos ficticios.
const CLIENTE = { idCliente: 2, nombreCompleto: 'JOSÉ ANTONIO HERNÁNDEZ CRUZ', telefono: null };

function pago(cambios: Partial<Pago> = {}): Pago {
  return {
    idPago: 233,
    folio: 'P-000233',
    idCuota: 101,
    idPrestamo: 12,
    cliente: CLIENTE,
    numeroCuota: 2,
    totalCuotas: 8,
    importe: '710.00',
    recargo: '0.00',
    totalRecibido: '710.00',
    fechaPago: '2026-10-29',
    metodoPago: 'EFECTIVO',
    referencia: null,
    nota: null,
    tipo: 'CUOTA_COMPLETA',
    saldoCuota: '0.00',
    cuotaLiquidada: true,
    prestamoLiquidado: false,
    registradoPor: 'cobrador@ejemplo.com',
    fechaRegistro: '2026-10-29T10:15:00-06:00',
    estatus: 'VIGENTE',
    canceladoPor: null,
    fechaCancelacion: null,
    motivoCancelacion: null,
    ...cambios,
  };
}

const SALDO: SaldoPrestamo = {
  idPrestamo: 12,
  cliente: CLIENTE,
  modalidad: { idModalidad: 2, descripcion: 'Quincenal' },
  totalCuotas: 8,
  cuotasPendientes: 2,
  saldoTotal: '1820.00',
  hayCuotasVencidas: false,
  cuotas: [],
};

const LIQUIDACION: Liquidacion = {
  folio: 'P-000240',
  idPrestamo: 12,
  cliente: CLIENTE,
  cuotasLiquidadas: 2,
  importe: '1820.00',
  recargo: '150.00',
  totalRecibido: '1970.00',
  fechaPago: '2026-10-30',
  metodoPago: 'TRANSFERENCIA',
  referencia: '998877',
  nota: null,
  pagos: [
    { idPago: 241, idCuota: 108, numeroCuota: 8, importe: '1110.00' },
    { idPago: 240, idCuota: 107, numeroCuota: 7, importe: '710.00' },
  ],
  prestamoLiquidado: true,
  clienteSinAdeudos: true,
  registradoPor: 'cobrador@ejemplo.com',
  fechaRegistro: '2026-10-30T11:02:00-06:00',
};

describe('nombre del archivo', () => {
  it('va sin acentos, en mayúsculas y con guiones bajos', () => {
    expect(nombreArchivo('María Fernanda López Ruiz', [2], 8)).toBe(
      'PAGO_MARIA_FERNANDA_LOPEZ_RUIZ_RECIBO_2_de_8.png',
    );
  });

  it('una liquidación lleva la primera y la última cuota', () => {
    expect(nombreArchivo('Rosa Elena Jiménez Díaz', [7, 8, 9, 10, 11, 12], 12)).toBe(
      'PAGO_ROSA_ELENA_JIMENEZ_DIAZ_RECIBO_7_a_12_de_12.png',
    );
  });

  it('describe el rango de pagos', () => {
    expect(rangoPagos([8], 8)).toBe('Pago 8 de 8');
    expect(rangoPagos([3, 4, 5], 8)).toBe('Pagos 3 a 5 de 8');
  });
});

describe('reciboDePago', () => {
  it('sin recargo muestra solo el importe recibido', () => {
    const recibo = reciboDePago(pago());
    expect(recibo.titulo).toBe('Pago registrado');
    expect(recibo.importes).toEqual([
      { etiqueta: 'Importe recibido', valor: '$710.00 MXN', fuerte: true },
    ]);
    expect(recibo.saldo).toBe('Cuota liquidada');
    expect(recibo.filas.map((f) => f.valor)).toContain('Préstamo #12 · Pago 2 de 8');
    expect(recibo.registro).toContain('29 de octubre de 2026');
    expect(recibo.archivo).toBe('PAGO_JOSE_ANTONIO_HERNANDEZ_CRUZ_RECIBO_2_de_8.png');
  });

  it('un abono parcial con recargo desglosa los importes', () => {
    const recibo = reciboDePago(
      pago({
        importe: '400.00',
        recargo: '50.00',
        totalRecibido: '450.00',
        saldoCuota: '310.00',
        cuotaLiquidada: false,
        metodoPago: 'DEPOSITO',
        referencia: 'ABC123',
      }),
    );
    expect(recibo.importes.map((i) => i.etiqueta)).toEqual([
      'Aplicado a la cuota',
      'Recargo por atraso',
      'Total recibido',
    ]);
    expect(recibo.saldo).toBe('$310.00 MXN pendientes');
    expect(recibo.liquidada).toBe(false);
    expect(recibo.filas.map((f) => f.valor)).toContain('Depósito · ABC123');
  });

  it('avisa cuando el pago liquida el préstamo', () => {
    expect(reciboDePago(pago({ prestamoLiquidado: true })).nota).toBe(
      'Con este pago el préstamo queda liquidado.',
    );
  });
});

describe('reciboDeLiquidacion', () => {
  it('usa un folio, el rango de cuotas y el total de cuotas del préstamo', () => {
    const recibo = reciboDeLiquidacion(LIQUIDACION, SALDO);
    expect(recibo.titulo).toBe('Préstamo liquidado');
    expect(recibo.folio).toBe('P-000240');
    expect(recibo.filas.map((f) => f.valor)).toContain('Pagos 7 a 8 de 8');
    expect(recibo.importes.at(-1)).toEqual({
      etiqueta: 'Total recibido',
      valor: '$1,970.00 MXN',
      fuerte: true,
    });
    expect(recibo.nota).toBe('El cliente ya no tiene adeudos.');
    expect(recibo.archivo).toBe('PAGO_JOSE_ANTONIO_HERNANDEZ_CRUZ_RECIBO_7_a_8_de_8.png');
  });

  it('avisa si el cliente tiene otro préstamo con saldo', () => {
    const recibo = reciboDeLiquidacion({ ...LIQUIDACION, clienteSinAdeudos: false }, SALDO);
    expect(recibo.nota).toBe('El cliente todavía tiene otro préstamo con saldo.');
  });
});

describe('reciboDeOperacion (reimpresión)', () => {
  it('un pago se reimprime igual que al cobrarlo', () => {
    const original = reciboDePago(pago());
    const copia = reciboDeOperacion({
      tipo: 'CUOTA_COMPLETA',
      modalidad: SALDO.modalidad,
      totalCuotas: 8,
      pago: pago(),
      liquidacion: null,
    });
    expect(copia).toEqual(original);
  });

  it('una liquidación usa la modalidad y el total del préstamo, sin la nota del momento del cobro', () => {
    const copia = reciboDeOperacion({
      tipo: 'LIQUIDACION',
      modalidad: SALDO.modalidad,
      totalCuotas: SALDO.totalCuotas,
      pago: null,
      liquidacion: { ...LIQUIDACION, clienteSinAdeudos: null },
    });
    expect(copia.filas.map((f) => f.valor)).toContain('Pagos 7 a 8 de 8');
    expect(copia.saldo).toBe('Préstamo liquidado');
    expect(copia.nota).toBe('');
    expect(copia.archivo).toBe('PAGO_JOSE_ANTONIO_HERNANDEZ_CRUZ_RECIBO_7_a_8_de_8.png');
  });
});
