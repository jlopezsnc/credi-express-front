# API de préstamos — contrato front ↔ back

Base: `http://localhost:8080/api/operaciones-prestamos` (en el front: `apiUrl('/operaciones-prestamos/...')`).
Todas las rutas exigen `Authorization: Bearer <idToken de Firebase>`. Sobre de respuesta y errores:
los mismos de [API-CLIENTES.md](API-CLIENTES.md#convenciones).

Estado al 2026-10-30:

| Endpoint             | Estado en el back | Lo usa el front                        |
| -------------------- | ----------------- | -------------------------------------- |
| `GET prestamos` | ✅ Hecho (sin MySQL) | Lista de préstamos (`/prestamos`): estado, próximo pago y pagos calculados en el back |
| `GET prestamos/{id}` | ✅ Hecho (sin MySQL) | Calendario de un préstamo |
| `GET buscar-ep/todo` | ✅ Existe | Ya no lo usa la pantalla; se conserva por compatibilidad |
| `POST calcular-pagos` | ✅ Existe | Botón "Generar préstamo" (`/prestamos/nuevo`) |

Pantallas: `src/app/features/prestamos/prestamos.ts` (lista) y `nuevo-prestamo.ts` (alta).
Cálculo del alta: `src/app/features/prestamos/calculo-prestamo.ts`. Tipos de la lista: `prestamo.ts`.

## `GET /prestamos` ✅ (2026-10-30)

Lista de préstamos **calculada en el back**: el front no agrupa cuotas ni calcula nada. Filtro,
búsqueda, orden y paginación se resuelven en SQL (`PrestamoConsultaRepository`).

| Parámetro   | Valores                                                                  | Por defecto    |
| ----------- | ------------------------------------------------------------------------ | -------------- |
| `filtro`    | `ACTIVOS` (con saldo), `CON_ATRASO`, `LIQUIDADOS`, `TODOS`              | `ACTIVOS`      |
| `busqueda`  | Contiene, en el nombre del cliente; sin acentos ni mayúsculas; máx. 100   | —              |
| `orden`     | `CLIENTE`, `PAGOS`, `CUOTA`, `TOTAL`, `SALDO`, `PROXIMO_PAGO`, `ESTADO` | `PROXIMO_PAGO` |
| `direccion` | `ASC`, `DESC` (los vacíos —sin próximo pago— van al final en las dos)     | `ASC`          |
| `pagina`    | Desde 0                                                                  | `0`            |
| `tamano`    | 1–100                                                                    | `10`           |

Un valor fuera de la lista (p. ej. `orden=NOMBRE`) → 400 con `campos`. La columna de orden sale de un
`enum`: nunca se concatena texto del usuario al SQL.

**Cómo se calcula** (con "hoy" en hora de México):

- Saldo de una cuota = importe (FLOAT redondeado a centavos) − pagos `VIGENTE` de la tabla `pago`,
  nunca negativo; `estado_pago = 3` → 0. Es la misma regla de cobranza (`SqlCartera`).
- `cuotasPagadas`: cuotas con saldo 0. `cuotasVencidas`: con saldo y vencimiento < hoy.
- `saldoPendiente`: suma de los saldos. `totalPagar`: suma de los importes de las cuotas.
- `proximoPago` / `proximaCuota`: la primera cuota con saldo; `null` si está liquidado.
- `estado`: `LIQUIDADO` si el saldo es 0; `CON_ATRASO` si hay cuotas vencidas; si no, `AL_CORRIENTE`.
- `contadores`: cuántos préstamos hay en cada filtro, **sin** la búsqueda.

**200**

```json
{
  "objetoResponse": {
    "contenido": [
      {
        "idPrestamo": 12,
        "cliente": { "idCliente": 2, "nombreCompleto": "JOSÉ ANTONIO HERNÁNDEZ CRUZ", "telefono": null },
        "modalidad": { "idModalidad": 2, "descripcion": "Quincenal" },
        "numeroCuotas": 8,
        "cuotasPagadas": 3,
        "cuotasVencidas": 1,
        "importeCuota": "1110.00",
        "totalPagar": "8880.00",
        "saldoPendiente": "5150.00",
        "proximoPago": "2026-10-17",
        "proximaCuota": 4,
        "estado": "CON_ATRASO"
      }
    ],
    "pagina": 0,
    "tamano": 10,
    "totalElementos": 1,
    "totalPaginas": 1,
    "contadores": { "activos": 11, "conAtraso": 5, "liquidados": 3, "todos": 14 }
  },
  "httpStatus": "OK",
  "mensaje": "1 registros encontrados."
}
```

## `GET /prestamos/{idPrestamo}` ✅ (2026-10-30)

Calendario del préstamo: `prestamo` (el mismo objeto de la lista) y cada cuota con lo abonado, su
saldo y su `estatus`: `PAGADA` (saldo 0), `VENCIDA` (con saldo y ya venció, tenga o no abonos),
`ABONO_PARCIAL` (con abonos, todavía no vence) o `PENDIENTE`.

```json
{
  "objetoResponse": {
    "prestamo": { "idPrestamo": 12, "estado": "CON_ATRASO", "...": "igual que en la lista" },
    "cuotas": [
      {
        "idCuota": 101,
        "numeroCuota": 2,
        "fechaVencimiento": "2026-10-17",
        "importe": "1110.00",
        "abonado": "400.00",
        "saldo": "710.00",
        "fechaPago": null,
        "estatus": "VENCIDA"
      }
    ]
  },
  "httpStatus": "OK",
  "mensaje": "Calendario del préstamo."
}
```

404 "El préstamo no existe."

Pruebas: `ConsultasCarteraSqlTest` ejecuta estas consultas en H2 (modo MySQL) con columnas de
precisión simple; falta correrlas contra MySQL real.

---

## `GET /buscar-ep/todo` ✅

Devuelve **una fila por cuota** de todos los préstamos. El front las agrupa por
`idCalculadoraPrestamo` para armar cada préstamo.

**Respuesta 200 actual**: un arreglo suelto, **sin el sobre** `{objetoResponse, httpStatus, mensaje}`.
El front acepta las dos formas, pero conviene usar el sobre como en los demás endpoints.

```json
[
  {
    "id": 649,
    "clienteResponse": { "idCliente": 1, "nombreCompleto": "…", "curp": null, "…": null },
    "modalidadResponse": { "idModalidad": 1, "descripcion": "Semanal", "informacionAdicional": null },
    "numeroCuota": 1.0,
    "fechaVencimiento": "2025-01-30",
    "importeCuota": 840.0,
    "fechaPago": null,
    "estadoPago": 1,
    "diasMoratorios": 2,
    "alerta": "VIGENTE",
    "idCalculadoraPrestamo": 1
  }
]
```

Cómo lo interpreta el front:

- Cuota **pagada** si `fechaPago` tiene fecha; **vencida** si no está pagada y `fechaVencimiento`
  ya pasó; si no, **pendiente**.
- Préstamo **liquidado** si todas sus cuotas están pagadas; **con atraso** si tiene alguna
  vencida; si no, **al corriente**.
- Total = suma de las cuotas; saldo pendiente = suma de las cuotas no pagadas.
- `estadoPago`, `diasMoratorios` y `alerta` todavía **no se usan**: llegan inconsistentes (`1`/`2`
  en unos préstamos y `null` en otros) y no está documentado qué significa cada valor.

**Mejoras propuestas** (ver [PENDIENTES.md](PENDIENTES.md)):

1. Usar el sobre de respuesta común.
2. Dinero como texto decimal (`"840.00"`, BigDecimal) en lugar de `840.0` (double), y
   `numeroCuota` como entero (`1`, no `1.0`).
3. Un endpoint de préstamos (encabezado), no de cuotas, para la lista: `idPrestamo`, cliente,
   modalidad, `importeCredito`, `tasaInteres`, `totalPagar`, `fechaInicioCredito`, cuotas
   pagadas/total, saldo pendiente, próximo vencimiento y estado. Hoy el monto prestado y la tasa
   **no llegan**, y traer todas las cuotas de todos los préstamos crecerá sin límite.
4. Paginación y filtros en el back (por cliente y por estado) cuando haya muchos préstamos.
5. Un `GET /{idPrestamo}/cuotas` para el calendario de un préstamo.
6. Documentar `estadoPago` (enum) y que el back calcule `diasMoratorios` y `alerta`.
7. `clienteResponse` solo necesita `idCliente` y `nombreCompleto` en esta respuesta.

---

## Regla de cálculo (acordada)

| Periodicidad | `idModalidad`\* | Números de pagos | Pagos por mes |
| ------------ | --------------- | ---------------- | ------------- |
| Semanal      | 1               | 12, 16           | 4             |
| Quincenal    | 2               | 8, 10, 12, 14    | 2             |

\* Supuesto del front; **confirmar** con el catálogo del back. No hay plazos mensuales.

1. Plazo en meses = número de pagos ÷ pagos por mes (12 semanas = 3 meses; 8 quincenas = 4 meses).
2. Interés = monto × interés mensual × plazo en meses.
3. Total a pagar = monto + interés.
4. Cuota = total ÷ número de pagos. Se redondea a centavos y **el último pago absorbe la diferencia**.

El interés mensual lo captura el usuario (12% por defecto; mayor a 0 y hasta 100, con dos decimales).

Ejemplo: $6,000 al 12% en 8 quincenas → 4 meses → interés $2,880 → total $8,880 → 8 pagos de $1,110.

Fechas: el primer pago lo elige el usuario (no antes de hoy); los siguientes se suman de 7 en 7
días (semanal) o de 15 en 15 (quincenal).

---

## `POST /calcular-pagos` ✅

Genera el préstamo y su calendario. (El nombre no describe bien la acción: genera, no solo calcula.)

**Request que envía hoy el front** (todo como texto):

```json
{
  "idCliente": "1",
  "idModalidad": "2",
  "numeroCuota": "8",
  "importeCuota": "1110.00",
  "fechaGeneracionOperacion": "2026-10-29",
  "fechaInicioCredito": "2026-11-13",
  "importeCredito": "6000.00",
  "tasaInteres": "12",
  "totalPagar": "8880.00",
  "interesGenerado": "2880.00",
  "estadoPago": "1",
  "diasMoratorios": "0",
  "alerta": "VIGENTE",
  "idCalculadoraPrestamo": "1"
}
```

`tasaInteres` es el **interés mensual** en porcentaje.

**Desde el 2026-10-30 el back solo usa** `idCliente`, `idModalidad`, `numeroCuota`,
`importeCredito`, `tasaInteres` y `fechaInicioCredito` (validados con Bean Validation). Los demás
campos se ignoran: el back calcula interés, total, cuotas (con el ajuste de centavos en la última) y
fechas, y asigna `fechaSolicitud` = hoy en México, `estadoPago = 1`, `diasMoratorios = 0` y
`alerta = "VIGENTE"`. Código: `CalculadoraPrestamo` y `EstadoPrestamosServiceImpl` en el back.

**Respuesta 200**

```json
{
  "objetoResponse": {
    "plazosGenerados": 8,
    "resultado": "Prestamo generado correctamente",
    "idPrestamo": 77,
    "interesGenerado": "2880.00",
    "totalPagar": "8880.00",
    "importeCuota": "1110.00",
    "importeUltimaCuota": "1110.00"
  },
  "httpStatus": "OK",
  "mensaje": "Prestamo generado correctamente"
}
```

**Errores** (el front muestra `mensaje` en la confirmación): 400 "Revisa los datos del préstamo." con
`campos` (faltan datos, interés fuera de 0–100, número de pagos que no es de la periodicidad, primer
pago anterior a hoy, periodicidad inexistente) · 404 "El cliente no existe." · Pendiente: 409
cliente inactivo (cuando exista `estatusCliente`).

---

## ✅ Recalcular y validar en el back (hecho el 2026-10-30, salvo lo marcado)

Antes el back **confiaba en los montos que mandaba el navegador**. Cualquiera con un token válido puede
llamar a la API con `totalPagar`, `interesGenerado` o `importeCuota` alterados. Cambio propuesto:

1. ⏳ (front) Enviar solo: `idCliente`, `idModalidad`, `numeroCuota`, `importeCredito`,
   `tasaInteres`, `fechaInicioCredito`.
2. El back **recalcula** interés, total, cuotas y fechas con la regla de arriba (en `BigDecimal`,
   `RoundingMode.HALF_UP`, el ajuste en el último pago) y guarda su propio resultado.
3. Mientras el front siga mandando `totalPagar`, `interesGenerado` e `importeCuota`, el back los
   **ignora**.
4. El back asigna `fechaGeneracionOperacion` (fecha del servidor), `estadoPago`,
   `diasMoratorios = 0`, `alerta = "VIGENTE"` e `idCalculadoraPrestamo`.
5. Validaciones: cliente existente (⏳ y `ACTIVO`, cuando exista el estatus); `idModalidad` válido; `numeroCuota` dentro de los
   permitidos para esa modalidad; tasa entre 0 y 100 (⏳ límites de monto por definir); `fechaInicioCredito` ≥ hoy.
6. Respuestas de error con el código HTTP real (nunca 200 con error).

> **¿Y enviar el cálculo cifrado o en Base64 en un campo genérico?** No protege: Base64 es solo una
> codificación (se revierte en un segundo) y cualquier cifrado hecho en el navegador lleva la llave
> en el propio código del front. Ocultar el nombre del campo tampoco ayuda. Como la fórmula es
> sencilla, lo correcto es que el back la repita.

Opcional después: `POST /simular` que devuelva el cálculo para que el front lo muestre en vez de
calcularlo, así la regla vive en un solo lugar.
