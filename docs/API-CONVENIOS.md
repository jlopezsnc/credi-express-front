# API de convenios

Actualizado: 2026-10-30. Pantallas: `/convenios` (lista) y `/convenios/nuevo` (`src/app/features/convenios/`). Prototipo:
https://claude.ai/artifact/HoYcN8GQvHA9Fojwy4wdYN

Un **convenio** junta varios préstamos con saldo, vigentes o vencidos y de uno o varios clientes
(p. ej. a nombre de familiares que en la práctica paga la misma persona), en **un préstamo nuevo a
nombre del titular**. Por regla **no lleva interés**; el interés mensual es opcional (0 por defecto)
para casos excepcionales.

| Endpoint | Estado | Uso |
| --- | --- | --- |
| `GET /operaciones-prestamos/prestamos` | ✅ Reutilizado | Lista de préstamos a convenir (filtros, búsqueda, orden y páginas en el back) |
| `POST /operaciones-convenios/simular` | ✅ Hecho (sin MySQL) | Saldo, interés, total y calendario con lo capturado. No guarda |
| `POST /operaciones-convenios/convenio-generar` | ✅ Hecho (sin MySQL) | Genera el convenio (con `Idempotency-Key`) |

## 1. Cómo funciona

- El préstamo nuevo vive en `calculadora_prestamos` y `estado_prestamos` como cualquier otro: se
  cobra en Cobranza, con recibo, liquidación y reportes, sin cambios. Lo guarda la misma pieza que
  "Nuevo préstamo" (`RegistroPrestamo`).
- Las cuotas con saldo de los préstamos de origen pasan a **`estado_pago = 4` (en convenio)**: no se
  cobran, cuentan como saldo 0 en la cartera (no se cuenta dos veces) y lo abonado se conserva como
  historial. El préstamo de origen queda en la situación **`EN_CONVENIO`** (no "liquidado").
- Interés = saldo × interés mensual × meses (meses = pagos ÷ 4 semanal, ÷ 2 quincenal); total =
  saldo + interés; cuota = total ÷ pagos y la última absorbe los centavos. Es la misma
  `CalculadoraPrestamo` de "Nuevo préstamo".
- Pagos: libre de **1 a 52**. Hasta 20 préstamos por convenio.

## 2. Lista de préstamos a convenir

`GET /operaciones-prestamos/prestamos` (ver [API-PRESTAMOS.md](API-PRESTAMOS.md)) con lo que se
agregó para convenios:

| Parámetro | Nuevo | Valores |
| --- | --- | --- |
| `filtro` | `AL_CORRIENTE`, `EN_CONVENIO` | "Todos con saldo" = `ACTIVOS`, "Vencidos" = `CON_ATRASO`, "Vigentes" = `AL_CORRIENTE` |
| `orden` | `PRESTAMO`, `VENCIDAS` | Número de préstamo y cuotas vencidas |
| `busqueda` | también por número | `27` o `#27` encuentran el préstamo 27 |
| `idCliente` | sí | Solo los de ese cliente (botón "Incluir los de …") |

Cada préstamo trae además `folioConvenio` (convenio al que pasó su saldo) y `folioConvenioOrigen`
(convenio que lo generó); `contadores` agrega `alCorriente` y `enConvenio`. En el calendario de un
préstamo, las cuotas convenidas traen `estatus: "EN_CONVENIO"`.

## 3. `POST /simular`

```json
{ "idsPrestamo": [12, 18], "idModalidad": 1, "numeroPagos": 12, "tasaInteres": "0", "fechaPrimerPago": "2026-11-06" }
```

**200** (dinero como texto):

```json
{
  "objetoResponse": {
    "prestamos": [
      { "idPrestamo": 12, "cliente": { "idCliente": 1, "nombreCompleto": "…", "telefono": null },
        "estado": "CON_ATRASO", "numeroCuotas": 12, "cuotasPagadas": 5, "cuotasVencidas": 3, "saldo": "4760.00" }
    ],
    "personas": 2,
    "saldoConvenido": "9910.00",
    "tasaInteres": "0.00",
    "meses": "3",
    "interes": "0.00",
    "totalPagar": "9910.00",
    "numeroPagos": 12,
    "importeCuota": "825.83",
    "importeUltimaCuota": "825.87",
    "modalidad": { "idModalidad": 1, "descripcion": "Semanal" },
    "calendario": [{ "numero": 1, "fechaVencimiento": "2026-11-06", "importe": "825.83" }]
  },
  "httpStatus": "OK",
  "mensaje": "Simulación del convenio."
}
```

Errores: 400 con `campos` (sin préstamos, más de 20, pagos fuera de 1–52, interés negativo o mayor a
100, fecha anterior a hoy, periodicidad no disponible); 404 "El préstamo #N no existe."; 409 "El
préstamo #N ya está liquidado." / "…ya está en el convenio CV-…".

## 4. `POST /convenio-generar`

Encabezado `Idempotency-Key: <uuid>` (obligatorio). Cuerpo: lo de `/simular` más:

| Campo | Regla |
| --- | --- |
| `idClienteTitular` | Quien firma y paga; el préstamo nuevo queda a su nombre |
| `motivo` | 10 a 250 caracteres |
| `saldoEsperado` | El `saldoConvenido` que se vio en la simulación |

En una transacción: bloquea (`FOR UPDATE`) las cuotas con saldo de los préstamos en orden de id,
vuelve a calcular el saldo con los abonos vigentes, lo compara con `saldoEsperado`, guarda el
préstamo nuevo, pasa las cuotas a `estado_pago = 4` y registra el convenio con su bitácora.

- **201** "Convenio CV-000124 generado." con `idConvenio`, `folio`, `idPrestamoConvenio`, `titular`,
  `motivo`, `estatus`, `registradoPor`, `fechaRegistro` (UTC) y `plan` (como en `/simular`).
- **200** "Este convenio ya estaba registrado." si se repite la misma llave con los mismos datos.
- **409** si el saldo cambió ("…puede que haya entrado un pago…"), si un préstamo ya no tiene saldo
  o ya está en convenio, o si la llave se usó con otros datos.

## 5. Tablas (`V4__convenio.sql`)

- `convenio`: folio `CV-000000`, titular, préstamo nuevo, periodicidad, pagos, primer pago, saldo
  convenido, tasa, interés, total, cuota, motivo, `estatus` (`VIGENTE`/`CANCELADO`) y bitácora:
  `registrado_por`, `fecha_registro` (UTC), `ip_origen`, `actualizado_por`, `fecha_actualizacion`,
  `cancelado_por`, `fecha_cancelacion`, `motivo_cancelacion`, `version` (bloqueo optimista),
  `llave_idempotencia` y `hash_peticion`.
- `convenio_prestamo`: cada préstamo de origen con a nombre de quién estaba, su situación anterior,
  cuántas cuotas se convinieron (y cuántas vencidas), lo abonado que ya tenían y el saldo convenido,
  con `estatus`, `registrado_por` y `fecha_registro`.

## 6. Protecciones en cobranza

- `pago-registrar` y `prestamo-liquidar` sobre un préstamo en convenio → 409 "El préstamo está en
  convenio: cobra en el préstamo que generó el convenio."
- `pago-cancelar` de un pago cuyo préstamo ya está en convenio → 409 (el saldo convenido ya contaba
  ese pago).
- `pago-registrar` y `prestamo-liquidar` sobre el préstamo de un convenio cancelado → 409 "El
  préstamo se canceló junto con su convenio; ya no se cobra."

## 7. Lista, detalle y cancelación (2026-10-30)

Pantalla `/convenios` (`convenios.ts`); "Nuevo convenio" pasó a `/convenios/nuevo`.

### `GET /convenios`

| Parámetro   | Valores                                                                        | Por defecto |
| ----------- | ------------------------------------------------------------------------------ | ----------- |
| `filtro`    | `VIGENTES` (al corriente + con atraso), `CON_ATRASO`, `LIQUIDADOS`, `CANCELADOS`, `TODOS` | `VIGENTES` |
| `busqueda`  | Titular, folio, número del préstamo nuevo o de origen, o nombre de una persona convenida | —   |
| `orden`     | `FOLIO`, `TITULAR`, `PRESTAMOS`, `CONVENIDO`, `PAGOS`, `SALDO`, `ESTADO`, `FECHA` | `FECHA`   |
| `direccion` | `ASC`, `DESC`                                                                  | `DESC`      |
| `pagina` / `tamano` | Desde 0 / 1–100                                                        | `0` / `10`  |

Cada renglón (`ConvenioResumen`): folio, titular, préstamo nuevo, cuántos préstamos y de cuántas
personas, pagos hechos y vencidas del préstamo nuevo, saldo convenido, total, cuota, **saldo
pendiente** (0 si está cancelado) y `estado`: la situación del préstamo nuevo (`AL_CORRIENTE`,
`CON_ATRASO`, `LIQUIDADO`) o `CANCELADO`. `contadores`: `vigentes`, `conAtraso`, `liquidados`,
`cancelados`, `todos` (sin la búsqueda). Todo en SQL (`ConvenioConsultaRepository`).

### `GET /convenios/{id}`

Resumen, `tasaInteres`, `meses`, `interes`, `fechaPrimerPago`, `motivo`, los préstamos de origen como
estaban al convenir, el calendario del préstamo nuevo (como `GET /prestamos/{id}`),
`pagosRegistrados`, **`puedeCancelar`** y `motivoNoCancelable` (los decide el back) y `bitacora`
(registrado por / fecha / IP, actualizado por / fecha, cancelado por / fecha / motivo). 404 "El
convenio no existe."

### `PUT /convenio-cancelar/{id}`

Cuerpo `{ "motivo": "…" }` (10 a 250 caracteres). Reglas acordadas:

1. Solo un convenio **vigente y sin pagos** en su préstamo nuevo (una sola regla para el detalle y la
   cancelación: `ReglaCancelacionConvenio`). Si no → 409 con el motivo.
2. En una transacción, bloqueando primero el convenio y luego las cuotas (las del préstamo nuevo y
   las de origen, en orden de id): las cuotas del préstamo nuevo pasan a **`estado_pago = 5`
   (cancelada)**, no se borran; las cuotas de los préstamos de origen pasan de 4 a 1 o 2 según sus
   abonos y vuelven a Cobranza; el convenio y sus `convenio_prestamo` quedan `CANCELADO` con quién,
   cuándo y por qué.
3. El préstamo nuevo queda en la situación **`CANCELADO`** en la lista de préstamos (filtro
   `CANCELADOS`; su calendario muestra las cuotas como `CANCELADA`).
4. Un convenio cancelado no se imprime; su detalle y bitácora sí se consultan.

**200** "Convenio CV-000124 cancelado." con el detalle ya cancelado.

`V5__convenio_cancelacion.sql`: índices `convenio (estatus, fecha_registro)` y
`estado_prestamos (id_calculadora_prestamo, estado_pago)`; no cambia columnas.

## 8. Pendiente

- Probar contra MySQL real (al arrancar, Flyway aplica V4 y V5).
