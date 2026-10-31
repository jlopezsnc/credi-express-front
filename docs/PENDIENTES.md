# Pendientes

Actualizado: 2026-10-30.

## Back

- [x] **Préstamos: el back recalcula** interés, total, cuotas (con ajuste de centavos en la última)
      y fechas, ignora los montos del front y asigna `estadoPago = 1`, `diasMoratorios = 0` y
      `fechaSolicitud`; valida modalidad, número de pagos, tasa y primer pago (2026-10-30).
      Pendiente: validar cliente activo cuando exista el estatus.
- [x] **Préstamos: la modalidad quincenal no existía en la base** (`V2__catalogo_modalidad.sql`, se
      aplica al arrancar el back).
- [x] Préstamos: `@Transactional`, `saveAll`, `findById`, `LocalDate` y `numeroCuota` entero.
- [ ] Préstamos: probar `calcular-pagos` contra MySQL real (las columnas son FLOAT).
- [ ] Préstamos: `buscar-ep/todo` con el sobre común, dinero como texto decimal y `numeroCuota`
      entero; endpoint de préstamos (encabezado con monto, tasa, total y saldo) con paginación,
      y `GET /{idPrestamo}/cuotas`; documentar `estadoPago`. Detalle: [API-PRESTAMOS.md](API-PRESTAMOS.md#get-buscar-eptodo-).
- [x] Cobranza: los 7 endpoints (`resumen`, `cuotas-pendientes`, `pago-registrar`, `pagos`,
      `pago-cancelar`, `prestamo-saldo`, `prestamo-liquidar`), tabla `pago` en `V3__pago.sql`
      (2026-10-30). Detalle: [API-COBRANZA.md](API-COBRANZA.md#46-cómo-quedó-implementado-2026-10-30).
- [ ] Cobranza: probar contra MySQL real (al arrancar, Flyway aplica V3: crea `pago`, un índice en
      `estado_prestamos` y pone `estado_pago = 1` a las cuotas sin estado ni fecha de pago).
- [x] Reportes: `GET /operaciones-reportes/cobranza` (por periodo, hasta 92 días) y `GET cartera`
      (2026-10-30). Detalle: [API-REPORTES.md](API-REPORTES.md).
- [ ] Reportes: probar contra MySQL real.
- [ ] Clientes: `cliente-lst` responde 404 sin cuerpo cuando no hay clientes; debe ser 200 con `[]`.
- [ ] Clientes: `cliente-agregar` exige calle, colonia y ciudad (en el front son opcionales) y
      truena si un campo llega `null`. Pasar a Bean Validation.
- [ ] Clientes: `PUT cliente-actualizar/{id}`, `PUT cliente-baja/{id}`, `PUT cliente-reactivar/{id}`
      y el campo `estatusCliente` (requiere una columna nueva en `cliente`). Detalle: [API-CLIENTES.md](API-CLIENTES.md).
- [ ] Clientes: validar la CURP (formato, dígito verificador y que no se repita) y corregir las
      dos CURP inválidas que ya están en la base.
- [ ] Clientes: confirmar que la baja se rechaza (409) si el cliente tiene préstamos activos.
- [ ] Clientes (a futuro): resumen de préstamos en `cliente-lst` (`prestamosActivos`,
      `saldoPendiente`, `conAtraso`).
- [ ] Base: el dinero está en columnas `FLOAT` (`importe_cuota`, `total_pagar`, …) y `numero_cuota`
      también es `FLOAT`. Mientras no se migren a `DECIMAL(12,2)`/`INT`, redondear a 2 decimales al
      leer (`BigDecimal.valueOf(x).setScale(2, HALF_UP)`).
- [x] Base: versionar el esquema con Flyway (línea base = `mysqldump --no-data` del 2026-10-30).
- [x] Manejador global de errores con el sobre común y `spring-boot-starter-validation`.
- [x] Seguridad sin roles: código de roles limpio y `SeguridadEndpointsTest` reescrito (commit `829c540`).
- [ ] Seguridad sin roles: lista blanca de UIDs y auditoría con el `sub` del token (§1.4 de
      `REVISION-BACK-Y-PROPUESTA-FRONT.md`).
- [ ] Quitar `install.cmd` del repo del back: está en `.gitignore` pero sigue versionado
      (`git rm --cached install.cmd` y commit).
- [ ] `JAVA_HOME` apunta a Java 8 (`C:\java_jdk\jdk1.8.0_121`) y Gradle no arranca; apuntarlo a
      `C:\Program Files\Java\jdk-21`.

## Negocio

- [ ] Límites del monto (hoy $1,000 a $50,000) y del interés mensual (hoy 12% por defecto, máximo 100%).
- [ ] ¿Quién puede cambiar el interés mensual? (sin roles: cualquier usuario del negocio).
- [ ] ¿Un cliente puede tener más de un préstamo activo a la vez?
- [x] Cobranza: **se aceptan abonos parciales** (2026-10-30); la diferencia queda en la misma cuota.
- [x] Cobranza: los abonos se guardan en una tabla nueva `pago` sin alterar las existentes (opción B,
      2026-10-30); `estado_pago` 1 = pendiente, 2 = abono parcial, 3 = pagada.
- [x] Cobranza: recargo por atraso con monto libre del cobrador y liquidación anticipada del
      préstamo completo (2026-10-30). Orden de cuotas, adelantos y cancelación: propuestas aplicadas.
- [x] Cobranza: sin descuento al liquidar antes; recibo en PNG con el botón "Crear recibo" y logotipo
      configurable (2026-10-30). Detalle: [API-COBRANZA.md](API-COBRANZA.md#7-decisiones-de-negocio).
- [ ] Logotipo definitivo del negocio (lo proporciona el usuario).

## Front

- [x] **Cobranza en Angular** (2026-10-30): resumen, pestañas, registrar pago (abono parcial y
      recargo), liquidar préstamo y recibo PNG con "Crear recibo" (`src/app/features/cobranza/`).
      El logotipo se configura con `NG_APP_LOGO_URL` (ruta del mismo dominio, p. ej. `/logo.png` en
      `public/`); vacío = logotipo temporal.
- [ ] Cobranza: probar la pantalla contra el back real (falta probar el back contra MySQL).
- [ ] Cobranza: botón para cancelar un pago del día (`pago-cancelar` ya existe en el back).
- [ ] Cobranza: paginación si un día pasa de 100 cuotas o pagos (hoy se piden 100 y se avisa
      "Mostrando 100 de N").

- [x] **Reportes en Angular** (2026-10-30): cobranza por periodo (totales, por día, por método y
      detalle por folio) y cartera (vencido, por vencer, antigüedad y clientes con atraso), con
      exportación a CSV.
- [ ] Reportes: exportar a PDF o `.xlsx` si hace falta (requiere una librería; decidir cuál).
- [ ] Reportes: cobranza esperada contra cobrada por semana (propuesta del dashboard, §4.2).

- [x] Clientes y Préstamos: orden por cualquier columna (clic en el encabezado; en el celular,
      "Ordenar por") y páginas de 10 (2026-10-30). Pieza reutilizable en `src/app/core/tabla/`.
- [x] **Fase 2 — cálculos en el back** (2026-10-30): Préstamos (Estado, Próximo pago, Pagos x de x,
      saldo con abonos, filtros y contadores) y Cobranza (días para vencer, totales del filtro,
      "Cobrado hoy" agrupado) vienen calculados del back; filtros, búsqueda, orden y páginas de 10 en
      SQL. Detalle: [API-PRESTAMOS.md](API-PRESTAMOS.md) y [API-COBRANZA.md](API-COBRANZA.md).
- [ ] Fase 2: probar contra MySQL real (`ConsultasCarteraSqlTest` las corre en H2 modo MySQL; la
      búsqueda sin acentos depende de la collation de MySQL).
- [ ] Préstamos: decidir si se retira `GET buscar-ep/todo` (la pantalla ya no lo usa).
- [ ] Cobranza: ordenar "Cobrado hoy" por columna (hoy va del más reciente al más antiguo).

- [x] Nuevo préstamo: "Imprimir simulación" (2026-10-30). Hoja para el cliente (`hoja-simulacion.ts`)
      con el resumen y el calendario completo, sin la fórmula del interés y sin exigir cliente; sale
      en colores claros (`.papel`) y el menú del shell no se imprime (`print:hidden`).
- [ ] Nuevo préstamo: probar la impresión en el navegador real (y "Guardar como PDF").
- [ ] Lista de préstamos: mostrar monto prestado y tasa cuando el back los envíe.
- [ ] Clientes: llenar "Préstamos" y "Saldo pendiente" con los préstamos de cada cliente.
- [ ] Cuando el back recalcule: enviar solo los datos capturados y quitar los campos fijos.
- [ ] Clientes: límites de longitud iguales a la base (`nombre_completo` 100, `domicilio_calle` 45,
      `domicilio_colonia` 30, `domicilio_ciudad` 45, `correo_electronico` 40) y corregir
      `API-CLIENTES.md`, que dice 150.

## Seguridad

- [ ] Rotar la llave SSH que estuvo en el historial de git.
- [ ] Desactivar el registro público de usuarios en Firebase Authentication.
- [ ] **Cambiar la contraseña de MySQL local:** la actual quedó en el historial del repo público
      del back (commit `db8084c`, rama `projecto_servicio_prestamos`). No reutilizarla en otro lado.

## Al final

- [ ] Pruebas de integración del back con Testcontainers (MySQL en Docker), incluida la de dos
      cobros simultáneos a la misma cuota, las consultas de cobranza (búsqueda sin acentos, orden,
      paginación, resumen) y la cancelación de una liquidación. Docker 27.5.1 ya está instalado;
      abrir Docker Desktop.
