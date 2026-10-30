/**
 * Datos que se capturan en el alta/edición. Los nombres coinciden con el back
 * (`POST /operaciones-cliente/cliente-agregar`).
 */
export interface DatosCliente {
  nombreCompleto: string;
  curp: string;
  telefono: string;
  correoElectronico: string;
  domicilioCalle: string;
  domicilioColonia: string;
  domicilioCiudad: string;
}

/** Cliente como se muestra en la lista. Los clientes no se eliminan: se dan de baja (inactivos). */
export interface Cliente extends DatosCliente {
  id: number;
  activo: boolean;
  /** Resumen de préstamos: opcional hasta que el back lo incluya en la lista. */
  prestamosActivos?: number;
  /** Decimal en texto, como lo envía el back (BigDecimal). */
  saldoPendiente?: string;
  conAtraso?: boolean;
}
