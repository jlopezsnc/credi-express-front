import {
  aDecimal,
  calcularPrestamo,
  fechaDePago,
  hoyIso,
  leerDecimal,
  periodicidad,
  textoPorcentaje,
} from '@/features/prestamos/calculo-prestamo';

describe('calcularPrestamo', () => {
  const semanal = periodicidad('semanal');
  const quincenal = periodicidad('quincenal');

  it('cobra el interés mensual por cada mes del plazo (12 semanas = 3 meses)', () => {
    const c = calcularPrestamo({ periodicidad: semanal, plazos: 12, monto: 6000, tasaMensual: 12 });
    expect(c.meses).toBe(3);
    expect(aDecimal(c.interesCent)).toBe('2160.00');
    expect(aDecimal(c.totalCent)).toBe('8160.00');
    expect(aDecimal(c.cuotaCent)).toBe('680.00');
    expect(c.ultimaCent).toBe(c.cuotaCent);
  });

  it('cuenta dos quincenas por mes (8 quincenas = 4 meses)', () => {
    const c = calcularPrestamo({
      periodicidad: quincenal,
      plazos: 8,
      monto: 6000,
      tasaMensual: 12,
    });
    expect(c.meses).toBe(4);
    expect(aDecimal(c.totalCent)).toBe('8880.00');
    expect(aDecimal(c.cuotaCent)).toBe('1110.00');
  });

  it('el último pago absorbe el ajuste de centavos', () => {
    const c = calcularPrestamo({
      periodicidad: quincenal,
      plazos: 14,
      monto: 6000,
      tasaMensual: 12,
    });
    expect(aDecimal(c.totalCent)).toBe('11040.00');
    expect(aDecimal(c.cuotaCent)).toBe('788.57');
    expect(aDecimal(c.ultimaCent)).toBe('788.59');
    expect(c.cuotaCent * 13 + c.ultimaCent).toBe(c.totalCent);
  });

  it('acepta tasas con decimales', () => {
    const c = calcularPrestamo({
      periodicidad: semanal,
      plazos: 16,
      monto: 1000.5,
      tasaMensual: 7.5,
    });
    // 1,000.50 × 7.5% × 4 meses = 300.15
    expect(aDecimal(c.interesCent)).toBe('300.15');
  });
});

describe('leerDecimal', () => {
  it('lee montos y porcentajes con separadores', () => {
    expect(leerDecimal('6,000.50')).toBe(6000.5);
    expect(leerDecimal('$ 1500')).toBe(1500);
    expect(leerDecimal('12 %')).toBe(12);
  });

  it('rechaza texto, negativos y más de dos decimales', () => {
    expect(leerDecimal('abc')).toBeNaN();
    expect(leerDecimal('-5')).toBeNaN();
    expect(leerDecimal('1.234')).toBeNaN();
    expect(leerDecimal('')).toBeNaN();
  });
});

describe('fechas y textos', () => {
  it('suma 7 o 15 días por pago', () => {
    expect(fechaDePago('2026-12-28', periodicidad('semanal'), 1)).toBe('2027-01-04');
    expect(fechaDePago('2026-02-10', periodicidad('quincenal'), 2)).toBe('2026-03-12');
  });

  it('da la fecha local como yyyy-MM-dd', () => {
    expect(hoyIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('formatea porcentajes sin ceros de más', () => {
    expect(textoPorcentaje(12)).toBe('12%');
    expect(textoPorcentaje(36.5)).toBe('36.5%');
  });
});
