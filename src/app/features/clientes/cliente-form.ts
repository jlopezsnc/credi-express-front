import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  type OnInit,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { formatearFecha } from '@/core/format';
import { DialogoModal } from '@/core/ui/dialogo-modal';
import { Icono } from '@/core/ui/icono';
import {
  curpValidator,
  esCurpValida,
  extraerDatosCurp,
  normalizarCurp,
} from '@/core/validation/curp';
import type { Cliente, DatosCliente } from '@/features/clientes/cliente';
import { ClientesService } from '@/features/clientes/clientes.service';

interface AyudaCurp {
  tipo: 'neutro' | 'ok' | 'error';
  texto: string;
}

/** Al menos un carácter que no sea espacio. */
const NO_VACIO = /\S/;
/** 10 dígitos; se permiten espacios y guiones para capturarlo como "993 214 5567". */
const TELEFONO = /^\d{10}$/;

function telefonoValidator(control: AbstractControl<string>): ValidationErrors | null {
  const digitos = control.value.replace(/[\s-]/g, '');
  return digitos === '' || TELEFONO.test(digitos) ? null : { telefono: true };
}

/** Diálogo de alta y edición de clientes, con validación de la CURP mientras se escribe. */
@Component({
  selector: 'app-cliente-form',
  imports: [ReactiveFormsModule, DialogoModal, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cliente-form.html',
})
export class ClienteForm implements OnInit {
  private readonly clientes = inject(ClientesService);

  /** Cliente a editar; sin él, el diálogo es de alta. */
  readonly cliente = input<Cliente>();
  /** Mientras el back responde: bloquea el botón para no enviar dos veces. */
  readonly guardando = input(false);
  /** Error devuelto por el back al guardar. */
  readonly errorServidor = input<string>();
  readonly guardar = output<DatosCliente>();
  readonly cerrar = output();

  protected readonly enviado = signal(false);
  protected readonly editando = computed(() => this.cliente() !== undefined);

  protected readonly form = inject(NonNullableFormBuilder).group({
    nombreCompleto: ['', [Validators.required, Validators.pattern(NO_VACIO)]],
    curp: [
      '',
      [
        Validators.required,
        curpValidator,
        (control: AbstractControl<string>) =>
          this.clientes.existeCurp(normalizarCurp(control.value), this.cliente()?.id)
            ? { curpRepetida: true }
            : null,
      ],
    ],
    telefono: ['', telefonoValidator],
    correoElectronico: ['', Validators.email],
    domicilioCalle: [''],
    domicilioColonia: [''],
    domicilioCiudad: [''],
  });

  private readonly curp = toSignal(this.form.controls.curp.valueChanges, { initialValue: '' });

  protected readonly ayudaCurp = computed<AyudaCurp>(() => {
    const curp = normalizarCurp(this.curp());
    const enviado = this.enviado();
    if (curp.length < 18) {
      if (enviado) return { tipo: 'error', texto: 'Captura una CURP válida de 18 caracteres.' };
      if (curp === '') return { tipo: 'neutro', texto: 'Se valida mientras escribes.' };
      const faltan = 18 - curp.length;
      return {
        tipo: 'neutro',
        texto: `Faltan ${String(faltan)} ${faltan === 1 ? 'carácter' : 'caracteres'}.`,
      };
    }
    const datos = extraerDatosCurp(curp);
    if (!datos) return { tipo: 'error', texto: 'La CURP no tiene un formato válido.' };
    if (!esCurpValida(curp)) return { tipo: 'error', texto: 'El dígito verificador no coincide.' };
    if (this.clientes.existeCurp(curp, this.cliente()?.id)) {
      return { tipo: 'error', texto: 'Ya existe un cliente registrado con esta CURP.' };
    }
    const sexo = datos.sexo === 'H' ? 'Hombre' : 'Mujer';
    return {
      tipo: 'ok',
      texto: `CURP válida · Nació el ${formatearFecha(datos.fechaNacimiento)} · ${sexo}`,
    };
  });

  ngOnInit(): void {
    const cliente = this.cliente();
    if (cliente) this.form.reset(cliente);
  }

  protected invalido(campo: keyof typeof this.form.controls): boolean {
    return this.enviado() && this.form.controls[campo].invalid;
  }

  protected enviar(): void {
    this.enviado.set(true);
    if (this.form.invalid || this.guardando()) return;
    const valores = this.form.getRawValue();
    this.guardar.emit({
      nombreCompleto: valores.nombreCompleto.trim().replace(/\s+/g, ' '),
      curp: normalizarCurp(valores.curp),
      // Solo dígitos, como lo guarda el back ("9171007543").
      telefono: valores.telefono.replace(/[\s-]/g, ''),
      correoElectronico: valores.correoElectronico.trim(),
      domicilioCalle: valores.domicilioCalle.trim(),
      domicilioColonia: valores.domicilioColonia.trim(),
      domicilioCiudad: valores.domicilioCiudad.trim(),
    });
  }
}
