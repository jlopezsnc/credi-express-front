import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { mensajeDeError } from '@/core/api/api-error';
import { formatearMoneda, iniciales, normalizarTexto } from '@/core/format';
import { AvisosService } from '@/core/ui/avisos.service';
import { claseAvatar } from '@/core/ui/avatar';
import { DialogoModal } from '@/core/ui/dialogo-modal';
import { Icono } from '@/core/ui/icono';
import type { Cliente, DatosCliente } from '@/features/clientes/cliente';
import { ClienteForm } from '@/features/clientes/cliente-form';
import { ClientesService } from '@/features/clientes/clientes.service';

type Filtro = 'activos' | 'inactivos' | 'todos';

// Los filtros por préstamo (con atraso, sin préstamo) vuelven cuando el back envíe ese resumen.
const FILTROS: readonly { id: Filtro; etiqueta: string; aplica: (c: Cliente) => boolean }[] = [
  { id: 'activos', etiqueta: 'Activos', aplica: (c) => c.activo },
  { id: 'inactivos', etiqueta: 'Inactivos', aplica: (c) => !c.activo },
  { id: 'todos', etiqueta: 'Todos', aplica: () => true },
];

/** Lo que la tabla y las tarjetas muestran de cada cliente, ya formateado. */
interface FilaCliente {
  cliente: Cliente;
  iniciales: string;
  avatar: string;
  estado: { texto: string; clase: string };
  prestamosNumero: string;
  prestamos: string;
  saldo: string;
}

function textoPrestamos(cantidad: number): string {
  if (cantidad === 0) return 'Sin préstamos';
  return cantidad === 1 ? '1 préstamo activo' : `${String(cantidad)} préstamos activos`;
}

function estadoDe(c: Cliente): { texto: string; clase: string } {
  if (!c.activo) return { texto: 'Inactivo', clase: 'bg-neutro-soft text-neutro' };
  if (c.conAtraso) return { texto: 'Con atraso', clase: 'bg-atraso-soft text-atraso' };
  if (c.prestamosActivos === 0)
    return { texto: 'Sin préstamo', clase: 'bg-neutro-soft text-neutro' };
  if (c.prestamosActivos !== undefined)
    return { texto: 'Al corriente', clase: 'bg-ok-soft text-ok' };
  return { texto: 'Activo', clase: 'bg-ok-soft text-ok' };
}

/** Catálogo de clientes: búsqueda, filtros, alta, edición, baja y reactivación. */
@Component({
  selector: 'app-clientes',
  imports: [ClienteForm, DialogoModal, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './clientes.html',
})
export class Clientes {
  protected readonly servicio = inject(ClientesService);
  private readonly avisos = inject(AvisosService);

  protected readonly busqueda = signal('');
  protected readonly filtro = signal<Filtro>('activos');
  /** `null` = diálogo de alta abierto; un cliente = edición; `undefined` = cerrado. */
  protected readonly enFormulario = signal<Cliente | null | undefined>(undefined);
  protected readonly aDarDeBaja = signal<Cliente | undefined>(undefined);
  /** Hay una operación en curso con el back (guardar, baja o reactivar). */
  protected readonly ocupado = signal(false);
  protected readonly errorFormulario = signal<string | undefined>(undefined);

  protected readonly total = computed(() => this.servicio.clientes().length);
  /** Primera carga: todavía no hay nada que mostrar. */
  protected readonly cargandoInicial = computed(
    () => this.servicio.cargando() && this.total() === 0,
  );

  protected readonly filtros = computed(() =>
    FILTROS.map((f) => ({
      id: f.id,
      etiqueta: f.etiqueta,
      cantidad: this.servicio.clientes().filter(f.aplica).length,
    })),
  );

  protected readonly filas = computed<FilaCliente[]>(() => {
    const filtro = FILTROS.find((f) => f.id === this.filtro());
    const consulta = normalizarTexto(this.busqueda().trim());
    return this.servicio
      .clientes()
      .filter((c) => filtro?.aplica(c) ?? true)
      .filter(
        (c) =>
          consulta === '' ||
          normalizarTexto(c.nombreCompleto).includes(consulta) ||
          c.curp.toLowerCase().includes(consulta),
      )
      .map((c) => ({
        cliente: c,
        iniciales: iniciales(c.nombreCompleto),
        avatar: claseAvatar(c.id),
        estado: estadoDe(c),
        prestamosNumero: c.prestamosActivos === undefined ? '—' : String(c.prestamosActivos),
        prestamos: c.prestamosActivos === undefined ? '' : textoPrestamos(c.prestamosActivos),
        saldo:
          c.saldoPendiente !== undefined && Number(c.saldoPendiente) > 0
            ? formatearMoneda(c.saldoPendiente)
            : '—',
      }));
  });

  protected readonly textoBaja = computed(() => {
    const cliente = this.aDarDeBaja();
    if (!cliente) return '';
    if (cliente.prestamosActivos) {
      const saldo = cliente.saldoPendiente ? formatearMoneda(cliente.saldoPendiente) : '—';
      return (
        `${cliente.nombreCompleto} tiene ${textoPrestamos(cliente.prestamosActivos)} con saldo ` +
        `pendiente de ${saldo}. Liquida o cancela sus préstamos antes de darlo de baja.`
      );
    }
    return (
      `${cliente.nombreCompleto} quedará inactivo: no se le podrán otorgar préstamos nuevos. ` +
      'Su historial se conserva y puedes reactivarlo cuando quieras.'
    );
  });

  constructor() {
    void this.servicio.cargar();
  }

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected abrirFormulario(cliente: Cliente | null): void {
    this.errorFormulario.set(undefined);
    this.enFormulario.set(cliente);
  }

  protected cerrarFormulario(): void {
    if (!this.ocupado()) this.enFormulario.set(undefined);
  }

  protected async guardar(datos: DatosCliente): Promise<void> {
    const cliente = this.enFormulario();
    this.ocupado.set(true);
    this.errorFormulario.set(undefined);
    try {
      if (cliente) {
        await this.servicio.actualizar(cliente.id, datos);
        this.avisos.mostrar(`Cambios guardados: ${datos.nombreCompleto}`);
      } else {
        await this.servicio.agregar(datos);
        // Que el cliente nuevo quede a la vista.
        this.busqueda.set('');
        this.filtro.set('activos');
        this.avisos.mostrar(`Cliente agregado: ${datos.nombreCompleto}`);
      }
      this.enFormulario.set(undefined);
    } catch (error) {
      this.errorFormulario.set(mensajeDeError(error, 'No se pudo guardar el cliente.'));
    } finally {
      this.ocupado.set(false);
    }
  }

  protected cerrarBaja(): void {
    if (!this.ocupado()) this.aDarDeBaja.set(undefined);
  }

  protected async confirmarBaja(cliente: Cliente): Promise<void> {
    this.ocupado.set(true);
    try {
      await this.servicio.darDeBaja(cliente.id);
      this.avisos.mostrar(`Cliente dado de baja: ${cliente.nombreCompleto}`);
    } catch (error) {
      this.avisos.error(mensajeDeError(error, 'No se pudo dar de baja al cliente.'));
    } finally {
      this.ocupado.set(false);
      this.aDarDeBaja.set(undefined);
    }
  }

  protected async reactivar(cliente: Cliente): Promise<void> {
    this.ocupado.set(true);
    try {
      await this.servicio.reactivar(cliente.id);
      this.avisos.mostrar(`Cliente reactivado: ${cliente.nombreCompleto}`);
    } catch (error) {
      this.avisos.error(mensajeDeError(error, 'No se pudo reactivar al cliente.'));
    } finally {
      this.ocupado.set(false);
    }
  }
}
