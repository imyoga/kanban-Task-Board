# Run as Administrator
$serviceName = "app13-45013-kanban-task-board"
$appDir      = "C:\Users\yoges\Desktop\Development\app13-45013-kanban-Task-Board"
$nssm        = "$appDir\nssm.exe"

if (-not (Test-Path $nssm)) {
    $fallback = "C:\Users\yoges\Desktop\Development\app12-45012-whiteboard\nssm.exe"
    if (Test-Path $fallback) {
        Copy-Item $fallback $nssm
    } else {
        Write-Error "nssm.exe not found at $nssm. Copy it from another app folder."
        exit 1
    }
}

New-Item -ItemType Directory -Force -Path "$appDir\logs" | Out-Null

$existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Stopping and removing existing service..."
    & $nssm stop $serviceName confirm 2>$null
    & $nssm remove $serviceName confirm
    Start-Sleep -Seconds 2
}

Write-Host "Installing $serviceName..."
& $nssm install $serviceName "$appDir\app.bat"
& $nssm set $serviceName AppDirectory $appDir
& $nssm set $serviceName DisplayName "Kanban Task Board"
& $nssm set $serviceName Description "Kanban task board on port 45013"
& $nssm set $serviceName Start SERVICE_AUTO_START
& $nssm set $serviceName AppStdout "$appDir\logs\stdout.log"
& $nssm set $serviceName AppStderr "$appDir\logs\stderr.log"
& $nssm set $serviceName AppRotateFiles 1
& $nssm set $serviceName AppRotateOnline 1
& $nssm set $serviceName AppRotateBytes 1048576

Write-Host "Starting $serviceName..."
& $nssm start $serviceName

Start-Sleep -Seconds 3
$svc = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
Write-Host "Service status: $($svc.Status)"
