/*
 * Préstamos armados a partir de las cuotas de `GET /operaciones-prestamos/buscar-ep/todo`.
 * El back devuelve una fila por cuota; aquí se agrupan por `idCalculadoraPrestamo`.
 * Contrato y pendientes en docs/API-PRESTAMOS.md.
 */

/** Cuota tal como llega del back. */
export interface CuotaRespuesta {
  id: number;
  clienteResponse: { idCliente: number; nombreCompleto: string } | null;
  modalidadResponse: { idModalidad: number; descripcion: string } | null;
  numeroCuota: number;
  fechaVencimiento: string;
  /** El back lo manda como número (double); se convierte a centavos al leerlo. */
  importeCuota: number | string;
  fechaPago: string | null;
  estadoPago: number | null;
  diasMoratorios: number | null;
  alerta: string | null;
  idCalculadoraPrestamo: number;
}

export type EstadoCuota = 'pagada' | 'vencida' | 'pendiente';
export type EstadoPrestamo = 'liquidado' | 'atraso' | 'corriente';

export interface Cuota {
  id: number;
  numero: number;
  fechaVencimiento: string;
  importeCent: number;
  fechaPago: string | undefined;
  estado: EstadoCuota;
}

export interface Prestamo {
  id: number;
  idCliente: number;
  cliente: string;
  modalidad: string;
  cuotas: Cuota[];
  totalCent: number;
  saldoCent: number;
  pagadas: number;
  vencidas: number;
  /** Primera cuota sin pagar. */
  proxima: Cuota | undefined;
  estado: EstadoPrestamo;
}

function aCentavos(valor: number | string): number {
  const numero = typeof valor === 'string' ? Number(valor) : valor;
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

/** Estado de una cuota según su fecha de pago y vencimiento (`hoy` en `yyyy-MM-dd`). */
export function estadoCuota(
  c: Pick<CuotaRespuesta, 'fechaPago' | 'fechaVencimiento'>,
  hoy: string,
): EstadoCuota {
  if (c.fechaPago) return 'pagada';
  return c.fechaVencimiento < hoy ? 'vencida' : 'pendiente';
}

/** Agrupa las cuotas en préstamos, del más reciente al más antiguo. */
export function agruparPrestamos(filas: readonly CuotaRespuesta[], hoy: string): Prestamo[] {
  const grupos = new Map<number, CuotaRespuesta[]>();
  for (const fila of filas) {
    const grupo = grupos.get(fila.idCalculadoraPrestamo);
    if (grupo) grupo.push(fila);
    else grupos.set(fila.idCalculadoraPrestamo, [fila]);
  }

  return [...grupos.entries()]
    .map(([id, grupo]) => {
      const cuotas = grupo
        .map<Cuota>((f) => ({
          id: f.id,
          numero: f.numeroCuota,
          fechaVencimiento: f.fechaVencimiento,
          importeCent: aCentavos(f.importeCuota),
          fechaPago: f.fechaPago ?? undefined,
          estado: estadoCuota(f, hoy),
        }))
        .sort((a, b) => a.numero - b.numero);
      const primera = grupo[0];
      const pendientes = cuotas.filter((c) => c.estado !== 'pagada');
      const vencidas = pendientes.filter((c) => c.estado === 'vencida').length;
      const estado: EstadoPrestamo =
        pendientes.length === 0 ? 'liquidado' : vencidas > 0 ? 'atraso' : 'corriente';
      return {
        id,
        idCliente: primera?.clienteResponse?.idCliente ?? 0,
        cliente: primera?.clienteResponse?.nombreCompleto ?? 'Sin cliente',
        modalidad: primera?.modalidadResponse?.descripcion ?? '—',
        cuotas,
        totalCent: cuotas.reduce((suma, c) => suma + c.importeCent, 0),
        saldoCent: pendientes.reduce((suma, c) => suma + c.importeCent, 0),
        pagadas: cuotas.length - pendientes.length,
        vencidas,
        proxima: pendientes[0],
        estado,
      };
    })
    .sort((a, b) => b.id - a.id);
}
