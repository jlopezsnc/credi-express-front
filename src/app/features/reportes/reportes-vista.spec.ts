import { aCsv } from '@/core/csv';
import type { ReporteCartera, ReporteCobranza } from '@/features/reportes/reportes-api';
import {
  barraHorizontal,
  barras,
  columnas,
  csvCartera,
  csvCobranza,
  errorPeriodo,
  LIENZO,
  periodoRapido,
} from '@/features/reportes/reportes-vista';

describe('periodos', () => {
  // Jueves 30 de octubre de 2026.
  const HOY = '2026-10-30';

  it('arma los periodos rápidos', () => {
    expect(periodoRapido('hoy', HOY)).toEqual({ desde: HOY, hasta: HOY });
    expect(periodoRapido('semana', HOY)).toEqual({ desde: '2026-10-26', hasta: HOY });
    expect(periodoRapido('mes', HOY)).toEqual({ desde: '2026-10-01', hasta: HOY });
    expect(periodoRapido('mes-anterior', HOY)).toEqual({
      desde: '2026-09-01',
      hasta: '2026-09-30',
    });
    expect(periodoRapido('mes-anterior', '2026-03-15')).toEqual({
      desde: '2026-02-01',
      hasta: '2026-02-28',
    });
  });

  it('la semana de un lunes empieza ese mismo día', () => {
    expect(periodoRapido('semana', '2026-10-26').desde).toBe('2026-10-26');
  });

  it('valida el periodo igual que el back', () => {
    expect(errorPeriodo({ desde: '2026-08-01', hasta: '2026-10-31' })).toBe('');
    expect(errorPeriodo({ desde: '2026-07-31', hasta: '2026-10-31' })).toContain('92 días');
    expect(errorPeriodo({ desde: '2026-10-30', hasta: '2026-10-01' })).toContain('posterior');
    expect(errorPeriodo({ desde: '', hasta: '2026-10-01' })).toContain('dos fechas');
  });
});

describe('gráficas', () => {
  it('escala al valor mayor y lo marca', () => {
    const resultado = barras([50, 200, 100], (v) => v);
    expect(resultado.map((b) => b.porcentaje)).toEqual([25, 100, 50]);
    expect(resultado.map((b) => b.mayor)).toEqual([false, true, false]);
    expect(barras([0, 0], (v) => v).every((b) => b.porcentaje === 0 && !b.mayor)).toBe(true);
  });

  it('las columnas no pasan de 24 de grueso y crecen desde la base', () => {
    const [unica] = columnas([100]);
    expect(unica?.slot).toBe(LIENZO.ancho);
    // Base recta en el alto del lienzo; punta en y = 0.
    expect(unica?.d).toMatch(new RegExp(`^M308,${String(LIENZO.alto)}V4Q308,0 312,0H328`));
    expect(columnas([0])[0]?.d).toBe('');
  });

  it('la barra horizontal tiene base recta y punta redondeada', () => {
    expect(barraHorizontal(50)).toBe('M0,0H196Q200,0 200,4V16Q200,20 196,20H0Z');
    expect(barraHorizontal(0)).toBe('');
  });
});

describe('CSV', () => {
  it('lleva BOM, escapa comillas y comas, y neutraliza fórmulas', () => {
    const csv = aCsv(
      ['Nombre', 'Nota'],
      [
        ['PÉREZ, ANA', '=HYPERLINK("x")'],
        ['"Pepe"', null],
      ],
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe(
      'Nombre,Nota\r\n"PÉREZ, ANA","\'=HYPERLINK(""x"")"\r\n"""Pepe""",\r\n',
    );
  });

  it('los números no se alteran', () => {
    expect(aCsv(['n'], [[-5]]).slice(1)).toBe('n\r\n-5\r\n');
  });

  it('exporta la cobranza con una fila por operación', () => {
    const reporte = {
      operaciones: [
        {
          folio: 'P-000240',
          fechaRegistro: '2026-10-30T11:02:00-06:00',
          fechaPago: '2026-10-30',
          cliente: { idCliente: 1, nombreCompleto: 'ANA RUIZ', telefono: null },
          idPrestamo: 12,
          cuotaInicial: 7,
          cuotaFinal: 8,
          totalCuotas: 8,
          tipo: 'LIQUIDACION',
          metodoPago: 'EFECTIVO',
          referencia: null,
          importe: '1820.00',
          recargo: '0.00',
          totalRecibido: '1820.00',
          registradoPor: 'cobrador@ejemplo.com',
          estatus: 'VIGENTE',
        },
      ],
    } as unknown as ReporteCobranza;
    const filas = csvCobranza(reporte).slice(1).split('\r\n');
    expect(filas[0]).toContain('Folio,Fecha de registro');
    expect(filas[1]).toBe(
      'P-000240,2026-10-30T11:02:00-06:00,2026-10-30,ANA RUIZ,12,Pagos 7 a 8 de 8,Liquidación,Efectivo,,1820.00,0.00,1820.00,cobrador@ejemplo.com,Vigente',
    );
  });

  it('exporta la cartera vencida por cliente', () => {
    const reporte = {
      clientesConAtraso: [
        {
          cliente: { idCliente: 1, nombreCompleto: 'ANA RUIZ', telefono: '9930000000' },
          prestamos: 1,
          cuotasVencidas: 2,
          saldoVencido: '1400.00',
          saldoTotal: '2400.00',
          diasMaximoAtraso: 45,
          vencimientoMasAntiguo: '2026-09-15',
        },
      ],
    } as unknown as ReporteCartera;
    expect(csvCartera(reporte).slice(1).split('\r\n')[1]).toBe(
      'ANA RUIZ,9930000000,1,2,1400.00,2400.00,45,2026-09-15',
    );
  });
});
