# API de cobranza — contrato e implementación

Base: `http://localhost:8080/api/operaciones-cobranza` (en el front: `apiUrl('/operaciones-cobranza/...')`).
Prototipo aprobado de la pantalla: https://claude.ai/artifact/7s7BvDxthagdPFnESFu6nU

Estado al 2026-10-30: **los 7 endpoints están implementados en el back (Fase 2)**, con pruebas
unitarias y de controller. **Falta probarlos contra MySQL real** (consultas JPQL/nativas, bloqueos y
la migración `V3__pago.sql`). Acordado: se aceptan abonos parciales, se guardan en una tabla nueva
`pago` sin alterar las existentes (opción B) y `estado_pago` vale 1 = pendiente, 2 = abono parcial,
3 = pagada (§4.1). Recargo por atraso libre, a criterio del cobrador, y liquidación anticipada del
préstamo completo (§3.7). Diferencias con lo propuesto: §4.6.

| #   | Endpoint                     | Estado               | Lo usa la pantalla                                   |
| --- | ---------------------------- | -------------------- | ---------------------------------------------------- |
| 1   | `GET resumen`                | ✅ Hecho (sin MySQL) | Tarjetas "Por cobrar hoy", "Vencido", "Cobrado hoy"  |
| 2   | `GET cuotas-pendientes`      | ✅ Hecho (sin MySQL) | Pestañas "Vencen hoy", "Vencidas", "Próximos 7 días" |
| 3   | `POST pago-registrar`        | ✅ Hecho (sin MySQL) | Diálogo "Registrar pago" y recibo                    |
| 4   | `GET pagos`                  | ✅ Hecho (sin MySQL) | Pestaña "Cobrado hoy"                                |
| 5   | `PUT pago-cancelar/{idPago}` | ✅ Hecho (sin MySQL) | Todavía no está en la pantalla (pendiente)           |
| 6   | `GET prestamo-saldo/{id}`    | ✅ Hecho (sin MySQL) | Diálogo "Liquidar préstamo"                          |
| 7   | `POST prestamo-liquidar`     | ✅ Hecho (sin MySQL) | Botón "Liquidar préstamo"                            |

Índice: [1. Convenciones](#1-convenciones) · [2. Objetos](#2-objetos-de-respuesta) ·
[3. Endpoints](#3-endpoints) · [4. Implementación en el back](#4-implementación-en-el-back) ·
[5. Uso en el front](#5-cómo-usa-el-front-cada-campo) · [6. Pruebas](#6-pruebas-del-back) ·
[7. Decisiones](#7-decisiones-de-negocio)

---

## 1. Convenciones

### 1.1 Seguridad

- Todas las rutas exigen `Authorization: Bearer <idToken de Firebase>` (ya lo resuelve
  `oauth2ResourceServer`). Sin token → 401; lo pone Spring Security, no el controller.
- **Quién registra o cancela** sale del token: `jwt.getClaimAsString("email")`, y si no viene,
  `jwt.getSubject()` (uid). **Nunca** del cuerpo de la petición.

### 1.2 Sobre de respuesta (éxito y error)

```json
{ "objetoResponse": {}, "httpStatus": "OK", "mensaje": "Texto para el usuario" }
```

- `httpStatus` = nombre del `HttpStatus` real (`OK`, `CREATED`, `BAD_REQUEST`, `NOT_FOUND`,
  `CONFLICT`). **El código HTTP de la respuesta debe coincidir**: un error nunca sale con 200.
- `mensaje` en español, entendible por el usuario: el front lo muestra tal cual.
- En errores, `objetoResponse` es `null` y puede venir `campos` (solo 400 de validación):

```json
{
  "objetoResponse": null,
  "httpStatus": "BAD_REQUEST",
  "mensaje": "Revisa los datos del pago.",
  "campos": [
    { "campo": "importe", "mensaje": "El importe debe ser mayor a cero." },
    { "campo": "referencia", "mensaje": "Captura la referencia del pago." }
  ]
}
```

- Errores no previstos → 500 con `"mensaje": "Ocurrió un error inesperado. Intenta de nuevo."`
  y **sin** trazas, nombres de clases ni SQL. La traza va solo al log.

### 1.3 Tipos

| Tipo en el JSON  | Java                     | Ejemplo                       | Regla                                         |
| ---------------- | ------------------------ | ----------------------------- | --------------------------------------------- |
| Dinero           | `BigDecimal` → texto     | `"710.00"`                    | Siempre 2 decimales, como **string**. Nunca `double`. |
| Fecha            | `LocalDate`              | `"2026-10-29"`                | `yyyy-MM-dd`.                                 |
| Marca de tiempo  | `OffsetDateTime`         | `"2026-10-29T10:15:00-06:00"` | ISO 8601 con zona.                            |
| Entero           | `Integer` / `Long`       | `2`                           | Nunca `2.0`.                                  |
| Enum             | `enum` → texto           | `"EFECTIVO"`                  | Mayúsculas, valores listados abajo.           |

Para que el dinero salga como texto con 2 decimales: en los DTO de respuesta usar
`@JsonFormat(shape = JsonFormat.Shape.STRING)` sobre los `BigDecimal` y guardarlos con
`setScale(2)`, o bien declarar esos campos como `String` armados con `toPlainString()`.

### 1.4 "Hoy"

Lo decide el back con `ZoneId.of("America/Mexico_City")` a través de un `Clock` inyectable
(así se puede probar). Nunca la fecha que mande el navegador.

### 1.5 Paginación

Las listas responden dentro de `objetoResponse` con este objeto `Pagina`:

```json
{ "contenido": [], "pagina": 0, "tamano": 50, "totalElementos": 0, "totalPaginas": 0 }
```

Parámetros `pagina` (desde 0, por defecto 0) y `tamano` (1–100; por defecto 10 en `cuotas-pendientes`
y `operaciones`, 50 en `pagos`). Fuera de rango → 400.

`cuotas-pendientes` y `operaciones` agregan `importeTotal`: la suma de **todo lo filtrado** (no solo de
la página), para el pie de la tabla.

### 1.6 Enums

| Enum             | Valores                                       |
| ---------------- | --------------------------------------------- |
| `SituacionCuota` | `VENCIDA`, `HOY`, `PROXIMA`                   |
| `MetodoPago`     | `EFECTIVO`, `TRANSFERENCIA`, `DEPOSITO`       |
| `TipoPago`       | `CUOTA_COMPLETA`, `ABONO_PARCIAL`, `LIQUIDACION` |
| `EstatusPago`    | `VIGENTE`, `CANCELADO`                        |

---

## 2. Objetos de respuesta

### 2.1 `ClienteResumen`

| Campo            | Tipo     | Nulo | Descripción                     |
| ---------------- | -------- | ---- | ------------------------------- |
| `idCliente`      | entero   | no   |                                 |
| `nombreCompleto` | texto    | no   |                                 |
| `telefono`       | texto    | sí   | 10 dígitos sin espacios.        |

### 2.2 `CuotaCobranza`

| Campo              | Tipo             | Nulo | Descripción                                                    |
| ------------------ | ---------------- | ---- | -------------------------------------------------------------- |
| `idCuota`          | entero           | no   | Id de la cuota (entidad `EstadoPrestamos`).                    |
| `idPrestamo`       | entero           | no   | Id del préstamo (`idCalculadoraPrestamo`).                     |
| `cliente`          | `ClienteResumen` | no   |                                                                |
| `modalidad`        | objeto           | no   | `{ "idModalidad": 2, "descripcion": "Quincenal" }`.            |
| `numeroCuota`      | entero           | no   | 1…`totalCuotas`.                                               |
| `totalCuotas`      | entero           | no   | Cuotas del préstamo.                                           |
| `fechaVencimiento` | fecha            | no   |                                                                |
| `importeCuota`     | dinero           | no   | Lo que vale la cuota.                                          |
| `importeAbonado`   | dinero           | no   | Suma de pagos **vigentes** a esta cuota (`"0.00"` si ninguno); se calcula, no se guarda. |
| `saldoCuota`       | dinero           | no   | `importeCuota − importeAbonado`; siempre > 0 en esta lista.    |
| `diasAtraso`       | entero           | no   | Días desde `fechaVencimiento` hasta hoy; `0` si no ha vencido. |
| `situacion`        | `SituacionCuota` | no   | `VENCIDA` (< hoy), `HOY` (= hoy), `PROXIMA` (> hoy).           |

### 2.3 `Pago`

| Campo               | Tipo             | Nulo | Descripción                                                 |
| ------------------- | ---------------- | ---- | ----------------------------------------------------------- |
| `idPago`            | entero           | no   |                                                             |
| `folio`             | texto            | no   | `P-` + id con 6 dígitos: `P-000233`. Único por operación (una liquidación comparte folio en todos sus renglones). |
| `idCuota`           | entero           | no   |                                                             |
| `idPrestamo`        | entero           | no   |                                                             |
| `cliente`           | `ClienteResumen` | no   |                                                             |
| `numeroCuota`       | entero           | no   |                                                             |
| `totalCuotas`       | entero           | no   |                                                             |
| `importe`           | dinero           | no   | Lo que se aplica a la cuota (reduce su saldo).              |
| `recargo`           | dinero           | no   | Recargo por atraso, a criterio del cobrador; `"0.00"` si no hay. No reduce el saldo. |
| `totalRecibido`     | dinero           | no   | `importe + recargo`: lo que entregó el cliente.             |
| `fechaPago`         | fecha            | no   | Cuándo pagó el cliente (puede ser anterior al registro).    |
| `metodoPago`        | `MetodoPago`     | no   |                                                             |
| `referencia`        | texto            | sí   | `null` en efectivo.                                         |
| `nota`              | texto            | sí   |                                                             |
| `tipo`              | `TipoPago`       | no   | `CUOTA_COMPLETA` o `ABONO_PARCIAL` según el saldo; `LIQUIDACION` si vino de §3.7. |
| `saldoCuota`        | dinero           | no   | Saldo de la cuota **justo después** de este pago.           |
| `cuotaLiquidada`    | booleano         | no   | `saldoCuota == 0`.                                          |
| `prestamoLiquidado` | booleano         | no   | Este pago liquidó la última cuota pendiente del préstamo.   |
| `registradoPor`     | texto            | no   | Correo (o uid) del token.                                   |
| `fechaRegistro`     | marca de tiempo  | no   | Cuándo se capturó.                                          |
| `estatus`           | `EstatusPago`    | no   |                                                             |
| `canceladoPor`      | texto            | sí   | Solo si `CANCELADO`.                                        |
| `fechaCancelacion`  | marca de tiempo  | sí   | Solo si `CANCELADO`.                                        |
| `motivoCancelacion` | texto            | sí   | Solo si `CANCELADO`.                                        |

---

## 3. Endpoints

### 3.1 `GET /resumen`

| Parámetro | Tipo  | Obligatorio | Por defecto |
| --------- | ----- | ----------- | ----------- |
| `fecha`   | fecha | no          | hoy         |

Solo cuenta cuotas de préstamos vigentes.

- `porCobrarHoy`: cuotas con `fechaVencimiento = fecha` y saldo > 0. `importe` = suma de **saldos**.
- `vencido`: cuotas con `fechaVencimiento < fecha` y saldo > 0. `importe` = suma de saldos.
- `cobrado`: pagos `VIGENTE` cuyo `fechaRegistro` cae en `fecha`. `pagos` = operaciones (folios
  distintos); `importe` = suma de `importe + recargo` (lo que entró en caja).

**200**

```json
{
  "objetoResponse": {
    "fecha": "2026-10-29",
    "porCobrarHoy": { "cuotas": 3, "importe": "2135.00" },
    "vencido": { "cuotas": 3, "importe": "1945.00" },
    "cobrado": { "pagos": 2, "importe": "1088.57" }
  },
  "httpStatus": "OK",
  "mensaje": "Resumen de cobranza."
}
```

Sin datos: los contadores en `0` e importes en `"0.00"` (nunca `null`).

**400** `fecha` mal formada:

```json
{ "objetoResponse": null, "httpStatus": "BAD_REQUEST", "mensaje": "La fecha debe tener el formato aaaa-mm-dd." }
```

> **Fase 2 (2026-10-30)**: `resumen` agrega `proximas` (`{cuotas, importe}`, de mañana a hoy + `dias`,
> parámetro `dias` 1–31, por defecto 7) para el contador de "Próximos 7 días".

### 3.2 `GET /cuotas-pendientes`

> **Fase 2 (2026-10-30)**: nuevos parámetros `orden` (`CLIENTE`, `PAGO`, `VENCE`, `SITUACION`,
> `SALDO`; por defecto `VENCE`) y `direccion` (`ASC`/`DESC`); `tamano` por defecto 10. Cada cuota
> trae `diasParaVencer` (0 si vence hoy o ya venció) para "Mañana" / "En 3 días": el front ya no resta
> fechas. La consulta es SQL (`CuotaPendienteRepository`) para poder ordenar por saldo, que se calcula.

| Parámetro   | Tipo             | Obligatorio | Por defecto | Regla                                             |
| ----------- | ---------------- | ----------- | ----------- | ------------------------------------------------- |
| `situacion` | `SituacionCuota` | no          | `HOY`       | `VENCIDA`, `HOY` o `PROXIMA`.                     |
| `dias`      | entero           | no          | `7`         | 1–31. Solo con `PROXIMA`: de mañana a hoy + `dias`. |
| `busqueda`  | texto            | no          | —           | Contiene, en `nombreCompleto`; sin importar acentos ni mayúsculas; máx. 100. |
| `pagina`    | entero           | no          | `0`         |                                                   |
| `tamano`    | entero           | no          | `50`        |                                                   |

Solo cuotas con saldo > 0 de préstamos vigentes.

Orden:

- `VENCIDA`: `fechaVencimiento` ascendente (la más atrasada primero), luego `nombreCompleto`.
- `HOY` y `PROXIMA`: `fechaVencimiento` ascendente, luego `nombreCompleto`.

**200**

```json
{
  "objetoResponse": {
    "contenido": [
      {
        "idCuota": 101,
        "idPrestamo": 12,
        "cliente": {
          "idCliente": 2,
          "nombreCompleto": "JOSÉ ANTONIO HERNÁNDEZ CRUZ",
          "telefono": "9171002231"
        },
        "modalidad": { "idModalidad": 2, "descripcion": "Quincenal" },
        "numeroCuota": 2,
        "totalCuotas": 8,
        "fechaVencimiento": "2026-10-17",
        "importeCuota": "1110.00",
        "importeAbonado": "400.00",
        "saldoCuota": "710.00",
        "diasAtraso": 12,
        "situacion": "VENCIDA"
      }
    ],
    "pagina": 0,
    "tamano": 50,
    "totalElementos": 1,
    "totalPaginas": 1
  },
  "httpStatus": "OK",
  "mensaje": "1 registros encontrados."
}
```

Sin resultados: 200 con `contenido: []` y `"mensaje": "0 registros encontrados."` (no 404).

**400** parámetro inválido:

```json
{
  "objetoResponse": null,
  "httpStatus": "BAD_REQUEST",
  "mensaje": "Revisa los filtros de la búsqueda.",
  "campos": [{ "campo": "situacion", "mensaje": "Usa VENCIDA, HOY o PROXIMA." }]
}
```

### 3.3 `POST /pago-registrar`

**Encabezados**

| Encabezado        | Obligatorio | Regla                                                                    |
| ----------------- | ----------- | ------------------------------------------------------------------------ |
| `Idempotency-Key` | sí          | UUID (36 caracteres). El front genera uno al abrir el diálogo y lo repite si reintenta. |
| `Content-Type`    | sí          | `application/json`                                                       |

**Request**

```json
{
  "idCuota": 101,
  "importe": "710.00",
  "recargo": "50.00",
  "fechaPago": "2026-10-29",
  "metodoPago": "TRANSFERENCIA",
  "referencia": "0045821933",
  "nota": "Pagó en su domicilio"
}
```

| Campo        | Tipo         | Obligatorio            | Regla y mensaje de error                                                                       |
| ------------ | ------------ | ---------------------- | ---------------------------------------------------------------------------------------------- |
| `idCuota`    | entero       | sí                     | "Selecciona la cuota."                                                                         |
| `importe`    | dinero texto | sí                     | > 0 → "El importe debe ser mayor a cero."; máx. 2 decimales → "El importe admite hasta dos decimales."; ≤ saldo (ver 409). |
| `recargo`    | dinero texto | no                     | ≥ 0, máx. 2 decimales; ausente = `"0.00"`. Monto libre del cobrador. Solo si la cuota está vencida → "Solo se puede cobrar recargo a una cuota vencida." No cuenta contra el saldo. |
| `fechaPago`  | fecha        | sí                     | ≤ hoy → "La fecha del pago no puede ser posterior a hoy."; ≥ hoy − 30 → "Solo se pueden registrar pagos de los últimos 30 días." |
| `metodoPago` | `MetodoPago` | sí                     | "Elige el método de pago."                                                                     |
| `referencia` | texto        | si no es `EFECTIVO`    | "Captura la referencia del pago."; máx. 50. En `EFECTIVO` se guarda `null` aunque venga.       |
| `nota`       | texto        | no                     | Máx. 200. Vacía → `null`.                                                                      |

Se recortan espacios al inicio y al final de `referencia` y `nota`.

**201** — `objetoResponse`: el `Pago` creado.

```json
{
  "objetoResponse": {
    "idPago": 233,
    "folio": "P-000233",
    "idCuota": 101,
    "idPrestamo": 12,
    "cliente": {
      "idCliente": 2,
      "nombreCompleto": "JOSÉ ANTONIO HERNÁNDEZ CRUZ",
      "telefono": "9171002231"
    },
    "numeroCuota": 2,
    "totalCuotas": 8,
    "importe": "710.00",
    "recargo": "50.00",
    "totalRecibido": "760.00",
    "fechaPago": "2026-10-29",
    "metodoPago": "TRANSFERENCIA",
    "referencia": "0045821933",
    "nota": "Pagó en su domicilio",
    "tipo": "CUOTA_COMPLETA",
    "saldoCuota": "0.00",
    "cuotaLiquidada": true,
    "prestamoLiquidado": false,
    "registradoPor": "cobrador@ejemplo.com",
    "fechaRegistro": "2026-10-29T10:15:00-06:00",
    "estatus": "VIGENTE",
    "canceladoPor": null,
    "fechaCancelacion": null,
    "motivoCancelacion": null
  },
  "httpStatus": "CREATED",
  "mensaje": "Pago registrado."
}
```

**Repetición con la misma `Idempotency-Key` y el mismo cuerpo**: 200 (no 201) con el **mismo**
`Pago` de la primera vez y `"mensaje": "Este pago ya estaba registrado."`. No crea nada.

**Errores**

| Código | Cuándo                                                   | `mensaje` exacto                                                                       |
| ------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 400    | Falta o es inválido un campo (con `campos`)              | "Revisa los datos del pago."                                                           |
| 400    | Falta `Idempotency-Key` o no es UUID                     | "Falta el identificador de la operación. Recarga la página e intenta de nuevo."        |
| 404    | No existe la cuota                                       | "La cuota no existe."                                                                  |
| 409    | La cuota ya está liquidada                               | "Esta cuota ya está pagada."                                                           |
| 409    | `importe` > saldo actual                                 | "El importe supera el saldo de la cuota ($710.00). Puede que alguien haya registrado un pago antes." |
| 409    | El préstamo no está vigente                              | "El préstamo no está vigente."                                                         |
| 409    | Misma `Idempotency-Key` con otro cuerpo                  | "Este identificador ya se usó para otro pago. Recarga la página e intenta de nuevo."   |
| 409    | Hay una cuota anterior pendiente (§7.2)                  | "Primero hay que cobrar la cuota 1 de este préstamo."                                  |

Ejemplo 409:

```json
{
  "objetoResponse": null,
  "httpStatus": "CONFLICT",
  "mensaje": "Esta cuota ya está pagada."
}
```

### 3.4.1 `GET /operaciones` (fase 2, 2026-10-30)

"Cobrado hoy" ya agrupado: un renglón por **operación** (folio), solo `VIGENTE`, del más reciente al
más antiguo. Parámetros `fecha` (por defecto hoy), `busqueda`, `pagina`, `tamano` (por defecto 10).
Cada renglón: `folio`, `fechaRegistro`, `fechaPago`, `cliente`, `idPrestamo`, `cuotaInicial`,
`cuotaFinal`, `totalCuotas`, `tipo`, `metodoPago`, `referencia`, `importe`, `recargo`, `totalRecibido`,
`registradoPor`, `estatus` (el mismo objeto de las operaciones del reporte de cobranza).
`importeTotal` = lo que entró en caja en todo lo filtrado.

### 3.4 `GET /pagos`

| Parámetro  | Tipo           | Obligatorio | Por defecto |
| ---------- | -------------- | ----------- | ----------- |
| `fecha`    | fecha          | no          | hoy         |
| `estatus`  | `EstatusPago`  | no          | todos       |
| `busqueda` | texto          | no          | —           |
| `pagina`   | entero         | no          | `0`         |
| `tamano`   | entero         | no          | `50`        |

Pagos cuyo `fechaRegistro` cae en `fecha`, del más reciente al más antiguo.

**200**

```json
{
  "objetoResponse": {
    "contenido": [
      {
        "idPago": 233,
        "folio": "P-000233",
        "idCuota": 101,
        "idPrestamo": 12,
        "cliente": {
          "idCliente": 2,
          "nombreCompleto": "JOSÉ ANTONIO HERNÁNDEZ CRUZ",
          "telefono": "9171002231"
        },
        "numeroCuota": 2,
        "totalCuotas": 8,
        "importe": "710.00",
        "fechaPago": "2026-10-29",
        "metodoPago": "TRANSFERENCIA",
        "referencia": "0045821933",
        "nota": null,
        "tipo": "CUOTA_COMPLETA",
        "saldoCuota": "0.00",
        "cuotaLiquidada": true,
        "prestamoLiquidado": false,
        "registradoPor": "cobrador@ejemplo.com",
        "fechaRegistro": "2026-10-29T10:15:00-06:00",
        "estatus": "VIGENTE",
        "canceladoPor": null,
        "fechaCancelacion": null,
        "motivoCancelacion": null
      }
    ],
    "pagina": 0,
    "tamano": 50,
    "totalElementos": 1,
    "totalPaginas": 1
  },
  "httpStatus": "OK",
  "mensaje": "1 registros encontrados."
}
```

### 3.5 `PUT /pago-cancelar/{idPago}` 💡

Corrige un pago capturado por error **sin borrarlo**.

**Request**

```json
{ "motivo": "Importe capturado mal" }
```

`motivo`: obligatorio, 5–200 caracteres → "Escribe el motivo de la cancelación (mínimo 5 caracteres)."

**Qué hace**: `estatus = CANCELADO`, guarda `canceladoPor` (del token), `fechaCancelacion` y
`motivoCancelacion`; el importe deja de contar en lo abonado de la cuota, que vuelve a
`estado_pago` 1 o 2 (`fechaPago = null`) si deja de estar pagada; con eso el préstamo vuelve a
estar vigente (§4.3).

**200** — `objetoResponse`: el `Pago` con `estatus: "CANCELADO"` y los tres campos de cancelación
llenos; `"mensaje": "Pago cancelado."`

| Código | Cuándo              | `mensaje`                          |
| ------ | ------------------- | ---------------------------------- |
| 400    | `motivo` inválido   | "Revisa el motivo." (con `campos`) |
| 404    | No existe el pago   | "El pago no existe."               |
| 409    | Ya estaba cancelado | "Este pago ya estaba cancelado."   |

No debe existir `DELETE`.

### 3.6 `GET /prestamo-saldo/{idPrestamo}`

Datos para el diálogo "Liquidar préstamo": cuánto debe en total y qué cuotas se van a liquidar.

**200**

```json
{
  "objetoResponse": {
    "idPrestamo": 12,
    "cliente": {
      "idCliente": 2,
      "nombreCompleto": "JOSÉ ANTONIO HERNÁNDEZ CRUZ",
      "telefono": "9171002231"
    },
    "modalidad": { "idModalidad": 2, "descripcion": "Quincenal" },
    "totalCuotas": 8,
    "cuotasPendientes": 6,
    "saldoTotal": "6260.00",
    "hayCuotasVencidas": true,
    "cuotas": [
      {
        "idCuota": 101,
        "numeroCuota": 3,
        "fechaVencimiento": "2026-10-17",
        "importeCuota": "1110.00",
        "importeAbonado": "400.00",
        "saldoCuota": "710.00",
        "diasAtraso": 13,
        "situacion": "VENCIDA"
      }
    ]
  },
  "httpStatus": "OK",
  "mensaje": "Saldo del préstamo."
}
```

- `cuotas`: todas las cuotas con `estado_pago` 1 o 2, por `numeroCuota`.
- `saldoTotal`: suma de sus `saldoCuota`.

**Errores**: 404 "El préstamo no existe." · 409 "El préstamo ya está liquidado."

### 3.7 `POST /prestamo-liquidar`

El cliente paga **todo lo que debe del préstamo** en una sola operación ("va en el pago 3 de 8 y
decide liquidar"). Un solo importe; el back lo reparte cuota por cuota, de la más antigua a la más
reciente, y deja todas pagadas.

**Encabezado**: `Idempotency-Key` (igual que en `pago-registrar`).

**Request**

```json
{
  "idPrestamo": 12,
  "importe": "6260.00",
  "recargo": "150.00",
  "fechaPago": "2026-10-30",
  "metodoPago": "EFECTIVO",
  "referencia": null,
  "nota": "Liquidó por adelantado"
}
```

| Campo        | Regla y mensaje de error                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| `idPrestamo` | Obligatorio → "Selecciona el préstamo."                                                                       |
| `importe`    | Obligatorio; **igual al saldo total** del préstamo (409 si no coincide, ver abajo).                           |
| `recargo`    | Opcional, ≥ 0, 2 decimales. Solo si hay cuotas vencidas → "Solo se puede cobrar recargo si hay cuotas vencidas." |
| `fechaPago`, `metodoPago`, `referencia`, `nota` | Mismas reglas que en `pago-registrar`.                                     |

**Qué hace, en una transacción**

1. Idempotencia como en `pago-registrar` (la llave se repite en todos los renglones de la operación).
2. Bloquea **todas** las cuotas pendientes del préstamo (`FOR UPDATE`, ordenadas por `numero_cuota`).
3. Valida `importe == saldoTotal` con los datos de la base.
4. Inserta **un renglón de `pago` por cuota** con su saldo como importe, `tipo = LIQUIDACION` y el
   **mismo folio** para todos (el del primer renglón). El `recargo` va solo en el primer renglón.
5. Cada cuota queda en `estado_pago = 3` con `fecha_pago = fechaPago`.
6. `clienteSinAdeudos` = el cliente ya no tiene ninguna cuota pendiente en ningún préstamo.

**201**

```json
{
  "objetoResponse": {
    "folio": "P-000240",
    "idPrestamo": 12,
    "cliente": {
      "idCliente": 2,
      "nombreCompleto": "JOSÉ ANTONIO HERNÁNDEZ CRUZ",
      "telefono": "9171002231"
    },
    "cuotasLiquidadas": 6,
    "importe": "6260.00",
    "recargo": "150.00",
    "totalRecibido": "6410.00",
    "fechaPago": "2026-10-30",
    "metodoPago": "EFECTIVO",
    "referencia": null,
    "nota": "Liquidó por adelantado",
    "pagos": [
      { "idPago": 240, "idCuota": 101, "numeroCuota": 3, "importe": "710.00" },
      { "idPago": 241, "idCuota": 102, "numeroCuota": 4, "importe": "1110.00" }
    ],
    "prestamoLiquidado": true,
    "clienteSinAdeudos": true,
    "registradoPor": "cobrador@ejemplo.com",
    "fechaRegistro": "2026-10-30T11:02:00-06:00"
  },
  "httpStatus": "CREATED",
  "mensaje": "Préstamo liquidado."
}
```

**Errores**

| Código | Cuándo                              | `mensaje`                                                                                       |
| ------ | ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| 400    | Validación (con `campos`)           | "Revisa los datos de la liquidación."                                                           |
| 404    | No existe el préstamo               | "El préstamo no existe."                                                                        |
| 409    | Ya estaba liquidado                 | "El préstamo ya está liquidado."                                                                |
| 409    | `importe` ≠ saldo total             | "El importe no coincide con el saldo del préstamo ($6,260.00). Actualiza la pantalla e intenta de nuevo." |
| 409    | Misma llave con otro cuerpo         | "Este identificador ya se usó para otro pago. Recarga la página e intenta de nuevo."            |

**Cancelar una liquidación**: `pago-cancelar` sobre cualquiera de sus renglones cancela **todos**
los renglones con ese folio y regresa cada cuota a su estado anterior (1 o 2).

**"Cliente sin adeudos"** no se guarda: se calcula (ninguna cuota con `estado_pago` 1 o 2). Cuando
`cliente-lst` incluya el resumen de préstamos, `prestamosActivos = 0` lo indica.

---

## 4. Implementación en el back

Paquete `com.crediexpress` (ver la estructura propuesta en
[REVISION-BACK-Y-PROPUESTA-FRONT.md](REVISION-BACK-Y-PROPUESTA-FRONT.md#21-estructura-y-modelo)).
Base: MySQL (Cloud SQL). Java 21, DTOs como `record`, sin exponer entidades JPA.

### 4.1 Modelo de datos (opción B, acordada el 2026-10-30)

**Una sola tabla nueva, `pago`. Las tablas existentes no se alteran.** Cada abono es un renglón de
`pago`; la cuota sigue siendo el mismo renglón de `estado_prestamos` y solo se actualizan columnas
que ya existen (`estado_pago`, `fecha_pago`).

Tablas reales (esquema del 2026-10-30): `cliente.id_cliente`,
`calculadora_prestamos.id_calculadora_prestamo` y `estado_prestamos.id`, todas `INT`. Flyway:
`V1` = línea base con el `mysqldump --no-data`; este script es `V3__pago.sql` (`V2__catalogo_modalidad.sql` ya agregó la modalidad quincenal en la Fase 0).

```sql
CREATE TABLE pago (
  id_pago             INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  folio               VARCHAR(12)   NULL,                 -- P-000233; lo comparten los renglones de una liquidación
  llave_idempotencia  CHAR(36)      NOT NULL,             -- encabezado Idempotency-Key (repetida en una liquidación)
  hash_peticion       CHAR(64)      NOT NULL,             -- SHA-256 del cuerpo normalizado
  id_cuota            INT           NOT NULL,
  id_prestamo         INT           NOT NULL,
  id_cliente          INT           NOT NULL,
  importe             DECIMAL(12,2) NOT NULL,             -- se aplica a la cuota
  recargo             DECIMAL(12,2) NOT NULL DEFAULT 0.00, -- recargo por atraso, libre
  fecha_pago          DATE          NOT NULL,
  metodo_pago         VARCHAR(20)   NOT NULL,             -- EFECTIVO | TRANSFERENCIA | DEPOSITO
  referencia          VARCHAR(50)   NULL,
  nota                VARCHAR(200)  NULL,
  tipo                VARCHAR(20)   NOT NULL,             -- CUOTA_COMPLETA | ABONO_PARCIAL | LIQUIDACION
  saldo_cuota         DECIMAL(12,2) NOT NULL,             -- saldo justo después del pago
  prestamo_liquidado  BOOLEAN       NOT NULL DEFAULT FALSE,
  registrado_por      VARCHAR(128)  NOT NULL,             -- correo o uid del token
  fecha_registro      DATETIME(3)   NOT NULL,             -- en UTC
  estatus             VARCHAR(12)   NOT NULL DEFAULT 'VIGENTE', -- VIGENTE | CANCELADO
  cancelado_por       VARCHAR(128)  NULL,
  fecha_cancelacion   DATETIME(3)   NULL,
  motivo_cancelacion  VARCHAR(200)  NULL,
  CONSTRAINT fk_pago_cuota    FOREIGN KEY (id_cuota)    REFERENCES estado_prestamos (id),
  CONSTRAINT fk_pago_prestamo FOREIGN KEY (id_prestamo) REFERENCES calculadora_prestamos (id_calculadora_prestamo),
  CONSTRAINT fk_pago_cliente  FOREIGN KEY (id_cliente)  REFERENCES cliente (id_cliente),
  CONSTRAINT ck_pago_importe  CHECK (importe > 0),
  CONSTRAINT ck_pago_recargo  CHECK (recargo >= 0),
  CONSTRAINT uq_pago_llave_cuota UNIQUE (llave_idempotencia, id_cuota),
  INDEX ix_pago_folio (folio),
  INDEX ix_pago_fecha_registro (fecha_registro),
  INDEX ix_pago_cuota_estatus (id_cuota, estatus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Índice nuevo (no altera columnas): las consultas de cobranza filtran por vencimiento.
CREATE INDEX ix_cuota_vencimiento ON estado_prestamos (fecha_vencimiento);

-- Datos: cuotas existentes sin estado → pendientes.
UPDATE estado_prestamos SET estado_pago = 1 WHERE estado_pago IS NULL AND fecha_pago IS NULL;
```

**`estado_pago`** (columna existente, acordado el 2026-10-30):

| Valor | Significado                         | `fecha_pago`                          |
| ----- | ----------------------------------- | ------------------------------------- |
| 1     | Pendiente (sin abonos)              | `NULL`                                |
| 2     | Abono parcial (saldo > 0)           | `NULL`                                |
| 3     | Pagada (saldo = 0)                  | Fecha del pago que la liquidó         |

"Vencida" no se guarda: es pendiente o parcial con `fecha_vencimiento < hoy` (se calcula). En Java,
un `enum EstadoCuota { PENDIENTE(1), ABONO_PARCIAL(2), PAGADA(3) }` con un `AttributeConverter`
a `Integer`; `NULL` se lee como `PENDIENTE`. `calcular-pagos` debe crear las cuotas con `1`.

**Reglas derivadas** (sin columnas nuevas):

- `importeAbonado` = suma de `pago.importe` con `estatus = 'VIGENTE'` de la cuota.
- `saldoCuota` = `importe_cuota − importeAbonado`; si `estado_pago = 3` y no tiene pagos (cuotas
  pagadas antes de existir esta tabla), el saldo es `0`.
- Préstamo **vigente** = tiene al menos una cuota con `estado_pago` 1 o 2; **liquidado** = ninguna.
- **Dinero en `FLOAT`**: `importe_cuota` es `FLOAT` en la base, así que al leerlo se normaliza con
  `setScale(2, RoundingMode.HALF_UP)` (un helper `Dinero.de(...)`) antes de cualquier resta o
  comparación. `pago.importe` ya es `DECIMAL(12,2)`.

La búsqueda ignora acentos porque las tablas usan `utf8mb4_0900_ai_ci`.

### 4.2 Clases

En los paquetes actuales del back, para no mezclar estructuras (la reorganización de paquetes queda
para después):

```
controller/CobranzaController.java                     /operaciones-cobranza
service/CobranzaService.java, service/impl/CobranzaServiceImpl.java
dto/entity/Pago.java                                   + enums EstadoCuota, MetodoPago, TipoPago, EstatusPago
dto/entity/EstadoCuotaConverter.java                   Integer ↔ EstadoCuota
dto/repository/PagoRepository.java                     (+ consultas nuevas en EstadoPrestamosRepository)
dto/view/request/RegistrarPagoRequest.java, CancelarPagoRequest.java        (record)
dto/view/response/ResumenCobranzaResponse, CuotaCobranzaResponse, PagoResponse,
                  ClienteResumenResponse, PaginaResponse<T>                   (record)
config/ClockConfig.java                                Clock con America/Mexico_City
controller/ApiExceptionHandler.java, exception/ApiException.java            sobre de error común
util/Dinero.java                                       normaliza FLOAT → BigDecimal(2)
```

`RegistrarPagoRequest` con Bean Validation (`spring-boot-starter-validation`):

```java
public record RegistrarPagoRequest(
    @NotNull(message = "Selecciona la cuota.") Integer idCuota,
    @NotNull(message = "Captura el importe.")
    @DecimalMin(value = "0.01", message = "El importe debe ser mayor a cero.")
    @Digits(integer = 10, fraction = 2, message = "El importe admite hasta dos decimales.")
    BigDecimal importe,
    @NotNull(message = "Elige la fecha del pago.") LocalDate fechaPago,
    @NotNull(message = "Elige el método de pago.") MetodoPago metodoPago,
    @Size(max = 50) String referencia,
    @Size(max = 200) String nota) {}
```

Las reglas que dependen de otros datos (referencia según método, rango de fecha, saldo) van en el
servicio, que lanza `ApiException` con el mensaje de la tabla de §3.3.

### 4.3 `POST /pago-registrar`, paso a paso (`@Transactional`)

1. Validar `Idempotency-Key` (UUID). Calcular `hash` = SHA-256 de
   `idCuota|importe.setScale(2)|fechaPago|metodoPago|referencia|nota`.
2. ¿Existe algún `pago` con esa `llave_idempotencia`?
   - Sí y el hash coincide → 200 con ese `Pago` ("Este pago ya estaba registrado.").
   - Sí y el hash no coincide → 409.
3. Leer la cuota con bloqueo: `@Lock(LockModeType.PESSIMISTIC_WRITE)` en
   `findByIdParaCobro(idCuota)` (con préstamo, cliente y modalidad en `JOIN FETCH`). No existe → 404.
   El bloqueo serializa los cobros de la misma cuota: el segundo espera y luego ve el saldo nuevo.
4. Calcular el saldo (§4.1) y validar: préstamo vigente (409), saldo > 0 (409 "ya está pagada"),
   `importe` ≤ saldo (409), `fechaPago` en rango con `LocalDate.now(clock)` (400), referencia si no
   es efectivo (400). Si se decide el orden de cuotas (§7.2): ¿hay una cuota anterior del mismo
   préstamo con `estado_pago` 1 o 2? → 409. `recargo` > 0 solo si la cuota está vencida (400).
5. Insertar el `pago` (`tipo`, `saldo_cuota`, `registrado_por` del token,
   `fecha_registro = Instant.now(clock)`) y luego `folio = String.format("P-%06d", idPago)`. Si
   dos peticiones con la misma llave llegan a la vez, la segunda choca con el `UNIQUE`
   (`llave_idempotencia`, `id_cuota`): atrapar `DataIntegrityViolationException` y responder como en el paso 2.
6. Actualizar la cuota: saldo nuevo = 0 → `estado_pago = 3` y `fecha_pago = fechaPago`; si no →
   `estado_pago = 2`.
7. ¿Quedan cuotas del préstamo con `estado_pago` 1 o 2? Si no → `pago.prestamo_liquidado = true`.
8. Responder 201.

`pago-cancelar`: marca el pago `CANCELADO`, recalcula el saldo de la cuota con los pagos vigentes y
deja `estado_pago` en 1 (sin abonos), 2 (con abonos) o 3; si deja de estar pagada,
`fecha_pago = NULL`. También con la cuota bloqueada.

### 4.4 Consultas

- **Cuotas pendientes** (JPQL con `Pageable`): cuotas `c` con `c.estadoPago` 1, 2 o `NULL`, y según
  `situacion`: `c.fechaVencimiento < :hoy`, `= :hoy` o `between :manana and :limite`; `busqueda`
  con `lower(c.idCliente.nombreCompleto) like lower(concat('%', :busqueda, '%'))` (parámetros,
  nunca concatenar SQL). Después, **una** consulta para lo abonado de las cuotas de esa página:
  `select p.cuota.id, sum(p.importe) from Pago p where p.cuota.id in :ids and p.estatus = VIGENTE
  group by p.cuota.id`. `totalCuotas` = `calculadora_prestamos.numero_cuotas`.
- **Resumen**: `count` y suma de `importe_cuota` de las cuotas pendientes de hoy y vencidas, menos
  la suma de sus abonos vigentes (una consulta nativa con `LEFT JOIN` agrupado sobre `pago`), y
  una sobre `pago` con `estatus = 'VIGENTE'` y `fecha_registro` entre el inicio y el fin del día
  (calculados en `America/Mexico_City` y convertidos a UTC).
- **`diasAtraso`**: en Java, `max(0, ChronoUnit.DAYS.between(fechaVencimiento, hoy))`.

### 4.5 Relación con `diasMoratorios` y `alerta`

Hoy esos campos de la cuota se guardan con valores que manda el front. Con cobranza:

- `diasAtraso` se **calcula al consultar**; no se guarda (si no, se desactualiza cada día).
- `diasMoratorios` y `alerta` dejan de recibirse del front. Si se necesitan guardados para
  reportes, que los actualice una tarea diaria del back.

### 4.6 Cómo quedó implementado (2026-10-30)

Clases en el back (`com.crediexpress`):

| Capa | Clases |
| ---- | ------ |
| Controller | `CobranzaController` (`/operaciones-cobranza`); el usuario sale de `UsuarioAutenticado.de(jwt)` (correo o uid). |
| Servicios | `CobranzaConsultaService` (solo lectura) y `PagoService` (registrar, liquidar, cancelar), con sus `impl`. |
| Apoyo (`service/cobranza`) | `DatosPago` (valida y normaliza; solo existe si es válido), `LlaveIdempotencia`, `IdempotenciaPago` (huella SHA-256), `SaldosCuotas` (abonos de varias cuotas en una consulta), `OperacionPago` (fábrica de renglones de `pago`), `CobranzaMapper`, `ResultadoOperacion`, `MensajesCobranza`. |
| Datos | Entidad `Pago` (sin setters; solo `asignarFolio`, `compartirFolio` y `cancelar`), enums `MetodoPago`, `TipoPago`, `EstatusPago`, `SituacionCuota`, `InstanteUtcConverter`; `CuotaSpecs` y `PagoSpecs` (patrón Specification) para las listas. |
| Dominio en la cuota | `EstadoPrestamos.saldo(abonado)`, `aplicarAbonos(abonado, fecha)`, `situacion(hoy)`, `diasAtraso(hoy)`. |

Concurrencia: registrar y liquidar bloquean **todas las cuotas con saldo del préstamo**
(`FOR UPDATE`, ordenadas por `numero_cuota`) antes de revisar la llave y los saldos, y corren en
`READ_COMMITTED`: dos cobros al mismo préstamo van uno tras otro y el segundo ve lo que guardó el
primero. Cancelar bloquea primero los renglones del folio y luego sus cuotas.

Diferencias con lo propuesto arriba:

- 400 de parámetros (`situacion`, `fecha`, `tamano`…): `mensaje` es "Revisa los parámetros de la
  petición." y el detalle va en `campos` (p. ej. "Usa VENCIDA, HOY o PROXIMA.", "Usa el formato
  aaaa-mm-dd."). Un enum inválido en el cuerpo (`"metodoPago": "CHEQUE"`) también llega en `campos`.
- 409 "El préstamo no está vigente" no se usa: un préstamo es vigente mientras tenga cuotas con saldo,
  así que ese caso ya responde "Esta cuota ya está pagada."
- Cancelar un pago de otro día → 409 "Solo se pueden cancelar pagos registrados hoy."
- Nuevo 409 genérico si dos operaciones chocan en la base (bloqueo que no se obtuvo a tiempo o
  restricción única): "Otra operación modificó estos datos al mismo tiempo. Actualiza la pantalla e
  intenta de nuevo."
- La repetición de una liquidación también responde 200 con "Este pago ya estaba registrado."
- En una liquidación, `prestamo_liquidado = true` solo en el último renglón.
- Huella de idempotencia: operación + id de cuota o préstamo + datos ya normalizados (importe,
  recargo, fecha, método, referencia y nota recortadas). Repetir con espacios de más no cuenta como
  "otros datos".

---

## 5. Cómo usa el front cada campo

| Pantalla                     | Campo(s)                                                                  |
| ---------------------------- | ------------------------------------------------------------------------- |
| Tarjetas del día             | `resumen.porCobrarHoy`, `vencido`, `cobrado` (`cuotas`/`pagos` e `importe`) |
| Contadores de las pestañas   | `totalElementos` de `cuotas-pendientes` (una llamada por situación) y de `pagos` |
| Fila de cuota                | `cliente.nombreCompleto`, `cliente.telefono`, `numeroCuota`/`totalCuotas` ("Pago 2 de 8"), `idPrestamo` + `modalidad.descripcion`, `fechaVencimiento`, `situacion` + `diasAtraso` ("12 días de atraso", "Vence hoy", "En 3 días"), `saldoCuota`, `importeAbonado`/`importeCuota` si hay abono |
| Diálogo "Registrar pago"     | Lo mismo de la fila; importe inicial = `saldoCuota`; tope = `saldoCuota`   |
| Recibo                       | `folio`, `cliente.nombreCompleto`, `idPrestamo`, `numeroCuota`/`totalCuotas`, `metodoPago` + `referencia`, `fechaPago`, `importe`, `saldoCuota` / `cuotaLiquidada` |
| Pestaña "Cobrado hoy"        | `folio`, `cliente.nombreCompleto`, `numeroCuota`/`totalCuotas`, `idPrestamo`, `tipo`, `metodoPago`, hora de `fechaRegistro`, `importe` |
| Errores                      | `mensaje` tal cual; `campos` se pinta bajo cada campo del diálogo         |

Después de registrar un pago, el front vuelve a pedir `resumen`, las tres pestañas de cuotas y `pagos`.

Implementación en el front (2026-10-30): `src/app/features/cobranza/`. Las cuatro listas se piden
en paralelo con `tamano=100` (`pagos` con `estatus=VIGENTE`) y la búsqueda filtra en el navegador; los
renglones de una liquidación se agrupan por folio en "Cobrado hoy". El `Idempotency-Key` se genera al
abrir el diálogo (uno para el pago y otro para la liquidación) y se repite en los reintentos. El
recibo PNG se dibuja con canvas (`recibo-png.ts`); el logotipo sale de `NG_APP_LOGO_URL`.

---

## 6. Pruebas del back

`@WebMvcTest` para el controller y Testcontainers (MySQL) para el servicio, con un `Clock` fijo.

- [ ] Pago completo: cuota liquidada, `tipo = CUOTA_COMPLETA`, folio `P-…`, 201.
- [ ] Abono parcial: `importeAbonado` sube, `estado_pago = 2` y la cuota sigue en pendientes con el saldo nuevo.
- [ ] Pago que liquida la cuota: `estado_pago = 3` y `fecha_pago` = fecha del pago.
- [ ] Último pago del préstamo: `prestamoLiquidado = true` y el préstamo ya no aparece en pendientes.
- [ ] Cuota con `importe_cuota` FLOAT (p. ej. 788.57): pagar "788.57" la deja en saldo 0 exacto.
- [ ] Importe > saldo → 409; importe 0 o con 3 decimales → 400 con `campos`.
- [ ] Fecha futura o de hace 31 días → 400.
- [ ] Transferencia sin referencia → 400; efectivo con referencia → se guarda `null`.
- [ ] Cuota ya pagada → 409; cuota inexistente → 404; préstamo no vigente → 409.
- [ ] Misma `Idempotency-Key` dos veces → un solo pago, segunda respuesta 200 con el mismo folio.
- [ ] Misma llave con otro importe → 409.
- [ ] Dos pagos simultáneos a la misma cuota que juntos superan el saldo → uno 201 y otro 409.
- [ ] `registradoPor` sale del token aunque el cuerpo traiga otro valor.
- [ ] `cuotas-pendientes`: filtros por situación, orden, búsqueda sin acentos ("martinez" encuentra "MARTÍNEZ"), paginación.
- [ ] `resumen`: suma saldos (no importes) y no cuenta pagos cancelados.
- [ ] Cancelar pago: la cuota vuelve a tener saldo; cancelar dos veces → 409.
- [ ] Recargo: se guarda aparte, no reduce el saldo y suma en "cobrado"; en cuota no vencida → 400.
- [ ] Liquidación: un renglón de `pago` por cuota pendiente con el mismo folio, todas en `estado_pago = 3`, `clienteSinAdeudos` correcto; importe distinto del saldo → 409.
- [ ] Cancelar un renglón de una liquidación cancela todos los del folio.
- [ ] Sin token → 401 en todos los endpoints.

---

## 7. Decisiones de negocio

Acordadas (2026-10-30):

1. **Abonos parciales**: sí, en la misma cuota, con la tabla `pago` (§4.1).
2. **Recargo por atraso**: sí, **monto libre** a criterio del cobrador, solo en cuotas vencidas; no
   reduce el saldo (§3.3, §3.7).
3. **Liquidación anticipada**: botón "Liquidar préstamo" con un solo importe (el saldo total); el
   back liquida cuota por cuota y el cliente queda sin adeudos si no tiene otros préstamos (§3.7).

Propuestas que se aplican mientras no se diga otra cosa:

4. **Orden de las cuotas**: no se puede abonar a una cuota si una anterior del mismo préstamo sigue
   pendiente (409).
5. **Adelantos sueltos**: un pago mayor al saldo de la cuota se rechaza; para pagar de más está la
   liquidación.
6. **Cancelar pagos**: cualquier usuario (no hay roles), el mismo día del registro, con motivo
   obligatorio; queda quién y cuándo.

Acordadas después (2026-10-30):

7. **Sin descuento por liquidar antes**: el importe de la liquidación es exactamente el saldo,
   incluido el interés de las cuotas futuras.
8. **Recibo**: se entrega en cuanto el pago (o la liquidación) queda registrado. Una liquidación usa `RECIBO_<primera>_a_<última>_de_<total>` en el nombre del archivo. En el diálogo "Pago registrado" hay un
   botón **"Crear recibo"** que descarga un **PNG** del mismo tamaño que el diálogo en pantalla
   (a la densidad de la pantalla), con el nombre `PAGO_NOMBRE_CLIENTE_RECIBO_X_de_X.png`: nombre
   sin acentos, en mayúsculas y con `_`; `X_de_X` = número de cuota y total de cuotas
   (`PAGO_MARIA_FERNANDA_LOPEZ_RUIZ_RECIBO_2_de_8.png`). Por ahora no se imprime. El diálogo y el
   recibo llevan el **logotipo del negocio, configurable** (en el front: una URL en la configuración;
   mientras no exista, el logotipo temporal). El recibo sale siempre en colores claros y muestra
   folio, cliente, préstamo y pago, método y referencia, fecha del pago, fecha y hora del registro,
   importe aplicado, recargo y total recibido (si hubo recargo) y el saldo de la cuota.
9. **Campo "Importe recibido"** (y "Recargo"): formato de moneda de México con separador de miles y
   dos decimales (`1,110.00`); acepta lo que se teclee con o sin comas y lo formatea al salir del campo.

Si cambia alguna, se ajusta este documento antes de programar.
