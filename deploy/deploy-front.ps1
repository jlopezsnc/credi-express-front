<#
.SYNOPSIS
    Despliegue manual del front de Crédito Expres en Firebase Hosting.

.DESCRIPTION
    1. npm ci y npm run check (tipos, lint, formato y pruebas). Si fallan, NO se despliega.
    2. npm run build con la configuración de .env.production.local.
    3. firebase deploy --only hosting. Hosting envía /api/** al servicio de Cloud Run del back
       (firebase.json), así que el back debe estar desplegado antes.
    Si una versión sale mal: Consola de Firebase > Hosting > historial de versiones > Revertir.

.EXAMPLE
    .\deploy\deploy-front.ps1 -Version 0.1.0

.NOTES
    La configuración web de Firebase se lee de .env.production.local (no se sube al repo; copiar de
    .env.example). La primera vez: npx firebase-tools@15.34.0 login
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [ValidatePattern('^\d+\.\d+\.\d+$')] [string] $Version,
    [string] $Proyecto = 'credi-express-app'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

function Invoke-Paso([string] $Nombre, [scriptblock] $Accion) {
    Write-Host "==> $Nombre" -ForegroundColor Cyan
    & $Accion
    if ($LASTEXITCODE -ne 0) { throw "Falló: $Nombre (código $LASTEXITCODE). No se despliega." }
}

# Versión fija de la CLI de Firebase (no se instala global).
$firebase = 'firebase-tools@15.34.0'

if (git tag --list "front-v$Version") { throw "La versión $Version ya existe (tag front-v$Version). Usa una versión nueva." }

# Variables públicas de Firebase para el build (no son secretos). scripts/generar-env.mjs les da
# prioridad sobre .env.local.
$envFile = Join-Path $raiz '.env.production.local'
if (-not (Test-Path $envFile)) { throw "Falta $envFile (copiar de .env.example)." }
Get-Content $envFile | Where-Object { $_ -match '^\s*(NG_APP_[A-Z_]+)=(.*)$' } | ForEach-Object {
    Set-Item -Path "env:$($Matches[1])" -Value $Matches[2].Trim()
}

Invoke-Paso 'Instalar dependencias' { npm ci }
Invoke-Paso 'Revisar tipos, lint, formato y pruebas' { npm run check }
Invoke-Paso 'Build de producción' { npm run build }
Invoke-Paso 'Publicar en Firebase Hosting' {
    npx --yes $firebase deploy --only hosting --project $Proyecto --message "front-v$Version"
}

# Verifica en el sitio publicado los headers de firebase.json (CSP y caché), que el emulador local
# no aplica, y que /api llegue al back.
$sitio = "https://$Proyecto.web.app"
Write-Host "==> Verificando $sitio" -ForegroundColor Cyan
$inicio = Invoke-WebRequest -Uri "$sitio/clientes" -UseBasicParsing
if (-not $inicio.Headers['Content-Security-Policy']) { throw 'El sitio no envía Content-Security-Policy. Revisa "headers" en firebase.json.' }
if ($inicio.Headers['Cache-Control'] -notmatch 'no-cache') { throw "index.html sale con Cache-Control '$($inicio.Headers['Cache-Control'])'; debe ser no-cache." }
$chunk = [regex]::Match($inicio.Content, '(main|chunk|polyfills|styles)-[A-Za-z0-9_-]{8}\.(js|css)').Value
if ($chunk) {
    $archivo = Invoke-WebRequest -Uri "$sitio/$chunk" -UseBasicParsing
    if ($archivo.Headers['Cache-Control'] -notmatch 'immutable') { throw "$chunk sale con Cache-Control '$($archivo.Headers['Cache-Control'])'; debe ser immutable." }
}
$salud = Invoke-RestMethod -Uri "$sitio/api/actuator/health" -TimeoutSec 90
if ($salud.status -ne 'UP') { throw "/api/actuator/health respondió '$($salud.status)': revisa el back en Cloud Run." }

git tag "front-v$Version"
Write-Host "Front $Version publicado en https://$Proyecto.web.app. Recuerda: git push origin front-v$Version" -ForegroundColor Green
