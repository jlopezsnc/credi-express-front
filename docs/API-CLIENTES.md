# API de clientes — contrato front ↔ back

Base: `http://localhost:8080/api/operaciones-cliente` (en el front: `apiUrl('/operaciones-cliente/...')`).
Todas las rutas exigen `Authorization: Bearer <idToken de Firebase>`.

Estado al 2026-10-30:

| Endpoint                          | Estado en el back | Lo usa el front            |
| --------------------------------- | ----------------- | -------------------------- |
| `GET cliente-lst`                 | ✅ Existe         | Lista de clientes          |
| `POST cliente-agregar`            | ✅ Existe         | Alta                       |
| `PUT cliente-actualizar/{id}`     | ✅ Hecho (sin MySQL) | Editar                  |
| `PUT cliente-baja/{id}`           | ⏳ Pendiente      | Dar de baja                |
| `PUT cliente-reactivar/{id}`      | ⏳ Pendiente      | Reactivar                  |
| Campo `estatusCliente`            | ⏳ Pendiente      | Filtros Activos/Inactivos  |

> **Los clientes nunca se eliminan.** Solo se dan de baja (`estatusCliente = "INACTIVO"`) para
> conservar su historial de préstamos y pagos. No debe existir un `DELETE`.

---

## Convenciones

### Sobre de respuesta

Todas las respuestas (éxito y error) usan el mismo sobre que ya devuelve `cliente-lst`:

```json
{
  "objetoResponse": {},
  "httpStatus": "OK",
  "mensaje": "Texto para el usuario"
}
```

- `objetoResponse`: el dato (un objeto, una lista o `null`).
- `httpStatus`: debe coincidir con el código HTTP real de la respuesta (`OK`, `CREATED`,
  `BAD_REQUEST`, `NOT_FOUND`, `CONFLICT`…). **El front decide éxito o error por el código HTTP**,
  no por este campo, así que un error nunca debe salir con código 200.
- `mensaje`: el front lo muestra tal cual en los errores, así que debe estar en español y ser
  entendible para el usuario (sin trazas ni nombres de clases).

### Errores

```json
{
  "objetoResponse": null,
  "httpStatus": "BAD_REQUEST",
  "mensaje": "Revisa los datos del cliente.",
  "campos": [{ "campo": "curp", "mensaje": "La CURP no es válida." }]
}
```

`campos` es opcional y solo aplica a errores de validación (400).

| Código | Cuándo                                                         |
| ------ | -------------------------------------------------------------- |
| 400    | Datos inválidos (ver validaciones)                             |
| 401    | Sin token o token vencido (lo resuelve Spring Security)        |
| 403    | Sin permiso                                                    |
| 404    | No existe un cliente con ese `idCliente`                       |
| 409    | Conflicto de negocio: CURP repetida, baja con préstamos activos |

### Validaciones del back (obligatorias aunque el front ya las haga)

| Campo               | Regla                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `nombreCompleto`    | Obligatorio, sin espacios al inicio/fin, máximo 150 caracteres.                           |
| `curp`              | Obligatoria, 18 caracteres, mayúsculas, formato RENAPO **y dígito verificador**, única.   |
| `telefono`          | Opcional; si viene, exactamente 10 dígitos (el front lo manda sin espacios).              |
| `correoElectronico` | Opcional; si viene, formato de correo válido.                                             |
| `domicilio*`        | Opcionales, máximo 150 caracteres.                                                        |

> Hallazgo: en la base actual hay CURP inválidas (`AEDO11223344HTCHR01` tiene 19 caracteres y
> `NASR101020MTCPRR01` no pasa el dígito verificador; el correcto sería `…RR02`). El front no deja
> guardar la edición de esos clientes hasta corregir la CURP. Referencia de la validación:
> `src/app/core/validation/curp.ts`.

Campos opcionales vacíos: el front envía `""`. Se recomienda que el back los guarde como `null`.

### Objeto `Cliente` (respuesta)

```json
{
  "idCliente": 1,
  "nombreCompleto": "JORGE LOPEZ SANCHEZ",
  "curp": "LOSJ881021HTCPNR07",
  "domicilioCalle": "AV LA JUVENTUD S/N",
  "domicilioColonia": "COLONIA CENTRO",
  "domicilioCiudad": "HUIMANGUILLO",
  "telefono": "9931567549",
  "correoElectronico": "jorge.lopez@gmail.com",
  "estatusCliente": "ACTIVO"
}
```

- `estatusCliente` (**pendiente**): `"ACTIVO"` o `"INACTIVO"`, nunca `null`. Al crear un
  cliente vale `"ACTIVO"`. Mientras el back no lo envíe, el front toma a todos como activos.
- Los demás campos opcionales pueden venir en `null`.

---

## `GET /cliente-lst` ✅

Devuelve todos los clientes, activos e inactivos (el front filtra).

**Respuesta 200**

```json
{
  "objetoResponse": [{ "idCliente": 1, "...": "objeto Cliente" }],
  "httpStatus": "OK",
  "mensaje": "3 registros encontrados."
}
```

Sin resultados: `objetoResponse: []` con 200 (no 404).

---

## `POST /cliente-agregar` ✅

**Request**

```json
{
  "nombreCompleto": "JUAN CORDOVA CORDOVA",
  "curp": "CORJ101020MTCPRR06",
  "telefono": "9171007543",
  "correoElectronico": "juancord@hotmail.com",
  "domicilioCalle": "CALLE PRINCIPAL",
  "domicilioColonia": "COLONIA PERIFERICO",
  "domicilioCiudad": "HUIMANGUILLO"
}
```

No se envían `idCliente` ni `estatusCliente`: los asigna el back (`estatusCliente = "ACTIVO"`).

**Respuesta 201** — `objetoResponse`: el cliente creado (objeto `Cliente` con su `idCliente`).

**Errores**: 400 validación · 409 `"Ya existe un cliente registrado con esta CURP."`

---

## `PUT /cliente-actualizar/{idCliente}` ✅

Reemplaza los datos capturables del cliente. **No** cambia `estatusCliente` (para eso están
baja y reactivar).

Implementado el 2026-10-30 con Bean Validation (`ActualizarClienteRequest`, `@CurpValida`). Los
límites son los de las columnas de `cliente` (no se cambió la tabla): nombre 100, calle 45,
colonia 30, ciudad 45, correo 40, teléfono 10 dígitos. Nombre y opcionales se guardan sin espacios
al inicio o al final, los opcionales vacíos como `null` y la CURP en mayúsculas.

**CURP obligatoria al editar.** Un cliente migrado del Excel sin CURP (`curp: null` en
`cliente-lst`) se puede seguir consultando y prestándole, pero para editarlo hay que capturarle
la CURP: así se completa su expediente la próxima vez que venga.

**Request** — mismo cuerpo que el alta (los 7 campos, todos presentes):

```json
{
  "nombreCompleto": "JUAN CORDOVA CORDOVA",
  "curp": "CORJ101020MTCPRR06",
  "telefono": "9171007543",
  "correoElectronico": "",
  "domicilioCalle": "CALLE PRINCIPAL",
  "domicilioColonia": "COLONIA PERIFERICO",
  "domicilioCiudad": "HUIMANGUILLO"
}
```

**Respuesta 200** — `objetoResponse`: el cliente actualizado.

**Errores**: 400 validación (`mensaje: "Revisa los datos del cliente."` y `campos`) · 404
`"No existe el cliente."` · 409 `"Ya existe otro cliente registrado con esta CURP."`

---

## `PUT /cliente-baja/{idCliente}` ⏳

Pone `estatusCliente = "INACTIVO"`. Sin cuerpo.

**Respuesta 200** — `objetoResponse`: el cliente con `estatusCliente: "INACTIVO"`,
`mensaje: "Cliente dado de baja."`

**Reglas**

- Si el cliente tiene préstamos activos → **409**
  `"El cliente tiene préstamos activos. Liquídalos o cancélalos antes de darlo de baja."`
- Si ya estaba inactivo → 200 sin cambios (idempotente).
- Un cliente inactivo no puede recibir préstamos nuevos (validarlo al crear préstamos).

**Errores**: 404 no existe · 409 préstamos activos.

---

## `PUT /cliente-reactivar/{idCliente}` ⏳

Pone `estatusCliente = "ACTIVO"`. Sin cuerpo.

**Respuesta 200** — `objetoResponse`: el cliente con `estatusCliente: "ACTIVO"`,
`mensaje: "Cliente reactivado."` Si ya estaba activo → 200 sin cambios.

**Errores**: 404 no existe.

---

## A futuro (propuesta, sin fecha)

Para recuperar las columnas y filtros de préstamos del diseño ("Con atraso", "Sin préstamo",
saldo pendiente), `cliente-lst` podría incluir un resumen por cliente:

```json
{
  "prestamosActivos": 1,
  "saldoPendiente": "9200.00",
  "conAtraso": true
}
```

`saldoPendiente` como **texto decimal** (BigDecimal serializado como string) para no perder
centavos. El front ya lee estos campos si llegan; mientras no, muestra "—".
