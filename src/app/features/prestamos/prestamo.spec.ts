import { agruparPrestamos, type CuotaRespuesta } from '@/features/prestamos/prestamo';

function cuota(
  id: number,
  idPrestamo: number,
  numero: number,
  fechaVencimiento: string,
  extra: Partial<CuotaRespuesta> = {},
): CuotaRespuesta {
  return {
    id,
    clienteResponse: { idCliente: idPrestamo, nombreCompleto: `CLIENTE ${String(idPrestamo)}` },
    modalidadResponse: { idModalidad: 1, descripcion: 'Semanal' },
    numeroCuota: numero,
    fechaVencimiento,
    importeCuota: 840.0,
    fechaPago: null,
    estadoPago: null,
    diasMoratorios: null,
    alerta: 'VIGENTE',
    idCalculadoraPrestamo: idPrestamo,
    ...extra,
  };
}

const HOY = '2026-02-10';

describe('agruparPrestamos', () => {
  it('junta las cuotas por idCalculadoraPrestamo, ordenadas por número', () => {
    const prestamos = agruparPrestamos(
      [cuota(3, 1, 2, '2026-02-07'), cuota(9, 2, 1, '2026-03-01'), cuota(2, 1, 1, '2026-01-31')],
      HOY,
    );
    expect(prestamos.map((p) => p.id)).toEqual([2, 1]); // el más reciente primero
    expect(prestamos[1]?.cuotas.map((c) => c.numero)).toEqual([1, 2]);
    expect(prestamos[1]?.cliente).toBe('CLIENTE 1');
  });

  it('suma total y saldo en centavos y marca el atraso', () => {
    const [p] = agruparPrestamos(
      [
        cuota(1, 5, 1, '2026-01-31', { fechaPago: '2026-01-31' }),
        cuota(2, 5, 2, '2026-02-07'),
        cuota(3, 5, 3, '2026-02-14', { importeCuota: '840.10' }),
      ],
      HOY,
    );
    expect(p?.totalCent).toBe(252010);
    expect(p?.saldoCent).toBe(168010);
    expect(p?.pagadas).toBe(1);
    expect(p?.vencidas).toBe(1);
    expect(p?.estado).toBe('atraso');
    expect(p?.proxima?.numero).toBe(2);
    expect(p?.cuotas.map((c) => c.estado)).toEqual(['pagada', 'vencida', 'pendiente']);
  });

  it('distingue préstamos al corriente y liquidados', () => {
    const prestamos = agruparPrestamos(
      [cuota(1, 1, 1, '2026-02-20'), cuota(2, 2, 1, '2026-01-01', { fechaPago: '2026-01-01' })],
      HOY,
    );
    expect(prestamos.find((p) => p.id === 1)?.estado).toBe('corriente');
    const liquidado = prestamos.find((p) => p.id === 2);
    expect(liquidado?.estado).toBe('liquidado');
    expect(liquidado?.saldoCent).toBe(0);
    expect(liquidado?.proxima).toBeUndefined();
  });
});
