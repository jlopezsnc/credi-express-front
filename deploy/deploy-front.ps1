<#
.SYNOPSIS
    Despliegue manual del front de Credi Express en GKE (docs §3.4).

.EXAMPLE
    .\deploy\deploy-front.ps1 -Version 0.1.0 -Proyecto mi-proyecto -Region us-central1 -Cluster crediexpress

.NOTES
    La configuración web de Firebase se lee de .env.production.local (no se sube al repo).
    Si cualquier paso falla, el script se detiene y NO se despliega.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [ValidatePattern('^\d+\.\d+\.\d+$')] [string] $Version,
    [Parameter(Mandatory)] [string] $Proyecto,
    [Parameter(Mandatory)] [string] $Region,
    [Parameter(Mandatory)] [string] $Cluster,
    [string] $Namespace = 'default'
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

$imagen = "$Region-docker.pkg.dev/$Proyecto/crediexpress/front:$Version"

# Variables públicas de Firebase para el build (no son secretos).
$envFile = Join-Path $raiz '.env.production.local'
if (-not (Test-Path $envFile)) { throw "Falta $envFile (copiar de .env.example)." }
$buildArgs = Get-Content $envFile |
    Where-Object { $_ -match '^\s*VITE_[A-Z_]+=' } |
    ForEach-Object { '--build-arg'; $_.Trim() }

Invoke-Paso 'Instalar dependencias' { npm ci }
Invoke-Paso 'Revisar tipos, lint, formato y pruebas' { npm run check }

$existe = git tag --list "front-v$Version"
if ($existe) { throw "La versión $Version ya existe (tag front-v$Version). Usa una versión nueva." }

Invoke-Paso 'Construir imagen' { docker build @buildArgs -t $imagen . }
Invoke-Paso 'Publicar imagen en Artifact Registry' { docker push $imagen }
Invoke-Paso 'Obtener credenciales del clúster' {
    gcloud container clusters get-credentials $Cluster --region $Region --project $Proyecto
}

Invoke-Paso 'Aplicar manifiestos' {
    kubectl apply -n $Namespace -f k8s/service.yaml -f k8s/networkpolicy.yaml
}
Invoke-Paso 'Aplicar Deployment con la nueva imagen' {
    (Get-Content k8s/deployment.yaml -Raw) -replace 'image: .+/front:[^\s]+', "image: $imagen" |
        kubectl apply -n $Namespace -f -
}

Write-Host '==> Esperando el rollout' -ForegroundColor Cyan
kubectl rollout status deployment/crediexpress-front -n $Namespace --timeout=180s
if ($LASTEXITCODE -ne 0) {
    Write-Warning 'El rollout falló. Regresando a la versión anterior.'
    kubectl rollout undo deployment/crediexpress-front -n $Namespace
    throw 'Despliegue revertido.'
}

git tag "front-v$Version"
Write-Host "Front $Version desplegado. Recuerda: git push origin front-v$Version" -ForegroundColor Green
